import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import type { CombatUnitDef } from '../src/combat/types';
import type { BuildingDef, TownState } from '../src/town/types';
import { applyWeeklyGrowth } from '../src/town/economy';
import { builtDwellings } from '../src/town/helpers';
import { testConfig, testMap } from './fixtures';
import { testBuildingCatalog, testTown, testUnitCatalogWithEconomy } from './town-fixtures';

/**
 * Lot E3 — choix exclusif AU NIVEAU : le niveau 2 d'une habitation propose deux
 * améliorations (`effect` = option 0, `alternatives[0]` = option 1). Le choix,
 * fait à la construction, décide de l'unité recrutable, de celle qui reçoit la
 * croissance et de la cible d'`UpgradeUnits`.
 */
const ELITE = 'red-grunt-elite';
const ALT = 'red-grunt-alt';

function catalog(): Record<string, CombatUnitDef> {
  const base = testUnitCatalogWithEconomy();
  const grunt = base['red-grunt']!;
  const variant = (attack: number): CombatUnitDef =>
    ({ ...grunt, stats: { ...grunt.stats, attack }, recruitCost: { gold: 90 }, growthPerWeek: 6 }) as CombatUnitDef;
  return { ...base, [ELITE]: variant(grunt.stats.attack + 3), [ALT]: variant(grunt.stats.attack + 5) };
}

function buildings(): Record<string, BuildingDef> {
  return {
    ...testBuildingCatalog(),
    dwelling1: {
      id: 'dwelling1',
      maxLevel: 2,
      levels: [
        { cost: { wood: 500 }, requires: [], effect: { type: 'dwelling', tier: 1, unitId: 'red-grunt' } },
        {
          cost: { gold: 400 },
          requires: [],
          effect: { type: 'dwelling', tier: 1, unitId: ELITE },
          alternatives: [{ type: 'dwelling', tier: 1, unitId: ALT }],
        },
      ],
    },
  };
}

function startedGame(townOverrides: Partial<TownState> = {}): GameState {
  const players: PlayerSetup[] = [{ id: 'p1', startingResources: { ...emptyResources(), gold: 5000 } }];
  const cmd: Command = {
    type: 'StartGame',
    seed: 1,
    players,
    map: testMap(),
    config: testConfig(),
    unitCatalog: catalog(),
    buildingCatalog: buildings(),
    towns: [{ ...testTown(), ...townOverrides }],
  };
  return apply(createEmptyState(), cmd).state;
}

const build = (choice?: number): Command => ({
  type: 'BuildStructure',
  townId: 'town-1',
  buildingId: 'dwelling1',
  ...(choice !== undefined ? { choice } : {}),
});

describe('lot E3 — alternatives au niveau d’un bâtiment', () => {
  it('l’option choisie est la seule amélioration recrutable, et le choix est mémorisé', () => {
    const town = apply(startedGame(), build(1)).state.towns[0]!;
    expect(town.levelChoices).toEqual({ 'dwelling1@2': 1 });
    expect(builtDwellings(town, buildings())).toEqual(['red-grunt', ALT]);
  });

  it('sans choix : option 0, et aucune trace dans la ville (forme de sauvegarde inchangée)', () => {
    const town = apply(startedGame(), build()).state.towns[0]!;
    expect(town.levelChoices).toBeUndefined();
    expect(builtDwellings(town, buildings())).toEqual(['red-grunt', ELITE]);
  });

  it('une option inexistante est refusée', () => {
    expect(validate(startedGame(), build(2))?.code).toBe('invalidLevelChoice');
    expect(validate(startedGame(), build(-1))?.code).toBe('invalidLevelChoice');
    // Le niveau 1 n'a pas d'alternative : seule l'option 0 existe.
    expect(validate(startedGame({ buildings: { townHall: 1, fort: 1 } }), build(1))?.code).toBe(
      'invalidLevelChoice',
    );
  });

  it('la croissance hebdo va à l’option choisie', () => {
    const state = structuredClone(apply(startedGame({ stock: {} }), build(1)).state);
    applyWeeklyGrowth(state, []);
    expect(state.towns[0]!.stock[ALT]).toBe(6);
    expect(state.towns[0]!.stock[ELITE]).toBeUndefined();
  });

  it('UpgradeUnits convertit la base vers l’option choisie', () => {
    let state = apply(startedGame({ garrison: [{ unitId: 'red-grunt', count: 3 }] }), build(1)).state;
    state = apply(state, { type: 'UpgradeUnits', townId: 'town-1', unitId: 'red-grunt' }).state;
    expect(state.towns[0]!.garrison).toEqual([{ unitId: ALT, count: 3 }]);
  });
});
