import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import { createEmptyState, type GameState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import type { ResolvedHeroDef } from '../src/hero/types';
import { heroActionsAllowed, heroArmyCap } from '../src/hero/skills';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import { testCatalog, testConfig, testMap } from './fixtures';

/**
 * Lot 3.1 (doc 18 C1) — perks structurels Might/Magic (signature MMHO) : effets
 * déclaratifs génériques `armySlotsBonus` (8ᵉ slot d'armée) et
 * `heroActionsPerRound` (2 actions de héros par round), portés par l'archétype
 * du roster via `config.hero.archetypeEffects` (clés opaques — aucun
 * `if (archetype)` dans le moteur).
 */

const MIGHT_HERO: ResolvedHeroDef = {
  factionId: 'fixture-faction',
  name: '@loc:hero.test.name',
  archetype: 'might',
  attributes: { attack: 2, defense: 2, power: 0, knowledge: 0 },
  specialtyId: '',
  specialtyEffects: [],
  startingSkills: {},
  startingSpells: [],
};

function configWithPerks() {
  const config = testConfig();
  config.hero = {
    ...config.hero,
    archetypeEffects: {
      might: [{ armySlotsBonus: 1 }],
      magic: [{ heroActionsPerRound: 1 }],
    },
  };
  return config;
}

/** StartGame : p1 = héros nommé Might (7 piles), p2 = héros générique. */
function startedGame(): GameState {
  const units = ['u-a', 'u-b', 'u-c', 'u-d', 'u-e', 'u-f', 'u-g'];
  const catalog = { ...testCatalog() };
  for (const u of units) catalog[u] = { ...testCatalog()['red-grunt']!, id: u };
  const players: PlayerSetup[] = [
    {
      id: 'p1',
      startingResources: { gold: 0, wood: 0, ore: 0, crystal: 0, gems: 0, sulfur: 0, mercury: 0 },
      startingArmy: units.map((u) => ({ unitId: u, count: 10 })),
      startingHeroId: 'might-hero',
    },
    {
      id: 'p2',
      startingResources: { gold: 0, wood: 0, ore: 0, crystal: 0, gems: 0, sulfur: 0, mercury: 0 },
      startingArmy: [{ unitId: 'red-grunt', count: 10 }],
    },
  ];
  const cmd: Command = {
    type: 'StartGame',
    seed: 1,
    players,
    map: testMap(),
    config: configWithPerks(),
    unitCatalog: catalog,
    buildingCatalog: {},
    towns: [],
    heroRoster: { 'might-hero': MIGHT_HERO },
  };
  return apply(createEmptyState(), cmd).state;
}

describe('création — perks posés paresseusement', () => {
  it('héros nommé Might : archetypeEffects posé ; héros générique : champ ABSENT (forme)', () => {
    const state = startedGame();
    const might = state.heroes.find((h) => h.playerId === 'p1')!;
    const generic = state.heroes.find((h) => h.playerId === 'p2')!;
    expect(might.archetypeEffects).toEqual([{ armySlotsBonus: 1 }]);
    expect('archetypeEffects' in generic).toBe(false);
    // Agrégation générique : cap 8 pour Might, budgets historiques pour le générique.
    expect(heroArmyCap(might)).toBe(8);
    expect(heroArmyCap(generic)).toBe(7);
    expect(heroActionsAllowed(might)).toBe(1);
    expect(heroActionsAllowed(generic)).toBe(1);
  });
});

describe('armySlotsBonus — 8ᵉ slot d’armée (Might)', () => {
  it('split vers une 8ᵉ pile accepté ; la 9ᵉ reste refusée', () => {
    const state = startedGame();
    const hero = state.heroes.find((h) => h.playerId === 'p1')!;
    expect(hero.army).toHaveLength(7);
    const r = apply(state, { type: 'SplitStack', heroId: hero.id, from: 0, count: 4 });
    expect(r.state.heroes.find((h) => h.id === hero.id)!.army).toHaveLength(8);
    // 9ᵉ pile : au-delà du cap 7+1 ⇒ refus (même code d'erreur qu'avant).
    expect(() =>
      apply(r.state, { type: 'SplitStack', heroId: hero.id, from: 0, count: 2 }),
    ).toThrowError(/invalidSplit|armée pleine/);
  });

  it('héros générique : le split au-delà de 7 reste refusé (régression)', () => {
    const state = startedGame();
    // p2 joue en second : on passe la main pour agir avec son héros.
    const p2Turn = apply(state, { type: 'EndTurn', playerId: 'p1' });
    const hero = p2Turn.state.heroes.find((h) => h.playerId === 'p2')!;
    let cur = p2Turn.state;
    for (let i = 0; i < 6; i++) {
      cur = apply(cur, { type: 'SplitStack', heroId: hero.id, from: 0, count: 1 }).state;
    }
    expect(cur.heroes.find((h) => h.id === hero.id)!.army).toHaveLength(7);
    expect(() => apply(cur, { type: 'SplitStack', heroId: hero.id, from: 0, count: 1 })).toThrowError(
      /invalidSplit|armée pleine/,
    );
  });
});

// ——— Actions de héros par round (Magic) — fixture de combat minimale ———

function stack(
  partial: Pick<CombatStack, 'id' | 'side' | 'slot' | 'unitId' | 'count' | 'pos'> & Partial<CombatStack>,
): CombatStack {
  return {
    firstHp: 100, retaliationsLeft: 1, waited: false, defending: false, ammo: null, spellCharges: 0,
    marks: 0, immobilizedRounds: 0, transformed: false, symbiosisStacks: 0, acted: false, statuses: [],
    ...partial,
  };
}

function combatState(heroEffects: { heroActionsPerRound?: number }[] | undefined): GameState {
  const catalog: Record<string, CombatUnitDef> = {
    grunt: { id: 'grunt', groupId: 'g', nativeTerrain: 'grass',
      stats: { hp: 100, attack: 5, defense: 5, damage: [1, 1], speed: 6 }, abilities: [] },
    wall: { id: 'wall', groupId: 'g', nativeTerrain: 'grass',
      stats: { hp: 10000, attack: 0, defense: 5, damage: [1, 1], speed: 1 }, abilities: [] },
  };
  const combat: CombatState = {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [],
    stacks: [
      stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'grunt', count: 5, pos: { col: 0, row: 5 } }),
      stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'wall', count: 1, firstHp: 10000, pos: { col: 14, row: 5 } }),
    ],
    activeStackId: 'attacker-0', playerSide: 'attacker', heroId: 'hero-1', guardianObjectId: null,
    townId: null, wallDefenseBonus: 0, finished: false, attackerHeroId: 'hero-1', defenderHeroId: null,
    heroCastThisRound: [], heroAttackUsed: [], winner: null,
  };
  const config = testConfig();
  config.combat = { ...config.combat, heroAttack: { base: 5, perPower: 0, perAttack: 0 } };
  const base = createEmptyState();
  return {
    ...base,
    started: true,
    rng: seedRng(1),
    config,
    unitCatalog: catalog,
    combat,
    players: [{ ...basePlayer('p1') }],
    currentPlayer: 0,
    heroes: [
      {
        id: 'hero-1', playerId: 'p1', name: '', pos: { x: 0, y: 0 }, movementPoints: 0,
        army: [{ unitId: 'grunt', count: 5 }], xp: 0, level: 1,
        attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, mana: 0, manaMax: 0,
        skills: {}, visitLuck: 0, visitMorale: 0, spells: [], artifacts: Array.from({ length: 10 }, () => null),
        backpack: [], pendingSkillChoices: [], pendingAttributeChoices: [], factionId: '', houseId: '',
        houseEffects: [], specialtyId: '', specialtyEffects: [], warMachines: [], rosterId: '',
        ...(heroEffects ? { archetypeEffects: heroEffects } : {}),
      },
    ],
  };
}

