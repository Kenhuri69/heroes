import { beginAmbushCombat } from '../combat/setup';
import type { GameEvent } from '../core/events';
import type { GameState, HeroState, PlayerState, ResourceId } from '../core/state';
import { heroArmyCap, heroVisionRadius } from '../hero/skills';
import { revealAround } from './fog';
import { inBounds, samePos, type GridPos, type TriggerEffect } from './map';

/**
 * Issue d'un trigger de visite (doc 18 A5) : `continue` (aucun / effet appliqué,
 * le chemin se poursuit) · `combat` (embuscade ⇒ l'appelant ouvre le combat) ·
 * `teleport` (le héros a été déplacé ⇒ le chemin s'interrompt SANS combat).
 */
export type TriggerOutcome = 'continue' | 'combat' | 'teleport' | 'choice';

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
export function applyTriggerEffect(
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
    else if (hero.army.length < heroArmyCap(hero))
      hero.army.push({ unitId: effect.unitId, count: effect.count });
  } else if (effect.kind === 'removeArtifact' && hero) {
    // Miroir de `grantArtifact` (péage/malédiction) : ôte l'artefact d'un slot
    // équipé, sinon du sac. Absent ⇒ no-op (le trigger est quand même consommé).
    const slot = hero.artifacts.indexOf(effect.artifactId);
    if (slot !== -1) hero.artifacts[slot] = null;
    else {
      const bag = hero.backpack?.indexOf(effect.artifactId) ?? -1;
      if (bag !== -1) hero.backpack!.splice(bag, 1);
    }
  } else if (effect.kind === 'removeArmy' && hero) {
    // Miroir de `grantArmy` (tribut) : réduit la pile ; slot supprimé à 0.
    const idx = hero.army.findIndex((s) => s.unitId === effect.unitId);
    if (idx !== -1) {
      const stack = hero.army[idx]!;
      if (stack.count > effect.count) stack.count -= effect.count;
      else hero.army.splice(idx, 1);
    }
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
      case 'removeArtifact':
        return { kind: 'removeArtifact', artifactId: effect.artifactId };
      case 'removeArmy':
        return { kind: 'removeArmy', unitId: effect.unitId, count: effect.count };
      case 'ambush':
        return { kind: 'ambush', army: effect.army.map((s) => ({ unitId: s.unitId, count: s.count })) };
      case 'teleport':
        return { kind: 'teleport', to: { x: effect.to.x, y: effect.to.y } };
      case 'choice':
        return {
          kind: 'choice',
          textKey: effect.textKey,
          options: effect.options.map((o) => ({ labelKey: o.labelKey, effect: { ...o.effect } })),
        };
    }
  })();
  events.push({ type: 'TriggerFired', triggerId, playerId: player?.id ?? null, effect: copy });
}

/**
 * Déclenche le trigger de **visite** non encore tiré posé sur la tuile du héros
 * (one-shot) — appelé pas à pas depuis `advanceHeroAlongPath`. L'effet s'applique
 * au joueur/héros qui visite. Retourne un `TriggerOutcome` : `combat` (embuscade
 * ouverte) ou `teleport` (héros déplacé) imposent à l'appelant d'interrompre le
 * chemin ; `continue` le laisse se poursuivre.
 */
export function fireVisitTrigger(
  draft: GameState,
  player: PlayerState,
  hero: HeroState,
  pos: GridPos,
  events: GameEvent[],
): TriggerOutcome {
  const map = draft.map;
  if (!map) return 'continue';
  const trig = map.triggers.find(
    (t) => !t.fired && t.on.kind === 'visit' && samePos(t.on.pos, pos),
  );
  if (!trig) return 'continue';
  if (trig.effect.kind === 'ambush') {
    // Garde-fou B5 (comme le gardien) : un héros sans armée ne déclenche pas de
    // combat — le piège n'est PAS consommé, il attend une proie.
    if (hero.army.length === 0) return 'continue';
    trig.fired = true;
    applyTriggerEffect(trig.effect, player, hero, trig.id, events);
    beginAmbushCombat(draft, hero.id, trig.effect.army, events);
    return 'combat';
  }
  if (trig.effect.kind === 'teleport') {
    // Téléport scripté (doc 18 A5) : cible hors carte ⇒ garde-fou (trigger non
    // consommé, aucun déplacement). Sinon : déplace, révèle la vision autour de
    // la destination, émet `HeroTeleported` (réutilisé du monolithe) et interrompt
    // le chemin (le reste du trajet, calculé depuis l'ancienne position, est caduc).
    const to = trig.effect.to;
    if (!inBounds(map, to)) return 'continue';
    trig.fired = true;
    applyTriggerEffect(trig.effect, player, hero, trig.id, events);
    const from = { ...hero.pos };
    hero.pos = { x: to.x, y: to.y };
    const config = draft.config;
    if (config)
      revealAround(
        player.explored,
        map,
        hero.pos,
        heroVisionRadius(hero, config.visionRadius, draft.skillCatalog, draft.artifactCatalog),
      );
    events.push({ type: 'HeroTeleported', heroId: hero.id, from, to: { x: to.x, y: to.y } });
    return 'teleport';
  }
  if (trig.effect.kind === 'choice') {
    // Message à choix (doc 18 A5) : le trigger est consommé et un état d'attente
    // (`pendingTriggerChoice`) est posé — le chemin s'interrompt. Le joueur humain
    // tranche via `ResolveTriggerChoice` (l'IA via un callback de mouvement).
    // L'effet de l'option choisie s'applique à la RÉSOLUTION, pas ici.
    trig.fired = true;
    draft.pendingTriggerChoice = {
      heroId: hero.id,
      playerId: player.id,
      triggerId: trig.id,
      textKey: trig.effect.textKey,
      options: trig.effect.options.map((o) => ({ labelKey: o.labelKey, effect: { ...o.effect } })),
    };
    events.push({ type: 'TriggerChoiceOffered', triggerId: trig.id, playerId: player.id });
    return 'choice';
  }
  trig.fired = true;
  applyTriggerEffect(trig.effect, player, hero, trig.id, events);
  return 'continue';
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
        if (!p.eliminated) applyTriggerEffect(trig.effect, p, null, trig.id, events);
      }
    } else {
      applyTriggerEffect(trig.effect, null, null, trig.id, events);
    }
  }
}
