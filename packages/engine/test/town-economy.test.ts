import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { dailyIncome, townIncome } from '../src/town/economy';
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

describe('applyDailyIncome', () => {
  it('crédite le revenu du townHall (niveau 1) au DayStarted suivant', () => {
    const state = startedGame();
    const { state: next, events } = apply(state, { type: 'EndTurn', playerId: 'p1' });
    expect(next.players[0]?.resources.gold).toBe(500);
    expect(events).toContainEqual({
      type: 'TownIncome',
      playerId: 'p1',
      resource: 'gold',
      amount: 500,
    });
    for (const p of next.players) expect(p.resources.gold).toBeGreaterThanOrEqual(0);
  });

  it('reflète le palier après une montée de niveau du townHall', () => {
    const state = startedGame({ gold: 2500 });
    const afterBuild = apply(state, {
      type: 'BuildStructure',
      townId: 'town-1',
      buildingId: 'townHall',
    }).state;
    expect(afterBuild.players[0]?.resources.gold).toBe(0);
    const { state: next, events } = apply(afterBuild, { type: 'EndTurn', playerId: 'p1' });
    expect(next.players[0]?.resources.gold).toBe(1000); // niveau 2 : 1000/j, pas 500
    expect(events).toContainEqual({
      type: 'TownIncome',
      playerId: 'p1',
      resource: 'gold',
      amount: 1000,
    });
  });

  it('ne verse rien pour une ville neutre (sans propriétaire)', () => {
    const state = startedGame({}, { ownerPlayerId: null });
    const { events } = apply(state, { type: 'EndTurn', playerId: 'p1' });
    expect(events.some((e) => e.type === 'TownIncome')).toBe(false);
  });
});

describe('dailyIncome (projection pure, lot M6 C8)', () => {
  it('projette le même revenu de ville que celui crédité au DayStarted', () => {
    const state = startedGame();
    // Projection AVANT le tour == or effectivement crédité APRÈS (townHall niv.1 = 500).
    expect(dailyIncome(state, 'p1').gold).toBe(500);
    const next = apply(state, { type: 'EndTurn', playerId: 'p1' }).state;
    expect(next.players[0]?.resources.gold).toBe(500);
  });

  it('rien pour une ville neutre, rien pour un joueur inconnu', () => {
    const neutral = startedGame({}, { ownerPlayerId: null });
    expect(dailyIncome(neutral, 'p1')).toEqual({});
    expect(dailyIncome(startedGame(), 'ghost')).toEqual({});
  });
});

describe('townIncome (par ville, lot M7 C21)', () => {
  it("somme le revenu des bâtiments à effet income de la ville", () => {
    const state = startedGame(); // townHall niv.1 = 500 or/j
    const town = state.towns[0]!;
    expect(townIncome(town, state.buildingCatalog).gold).toBe(500);
  });
});

describe('applyWeeklyGrowth', () => {
  it('applique la croissance hebdo avec bonus de fort, plafonnée à 2×, au jour 8', () => {
    // fort niveau 1 (fixture) = growthBonus 0% -> passe à niveau... on force
    // directement un fort niveau 2 (+50%) via override pour isoler le calcul.
    const state = startedGame(
      {},
      { buildings: { townHall: 1, fort: 2, dwelling1: 1 }, stock: { 'red-grunt': 2 } },
    );
    let s = state;
    const growthAmounts: number[] = [];
    for (let day = 1; day <= 7; day++) {
      const r = apply(s, { type: 'EndTurn', playerId: 'p1' });
      s = r.state;
      for (const e of r.events) if (e.type === 'TownGrowth') growthAmounts.push(e.added);
    }
    expect(s.calendar.day).toBe(8);
    // growthPerWeek=6, bonus=+50% ⇒ floor(6*1.5)=9 ; stock 2+9=11 ≤ plafond 18.
    expect(growthAmounts).toEqual([9]);
    expect(s.towns[0]?.stock['red-grunt']).toBe(11);
  });

  it('plafonne le stock à 2× la croissance hebdo', () => {
    const state = startedGame(
      {},
      { buildings: { townHall: 1, fort: 2, dwelling1: 1 }, stock: { 'red-grunt': 15 } },
    );
    let s = state;
    for (let day = 1; day <= 7; day++) {
      s = apply(s, { type: 'EndTurn', playerId: 'p1' }).state;
    }
    // ajout brut 9 ⇒ 15+9=24, plafonné à 2*9=18.
    expect(s.towns[0]?.stock['red-grunt']).toBe(18);
  });
});
