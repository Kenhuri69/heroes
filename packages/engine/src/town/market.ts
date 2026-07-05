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
 * Contrepartie reçue pour un échange (helper PUR, réutilisé par le client pour
 * l'aperçu — pas de réimplémentation du taux côté client, leçon CL9). Exactement
 * un côté doit être `'gold'` ; sinon `0`.
 */
export function tradeQuote(
  market: MarketConfig,
  give: ResourceId,
  receive: ResourceId,
  giveAmount: number,
): number {
  if (giveAmount <= 0) return 0;
  // Vente : ressource non-or → or.
  if (receive === 'gold' && give !== 'gold') return giveAmount * market.sellRate;
  // Achat : or → ressource non-or (arrondi bas ; sous `buyRate` on ne reçoit rien).
  if (give === 'gold' && receive !== 'gold') return Math.floor(giveAmount / market.buyRate);
  return 0;
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
  // Exactement un côté est de l'or (XOR) : vendre OU acheter, pas troc ni or↔or.
  const oneSideGold = (cmd.give === 'gold') !== (cmd.receive === 'gold');
  if (!oneSideGold)
    return { code: 'invalidTrade', message: 'exactement un côté de l’échange doit être de l’or' };
  const market = state.config?.market;
  if (!market) return { code: 'invalidTrade', message: 'aucun taux de marché configuré' };
  if (player.resources[cmd.give] < cmd.giveAmount)
    return { code: 'cannotAfford', message: `${cmd.give} insuffisant` };
  if (tradeQuote(market, cmd.give, cmd.receive, cmd.giveAmount) <= 0)
    return { code: 'invalidTrade', message: 'montant trop faible pour recevoir une contrepartie' };
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- pas d'événement dédié (surface figée events.ts)
export function handleTradeResources(draft: GameState, cmd: TradeCmd, events: GameEvent[]): void {
  const town = draft.towns.find((t) => t.id === cmd.townId);
  const player = draft.players[draft.currentPlayer];
  const market = draft.config?.market;
  if (!town || !player || !market) return; // exclu par validate
  const receiveAmount = tradeQuote(market, cmd.give, cmd.receive, cmd.giveAmount);
  player.resources[cmd.give] -= cmd.giveAmount;
  player.resources[cmd.receive] += receiveAmount;
}
