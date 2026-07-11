import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { townBuildingAura } from '../src/town/economy';
import { moraleOf } from '../src/combat/state-helpers';
import { seedRng } from '../src/core/rng';
import { createEmptyState, emptyResources, type GameState, type HeroState } from '../src/core/state';
import type { CombatStack, CombatState } from '../src/combat/types';
import type { BuildingDef, TownState } from '../src/town/types';
import { testConfig, testCatalog } from './fixtures';

/**
 * Lot F-BUILDEFF.1 — aura de bâtiment au héros présent (doc 03 §4 — Écuries),
 * option B (le héros doit se tenir sur la ville). Faction/bâtiment GÉNÉRIQUES :
 * (1) `townBuildingAura` somme l'aura des bâtiments construits de la ville du
 *     propriétaire où il se tient ; (2) `heroDailyMovement` ajoute
 *     `movementBonusFlat` à la restauration de PM du début de tour.
 */

function hero(over: Partial<HeroState>): HeroState {
  return {
    id: 'h1', playerId: 'p1', pos: { x: 5, y: 5 }, movementPoints: 0,
    army: [{ unitId: 'red-grunt', count: 1 }], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, mana: 0, manaMax: 0, skills: {},
    visitLuck: 0, spells: [], artifacts: Array.from({ length: 10 }, () => null), pendingSkillChoices: [],
    pendingAttributeChoices: [], factionId: '', houseId: '', houseEffects: [], name: '', specialtyId: '',
    specialtyEffects: [], warMachines: [], ...over,
  };
}

const AURA_CATALOG: Record<string, BuildingDef> = {
  stables: {
    id: 'stables', maxLevel: 1,
    levels: [{ cost: {}, requires: [], effect: { type: 'heroAura', movementBonusFlat: 400 } }],
  },
  statue: {
    id: 'statue', maxLevel: 1,
    levels: [{ cost: {}, requires: [], effect: { type: 'heroAura', combatMoraleBonus: 1 } }],
  },
  watchtower: {
    id: 'watchtower', maxLevel: 1,
    levels: [{ cost: {}, requires: [], effect: { type: 'heroAura', garrisonDefense: 3 } }],
  },
};

function town(over: Partial<TownState> = {}): TownState {
  return {
    id: 't1', ownerPlayerId: 'p1', pos: { x: 5, y: 5 }, factionId: '', buildings: { stables: 1 },
    builtToday: false, garrison: [], stock: {}, spellPool: [], sharedGrowthChoice: {}, ...over,
  };
}

describe('F-BUILDEFF.1 — townBuildingAura (pur)', () => {
  const state = (over: Partial<TownState>): GameState =>
    ({ ...createEmptyState(), buildingCatalog: AURA_CATALOG, towns: [town(over)] }) as GameState;

  it('somme l’aura pour le propriétaire présent sur la ville', () => {
    expect(townBuildingAura(state({}), 'p1', { x: 5, y: 5 }, 'movementBonusFlat')).toBe(400);
  });

  it('rien si le héros n’est pas sur la tuile de la ville', () => {
    expect(townBuildingAura(state({}), 'p1', { x: 9, y: 9 }, 'movementBonusFlat')).toBe(0);
  });

  it('rien pour un joueur qui ne possède pas la ville', () => {
    expect(townBuildingAura(state({}), 'p2', { x: 5, y: 5 }, 'movementBonusFlat')).toBe(0);
  });

  it('rien si le bâtiment d’aura n’est pas construit', () => {
    expect(townBuildingAura(state({ buildings: {} }), 'p1', { x: 5, y: 5 }, 'movementBonusFlat')).toBe(0);
  });
});

/** État minimal démarré : joueur p1 seul, un héros, une ville Écuries. */
function movementState(heroPos: { x: number; y: number }): GameState {
  const s = createEmptyState();
  s.started = true;
  s.config = testConfig();
  s.rng = seedRng(3);
  s.currentPlayer = 0;
  s.players = [
    { id: 'p1', resources: emptyResources(), factionResources: {}, explored: [], controller: 'human', eliminated: false, townlessDays: -1, huntContract: null, team: 0 },
  ];
  s.heroes = [hero({ pos: heroPos })];
  s.towns = [town()];
  s.unitCatalog = testCatalog();
  s.buildingCatalog = AURA_CATALOG;
  return s;
}

