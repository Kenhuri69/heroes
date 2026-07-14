import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import type { CombatUnitDef } from '../src/combat/types';
import type { BuildingDef, TownState } from '../src/town/types';
import { builtDwellings } from '../src/town/helpers';
import { testConfig, testMap } from './fixtures';
import { testBuildingCatalog, testTown, testUnitCatalogWithEconomy } from './town-fixtures';

/**
 * Upgrades d'unités (Alpha 4.11). Le dwelling amélioré est un bâtiment GRADUÉ
 * (niveau 1 = base, niveau 2 = amélioré) : recruter l'amélioré est déjà géré
 * par le moteur existant (DONNÉES pures, zéro règle nouvelle). La commande
 * `UpgradeUnits` (seul point d'extension) convertit une pile déjà recrutée.
 */
const ELITE = 'red-grunt-elite';

/** Catalogue = base + variante améliorée (`red-grunt-elite`, +stats, coût 90 or). */
function catalog(): Record<string, CombatUnitDef> {
  const base = testUnitCatalogWithEconomy();
  const grunt = base['red-grunt']!;
  return {
    ...base,
    [ELITE]: {
      ...grunt,
      stats: { ...grunt.stats, attack: grunt.stats.attack + 3 },
      recruitCost: { gold: 90 },
      growthPerWeek: 6,
    } as CombatUnitDef,
  };
}

/** `dwelling1` gradué : niveau 1 = red-grunt, niveau 2 = red-grunt-elite. */
function buildings(): Record<string, BuildingDef> {
  return {
    ...testBuildingCatalog(),
    dwelling1: {
      id: 'dwelling1',
      maxLevel: 2,
      levels: [
        { cost: { wood: 500 }, requires: [], effect: { type: 'dwelling', tier: 1, unitId: 'red-grunt' } },
        { cost: { gold: 400 }, requires: [], effect: { type: 'dwelling', tier: 1, unitId: ELITE } },
      ],
    },
  };
}

function startedGame(
  resources: Partial<ReturnType<typeof emptyResources>> = {},
  townOverrides: Partial<TownState> = {},
): GameState {
  const players: PlayerSetup[] = [{ id: 'p1', startingResources: { ...emptyResources(), ...resources } }];
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

describe('dwelling amélioré (données pures, zéro commande moteur)', () => {
  it('D3 — au niveau 2, la base ET l’améliorée restent recrutables (façon HoMM)', () => {
    const state = startedGame(
      { gold: 1000 },
      { buildings: { dwelling1: 2 }, stock: { [ELITE]: 10, 'red-grunt': 5 } },
    );
    // Les deux variantes exposées (base niveau 1, améliorée niveau 2).
    expect(builtDwellings(state.towns[0]!, buildings())).toEqual(['red-grunt', ELITE]);
    // Recrute l'amélioré : OK.
    const rec = apply(state, { type: 'RecruitUnits', townId: 'town-1', unitId: ELITE, count: 2 });
    expect(rec.state.towns[0]?.garrison).toEqual([{ unitId: ELITE, count: 2 }]);
    // La base reste recrutable — le stock accumulé avant l'amélioration n'est pas perdu.
    expect(validate(state, { type: 'RecruitUnits', townId: 'town-1', unitId: 'red-grunt', count: 1 })).toBeNull();
  });
});

describe('UpgradeUnits', () => {
  it('convertit la pile de garnison base→améliorée, débite le différentiel, émet UnitsUpgraded', () => {
    const state = startedGame(
      { gold: 1000 },
      { buildings: { dwelling1: 2 }, garrison: [{ unitId: 'red-grunt', count: 3 }] },
    );
    const { state: next, events } = apply(state, { type: 'UpgradeUnits', townId: 'town-1', unitId: 'red-grunt' });
    expect(next.towns[0]?.garrison).toEqual([{ unitId: ELITE, count: 3 }]);
    expect(next.players[0]?.resources.gold).toBe(1000 - 3 * (90 - 50)); // différentiel 40/unité
    expect(events).toContainEqual({
      type: 'UnitsUpgraded',
      townId: 'town-1',
      fromUnitId: 'red-grunt',
      toUnitId: ELITE,
      count: 3,
    });
  });

  it('fusionne avec une pile améliorée existante', () => {
    const state = startedGame(
      { gold: 1000 },
      { buildings: { dwelling1: 2 }, garrison: [{ unitId: 'red-grunt', count: 2 }, { unitId: ELITE, count: 1 }] },
    );
    const next = apply(state, { type: 'UpgradeUnits', townId: 'town-1', unitId: 'red-grunt' }).state;
    expect(next.towns[0]?.garrison).toEqual([{ unitId: ELITE, count: 3 }]);
  });

  it('rejette sans dwelling amélioré bâti (notUpgradable)', () => {
    const state = startedGame({ gold: 1000 }, { buildings: { dwelling1: 1 }, garrison: [{ unitId: 'red-grunt', count: 3 }] });
    expect(validate(state, { type: 'UpgradeUnits', townId: 'town-1', unitId: 'red-grunt' })?.code).toBe('notUpgradable');
  });

  it('rejette sans pile de base en garnison (notUpgradable)', () => {
    const state = startedGame({ gold: 1000 }, { buildings: { dwelling1: 2 }, garrison: [] });
    expect(validate(state, { type: 'UpgradeUnits', townId: 'town-1', unitId: 'red-grunt' })?.code).toBe('notUpgradable');
  });

  it('rejette si les ressources manquent (cannotAfford)', () => {
    const state = startedGame({ gold: 10 }, { buildings: { dwelling1: 2 }, garrison: [{ unitId: 'red-grunt', count: 3 }] });
    expect(validate(state, { type: 'UpgradeUnits', townId: 'town-1', unitId: 'red-grunt' })?.code).toBe('cannotAfford');
  });
});

describe('Revue 2026-07 — B22 : coût d’upgrade sur une ressource de faction', () => {
  // Id de ressource de faction OPAQUE (garde-fou CI « zéro faction dans le moteur »).
  const SPARK = 'spark';

  /** Élite dont le `recruitCost` porte une ressource de faction (4 spark/unité). */
  function stateWithFactionCost(spark: number): GameState {
    const base = startedGame(
      { gold: 1000 },
      { buildings: { dwelling1: 2 }, garrison: [{ unitId: 'red-grunt', count: 3 }] },
    );
    const cat = catalog();
    return {
      ...base,
      unitCatalog: { ...cat, [ELITE]: { ...cat[ELITE]!, recruitCost: { gold: 90, [SPARK]: 4 } } as CombatUnitDef },
      players: base.players.map((p) => ({ ...p, factionResources: { [SPARK]: spark } })),
    };
  }

  it('facture le différentiel de la ressource de faction (union des clés, pas les 7 core seules)', () => {
    const next = apply(stateWithFactionCost(100), { type: 'UpgradeUnits', townId: 'town-1', unitId: 'red-grunt' }).state;
    expect(next.towns[0]?.garrison).toEqual([{ unitId: ELITE, count: 3 }]);
    expect(next.players[0]?.resources.gold).toBe(1000 - 3 * 40); // différentiel or inchangé
    expect(next.players[0]?.factionResources[SPARK]).toBe(100 - 3 * 4); // 4/unité — escamotés avant B22
  });

  it('rejette si la ressource de faction manque (cannotAfford)', () => {
    // 11 < 3 × 4 : l'or suffit mais pas la ressource de faction.
    expect(
      validate(stateWithFactionCost(11), { type: 'UpgradeUnits', townId: 'town-1', unitId: 'red-grunt' })?.code,
    ).toBe('cannotAfford');
  });
});
