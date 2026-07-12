import type { Draft } from '../combat/draft';
import { hasAbility, performerParams } from '../combat/state-helpers';
import type { CombatSideId, CombatStack, CombatState } from '../combat/types';
import type { GameEvent } from '../core/events';
import type { GameState, HeroState, PlayerState } from '../core/state';
import { sumHeroEffectField } from '../hero/skills';
import type { FactionBonus } from './types';

/**
 * Crédite un joueur d'une ressource de faction (id opaque), plafonné au `cap`
 * si fourni. Patron R1 de la croissance de ville : `max(current, …)` ne réduit
 * jamais un stock déjà au-delà du cap (pré-seedé par un scénario). Cap absent =
 * non plafonné. Retourne le gain effectif (≥ 0). Partagé par le gain
 * post-victoire (F-RESON.1) et la génération intra-combat (F-RESON.2).
 */
export function creditFactionResource(
  player: PlayerState,
  resource: string,
  amount: number,
  cap: number | undefined,
): number {
  if (amount <= 0) return 0;
  const current = player.factionResources[resource] ?? 0;
  const next = current + amount;
  const capped = cap !== undefined ? Math.max(current, Math.min(next, cap)) : next;
  player.factionResources[resource] = capped;
  return capped - current;
}

/**
 * Cap déclaré d'une ressource de faction, estampillé par le loader sur le bonus
 * `gainFactionResourceOnVictory` de la faction (dérivé de
 * `factionResources[].cap`). Générique : le moteur ne lit qu'un id opaque.
 * `undefined` si non plafonné / faction sans bonus de gain de cette ressource.
 */
export function factionResourceCap(
  state: GameState,
  factionId: string,
  resource: string,
): number | undefined {
  const bonuses = state.factionCatalog[factionId]?.bonuses ?? [];
  for (const b of bonuses) {
    if (b.type === 'gainFactionResourceOnVictory' && b.resource === resource) return b.cap;
  }
  return undefined;
}

/** Capacité d'armée du héros (doc 02 §5.1) — ≤ 7 piles distinctes. */
const MAX_ARMY_STACKS = 7;

type Casualty = { side: CombatSideId; unitId: string; lost: number };

/**
 * Interprète les effets de faction déclaratifs du héros vainqueur (doc 06
 * §4) : lit `draft.factionCatalog[hero.factionId]?.bonuses`, jamais un nom de
 * faction. Appelé depuis `applyConsequences` (combat/turns.ts) après la
 * reconstruction de `hero.army`, uniquement quand le héros a gagné en tant
 * qu'attaquant.
 */
export function applyFactionVictoryEffects(
  draft: Draft,
  combat: CombatState,
  hero: HeroState,
  casualties: Casualty[],
  events: GameEvent[],
): void {
  const bonuses = draft.factionCatalog[hero.factionId]?.bonuses ?? [];
  for (const bonus of bonuses) {
    if (bonus.type === 'raiseUndeadOnVictory') {
      applyRaiseUndeadOnVictory(draft, bonus, casualties, hero, events);
    } else if (bonus.type === 'gainFactionResourceOnVictory') {
      applyGainFactionResourceOnVictory(draft, bonus, hero, events);
    }
  }
}

/** Crédite le joueur du héros vainqueur d'une ressource de faction (doc 05 §3.3). */
function applyGainFactionResourceOnVictory(
  draft: Draft,
  bonus: Extract<FactionBonus, { type: 'gainFactionResourceOnVictory' }>,
  hero: HeroState,
  events: GameEvent[],
): void {
  if (bonus.amount <= 0) return;
  const player = draft.players.find((p) => p.id === hero.playerId);
  if (!player) return;
  // F-RESON.1 : plafonne le gain au cap de la ressource (doc 16 §3.2 / doc 05 §3.3).
  const gained = creditFactionResource(player, bonus.resource, bonus.amount, bonus.cap);
  events.push({
    type: 'FactionResourceGained',
    playerId: player.id,
    resource: bonus.resource,
    amount: gained,
  });
}

