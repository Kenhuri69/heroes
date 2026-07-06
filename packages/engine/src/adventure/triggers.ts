import type { GameEvent } from '../core/events';
import type { GameState, PlayerState, ResourceId } from '../core/state';
import { samePos, type GridPos, type TriggerEffect } from './map';

/**
 * Interprétation des triggers de carte (doc 02 §2.1) — **générique** : le moteur
 * applique le `kind` de l'effet, jamais un nom de faction ni de scénario.
 * Ajouter un effet = une variante `TriggerEffect` (map.ts) + un cas ici.
 */

/** Applique un effet au joueur cible (`null` = message global) puis émet l'événement. Pur. */
function applyEffect(
  effect: TriggerEffect,
  player: PlayerState | null,
  triggerId: string,
  events: GameEvent[],
): void {
  if (effect.kind === 'grantResource' && player) {
    player.resources[effect.resource as ResourceId] += effect.amount;
  }
  // Clone l'effet : le stocké est un proxy immer révoqué après `produce`, un
  // événement doit être un objet nu (comme `pos: {...}` des autres événements).
  const copy: TriggerEffect =
    effect.kind === 'grantResource'
      ? { kind: 'grantResource', resource: effect.resource, amount: effect.amount }
      : { kind: 'message', textKey: effect.textKey };
  events.push({ type: 'TriggerFired', triggerId, playerId: player?.id ?? null, effect: copy });
}

/**
 * Déclenche le trigger de **visite** non encore tiré posé sur la tuile du héros
 * (one-shot) — appelé pas à pas depuis `advanceHeroAlongPath`. L'effet s'applique
 * au joueur du héros qui visite.
 */
export function fireVisitTrigger(
  draft: GameState,
  player: PlayerState,
  pos: GridPos,
  events: GameEvent[],
): void {
  const map = draft.map;
  if (!map) return;
  const trig = map.triggers.find(
    (t) => !t.fired && t.on.kind === 'visit' && samePos(t.on.pos, pos),
  );
  if (!trig) return;
  trig.fired = true;
  applyEffect(trig.effect, player, trig.id, events);
}

/**
 * Déclenche les triggers de **jour** dus au jour courant (one-shot) — appelé au
 * `DayStarted`. Un octroi de ressource `onDay` est symétrique (tous les joueurs
 * actifs, déterministe) ; un message est global (`playerId: null`).
 */
export function fireDayTriggers(draft: GameState, events: GameEvent[]): void {
  const map = draft.map;
  if (!map) return;
  for (const trig of map.triggers) {
    if (trig.fired || trig.on.kind !== 'day' || trig.on.day !== draft.calendar.day) continue;
    trig.fired = true;
    if (trig.effect.kind === 'grantResource') {
      for (const p of draft.players) {
        if (!p.eliminated) applyEffect(trig.effect, p, trig.id, events);
      }
    } else {
      applyEffect(trig.effect, null, trig.id, events);
    }
  }
}