describe('F-BUILDEFF.1 — Écuries : +PM/jour au héros présent', () => {
  it('le héros sur la ville démarre son tour avec +400 PM vs ailleurs', () => {
    const onTown = apply(movementState({ x: 5, y: 5 }), { type: 'EndTurn', playerId: 'p1' }).state;
    const offTown = apply(movementState({ x: 9, y: 9 }), { type: 'EndTurn', playerId: 'p1' }).state;
    const mvOn = onTown.heroes[0]?.movementPoints ?? 0;
    const mvOff = offTown.heroes[0]?.movementPoints ?? 0;
    expect(mvOff).toBeGreaterThan(0); // base non nulle
    expect(mvOn - mvOff).toBe(400); // aura Écuries appliquée seulement sur la ville
  });
});

/** Combat de siège minimal : une pile défenseure (garnison) dans la ville `townId`. */
function siegeCombat(townId: string | null): { stack: CombatStack; combat: CombatState } {
  const stack: CombatStack = {
    id: 'defender-0', side: 'defender', slot: 0, unitId: 'red-grunt', count: 5, firstHp: 10,
    pos: { col: 11, row: 3 }, retaliationsLeft: 1, waited: false, defending: false, ammo: null,
    spellCharges: 0, marks: 0, immobilizedRounds: 0, transformed: false, symbiosisStacks: 0,
    acted: false, statuses: [],
  };
  const combat = {
    terrain: 'water', round: 1, obstacles: [], stacks: [stack], activeStackId: null,
    playerSide: 'attacker', heroId: null, guardianObjectId: null, townId, wallDefenseBonus: 0,
    attackerHeroId: null, defenderHeroId: null, heroCastThisRound: false, heroAttackUsed: [],
    finished: false, winner: null,
  } as unknown as CombatState;
  return { stack, combat };
}

describe('F-BUILDEFF.2 — Statue du Jugement : +moral à la garnison en siège', () => {
  const state = (buildings: Record<string, number>): GameState =>
    ({
      ...createEmptyState(),
      unitCatalog: testCatalog(),
      buildingCatalog: AURA_CATALOG,
      towns: [town({ buildings })],
    }) as GameState;

  it('la garnison défenseure gagne +1 moral quand la ville a une Statue', () => {
    const { stack, combat } = siegeCombat('t1');
    const withStatue = moraleOf(stack, combat, state({ statue: 1 }));
    const without = moraleOf(stack, combat, state({}));
    expect(withStatue - without).toBe(1);
  });

  it('hors siège (townId null) : aucune aura de moral', () => {
    const { stack, combat } = siegeCombat(null);
    expect(moraleOf(stack, combat, state({ statue: 1 }))).toBe(moraleOf(stack, combat, state({})));
  });
});

/** État de siège : p1 (humain) assiège la ville défendue de p2, buildings donnés. */
function defenseSiegeState(townBuildings: Record<string, number>): GameState {
  const s = createEmptyState();
  s.started = true;
  s.config = testConfig();
  s.rng = seedRng(4);
  s.currentPlayer = 0;
  s.players = [
    { id: 'p1', resources: emptyResources(), factionResources: {}, explored: [], controller: 'human', eliminated: false, townlessDays: -1, huntContract: null, team: 0 },
    { id: 'p2', resources: emptyResources(), factionResources: {}, explored: [], controller: 'ai', eliminated: false, townlessDays: 0, huntContract: null, team: 0 },
  ];
  s.heroes = [hero({ id: 'hero-p1', playerId: 'p1', pos: { x: 5, y: 5 }, movementPoints: 100 })];
  s.towns = [{ id: 't1', ownerPlayerId: 'p2', pos: { x: 5, y: 5 }, factionId: '', buildings: townBuildings, builtToday: false, garrison: [{ unitId: 'blue-wolf', count: 1 }], stock: {}, spellPool: [], sharedGrowthChoice: {} }];
  s.unitCatalog = testCatalog();
  s.buildingCatalog = AURA_CATALOG;
  return s;
}

describe('F-BUILDEFF.4 — Cercle Vigile : +défense de garnison au siège', () => {
  it('un bâtiment garrisonDefense majore le mur de siège', () => {
    const withTower = apply(defenseSiegeState({ watchtower: 1 }), { type: 'CaptureTown', townId: 't1', playerId: 'p1' }).state;
    const without = apply(defenseSiegeState({}), { type: 'CaptureTown', townId: 't1', playerId: 'p1' }).state;
    expect((withTower.combat?.wallDefenseBonus ?? 0) - (without.combat?.wallDefenseBonus ?? 0)).toBe(3);
  });
});
