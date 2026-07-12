import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { applyDailyIncome } from '../src/town/economy';
import { createEmptyState, emptyResources, type GameState, type PlayerState } from '../src/core/state';
import type { GameEvent } from '../src/core/events';
import type { BuildingDef, TownState } from '../src/town/types';

/**
 * Lot F-BUILDEFF.6 — effet de bâtiment `factionResourceIncome` (doc 16 §5, La
 * Scène) : revenu quotidien d'une ressource de faction, plafonné au cap déclaré.
 * Bâtiment/faction/ressource GÉNÉRIQUES (`stage`/`fac-x`/`res-x`).
 */

const BUILDINGS: Record<string, BuildingDef> = {
  stage: {
    id: 'stage', maxLevel: 1,
    levels: [{ cost: {}, requires: [], effect: { type: 'factionResourceIncome', resource: 'res-x', amount: 5 } }],
  },
};

function player(over: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'p1', resources: emptyResources(), factionResources: {}, explored: [], controller: 'human',
    eliminated: false, townlessDays: 0, huntContract: null, team: 0, ...over,
  };
}

function town(over: Partial<TownState> = {}): TownState {
  return {
    id: 't1', ownerPlayerId: 'p1', pos: { x: 5, y: 5 }, factionId: 'fac-x', buildings: { stage: 1 },
    builtToday: false, garrison: [], stock: {}, spellPool: [], sharedGrowthChoice: {}, ...over,
  };
}

// Cap de `res-x` = 12 (estampillé sur le bonus de gain, F-RESON.1).
const CAPPED = { 'fac-x': { bonuses: [{ type: 'gainFactionResourceOnVictory' as const, resource: 'res-x', amount: 10, cap: 12 }] } };

function state(over: Partial<GameState> = {}): GameState {
  return { ...createEmptyState(), buildingCatalog: BUILDINGS, towns: [town()], players: [player()], ...over };
}

const runDay = (s: GameState): GameState => {
  const events: GameEvent[] = [];
  return produce(s, (draft) => applyDailyIncome(draft, events));
};

describe('F-BUILDEFF.6 — factionResourceIncome (La Scène)', () => {
  it('crédite +amount de la ressource de faction au propriétaire chaque jour', () => {
    const next = runDay(state());
    expect(next.players[0]!.factionResources['res-x']).toBe(5);
  });

  it('plafonne au cap déclaré de la ressource (F-RESON.1)', () => {
    // 10 + 5 = 15, plafonné à 12.
    const next = runDay(state({ players: [player({ factionResources: { 'res-x': 10 } })], factionCatalog: CAPPED }));
    expect(next.players[0]!.factionResources['res-x']).toBe(12);
  });

  it('ne crédite pas un joueur qui ne possède pas la ville', () => {
    const next = runDay(state({ towns: [town({ ownerPlayerId: 'p2' })] }));
    expect(next.players[0]!.factionResources['res-x']).toBeUndefined();
  });

  it('ne crédite rien si le bâtiment n’est pas construit', () => {
    const next = runDay(state({ towns: [town({ buildings: {} })] }));
    expect(next.players[0]!.factionResources['res-x']).toBeUndefined();
  });
});
