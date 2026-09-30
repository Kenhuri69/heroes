import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { createEmptyState, emptyResources, type GameState, type HeroState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { runAutoCombat } from '../src/combat/ai';
import type { GameEvent } from '../src/core/events';
import type { ArmyStack } from '../src/combat/types';
import type { TownState } from '../src/town/types';
import { townDefenseStrength } from '../src/town/capture';
import { testCatalog, testConfig, testMap } from './fixtures';

/**
 * LE7 D3 — siège avec héros visiteur (HoMM III) : le héros posté dans SA ville la
 * défend avec la garnison dans ses emplacements libres, murs compris ; la ville
 * tombe avec lui, ou la garnison reprend ses survivants s'il repousse l'assaut.
 */

function hero(id: string, playerId: string, pos: { x: number; y: number }, army: ArmyStack[]): HeroState {
  return {
    id, playerId, pos, movementPoints: 1500, naval: false, army, xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, mana: 0, manaMax: 0, skills: {},
    visitLuck: 0, visitMorale: 0, spells: [], artifacts: Array.from({ length: 10 }, () => null),
    pendingSkillChoices: [], pendingAttributeChoices: [], factionId: '', houseId: '', houseEffects: [],
    name: '', specialtyId: '', specialtyEffects: [], warMachines: [], rosterId: '',
  };
}

const TOWN_POS = { x: 7, y: 7 };

function siege(opts: {
  attacker: ArmyStack[];
  defender: ArmyStack[];
  garrison: ArmyStack[];
  rule?: boolean;
  fort?: number;
}): GameState {
  const s = createEmptyState();
  s.started = true;
  s.config = testConfig();
  if (opts.rule ?? true) s.config.siegeVisitingHero = true;
  s.rng = seedRng(7);
  s.map = testMap();
  s.currentPlayer = 0;
  const player = (id: string) => ({
    id, resources: emptyResources(), factionResources: {}, explored: [], controller: 'human' as const,
    eliminated: false, townlessDays: -1, huntContract: null, team: 0,
  });
  s.players = [player('p1'), player('p2')];
  s.heroes = [hero('h1', 'p1', { x: 7, y: 6 }, opts.attacker), hero('h2', 'p2', TOWN_POS, opts.defender)];
  s.heroes[1]!.artifacts[0] = 'relic';
  s.artifactCatalog = { relic: { id: 'relic', bonus: { attack: 1 } } };
  const town: TownState = {
    id: 't2', ownerPlayerId: 'p2', pos: TOWN_POS, factionId: '', buildings: opts.fort ? { fort: opts.fort } : {},
    builtToday: false, garrison: opts.garrison, stock: {}, spellPool: [], sharedGrowthChoice: {},
  };
  s.towns = [town];
  s.unitCatalog = testCatalog();
  return s;
}

const capture = (s: GameState) => apply(s, { type: 'CaptureTown', townId: 't2', playerId: 'p1' }).state;

function fight(s: GameState): { done: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const done = produce(s, (d) => runAutoCombat(d, events));
  return { done, events };
}

const wolves = (n: number, count = 1): ArmyStack[] => Array.from({ length: n }, () => ({ unitId: 'blue-wolf', count }));

describe('LE7 D3 — siège avec héros visiteur', () => {
  it('le héros d’abord, la garnison dans les emplacements libres, le surplus hors combat', () => {
    const next = capture(
      siege({
        attacker: [{ unitId: 'red-grunt', count: 10 }],
        defender: wolves(6),
        garrison: [{ unitId: 'red-grunt', count: 1 }, { unitId: 'red-grunt', count: 2 }, { unitId: 'red-grunt', count: 3 }],
        fort: 1,
      }),
    );
    const combat = next.combat!;
    expect(combat).toMatchObject({ townId: 't2', defenderHeroId: 'h2', wallDefenseBonus: 3 });
    expect(combat.siegeWalls?.length).toBeGreaterThan(0);
    const defenders = combat.stacks.filter((st) => st.side === 'defender');
    expect(defenders.filter((st) => !st.fromGarrison).map((st) => st.unitId)).toEqual(Array(6).fill('blue-wolf'));
    expect(defenders.filter((st) => st.fromGarrison).map((st) => st.count)).toEqual([1]);
    expect(next.towns[0]!.garrison).toEqual([{ unitId: 'red-grunt', count: 2 }, { unitId: 'red-grunt', count: 3 }]);
  });

  it('assaut réussi : le défenseur meurt (dépouille) et la ville tombe avec tout ce qui restait', () => {
    const started = capture(
      siege({ attacker: [{ unitId: 'red-grunt', count: 200 }], defender: wolves(7), garrison: [{ unitId: 'red-grunt', count: 1 }] }),
    );
    const { done } = fight(started);
    expect(done.combat).toBeNull();
    expect(done.heroes.map((h) => h.id)).toEqual(['h1']);
    expect(done.heroes[0]!.artifacts).toContain('relic');
    expect(done.towns[0]).toMatchObject({ ownerPlayerId: 'p1', garrison: [] });
  });

  it('assaut repoussé : le héros reprend ses piles, la garnison les siennes', () => {
    const started = capture(
      siege({
        attacker: [{ unitId: 'red-grunt', count: 1 }],
        defender: [{ unitId: 'blue-wolf', count: 100 }],
        garrison: [{ unitId: 'red-grunt', count: 5 }],
      }),
    );
    const { done } = fight(started);
    expect(done.heroes.map((h) => h.id)).toEqual(['h2']);
    expect(done.heroes[0]!.army.map((s) => s.unitId)).toEqual(['blue-wolf']);
    expect(done.towns[0]).toMatchObject({ ownerPlayerId: 'p2', garrison: [{ unitId: 'red-grunt', count: 5 }] });
  });

  it('l’assaillant fuit : chaque camp défenseur garde ses pertes, rendues au bon propriétaire', () => {
    const started = capture(
      siege({
        attacker: [{ unitId: 'red-grunt', count: 10 }],
        defender: [{ unitId: 'blue-wolf', count: 9 }],
        garrison: [{ unitId: 'red-grunt', count: 4 }],
      }),
    );
    const wounded = produce(started, (d) => {
      const c = d.combat!;
      c.stacks.find((st) => st.side === 'defender' && !st.fromGarrison)!.count = 6;
      c.stacks.find((st) => st.side === 'defender' && st.fromGarrison)!.count = 3;
      c.activeStackId = c.stacks.find((st) => st.side === 'attacker')!.id;
    });
    const done = apply(wounded, { type: 'Retreat' }).state;
    expect(done.combat).toBeNull();
    expect(done.heroes.find((h) => h.id === 'h2')!.army).toEqual([{ unitId: 'blue-wolf', count: 6 }]);
    expect(done.towns[0]!.garrison).toEqual([{ unitId: 'red-grunt', count: 3 }]);
  });

  it('ville sans garnison : siège (pas de rase campagne), prise dans le même combat', () => {
    const started = capture(siege({ attacker: [{ unitId: 'red-grunt', count: 200 }], defender: wolves(1), garrison: [] }));
    expect(started.combat).toMatchObject({ townId: 't2', defenderHeroId: 'h2' });
    expect(fight(started).done.towns[0]!.ownerPlayerId).toBe('p1');
  });

  it('marcher sur le héros posté dans sa ville mène au même siège', () => {
    const s = siege({ attacker: [{ unitId: 'red-grunt', count: 10 }], defender: wolves(1), garrison: [{ unitId: 'red-grunt', count: 1 }] });
    const next = apply(s, { type: 'MoveHero', heroId: 'h1', path: [TOWN_POS] }).state;
    expect(next.combat).toMatchObject({ townId: 't2', attackerHeroId: 'h1', defenderHeroId: 'h2' });
  });

  it('règle absente : le héros ne combat pas au siège d’une ville à garnison', () => {
    const next = capture(
      siege({ attacker: [{ unitId: 'red-grunt', count: 10 }], defender: wolves(1), garrison: [{ unitId: 'red-grunt', count: 1 }], rule: false }),
    );
    expect(next.combat).toMatchObject({ townId: 't2', defenderHeroId: null });
    expect(next.combat!.stacks.filter((st) => st.side === 'defender').map((st) => st.unitId)).toEqual(['red-grunt']);
  });

  it('IA : la force de la ville compte le héros qui la défend', () => {
    const args = { attacker: [], defender: [{ unitId: 'blue-wolf', count: 10 }], garrison: [{ unitId: 'red-grunt', count: 1 }] };
    expect(townDefenseStrength(siege(args), siege(args).towns[0]!)).toBeGreaterThan(
      townDefenseStrength(siege({ ...args, rule: false }), siege(args).towns[0]!),
    );
  });
});
