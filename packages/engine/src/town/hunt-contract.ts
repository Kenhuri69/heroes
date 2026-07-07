import type { GameEvent } from '../core/events';
import { rollRange } from '../core/rng';
import type { GameState, HeroState } from '../core/state';
import { builtLevelOf } from './helpers';

/**
 * Contrats de chasse (doc 05 §3.3, point d'extension (5) du cadrage 4.1).
 * **Générique** : piloté par l'effet de bâtiment déclaratif `huntContract`
 * (`{ gold, resource, amount }`), jamais un nom de faction. Au passage de
 * semaine, le propriétaire d'un tel bâtiment se voit assigner une cible neutre
 * (un gardien de la carte, tirée au **RNG seedé**) ; la vaincre crédite la
 * récompense (or + ressource de faction) puis libère le contrat.
 */

type HuntContractEffect = { gold: number; resource: string; amount: number };

/** Effet `huntContract` d'un bâtiment construit d'une ville du joueur, ou `null`. */
function huntContractEffectFor(draft: GameState, playerId: string): HuntContractEffect | null {
  for (const town of draft.towns) {
    if (town.ownerPlayerId !== playerId) continue;
    for (const buildingId of Object.keys(town.buildings)) {
      const effect = builtLevelOf(town, draft.buildingCatalog, buildingId)?.effect;
      if (effect?.type === 'huntContract') {
        return { gold: effect.gold, resource: effect.resource, amount: effect.amount };
      }
    }
  }
  return null;
}

/**
 * (Ré)assigne les contrats de chasse au `WeekStarted` (doc 05 §3.3 : « chaque
 * semaine … à remplir avant la fin de la semaine »). Contrat HEBDOMADAIRE :
 * tout contrat non rempli **expire** en début de semaine (émission
 * `HuntContractExpired`) — ce qui débloque aussi le cas où la cible a été tuée
 * par un tiers (l'objet a disparu de la carte, le contrat n'aurait jamais pu
 * être rempli). Un nouveau contrat est ensuite tiré au RNG seedé pour tout
 * propriétaire d'un bâtiment `huntContract`. No-op s'il n'y a aucun gardien.
 */
export function assignHuntContracts(draft: GameState, events: GameEvent[]): void {
  const map = draft.map;
  if (!map) return;
  for (const player of draft.players) {
    if (player.eliminated) continue;
    // Expiration hebdomadaire du contrat en cours non rempli.
    if (player.huntContract) {
      events.push({
        type: 'HuntContractExpired',
        playerId: player.id,
        targetObjectId: player.huntContract.targetObjectId,
      });
      player.huntContract = null;
    }
    const effect = huntContractEffectFor(draft, player.id);
    if (!effect) continue;
    const targets = map.objects.filter((o) => o.type === 'guardian');
    if (targets.length === 0) continue;
    const roll = rollRange(draft.rng, 0, targets.length - 1);
    draft.rng = roll.state;
    const target = targets[roll.value];
    if (!target) continue;
    player.huntContract = { targetObjectId: target.id, ...effect };
    events.push({ type: 'HuntContractAssigned', playerId: player.id, targetObjectId: target.id });
  }
}

/**
 * Crédite la récompense de contrat si le gardien vaincu est la cible du contrat
 * actif du joueur du héros — appelé à la victoire d'un combat de gardien. Libère
 * le contrat (remis à `null`).
 */
export function rewardHuntContract(
  draft: GameState,
  hero: HeroState,
  guardianObjectId: string,
  events: GameEvent[],
): void {
  const player = draft.players.find((p) => p.id === hero.playerId);
  if (!player?.huntContract || player.huntContract.targetObjectId !== guardianObjectId) return;
  const { gold, resource, amount } = player.huntContract;
  player.resources.gold += gold;
  player.factionResources[resource] = (player.factionResources[resource] ?? 0) + amount;
  player.huntContract = null;
  events.push({ type: 'HuntContractCompleted', playerId: player.id, gold, resource, amount });
}
