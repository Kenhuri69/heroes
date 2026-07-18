import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import { seedRng } from '../src/core/rng';
import { createEmptyState, emptyResources, type GameState, type HeroState } from '../src/core/state';
import type { ArmyStack } from '../src/combat/types';
import { testCatalog, testConfig, testMap } from './fixtures';

/**
 * Lot UX-HEROSWAP — transfert d'armée/artefacts entre deux héros du MÊME joueur
 * sur des tuiles adjacentes (doc 02 §1.5, doc 08 §2.3). Commande GÉNÉRIQUE,
 * purement déterministe (aucun RNG), aucun champ d'état nouveau.
 */

function hero(
  id: string,
  pos: { x: number; y: number },
  over: { army?: ArmyStack[]; artifacts?: (string | null)[]; playerId?: string } = {},
): HeroState {
  return {
    id,
    playerId: over.playerId ?? 'p1',
    name: '',
    pos,
    movementPoints: 1500, naval: false,
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

function state(heroes: HeroState[]): GameState {
  const s = createEmptyState();
  s.started = true;
  s.config = testConfig();
  s.rng = seedRng(1);
  s.map = testMap();
  s.currentPlayer = 0;
  s.unitCatalog = testCatalog();
  s.players = [
    { id: 'p1', resources: { ...emptyResources() }, factionResources: {}, explored: [], controller: 'human', eliminated: false, townlessDays: 0, huntContract: null, team: 0 },
    { id: 'p2', resources: { ...emptyResources() }, factionResources: {}, explored: [], controller: 'ai', eliminated: false, townlessDays: 0, huntContract: null, team: 0 },
  ];
  s.heroes = heroes;
  return s;
}

const armyTransfer = (slot = 0) =>
  ({ type: 'TransferBetweenHeroes' as const, fromHeroId: 'a', toHeroId: 'b', kind: 'army' as const, slot });
const artifactTransfer = (slot = 0) =>
  ({ type: 'TransferBetweenHeroes' as const, fromHeroId: 'a', toHeroId: 'b', kind: 'artifact' as const, slot });

describe('UX-HEROSWAP — TransferBetweenHeroes', () => {
  it('transfère une pile d’armée vers le héros voisin', () => {
    const s = state([
      hero('a', { x: 3, y: 3 }, { army: [{ unitId: 'red-grunt', count: 10 }, { unitId: 'red-archer', count: 4 }] }),
      hero('b', { x: 4, y: 4 }),
    ]);
    const { state: next } = apply(s, armyTransfer(0));
    const a = next.heroes.find((h) => h.id === 'a')!;
    const b = next.heroes.find((h) => h.id === 'b')!;
    expect(a.army).toEqual([{ unitId: 'red-archer', count: 4 }]);
    expect(b.army).toEqual([{ unitId: 'red-grunt', count: 10 }]);
  });

  it('fusionne dans une pile de même unité chez la cible', () => {
    const s = state([
      hero('a', { x: 3, y: 3 }, { army: [{ unitId: 'red-grunt', count: 10 }] }),
      hero('b', { x: 4, y: 3 }, { army: [{ unitId: 'red-grunt', count: 5 }] }),
    ]);
    const { state: next } = apply(s, armyTransfer(0));
    const b = next.heroes.find((h) => h.id === 'b')!;
    expect(b.army).toEqual([{ unitId: 'red-grunt', count: 15 }]);
  });

  it('refuse si la cible a déjà 7 piles distinctes (sans fusion possible)', () => {
    const full: ArmyStack[] = Array.from({ length: 7 }, (_, i) => ({ unitId: `u${i}`, count: 1 }));
    const s = state([
      hero('a', { x: 3, y: 3 }, { army: [{ unitId: 'red-grunt', count: 10 }] }),
      hero('b', { x: 4, y: 3 }, { army: full }),
    ]);
    expect(validate(s, armyTransfer(0))?.code).toBe('invalidTransfer');
  });

  it('transfère un artefact vers le 1er slot libre de la cible', () => {
    const aArts = Array.from({ length: 10 }, () => null) as (string | null)[];
    aArts[0] = 'sword';
    const bArts = Array.from({ length: 10 }, () => null) as (string | null)[];
    bArts[0] = 'shield';
    const s = state([
      hero('a', { x: 3, y: 3 }, { artifacts: aArts }),
      hero('b', { x: 4, y: 3 }, { artifacts: bArts }),
    ]);
    const { state: next } = apply(s, artifactTransfer(0));
    const a = next.heroes.find((h) => h.id === 'a')!;
    const b = next.heroes.find((h) => h.id === 'b')!;
    expect(a.artifacts[0]).toBeNull();
    expect(b.artifacts[1]).toBe('sword'); // slot 0 occupé par shield ⇒ va en slot 1
  });

  it('refuse le transfert d’artefact si la cible n’a aucun slot libre', () => {
    const aArts = Array.from({ length: 10 }, () => null) as (string | null)[];
    aArts[0] = 'sword';
    const bArts = Array.from({ length: 10 }, (_, i) => `art${i}`) as (string | null)[];
    const s = state([
      hero('a', { x: 3, y: 3 }, { artifacts: aArts }),
      hero('b', { x: 4, y: 3 }, { artifacts: bArts }),
    ]);
    expect(validate(s, artifactTransfer(0))?.code).toBe('invalidTransfer');
  });

  it('refuse un slot d’armée vide', () => {
    const s = state([hero('a', { x: 3, y: 3 }), hero('b', { x: 4, y: 3 })]);
    expect(validate(s, armyTransfer(0))?.code).toBe('invalidTransfer');
  });

  it('refuse si les héros ne sont pas adjacents', () => {
    const s = state([
      hero('a', { x: 3, y: 3 }, { army: [{ unitId: 'red-grunt', count: 10 }] }),
      hero('b', { x: 6, y: 6 }),
    ]);
    expect(validate(s, armyTransfer(0))?.code).toBe('notAdjacent');
  });

  it('refuse si un héros appartient à un autre joueur', () => {
    const s = state([
      hero('a', { x: 3, y: 3 }, { army: [{ unitId: 'red-grunt', count: 10 }] }),
      hero('b', { x: 4, y: 3 }, { playerId: 'p2' }),
    ]);
    expect(validate(s, armyTransfer(0))?.code).toBe('notYourHero');
  });

  it('refuse source = cible', () => {
    const s = state([hero('a', { x: 3, y: 3 }, { army: [{ unitId: 'red-grunt', count: 10 }] }), hero('b', { x: 4, y: 3 })]);
    expect(
      validate(s, { type: 'TransferBetweenHeroes', fromHeroId: 'a', toHeroId: 'a', kind: 'army', slot: 0 })?.code,
    ).toBe('invalidTransfer');
  });

  it('refuse pendant un combat', () => {
    const s = state([
      hero('a', { x: 3, y: 3 }, { army: [{ unitId: 'red-grunt', count: 10 }] }),
      hero('b', { x: 4, y: 3 }),
    ]);
    s.combat = {} as GameState['combat'];
    expect(validate(s, armyTransfer(0))?.code).toBe('combatActive');
  });
});
