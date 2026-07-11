import type { MarketConfig } from '../adventure/config';
import type { Command, CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import type { GameState, ResourceId } from '../core/state';

type TradeCmd = Extract<Command, { type: 'TradeResources' }>;

/**
 * Marché (doc 02 §4.1, lot UX U6a) : échange ressource ↔ or à un taux
 * data-driven (`config.market`), déterministe (aucun RNG). Point d'extension
 * moteur GÉNÉRIQUE — le marché est activé par un **effet de bâtiment**
 * `{ type: 'market' }` (aucun id de bâtiment en dur : le moteur reste
 * agnostique du contenu). Aucun événement dédié (surface figée `events.ts`) :
 * le rendu observe la mutation des ressources, comme `GarrisonTransfer`.
 */

/**
 * Taux effectifs du marché (T-MARKETRATE, doc 02 §3) : le ratio s'améliore avec
 * le nombre de marchés possédés — `factor = min(maxMarketFactor, 1 +
 * perMarketBonus × (marchés − 1))`. Vendre rapporte plus (`sellRate × factor`),
 * acheter coûte moins (`buyRate ÷ factor`). `marketCount ≤ 1` ⇒ facteur 1 (plat).
 */
export function effectiveMarketRates(
  market: MarketConfig,
  marketCount: number,
): { sellRate: number; buyRate: number; factor: number } {
  const n = Math.max(1, marketCount);
  const bonus = market.perMarketBonus ?? 0;
  const cap = market.maxMarketFactor ?? 1;
  const factor = Math.min(cap, 1 + bonus * (n - 1));
  return { sellRate: market.sellRate * factor, buyRate: market.buyRate / factor, factor };
}

/**
 * Contrepartie reçue pour un échange (helper PUR, réutilisé par le client pour
 * l'aperçu — pas de réimplémentation du taux côté client, leçon CL9). Vente
 * (→ or), achat (or →), ou **troc** ressource↔ressource (via équivalence or).
 * `marketCount` (défaut 1) applique le taux dégressif. Rejette or↔or.
 */
export function tradeQuote(
  market: MarketConfig,
  give: ResourceId,
  receive: ResourceId,
  giveAmount: number,
  marketCount = 1,
): number {
  if (giveAmount <= 0 || (give === 'gold' && receive === 'gold')) return 0;
  // Calcul depuis `factor` (multiplier avant diviser) : évite un double arrondi
  // flottant qui pouvait retirer 1 unité à l'achat/troc.
  const { factor } = effectiveMarketRates(market, marketCount);
  // Vente : ressource non-or → or.
  if (receive === 'gold') return Math.floor(giveAmount * market.sellRate * factor);
  // Achat : or → ressource non-or (arrondi bas ; sous `buyRate` on ne reçoit rien).
  if (give === 'gold') return Math.floor((giveAmount * factor) / market.buyRate);
  // Troc : ressource → ressource = vendre (× facteur) puis acheter (× facteur).
  return Math.floor((giveAmount * market.sellRate * factor * factor) / market.buyRate);
}

/** La ville a-t-elle un bâtiment construit portant l'effet `market` ? */
function townHasMarket(state: GameState, town: GameState['towns'][number]): boolean {
  for (const [id, level] of Object.entries(town.buildings)) {
    if (level < 1) continue;
    const effect = state.buildingCatalog[id]?.levels[level - 1]?.effect;
    if (effect?.type === 'market') return true;
  }
  return false;
}

/** Nombre de marchés possédés par un joueur (villes possédées à marché construit). */
export function ownedMarketCount(state: GameState, playerId: string): number {
  return state.towns.filter((t) => t.ownerPlayerId === playerId && townHasMarket(state, t)).length;
}

export function validateTradeResources(state: GameState, cmd: TradeCmd): CommandError | null {
  const town = state.towns.find((t) => t.id === cmd.townId);
  if (!town) return { code: 'unknownTown', message: `ville inconnue '${cmd.townId}'` };
  const player = state.players[state.currentPlayer];
  if (!player || town.ownerPlayerId !== player.id)
    return { code: 'notYourTown', message: `la ville '${cmd.townId}' n'appartient pas au joueur actif` };
  if (!townHasMarket(state, town))
    return { code: 'invalidTrade', message: `aucun marché construit dans '${cmd.townId}'` };
  if (!Number.isInteger(cmd.giveAmount) || cmd.giveAmount <= 0)
    return { code: 'invalidTrade', message: `montant d'échange invalide (${cmd.giveAmount})` };
  // Troc autorisé (T-MARKETRATE) : on rejette seulement or↔or (échange nul).
  if (cmd.give === 'gold' && cmd.receive === 'gold')
    return { code: 'invalidTrade', message: 'or contre or : échange sans effet' };
  const market = state.config?.market;
  if (!market) return { code: 'invalidTrade', message: 'aucun taux de marché configuré' };
  if (player.resources[cmd.give] < cmd.giveAmount)
    return { code: 'cannotAfford', message: `${cmd.give} insuffisant` };
  const marketCount = ownedMarketCount(state, player.id);
  if (tradeQuote(market, cmd.give, cmd.receive, cmd.giveAmount, marketCount) <= 0)
    return { code: 'invalidTrade', message: 'montant trop faible pour recevoir une contrepartie' };
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- pas d'événement dédié (surface figée events.ts)
export function handleTradeResources(draft: GameState, cmd: TradeCmd, events: GameEvent[]): void {
  const town = draft.towns.find((t) => t.id === cmd.townId);
  const player = draft.players[draft.currentPlayer];
  const market = draft.config?.market;
  if (!town || !player || !market) return; // exclu par validate
  const marketCount = ownedMarketCount(draft, player.id);
  const receiveAmount = tradeQuote(market, cmd.give, cmd.receive, cmd.giveAmount, marketCount);
  player.resources[cmd.give] -= cmd.giveAmount;
  player.resources[cmd.receive] += receiveAmount;
}
