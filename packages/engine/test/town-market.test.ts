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
  it('troc : ressource → ressource via équivalence or (T-MARKETRATE)', () => {
    expect(tradeQuote(MARKET, 'wood', 'ore', 10)).toBe(5); // floor(10 × 25 / 50)
  });
  it('0 pour or↔or ou montant nul', () => {
    expect(tradeQuote(MARKET, 'gold', 'gold', 10)).toBe(0);
    expect(tradeQuote(MARKET, 'wood', 'gold', 0)).toBe(0);
  });
  it('0 pour l’échange d’une ressource contre elle-même, même à facteur élevé', () => {
    // Sans ce rejet, bois→bois vaudrait floor(n × 25 × 2² / 50) = 2n : duplication.
    const M = { sellRate: 25, buyRate: 50, perMarketBonus: 0.1, maxMarketFactor: 2 };
    expect(tradeQuote(M, 'wood', 'wood', 1000, 20)).toBe(0);
  });
  it('aller-retour jamais rentable aux valeurs livrées (sellRate × maxFactor² ≤ buyRate)', () => {
    // Mêmes valeurs que data/core/config.json — le garde-fou de schéma du
    // contenu impose cette inégalité ; on vérifie ici sa conséquence moteur.
    const M = { sellRate: 25, buyRate: 50, perMarketBonus: 0.1, maxMarketFactor: 1.4 };
    for (const markets of [1, 3, 5, 6, 11, 20]) {
      for (const amount of [1, 7, 100, 1000]) {
        const gold = tradeQuote(M, 'wood', 'gold', amount, markets);
        const back = tradeQuote(M, 'gold', 'wood', gold, markets);
        expect(back).toBeLessThanOrEqual(amount);
        // Idem via troc direct bois→minerai→bois.
        const ore = tradeQuote(M, 'wood', 'ore', amount, markets);
        const back2 = tradeQuote(M, 'ore', 'wood', ore, markets);
        expect(back2).toBeLessThanOrEqual(amount);
      }
    }
  });
  it('taux dégressif : plus de marchés ⇒ meilleur ratio (T-MARKETRATE)', () => {
    const M = { sellRate: 25, buyRate: 50, perMarketBonus: 0.1, maxMarketFactor: 2 };
    expect(tradeQuote(M, 'wood', 'gold', 10, 1)).toBe(250); // factor 1 : plat
    expect(tradeQuote(M, 'wood', 'gold', 10, 3)).toBe(300); // factor 1.2 : floor(10 × 30)
    expect(tradeQuote(M, 'gold', 'ore', 500, 3)).toBe(12); // buyRate 50/1.2≈41.7 : floor(500/41.7)
    // Plafond : 20 marchés ⇒ factor plafonné à 2 (pas 1 + 0.1×19 = 2.9).
    expect(tradeQuote(M, 'wood', 'gold', 10, 20)).toBe(500); // floor(10 × 25 × 2)
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

  it('accepte le troc ressource↔ressource et applique l’équivalence or (T-MARKETRATE)', () => {
    const state = startedGame({ wood: 10 });
    expect(validate(state, { type: 'TradeResources', townId: 'town-1', give: 'wood', receive: 'ore', giveAmount: 10 })).toBeNull();
    const next = apply(state, { type: 'TradeResources', townId: 'town-1', give: 'wood', receive: 'ore', giveAmount: 10 }).state;
    expect(next.players[0]?.resources.wood).toBe(0);
    expect(next.players[0]?.resources.ore).toBe(5); // floor(10 × 25 / 50)
  });

  it('refuse or contre or (invalidTrade)', () => {
    const state = startedGame({ gold: 100 });
    const err = validate(state, { type: 'TradeResources', townId: 'town-1', give: 'gold', receive: 'gold', giveAmount: 10 });
    expect(err?.code).toBe('invalidTrade');
  });

  it('refuse l’échange d’une ressource contre elle-même (invalidTrade)', () => {
    const state = startedGame({ wood: 1000 });
    const err = validate(state, { type: 'TradeResources', townId: 'town-1', give: 'wood', receive: 'wood', giveAmount: 1000 });
    expect(err?.code).toBe('invalidTrade');
  });

  it('refuse un montant supérieur au stock (cannotAfford)', () => {
    const state = startedGame({ wood: 3 });
    const err = validate(state, { type: 'TradeResources', townId: 'town-1', give: 'wood', receive: 'gold', giveAmount: 10 });
    expect(err?.code).toBe('cannotAfford');
  });

  it('taux dégressif de bout en bout : posséder 2 marchés améliore la vente (T-MARKETRATE)', () => {
    const cmd: Command = {
      type: 'StartGame',
      seed: 1,
      players: [{ id: 'p1', startingResources: { ...emptyResources(), wood: 10 } }],
      map: testMap(),
      config: { ...testConfig(), market: { sellRate: 25, buyRate: 50, perMarketBonus: 0.5, maxMarketFactor: 3 } },
      unitCatalog: testUnitCatalogWithEconomy(),
      buildingCatalog: marketCatalog,
      towns: [
        testTown({ id: 'town-1', pos: { x: 1, y: 1 }, buildings: { market: 1 }, ownerPlayerId: 'p1' }),
        testTown({ id: 'town-2', pos: { x: 8, y: 8 }, buildings: { market: 1 }, ownerPlayerId: 'p1' }),
      ],
    };
    const state = apply(createEmptyState(), cmd).state;
    // 2 marchés ⇒ factor 1.5 ⇒ vente 10 bois = floor(10 × 25 × 1.5) = 375 (vs 250 à 1 marché).
    const next = apply(state, { type: 'TradeResources', townId: 'town-1', give: 'wood', receive: 'gold', giveAmount: 10 }).state;
    expect(next.players[0]?.resources.gold).toBe(375);
  });
});
