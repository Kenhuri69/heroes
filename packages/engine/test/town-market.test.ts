import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import type { Command } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState, type Resources } from '../src/core/state';
import type { BuildingDef } from '../src/town/types';
import { tradeQuote } from '../src/town/market';
import { testConfig, testMap } from './fixtures';
import { testTown, testUnitCatalogWithEconomy } from './town-fixtures';

// Marché (lot UX U6a) : échange ressource ↔ or au bâtiment portant l'effet
// `market`. Taux data-driven (config.market), déterministe (aucun RNG).

const MARKET = { sellRate: 25, buyRate: 50 };

const marketCatalog: Record<string, BuildingDef> = {
  market: { id: 'market', maxLevel: 1, levels: [{ cost: {}, requires: [], effect: { type: 'market' } }] },
  townHall: { id: 'townHall', maxLevel: 1, levels: [{ cost: {}, requires: [], effect: { type: 'none' } }] },
};

function startedGame(
  resources: Partial<Resources> = {},
  buildings: Record<string, number> = { market: 1 },
  ownerPlayerId = 'p1',
): GameState {
  const cmd: Command = {
    type: 'StartGame',
    seed: 1,
    players: [{ id: 'p1', startingResources: { ...emptyResources(), ...resources } }],
    map: testMap(),
    config: { ...testConfig(), market: MARKET },
    unitCatalog: testUnitCatalogWithEconomy(),
    buildingCatalog: marketCatalog,
    towns: [testTown({ buildings, ownerPlayerId })],
  };
  return apply(createEmptyState(), cmd).state;
}

describe('tradeQuote (helper pur)', () => {
  it('vente : ressource → or au sellRate', () => {
    expect(tradeQuote(MARKET, 'wood', 'gold', 10)).toBe(250);
  });
  it('achat : or → ressource au buyRate (arrondi bas)', () => {
    expect(tradeQuote(MARKET, 'gold', 'ore', 120)).toBe(2); // floor(120/50)
  });
  it('0 si aucun côté or, deux côtés or, ou montant nul', () => {
    expect(tradeQuote(MARKET, 'wood', 'ore', 10)).toBe(0);
    expect(tradeQuote(MARKET, 'gold', 'gold', 10)).toBe(0);
    expect(tradeQuote(MARKET, 'wood', 'gold', 0)).toBe(0);
  });
});

describe('TradeResources', () => {
  it('vend une ressource contre de l’or (débite/crédite)', () => {
    const state = startedGame({ wood: 10 });
    const next = apply(state, { type: 'TradeResources', townId: 'town-1', give: 'wood', receive: 'gold', giveAmount: 10 }).state;
    expect(next.players[0]?.resources.wood).toBe(0);
    expect(next.players[0]?.resources.gold).toBe(250);
  });

  it('achète une ressource avec de l’or (arrondi bas)', () => {
    const state = startedGame({ gold: 120 });
    const next = apply(state, { type: 'TradeResources', townId: 'town-1', give: 'gold', receive: 'ore', giveAmount: 100 }).state;
    expect(next.players[0]?.resources.gold).toBe(20); // 120 - 100
    expect(next.players[0]?.resources.ore).toBe(2); // floor(100/50)
  });

  it('refuse sans marché construit (invalidTrade)', () => {
    const state = startedGame({ wood: 10 }, { townHall: 1 });
    const err = validate(state, { type: 'TradeResources', townId: 'town-1', give: 'wood', receive: 'gold', giveAmount: 10 });
    expect(err?.code).toBe('invalidTrade');
  });

  it('refuse une ville qui n’appartient pas au joueur actif (notYourTown)', () => {
    const state = startedGame({ wood: 10 }, { market: 1 }, 'other');
    const err = validate(state, { type: 'TradeResources', townId: 'town-1', give: 'wood', receive: 'gold', giveAmount: 10 });
    expect(err?.code).toBe('notYourTown');
  });

  it('refuse un échange sans or sur exactement un côté (invalidTrade)', () => {
    const state = startedGame({ wood: 10, ore: 10 });
    const err = validate(state, { type: 'TradeResources', townId: 'town-1', give: 'wood', receive: 'ore', giveAmount: 5 });
    expect(err?.code).toBe('invalidTrade');
  });

  it('refuse un montant supérieur au stock (cannotAfford)', () => {
    const state = startedGame({ wood: 3 });
    const err = validate(state, { type: 'TradeResources', townId: 'town-1', give: 'wood', receive: 'gold', giveAmount: 10 });
    expect(err?.code).toBe('cannotAfford');
  });
});
