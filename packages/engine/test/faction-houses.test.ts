import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { applyWeeklyGrowth } from '../src/town/economy';
import { seedRng } from '../src/core/rng';
import {
  createEmptyState,
  emptyResources,
  type GameState,
  type HeroState,
} from '../src/core/state';
import type { GameEvent } from '../src/core/events';
import type { TownState } from '../src/town/types';
import { testConfig, testCatalog } from './fixtures';
import { testBuildingCatalog, testTown, testUnitCatalogWithEconomy } from './town-fixtures';

/**
 * Lot F-HOUSES — effets de Maison **town-scoped** (doc 16 §3.1 — Le Blaireau),
 * option B : la Maison du héros du propriétaire présent SUR la tuile de la ville
 * s'applique à cette ville. Faction/Maison **génériques** (aucun nom réel) :
 * (1) `garrisonGrowthPct` majore la croissance hebdo ;
 * (2) `garrisonDefense` majore le bonus « murs » du siège ;
 * (3) effet **intermittent** : héros absent ⇒ aucun bonus.
 */

function hero(over: Partial<HeroState>): HeroState {
  return {
    id: 'h1', playerId: 'p1', pos: { x: 5, y: 5 }, movementPoints: 0, army: [], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, mana: 0, manaMax: 0, skills: {},
    visitLuck: 0, spells: [], artifacts: Array.from({ length: 10 }, () => null), pendingSkillChoices: [],
    pendingAttributeChoices: [], factionId: '', houseId: '', houseEffects: [], name: '', specialtyId: '',
    specialtyEffects: [], warMachines: [], ...over,
  };
}

/** Croissance hebdo d'une ville dwelling1 (red-grunt, +6/sem) avec un héros donné. */
function weeklyGrowth(heroes: HeroState[]): number {
  const town = testTown({ buildings: { dwelling1: 1 }, stock: { 'red-grunt': 0 } });
  const state = {
    ...createEmptyState(),
    unitCatalog: testUnitCatalogWithEconomy(),
    buildingCatalog: testBuildingCatalog(),
    towns: [town],
    heroes,
  } as GameState;
  const events: GameEvent[] = [];
  const next = produce(state, (draft) => applyWeeklyGrowth(draft, events));
  return next.towns[0]?.stock['red-grunt'] ?? 0;
}

describe('F-HOUSES — croissance hebdo town-scoped (Le Blaireau)', () => {
  it('un héros du propriétaire SUR la ville majore la croissance (+20 %)', () => {
    const onTown = hero({ pos: { x: 5, y: 5 }, houseEffects: [{ garrisonGrowthPct: 20 }] });
    expect(weeklyGrowth([onTown])).toBe(7); // floor(6 * 1.2) = 7
  });

  it('effet INTERMITTENT : héros ailleurs ⇒ croissance de base', () => {
    const away = hero({ pos: { x: 9, y: 9 }, houseEffects: [{ garrisonGrowthPct: 20 }] });
    expect(weeklyGrowth([away])).toBe(6); // floor(6 * 1) = 6, aucun bonus
  });

  it('un héros d’un AUTRE joueur sur la ville ne compte pas', () => {
    const enemyOnTown = hero({ playerId: 'p2', pos: { x: 5, y: 5 }, houseEffects: [{ garrisonGrowthPct: 20 }] });
    expect(weeklyGrowth([enemyOnTown])).toBe(6);
  });
});

/** État de siège : p1 attaque la ville de p2, p2 défend avec `defenderHero` optionnel sur la ville. */
function siegeState(defenderHero: HeroState | null): GameState {
  const s = createEmptyState();
  s.started = true;
  s.config = testConfig();
  s.rng = seedRng(7);
  s.currentPlayer = 0;
  s.players = [
    { id: 'p1', resources: emptyResources(), factionResources: {}, explored: [], controller: 'human', eliminated: false, townlessDays: -1, huntContract: null, team: 0 },
    { id: 'p2', resources: emptyResources(), factionResources: {}, explored: [], controller: 'ai', eliminated: false, townlessDays: 0, huntContract: null, team: 0 },
  ];
  const attacker = hero({ id: 'hero-p1', playerId: 'p1', pos: { x: 5, y: 5 }, movementPoints: 100, army: [{ unitId: 'red-grunt', count: 50 }] });
  s.heroes = defenderHero ? [attacker, defenderHero] : [attacker];
  const town: TownState = { id: 't1', ownerPlayerId: 'p2', pos: { x: 5, y: 5 }, factionId: '', buildings: {}, builtToday: false, garrison: [{ unitId: 'blue-wolf', count: 1 }], stock: {}, spellPool: [], sharedGrowthChoice: {} };
  s.towns = [town];
  s.unitCatalog = testCatalog();
  return s;
}

describe('F-HOUSES — défense de garnison town-scoped (Le Blaireau)', () => {
  it('un héros défenseur de Maison sur la ville ajoute son bonus au mur de siège', () => {
    const defender = hero({ id: 'hero-p2', playerId: 'p2', pos: { x: 5, y: 5 }, army: [], houseEffects: [{ garrisonDefense: 2 }] });
    const { state: next } = apply(siegeState(defender), { type: 'CaptureTown', townId: 't1', playerId: 'p1' });
    expect(next.combat?.wallDefenseBonus).toBe(2); // pas de Fort ⇒ 0 mur + 2 Maison
  });

  it('sans héros de Maison présent : aucun bonus de garnison', () => {
    const { state: next } = apply(siegeState(null), { type: 'CaptureTown', townId: 't1', playerId: 'p1' });
    expect(next.combat?.wallDefenseBonus).toBe(0);
  });
});
