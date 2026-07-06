import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';
import { grantXp } from './experience';

/**
 * Résout le trésor en attente (doc 02 §2.2) : crédite l'or au joueur OU
 * accorde l'XP au héros (montées de niveau en chaîne via `grantXp`), retire
 * l'objet de la carte et vide `pendingTreasure`. Logique unique partagée par
 * le handler `ResolveTreasure` (joueur humain) et l'IA d'aventure (qui choisit
 * l'or, déterministe). No-op si aucun trésor n'est en attente.
 */
export function resolveTreasure(
  draft: GameState,
  choice: 'gold' | 'xp',
  events: GameEvent[],
): void {
  const pending = draft.pendingTreasure;
  if (!pending) return;
  const player = draft.players.find((p) => p.id === pending.playerId);
  const amount = choice === 'gold' ? pending.gold : pending.xp;
  if (player && choice === 'gold') player.resources.gold += pending.gold;
  if (choice === 'xp') grantXp(draft, events, pending.heroId, pending.xp);
  const index = draft.map?.objects.findIndex((o) => o.id === pending.objectId) ?? -1;
  if (index !== -1) draft.map?.objects.splice(index, 1);
  events.push({
    type: 'TreasureTaken',
    heroId: pending.heroId,
    playerId: pending.playerId,
    objectId: pending.objectId,
    choice,
    amount,
  });
  draft.pendingTreasure = null;
}
