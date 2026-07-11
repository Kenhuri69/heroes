import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { townBuildingAura } from '../src/town/economy';
import { seedRng } from '../src/core/rng';
import { createEmptyState, emptyResources, type GameState, type HeroState } from '../src/core/state';
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
