import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
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