function basePlayer(id: string) {
  const empty = createEmptyState();
  void empty;
  return {
    id,
    resources: { gold: 0, wood: 0, ore: 0, crystal: 0, gems: 0, sulfur: 0, mercury: 0 },
    factionResources: {}, explored: [], eliminated: false, townlessDays: -1, huntContract: null,
    obelisksVisited: [], hasGrail: false, team: 0,
  };
}

describe('heroActionsPerRound — 2 actions de héros par round (Magic)', () => {
  it('avec le perk : deux frappes de héros dans le même round, la 3ᵉ refusée', () => {
    const state = combatState([{ heroActionsPerRound: 1 }]);
    const r1 = apply(state, { type: 'HeroAttack', targetStackId: 'defender-0' });
    const r2 = apply(r1.state, { type: 'HeroAttack', targetStackId: 'defender-0' });
    expect(r2.state.combat?.heroAttackUsed).toEqual(['attacker', 'attacker']);
    expect(() => apply(r2.state, { type: 'HeroAttack', targetStackId: 'defender-0' })).toThrowError(
      /heroAttackUsed|épuisé/,
    );
  });

  it('sans le perk : la 2ᵉ action du round reste refusée (régression doc 02 §1)', () => {
    const state = combatState(undefined);
    const r1 = apply(state, { type: 'HeroAttack', targetStackId: 'defender-0' });
    expect(() => apply(r1.state, { type: 'HeroAttack', targetStackId: 'defender-0' })).toThrowError(
      /heroAttackUsed|épuisé/,
    );
  });
});
