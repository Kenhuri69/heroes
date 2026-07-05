import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { armyStrength, playerPower } from '../src/core/power';
import { createEmptyState, emptyResources } from '../src/core/state';
import type { CombatUnitDef } from '../src/combat/types';
import { testConfig, testMap } from './fixtures';
import { testBuildingCatalog, testTown, testUnitCatalogWithEconomy } from './town-fixtures';

// Puissance (doc 08 §2.5) : Σ effectif × (PV + attaque + défense), héros +
// garnisons. Alimente le graphique de puissance de l'écran de fin de partie.

describe('armyStrength', () => {
  const catalog: Record<string, CombatUnitDef> = {
    knight: {
      id: 'knight',
      groupId: '',
      nativeTerrain: 'grass',
      stats: { hp: 10, attack: 4, defense: 6, damage: [2, 4], speed: 5 },
      abilities: [],
    },
  };

  it('somme effectif × (PV + attaque + défense)', () => {
    expect(armyStrength([{ unitId: 'knight', count: 3 }], catalog)).toBe(60); // 3 × 20
  });

  it('ignore une unité absente du catalogue', () => {
    expect(armyStrength([{ unitId: 'ghost', count: 5 }], catalog)).toBe(0);
  });
});

describe('playerPower', () => {
  it('agrège les armées de héros et les garnisons du joueur', () => {
    const catalog = testUnitCatalogWithEconomy();
    const garrison = [{ unitId: 'red-grunt', count: 2 }];
    const state = apply(createEmptyState(), {
      type: 'StartGame',
      seed: 1,
      players: [
        { id: 'p1', startingResources: emptyResources(), startingArmy: [{ unitId: 'red-grunt', count: 4 }] },
      ],
      map: testMap(),
      config: testConfig(),
      unitCatalog: catalog,
      buildingCatalog: testBuildingCatalog(),
      towns: [testTown({ garrison })],
    }).state;

    const hero = state.heroes.find((h) => h.playerId === 'p1')!;
    expect(playerPower(state, 'p1')).toBe(
      armyStrength(hero.army, catalog) + armyStrength(garrison, catalog),
    );
    expect(playerPower(state, 'p1')).toBeGreaterThan(0);
    expect(playerPower(state, 'personne')).toBe(0);
  });
});
