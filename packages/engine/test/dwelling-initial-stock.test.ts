import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { testBuildingCatalog, testTown, testUnitCatalogWithEconomy } from './town-fixtures';
import { testConfig, testMap } from './fixtures';

/**
 * LE6 E2 — semaine offerte à la construction (HoMM III) : une habitation neuve
 * ouvre avec sa croissance hebdomadaire (grunt : 6/sem., Fort niveau 1).
 */

function started(rule: boolean): GameState {
  const players: PlayerSetup[] = [{ id: 'p1', startingResources: { ...emptyResources(), wood: 1000 } }];
  const config = testConfig();
  if (rule) config.dwellingInitialStock = true;
  const cmd: Command = {
    type: 'StartGame',
    seed: 1,
    players,
    map: testMap(),
    config,
    unitCatalog: testUnitCatalogWithEconomy(),
    buildingCatalog: testBuildingCatalog(),
    towns: [testTown({ buildings: { townHall: 1 }, stock: {} })],
  };
  return apply(createEmptyState(), cmd).state;
}

const build = (s: GameState) =>
  apply(s, { type: 'BuildStructure', townId: 'town-1', buildingId: 'dwelling1' }).state;

describe('LE6 E2 — stock initial d’habitation', () => {
  it('habitation neuve : une semaine de croissance, aussitôt recrutable', () => {
    expect(build(started(true)).towns[0]!.stock['red-grunt']).toBe(6);
  });

  it('règle absente : stock vide jusqu’à la semaine suivante', () => {
    expect(build(started(false)).towns[0]!.stock['red-grunt'] ?? 0).toBe(0);
  });
});
