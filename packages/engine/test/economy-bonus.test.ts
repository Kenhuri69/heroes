import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import type { GameEvent } from '../src/core/events';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { applyDailyIncome, applyWeeklyGrowth, dailyIncome, weeklyGrowthOf } from '../src/town/economy';
import { testConfig, testMap } from './fixtures';
import { testBuildingCatalog, testTown, testUnitCatalogWithEconomy } from './town-fixtures';

/**
 * Profil économique par joueur (`PlayerState.economyBonus`, lot L5) : point
 * d'extension GÉNÉRIQUE — le moteur applique un pourcentage opaque, il ne sait
 * rien d'un « cran de difficulté ». Absent ⇒ facteur 1 (comportement d'avant).
 */

function stateWith(bonus?: { incomePercent?: number; growthPercent?: number }): GameState {
  const players: PlayerSetup[] = [
    { id: 'p1', startingResources: emptyResources(), ...(bonus ? { economyBonus: bonus } : {}) },
  ];
  const cmd: Command = {
    type: 'StartGame',
    seed: 1,
    players,
    map: { ...testMap(), objects: [{ id: 'mine-1', type: 'mine', pos: { x: 1, y: 1 }, resource: 'ore', amount: 2, ownerId: 'p1' }] },
    config: testConfig(),
    unitCatalog: testUnitCatalogWithEconomy(),
    buildingCatalog: testBuildingCatalog(),
    towns: [testTown({ buildings: { townHall: 1, dwelling1: 1 }, stock: {} })],
  };
  return apply(createEmptyState(), cmd).state;
}

function income(state: GameState): { gold: number; ore: number } {
  const events: GameEvent[] = [];
  const next = produce(state, (draft) => applyDailyIncome(draft, events));
  return { gold: next.players[0]?.resources.gold ?? 0, ore: next.players[0]?.resources.ore ?? 0 };
}

describe('economyBonus — revenu quotidien', () => {
  it('sans profil, le revenu est celui des données (bâtiment + mine)', () => {
    expect(income(stateWith())).toEqual({ gold: 500, ore: 2 });
  });

  it('un profil positif majore bâtiment ET mine ; la projection du HUD suit', () => {
    const state = stateWith({ incomePercent: 50 });
    expect(income(state)).toEqual({ gold: 750, ore: 3 });
    expect(dailyIncome(state, 'p1')).toMatchObject({ gold: 750, ore: 3 });
  });

  it('un profil négatif réduit sans jamais passer sous zéro', () => {
    expect(income(stateWith({ incomePercent: -25 })).gold).toBe(375);
    expect(income(stateWith({ incomePercent: -500 })).gold).toBe(0);
  });
});

describe('economyBonus — croissance hebdomadaire', () => {
  function grown(bonus?: { growthPercent?: number }): number {
    const state = stateWith(bonus);
    const events: GameEvent[] = [];
    const next = produce(state, (draft) => applyWeeklyGrowth(draft, events));
    return next.towns[0]?.stock['red-grunt'] ?? 0;
  }

  it('sans profil, la croissance est celle des données', () => {
    expect(grown()).toBe(6); // growthPerWeek de la fixture
  });

  it('le profil du PROPRIÉTAIRE module la croissance, projection comprise', () => {
    expect(grown({ growthPercent: 50 })).toBe(9);
    expect(grown({ growthPercent: -50 })).toBe(3);
    const state = stateWith({ growthPercent: 50 });
    const town = state.towns[0];
    expect(town && weeklyGrowthOf(state, town, 'red-grunt')?.added).toBe(9);
  });
});