/**
 * Génération de ressource de faction intra-combat (F-RESON.2, doc 16 §3.2) : une
 * pile « performeuse » (capacité `performer`) crédite le joueur du héros de son
 * camp quand elle prend réellement son tour (1×/round, appelé depuis `afterAction`
 * hors Attendre). Plafonné au cap de la ressource (partagé avec le gain
 * post-victoire). No-op sans héros lié au camp (arène/gardien/garnison).
 * Générique : le moteur ne lit qu'un id de ressource opaque.
 */
export function applyPerformerResonance(
  state: Draft,
  combat: CombatState,
  actor: CombatStack,
  events: GameEvent[],
): void {
  const def = state.unitCatalog[actor.unitId];
  if (!def) return;
  const params = performerParams(def);
  if (!params) return;
  const heroId = actor.side === 'attacker' ? combat.attackerHeroId : combat.defenderHeroId;
  const hero = heroId ? state.heroes.find((h) => h.id === heroId) : undefined;
  if (!hero) return;
  const player = state.players.find((p) => p.id === hero.playerId);
  if (!player) return;
  const cap = factionResourceCap(state, hero.factionId, params.resource);
  const gained = creditFactionResource(player, params.resource, params.amount, cap);
  if (gained <= 0) return;
  events.push({
    type: 'StackResonated',
    stackId: actor.id,
    playerId: player.id,
    resource: params.resource,
    amount: gained,
  });
}

function applyRaiseUndeadOnVictory(
  draft: Draft,
  bonus: Extract<FactionBonus, { type: 'raiseUndeadOnVictory' }>,
  casualties: Casualty[],
  hero: HeroState,
  events: GameEvent[],
): void {
  const raisedDef = draft.unitCatalog[bonus.unitId];
  if (!raisedDef || raisedDef.stats.hp <= 0) return; // données absentes/invalides — no-op défensif

  // PV vivants (non-`undead`) tués côté défenseur (doc 04 : « PV des créatures
  // vivantes ennemies tuées »).
  const hpKilled = casualties
    .filter((c) => c.side === 'defender')
    .reduce((sum, c) => {
      const def = draft.unitCatalog[c.unitId];
      if (!def || hasAbility(def, 'undead')) return sum;
      return sum + def.stats.hp * c.lost;
    }, 0);
  if (hpKilled <= 0) return;

  const existingStack = hero.army.find((s) => s.unitId === bonus.unitId);
  const cap = bonus.capBase + bonus.capPerExisting * (existingStack?.count ?? 0);
  // Nécromancie graduée (F-SKILLS, doc 04 §2) : le rang de `scaleSkillId` choisit
  // le pourcentage ; repli sur `percentHpRaised` si non gradué / compétence non apprise.
  const rank = bonus.scaleSkillId ? (hero.skills[bonus.scaleSkillId] ?? 0) : 0;
  const basePercent =
    rank > 0 && bonus.percentByRank && bonus.percentByRank[rank - 1] !== undefined
      ? bonus.percentByRank[rank - 1]!
      : bonus.percentHpRaised;
  // Spécialité EXACTE Mère Corbeau (H-COND-EXACT, doc 04 §5) : +N %/niveau du
  // héros, additionné au pourcentage de base. Générique (0 si aucun héros n'a
  // l'effet) ⇒ comportement historique préservé.
  const percent = basePercent + sumHeroEffectField(hero, 'raiseUndeadPctPerLevel') * hero.level;
  const raised = Math.min(Math.floor((hpKilled * percent) / 100 / raisedDef.stats.hp), cap);
  if (raised <= 0) return;

  if (existingStack) {
    existingStack.count += raised;
  } else {
    if (hero.army.length >= MAX_ARMY_STACKS) return; // armée pleine : pas d'ajout (documenté, lot O)
    hero.army.push({ unitId: bonus.unitId, count: raised });
  }
  events.push({ type: 'UndeadRaised', heroId: hero.id, unitId: bonus.unitId, count: raised });
}
