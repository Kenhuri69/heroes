import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import type { CombatUnitDef } from '../src/combat/types';
import { testConfig, testMap } from './fixtures';
import { testBuildingCatalog, testTown, testUnitCatalogWithEconomy } from './town-fixtures';

function startedGame(
  resources: Partial<ReturnType<typeof emptyResources>> = {},
  townOverrides: Partial<ReturnType<typeof testTown>> = {},
): GameState {
  const players: PlayerSetup[] = [{ id: 'p1', startingResources: { ...emptyResources(), ...resources } }];
  const cmd: Command = {
    type: 'StartGame',
    seed: 1,
    players,
    map: testMap(),
    config: testConfig(),
    unitCatalog: testUnitCatalogWithEconomy(),
    buildingCatalog: testBuildingCatalog(),
    towns: [{ ...testTown(), ...townOverrides }],
  };
  return apply(createEmptyState(), cmd).state;
}

describe('RecruitUnits', () => {
  it('recrute ≤ stock, ajoute à la garnison, débite le coût et émet UnitsRecruited', () => {
    // recruitCost 'red-grunt' = 50 or/unité (fixture), stock = 10.
    const state = startedGame({ gold: 1000 });
    const { state: next, events } = apply(state, {
      type: 'RecruitUnits',
      townId: 'town-1',
      unitId: 'red-grunt',
      count: 4,
    });
    expect(next.towns[0]?.garrison).toEqual([{ unitId: 'red-grunt', count: 4 }]);
    expect(next.towns[0]?.stock['red-grunt']).toBe(6);
    expect(next.players[0]?.resources.gold).toBe(1000 - 4 * 50);
    expect(events).toContainEqual({
      type: 'UnitsRecruited',
      townId: 'town-1',
      unitId: 'red-grunt',
      count: 4,
    });
  });

  it('fusionne avec une pile existante de la garnison', () => {
    const state = startedGame(
      { gold: 1000 },
      { garrison: [{ unitId: 'red-grunt', count: 2 }] },
    );
    const next = apply(state, {
      type: 'RecruitUnits',
      townId: 'town-1',
      unitId: 'red-grunt',
      count: 3,
    }).state;
    expect(next.towns[0]?.garrison).toEqual([{ unitId: 'red-grunt', count: 5 }]);
  });

  it('B1 — rejette un effectif non entier (pas de 2,5 créature)', () => {
    const state = startedGame({ gold: 1000 });
    expect(
      validate(state, { type: 'RecruitUnits', townId: 'town-1', unitId: 'red-grunt', count: 2.5 })?.code,
    ).toBe('invalidAction');
  });

  it('rejette un recrutement au-delà du stock (insufficientStock)', () => {
    const state = startedGame({ gold: 1000 });
    expect(
      validate(state, {
        type: 'RecruitUnits',
        townId: 'town-1',
        unitId: 'red-grunt',
        count: 11,
      })?.code,
    ).toBe('insufficientStock');
  });

  it('rejette une unité sans dwelling construit (notRecruitable)', () => {
    const state = startedGame({ gold: 1000 }, { stock: { 'red-grunt': 10, 'blue-wolf': 10 } });
    expect(
      validate(state, {
        type: 'RecruitUnits',
        townId: 'town-1',
        unitId: 'blue-wolf',
        count: 1,
      })?.code,
    ).toBe('notRecruitable');
  });

  it('rejette un coût insuffisant (cannotAfford)', () => {
    const state = startedGame({ gold: 10 });
    expect(
      validate(state, {
        type: 'RecruitUnits',
        townId: 'town-1',
        unitId: 'red-grunt',
        count: 5,
      })?.code,
    ).toBe('cannotAfford');
  });

  it('rejette un effectif non positif', () => {
    const state = startedGame({ gold: 1000 });
    expect(
      validate(state, {
        type: 'RecruitUnits',
        townId: 'town-1',
        unitId: 'red-grunt',
        count: 0,
      })?.code,
    ).toBe('invalidAction');
  });

  it('rejette une garnison pleine (7 piles distinctes)', () => {
    const fullGarrison = Array.from({ length: 7 }, (_, i) => ({
      unitId: `filler-${i}`,
      count: 1,
    }));
    const state = startedGame({ gold: 1000 }, { garrison: fullGarrison });
    expect(
      validate(state, {
        type: 'RecruitUnits',
        townId: 'town-1',
        unitId: 'red-grunt',
        count: 1,
      })?.code,
    ).toBe('invalidAction');
  });
});

/**
 * Dépense d'une ressource de faction au recrutement (plan phase-4.6, doc 05
 * §3.3) — un coût peut mêler ressources communes et de faction ; chaque clé est
 * débitée du bon stock. La ressource 'essence' est un id de test arbitraire ici
 * (aucun nom de faction), routé vers `player.factionResources`.
 */
describe('RecruitUnits — coût en ressource de faction', () => {
  function startedWithFactionCost(essence: number): GameState {
    const base = testUnitCatalogWithEconomy();
    const grunt = base['red-grunt'];
    if (!grunt) throw new Error('fixture red-grunt absente');
    const unitCatalog: Record<string, CombatUnitDef> = {
      ...base,
      'red-grunt': { ...grunt, recruitCost: { gold: 50, essence: 5 } } as CombatUnitDef,
    };
    const cmd: Command = {
      type: 'StartGame',
      seed: 1,
      players: [{ id: 'p1', startingResources: { ...emptyResources(), gold: 1000 } }],
      map: testMap(),
      config: testConfig(),
      unitCatalog,
      buildingCatalog: testBuildingCatalog(),
      towns: [testTown()],
    };
    const state = apply(createEmptyState(), cmd).state;
    return {
      ...state,
      players: state.players.map((p) =>
        p.id === 'p1' ? { ...p, factionResources: { essence } } : p,
      ),
    };
  }

  it('débite l’Essence et l’or, chacun de son stock', () => {
    const state = startedWithFactionCost(100);
    const next = apply(state, {
      type: 'RecruitUnits',
      townId: 'town-1',
      unitId: 'red-grunt',
      count: 4,
    }).state;
    expect(next.players[0]?.resources.gold).toBe(1000 - 4 * 50);
    expect(next.players[0]?.factionResources['essence']).toBe(100 - 4 * 5);
  });

  it('rejette (cannotAfford) si l’Essence manque, même avec assez d’or', () => {
    const state = startedWithFactionCost(3); // < 4 × 5
    expect(
      validate(state, {
        type: 'RecruitUnits',
        townId: 'town-1',
        unitId: 'red-grunt',
        count: 4,
      })?.code,
    ).toBe('cannotAfford');
  });
});
