import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';
import { applyTriggerEffect } from './triggers';

/**
 * Résout le message à choix en attente (doc 18 A5) : applique l'effet-feuille de
 * l'option `optionIndex` au héros/joueur visiteur (via `applyTriggerEffect`),
 * émet `TriggerChoiceResolved` et vide `pendingTriggerChoice`. Logique unique
 * partagée par le handler `ResolveTriggerChoice` (joueur humain) et l'IA
 * d'aventure (qui choisit l'option 0, déterministe). No-op si aucun choix n'est
 * en attente ou si l'index est hors bornes.
 */
export function resolveTriggerChoice(draft: GameState, optionIndex: number, events: GameEvent[]): void {
  const pending = draft.pendingTriggerChoice;
  if (!pending) return;
  const option = pending.options[optionIndex];
  if (!option) return;
  const player = draft.players.find((p) => p.id === pending.playerId) ?? null;
  const hero = draft.heroes.find((h) => h.id === pending.heroId) ?? null;
  applyTriggerEffect(option.effect, player, hero, pending.triggerId, events);
  events.push({
    type: 'TriggerChoiceResolved',
    triggerId: pending.triggerId,
    playerId: player?.id ?? null,
    optionIndex,
  });
  delete draft.pendingTriggerChoice;
}
