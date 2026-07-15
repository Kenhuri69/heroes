import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import { seedRng } from '../src/core/rng';
import { createEmptyState, emptyResources, type GameState, type HeroState } from '../src/core/state';
import type { ArmyStack } from '../src/combat/types';
import { testCatalog, testConfig, testMap } from './fixtures';

/**
 * Lot H-VS-H — combat héros-vs-héros. Marcher sur un héros ENNEMI déclenche un
 * combat (`defenderHeroId` non-null) ; le perdant meurt ; les artefacts du vaincu
 * passent au vainqueur (dépouille), surplus déposé au sol.
 */

function hero(
  id: string,
  playerId: string,
  pos: { x: number; y: number },
  over: { army?: ArmyStack[]; artifacts?: (string | null)[] } = {},
): HeroState {
  return {
    id,
    playerId,
    name: '',
    pos,
    movementPoints: 1500,
    army: over.army ?? [],
    xp: 0,
    level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 },
    mana: 0,
    manaMax: 0,
    skills: {},
    visitLuck: 0,
    visitMorale: 0,
    spells: [],
    artifacts: over.artifacts ?? Array.from({ length: 10 }, () => null),
    pendingSkillChoices: [],
    pendingAttributeChoices: [],
    factionId: '',
    houseId: '',
    houseEffects: [],
    specialtyId: '',
    specialtyEffects: [],
    warMachines: [],
    rosterId: '',
  };
}

/** État à 2 joueurs (p1 actif), héros voisins en (2,2)/(3,3). `team` par joueur. */
function state(
  a: HeroState,
  b: HeroState,
  teams: [number, number] = [0, 0],
): GameState {
  const s = createEmptyState();
  s.started = true;
  s.config = testConfig();
  s.rng = seedRng(7);
  s.map = testMap();
  s.currentPlayer = 0;
  s.unitCatalog = testCatalog();
  s.players = [
    { id: 'p1', resources: { ...emptyResources() }, factionResources: {}, explored: [], controller: 'human', eliminated: false, townlessDays: 0, huntContract: null, team: teams[0] },
    { id: 'p2', resources: { ...emptyResources() }, factionResources: {}, explored: [], controller: 'ai', eliminated: false, townlessDays: 0, huntContract: null, team: teams[1] },
  ];
  s.heroes = [a, b];
  return s;
}

const stepOnto = { type: 'MoveHero' as const, heroId: 'a', path: [{ x: 3, y: 3 }] };

describe('H-VS-H — combat héros-vs-héros', () => {
  it('marcher sur un héros ennemi ouvre un combat avec les DEUX hero ids', () => {
    const s = state(
      hero('a', 'p1', { x: 2, y: 2 }, { army: [{ unitId: 'blue-wolf', count: 20 }] }),
      hero('b', 'p2', { x: 3, y: 3 }, { army: [{ unitId: 'red-grunt', count: 3 }] }),
    );
    const { state: next } = apply(s, stepOnto);
    expect(next.combat).not.toBeNull();
    expect(next.combat?.attackerHeroId).toBe('a');
    expect(next.combat?.defenderHeroId).toBe('b');
    // Le héros mouvant reste sur sa tuile (n'entre pas), comme un gardien.
    expect(next.heroes.find((h) => h.id === 'a')?.pos).toEqual({ x: 2, y: 2 });
  });

  it('attaquant vainqueur : le défenseur meurt et ses artefacts passent au vainqueur', () => {
    const bArts = Array.from({ length: 10 }, () => null) as (string | null)[];
    bArts[0] = 'sword';
    bArts[1] = 'shield';
    const s = state(
      hero('a', 'p1', { x: 2, y: 2 }, { army: [{ unitId: 'blue-wolf', count: 50 }] }),
      hero('b', 'p2', { x: 3, y: 3 }, { army: [{ unitId: 'red-grunt', count: 1 }], artifacts: bArts }),
    );
    const afterMove = apply(s, stepOnto).state;
    const { state: next } = apply(afterMove, { type: 'AutoCombat' });
    expect(next.combat).toBeNull();
    // Défenseur mort.
    expect(next.heroes.find((h) => h.id === 'b')).toBeUndefined();
    // Vainqueur toujours là, dépouille récupérée.
    const winner = next.heroes.find((h) => h.id === 'a')!;
    expect(winner.artifacts).toContain('sword');
    expect(winner.artifacts).toContain('shield');
    // XP accordée (PV ennemis tués × xpPerHpKilled).
    expect(winner.xp).toBeGreaterThan(0);
  });

  it('défenseur vainqueur : l’attaquant meurt, le défenseur survit et récupère la dépouille', () => {
    const aArts = Array.from({ length: 10 }, () => null) as (string | null)[];
    aArts[0] = 'relic';
    const s = state(
      hero('a', 'p1', { x: 2, y: 2 }, { army: [{ unitId: 'red-grunt', count: 1 }], artifacts: aArts }),
      hero('b', 'p2', { x: 3, y: 3 }, { army: [{ unitId: 'blue-wolf', count: 50 }] }),
    );
    const afterMove = apply(s, stepOnto).state;
    const { state: next } = apply(afterMove, { type: 'AutoCombat' });
    expect(next.combat).toBeNull();
    expect(next.heroes.find((h) => h.id === 'a')).toBeUndefined();
    const winner = next.heroes.find((h) => h.id === 'b')!;
    expect(winner.artifacts).toContain('relic');
  });

  it('surplus d’artefacts rangé au SAC du vainqueur quand il n’a plus de slot (jamais perdu)', () => {
    const winnerFull = Array.from({ length: 10 }, (_, i) => `w${i}`) as (string | null)[];
    const bArts = Array.from({ length: 10 }, () => null) as (string | null)[];
    bArts[0] = 'sword';
    const s = state(
      hero('a', 'p1', { x: 2, y: 2 }, { army: [{ unitId: 'blue-wolf', count: 50 }], artifacts: winnerFull }),
      hero('b', 'p2', { x: 3, y: 3 }, { army: [{ unitId: 'red-grunt', count: 1 }], artifacts: bArts }),
    );
    const afterMove = apply(s, stepOnto).state;
    const { state: next } = apply(afterMove, { type: 'AutoCombat' });
    // Plus de dépôt au sol : le surplus va dans le sac du vainqueur.
    expect(next.map?.objects.some((o) => o.type === 'artifact')).toBe(false);
    const winner = next.heroes.find((h) => h.id === 'a');
    expect(winner?.backpack).toContain('sword');
  });

  it('refuse de marcher sur un héros ALLIÉ (même équipe non nulle)', () => {
    const s = state(
      hero('a', 'p1', { x: 2, y: 2 }, { army: [{ unitId: 'blue-wolf', count: 20 }] }),
      hero('b', 'p2', { x: 3, y: 3 }, { army: [{ unitId: 'red-grunt', count: 3 }] }),
      [1, 1], // alliés
    );
    expect(validate(s, stepOnto)?.code).toBe('invalidPath');
  });

  it('refuse d’engager un héros ennemi avec une armée vide', () => {
    const s = state(
      hero('a', 'p1', { x: 2, y: 2 }, { army: [] }),
      hero('b', 'p2', { x: 3, y: 3 }, { army: [{ unitId: 'red-grunt', count: 3 }] }),
    );
    expect(validate(s, stepOnto)?.code).toBe('invalidArmy');
  });
});
