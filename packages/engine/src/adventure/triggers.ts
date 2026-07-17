import { beginAmbushCombat } from '../combat/setup';
import type { GameEvent } from '../core/events';
import type { GameState, HeroState, PlayerState, ResourceId } from '../core/state';
import { MAX_ARMY_STACKS } from './visitable';
import { samePos, type GridPos, type TriggerEffect } from './map';

/**
 * Interprétation des triggers de carte (doc 02 §2.1) — **générique** : le moteur
 * applique le `kind` de l'effet, jamais un nom de faction ni de scénario.
 * Ajouter un effet = une variante `TriggerEffect` (map.ts) + un cas ici.
 */

/**
 * Applique un effet au joueur cible (`null` = message global) puis émet
 * l'événement. `hero` = héros visiteur (doc 18 A5) — `null` sur un trigger de
 * jour : les effets liés à un héros (`grantArtifact`/`grantArmy`/`ambush`)
 * sont alors des no-ops silencieux (documenté doc 02 §2.1). Pur.
 */
function applyEffect(
  effect: TriggerEffect,
  player: PlayerState | null,
  hero: HeroState | null,
  triggerId: string,
  events: GameEvent[],
): void {
  if (effect.kind === 'grantResource' && player) {
    player.resources[effect.resource as ResourceId] += effect.amount;
  } else if (effect.kind === 'grantArtifact' && hero) {
    // Comme le butin de gardien (guardian-reward.ts) : 1er slot équipé libre,
    // sinon le SAC (rien de perdu).
    const slot = hero.artifacts.indexOf(null);
    if (slot !== -1) hero.artifacts[slot] = effect.artifactId;
    else (hero.backpack ??= []).push(effect.artifactId);
  } else if (effect.kind === 'grantArmy' && hero) {
    // Comme le recrutement d'habitation (visitable.ts) : fusion même unité,
    // sinon nouveau slot si le cap le permet — sinon le don est perdu (mais le
    // trigger est consommé : la caravane est passée).
    const existing = hero.army.find((s) => s.unitId === effect.unitId);
    if (existing) existing.count += effect.count;
    else if (hero.army.length < MAX_ARMY_STACKS)
      hero.army.push({ unitId: effect.unitId, count: effect.count });
  }
  // Clone l'effet : le stocké est un proxy immer révoqué après `produce`, un
  // événement doit être un objet nu (comme `pos: {...}` des autres événements).
  // Switch exhaustif sur l'union : le compilateur casse si un kind manque.
  const copy = ((): TriggerEffect => {
    switch (effect.kind) {
      case 'grantResource':
        return { kind: 'grantResource', resource: effect.resource, amount: effect.amount };
      case 'message':
        return { kind: 'message', textKey: effect.textKey };
      case 'grantArtifact':
        return { kind: 'grantArtifact', artifactId: effect.artifactId };
      case 'grantArmy':
        return { kind: 'grantArmy', unitId: effect.unitId, count: effect.count };
      case 'ambush':
        return { kind: 'ambush', army: effect.army.map((s) => ({ unitId: s.unitId, count: s.count })) };
    }
  })();
  events.push({ type: 'TriggerFired', triggerId, playerId: player?.id ?? null, effect: copy });
}

/**
 * Déclenche le trigger de **visite** non encore tiré posé sur la tuile du héros
 * (one-shot) — appelé pas à pas depuis `advanceHeroAlongPath`. L'effet s'applique
 * au joueur/héros qui visite. Retourne `true` si un COMBAT a été ouvert
 * (embuscade, doc 18 A5) — l'appelant doit alors interrompre le chemin.
 */
export function fireVisitTrigger(
  draft: GameState,
  player: PlayerState,
  hero: HeroState,
  pos: GridPos,
  events: GameEvent[],
): boolean {
  const map = draft.map;
  if (!map) return false;
  const trig = map.triggers.find(
    (t) => !t.fired && t.on.kind === 'visit' && samePos(t.on.pos, pos),
  );
  if (!trig) return false;
  if (trig.effect.kind === 'ambush') {
    // Garde-fou B5 (comme le gardien) : un héros sans armée ne déclenche pas de
    // combat — le piège n'est PAS consommé, il attend une proie.
    if (hero.army.length === 0) return false;
    trig.fired = true;
    applyEffect(trig.effect, player, hero, trig.id, events);
    beginAmbushCombat(draft, hero.id, trig.effect.army, events);
    return true;
  }
  trig.fired = true;
  applyEffect(trig.effect, player, hero, trig.id, events);
  return false;
}

/**
 * Déclenche les triggers de **jour** dus au jour courant (one-shot) — appelé au
 * `DayStarted`. Un octroi de ressource `onDay` est symétrique (tous les joueurs
 * actifs, déterministe) ; un message est global (`playerId: null`) ; les effets
 * liés à un héros visiteur (`grantArtifact`/`grantArmy`/`ambush`) sont des
 * no-ops (l'événement est quand même émis pour tracer la consommation).
 */
export function fireDayTriggers(draft: GameState, events: GameEvent[]): void {
  const map = draft.map;
  if (!map) return;
  for (const trig of map.triggers) {
    if (trig.fired || trig.on.kind !== 'day' || trig.on.day !== draft.calendar.day) continue;
    trig.fired = true;
    if (trig.effect.kind === 'grantResource') {
      for (const p of draft.players) {
        if (!p.eliminated) applyEffect(trig.effect, p, null, trig.id, events);
      }
    } else {
      applyEffect(trig.effect, null, null, trig.id, events);
    }
  }
}
