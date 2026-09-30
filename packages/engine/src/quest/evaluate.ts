import { levelOf, type GridPos } from '../adventure/map';
import type { GameEvent } from '../core/events';
import { humanPlayerId, type GameState, type ResourceId } from '../core/state';
import { heroArmyCap } from '../hero/skills';
import { conditionMet } from '../scenario/outcome';
import type { QuestCondition, QuestReward } from './types';
import { grantArtifact } from '../hero/equip';

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
  /** Événements de la commande en cours — un héros qui TRAVERSE la tuile compte (`visitTile`). */
  events: readonly GameEvent[] = [],
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
      // LE2/M14 : c'est CE joueur qui doit l'avoir vaincu — un gardien tué par un
      // adversaire (ou disparu autrement) ne valide plus la quête.
      return draft.quests?.vanquishedBy?.[cond.objectId]?.playerId === playerId;
    case 'visitTile':
      // LE2/M14 : il faut ATTEINDRE la tuile avec un héros (s'y trouver, ou y
      // passer pendant la commande) — la voir de loin ne suffit plus.
      return visitingHeroId(draft, playerId, cond, events) !== undefined;
    default:
      // captureTown / defeatHero / surviveDays / eliminateAllEnemies.
      return conditionMet(draft, playerId, cond);
  }
}

/** Héros du joueur sur la tuile (surface), ou qui y est passé pendant la commande. */
function visitingHeroId(
  draft: GameState,
  playerId: string,
  cond: { x: number; y: number },
  events: readonly GameEvent[],
): string | undefined {
  // `visitTile` ne porte pas de couche (schéma de quête) : c'est la SURFACE.
  const onTile = (p: GridPos): boolean => p.x === cond.x && p.y === cond.y && levelOf(p) === 0;
  const mine = (heroId: string): boolean => draft.heroes.some((h) => h.id === heroId && h.playerId === playerId);
  const standing = draft.heroes.find((h) => h.playerId === playerId && onTile(h.pos));
  if (standing) return standing.id;
  for (const e of events) if (e.type === 'MoveStepped' && onTile(e.to) && mine(e.heroId)) return e.heroId;
  return undefined;
}

/**
 * Héros qui a validé la DERNIÈRE étape (LE2/M19) — destinataire de la récompense.
 * `undefined` si la condition n'est pas portée par un héros (bâtir, posséder…).
 */
function validatingHeroId(
  draft: GameState,
  playerId: string,
  cond: QuestCondition,
  events: readonly GameEvent[],
): string | undefined {
  if (cond.type === 'visitTile') return visitingHeroId(draft, playerId, cond, events);
  if (cond.type === 'defeatGuardian') return draft.quests?.vanquishedBy?.[cond.objectId]?.heroId;
  return undefined;
}

/**
 * Applique les récompenses d'une quête complétée au joueur et au héros qui l'a
 * validée (LE2/M19 ; à défaut, son premier héros). Des unités qui ne tiennent
 * plus dans l'armée partent en **garnison** de la ville possédée la plus proche
 * (plus jamais perdues en silence) — renvoie cette ville pour que l'UI l'annonce.
 */
function applyRewards(
  draft: GameState,
  playerId: string,
  rewards: QuestReward[],
  heroId: string | undefined,
): { townId: string; unitId: string; count: number } | undefined {
  const player = draft.players.find((p) => p.id === playerId);
  const hero =
    (heroId ? draft.heroes.find((h) => h.id === heroId && h.playerId === playerId) : undefined) ??
    draft.heroes.find((h) => h.playerId === playerId);
  let rerouted: { townId: string; unitId: string; count: number } | undefined;
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
      grantArtifact(hero, draft.artifactCatalog, r.artifactId);
    } else {
      const existing = hero?.army.find((s) => s.unitId === r.unitId);
      if (existing) existing.count += r.count;
      else if (hero && hero.army.length < heroArmyCap(hero)) hero.army.push({ unitId: r.unitId, count: r.count });
      else {
        const town = nearestGarrisonFor(draft, playerId, r.unitId, hero?.pos);
        if (!town) continue; // aucune ville ne peut les accueillir
        const stack = town.garrison.find((s) => s.unitId === r.unitId);
        if (stack) stack.count += r.count;
        else town.garrison.push({ unitId: r.unitId, count: r.count });
        rerouted = { townId: town.id, unitId: r.unitId, count: r.count };
      }
    }
  }
  return rerouted;
}

/** Plafond de piles d'une garnison (doc 02 §4.1) — même borne que `RecruitUnits`. */
const MAX_GARRISON_STACKS = 7;

/**
 * Ville possédée la plus proche (Tchebychev, puis id) dont la garnison accueille
 * `unitId` (pile existante ou place libre). Sans héros de référence : la 1ʳᵉ par id.
 */
function nearestGarrisonFor(
  draft: GameState,
  playerId: string,
  unitId: string,
  from: GridPos | undefined,
): GameState['towns'][number] | undefined {
  let best: { town: GameState['towns'][number]; d: number } | undefined;
  for (const town of draft.towns) {
    if (town.ownerPlayerId !== playerId) continue;
    if (!town.garrison.some((s) => s.unitId === unitId) && town.garrison.length >= MAX_GARRISON_STACKS) continue;
    const d = from ? Math.max(Math.abs(town.pos.x - from.x), Math.abs(town.pos.y - from.y)) : 0;
    if (!best || d < best.d || (d === best.d && town.id < best.town.id)) best = { town, d };
  }
  return best?.town;
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
  // LE2/M14 : mémorise l'auteur de chaque victoire sur un gardien (avant que
  // l'étape `defeatGuardian` ne soit courante — la quête peut être plus loin).
  for (const e of events) {
    if (e.type !== 'GuardianVanquished') continue;
    draft.quests.vanquishedBy ??= {};
    draft.quests.vanquishedBy[e.objectId] = { playerId: e.playerId, heroId: e.heroId };
  }
  const humanId = humanPlayerId(draft);
  for (const quest of draft.quests.quests) {
    if (quest.status !== 'active') continue;
    const playerId = quest.def.playerId ?? humanId;
    if (!playerId) continue;
    let validator: string | undefined;
    while (
      quest.stepIndex < quest.def.steps.length &&
      questConditionMet(draft, playerId, quest.def.steps[quest.stepIndex]!.condition, events)
    ) {
      validator = validatingHeroId(draft, playerId, quest.def.steps[quest.stepIndex]!.condition, events) ?? validator;
      events.push({
        type: 'QuestAdvanced',
        questId: quest.def.id,
        stepId: quest.def.steps[quest.stepIndex]!.id,
      });
      quest.stepIndex += 1;
    }
    if (quest.stepIndex >= quest.def.steps.length) {
      quest.status = 'completed';
      const rerouted = applyRewards(draft, playerId, quest.def.rewards, validator);
      events.push({ type: 'QuestCompleted', questId: quest.def.id, ...(rerouted && { rerouted }) });
    }
  }
}
