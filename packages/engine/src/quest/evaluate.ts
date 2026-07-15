import type { GameEvent } from '../core/events';
import { humanPlayerId, type GameState, type ResourceId } from '../core/state';
import { conditionMet } from '../scenario/outcome';
import type { QuestCondition, QuestReward } from './types';

/**
 * Interprétation d'une `QuestCondition` du point de vue de `playerId` — pure,
 * aucune connaissance de quête nommée ni de faction (doc 13 §5.2/§6.2). Les
 * conditions partagées avec les scénarios délèguent à `conditionMet` (une seule
 * notion d'objectif). Les nouvelles conditions sont évaluées ici, toujours
 * depuis l'état observable.
 */
export function questConditionMet(
  draft: GameState,
  playerId: string,
  cond: QuestCondition,
): boolean {
  switch (cond.type) {
    case 'buildStructure':
      return draft.towns.some(
        (t) => t.ownerPlayerId === playerId && (t.buildings[cond.buildingId] ?? 0) >= 1,
      );
    case 'ownUnits': {
      // « Recruté » = présent dans une armée de héros ou une garnison possédée
      // (le stock non recruté ne compte pas).
      let total = 0;
      for (const h of draft.heroes) {
        if (h.playerId !== playerId) continue;
        for (const s of h.army) if (s.unitId === cond.unitId) total += s.count;
      }
      for (const t of draft.towns) {
        if (t.ownerPlayerId !== playerId) continue;
        for (const s of t.garrison) if (s.unitId === cond.unitId) total += s.count;
      }
      return total >= cond.count;
    }
    case 'defeatGuardian':
      // Le gardien vaincu est retiré des objets de la carte (interception).
      return !draft.map?.objects.some((o) => o.id === cond.objectId);
    case 'visitTile': {
      const player = draft.players.find((p) => p.id === playerId);
      if (!player || !draft.map) return false;
      return player.explored[cond.y * draft.map.width + cond.x] === 1;
    }
    default:
      // captureTown / defeatHero / surviveDays / eliminateAllEnemies.
      return conditionMet(draft, playerId, cond);
  }
}

/** Applique les récompenses d'une quête complétée au joueur (et à son héros). */
function applyRewards(draft: GameState, playerId: string, rewards: QuestReward[]): void {
  const player = draft.players.find((p) => p.id === playerId);
  const hero = draft.heroes.find((h) => h.playerId === playerId);
  for (const r of rewards) {
    if (r.type === 'resources') {
      if (!player) continue;
      for (const [res, amount] of Object.entries(r.resources)) {
        player.resources[res as ResourceId] = (player.resources[res as ResourceId] ?? 0) + (amount ?? 0);
      }
    } else if (r.type === 'artifact') {
      if (!hero) continue;
      // B2 : 1er slot équipé libre (invariant 10 slots, state.ts) ; inventaire
      // plein ⇒ le SAC (`backpack`, jamais perdu) plutôt que la perte — même
      // routage que le ramassage carte/gardien/visitable/dépouille.
      const slot = hero.artifacts.indexOf(null);
      if (slot >= 0) hero.artifacts[slot] = r.artifactId;
      else (hero.backpack ??= []).push(r.artifactId);
    } else {
      if (!hero) continue;
      const existing = hero.army.find((s) => s.unitId === r.unitId);
      if (existing) existing.count += r.count;
      else if (hero.army.length < 7) hero.army.push({ unitId: r.unitId, count: r.count });
    }
  }
}

/**
 * Fait avancer les quêtes actives (doc 13 §6.2) : pour chaque quête, franchit
 * toutes les étapes dont la condition est satisfaite (émet `QuestAdvanced`),
 * puis, une fois la dernière franchie, marque la quête complétée, applique ses
 * récompenses et émet `QuestCompleted`. **No-op si `draft.quests` est null**
 * (partie libre / golden — état sérialisé identique hormis le champ `quests`).
 *
 * Appelé une fois en fin de chaque commande (`apply`) : toute mutation d'état
 * (bâtir, recruter, fin de combat, capture, déplacement…) est prise en compte
 * sans câblage par-commande. Idempotent et déterministe.
 */
export function evaluateQuests(draft: GameState, events: GameEvent[]): void {
  if (!draft.quests) return;
  const humanId = humanPlayerId(draft);
  for (const quest of draft.quests.quests) {
    if (quest.status !== 'active') continue;
    const playerId = quest.def.playerId ?? humanId;
    if (!playerId) continue;
    while (
      quest.stepIndex < quest.def.steps.length &&
      questConditionMet(draft, playerId, quest.def.steps[quest.stepIndex]!.condition)
    ) {
      events.push({
        type: 'QuestAdvanced',
        questId: quest.def.id,
        stepId: quest.def.steps[quest.stepIndex]!.id,
      });
      quest.stepIndex += 1;
    }
    if (quest.stepIndex >= quest.def.steps.length) {
      quest.status = 'completed';
      applyRewards(draft, playerId, quest.def.rewards);
      events.push({ type: 'QuestCompleted', questId: quest.def.id });
    }
  }
}
