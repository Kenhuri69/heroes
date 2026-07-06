import type { HeroState } from '../core/state';
import type { HeroSkillDef, SkillRankEffect } from './types';

/**
 * Compétences secondaires (doc 02 §1.3, décision plan phase-3.2 #5) : effets
 * déclaratifs par rang (`HeroSkillDef.ranks`, index 0 = Novice). Fonctions
 * pures lisant uniquement `hero.skills` + `state.skillCatalog`, toutes
 * consommées par le moteur : luck/moral/mêlée/tir/armure dans `combat/damage.ts`
 * et `combat/state-helpers.ts`, PM dans `core/engine.ts` (`heroDailyMovement`),
 * vision dans `adventure/movement.ts` (`revealAround`), or/jour dans
 * `core/engine.ts` (`DayStarted`), réduction de coût de mana dans
 * `hero/spells.ts` (`effectiveManaCost`).
 */

/** Somme du champ `field` sur toutes les compétences connues, au rang courant. */
function sumRankField(
  hero: HeroState,
  catalog: Record<string, HeroSkillDef>,
  field: keyof SkillRankEffect,
): number {
  let total = 0;
  for (const [skillId, rank] of Object.entries(hero.skills)) {
    const effect = catalog[skillId]?.ranks[rank - 1];
    total += effect?.[field] ?? 0;
  }
  return total;
}

/** Logistique : bonus % de points de mouvement quotidiens (`heroDailyMovement`). */
export function heroMovementBonus(hero: HeroState, catalog: Record<string, HeroSkillDef>): number {
  return sumRankField(hero, catalog, 'movementBonusPct');
}

/** Recherche : bonus de rayon de vision — intégration hors périmètre. */
export function heroVisionBonus(hero: HeroState, catalog: Record<string, HeroSkillDef>): number {
  return sumRankField(hero, catalog, 'visionBonus');
}

/** Économie : or/jour supplémentaire — intégration hors périmètre. */
export function heroGoldPerDay(hero: HeroState, catalog: Record<string, HeroSkillDef>): number {
  return sumRankField(hero, catalog, 'goldPerDay');
}

/** Chance (compétence) — combiné aux artefacts et borné [0,3] dans `combat/damage.ts`. */
export function heroLuck(hero: HeroState, catalog: Record<string, HeroSkillDef>): number {
  return sumRankField(hero, catalog, 'luckBonus');
}

/** Commandement (compétence) — moral, NON branché au moral de pile (state-helpers.ts hors périmètre). */
export function heroMorale(hero: HeroState, catalog: Record<string, HeroSkillDef>): number {
  return sumRankField(hero, catalog, 'moraleBonus');
}

/** Attaque au corps : bonus % de dégâts en mêlée — branché dans `combat/damage.ts`. */
export function heroMeleePct(hero: HeroState, catalog: Record<string, HeroSkillDef>): number {
  return sumRankField(hero, catalog, 'meleeDamagePct');
}

/** Tir : bonus % de dégâts à distance — branché dans `combat/damage.ts`. */
export function heroRangedPct(hero: HeroState, catalog: Record<string, HeroSkillDef>): number {
  return sumRankField(hero, catalog, 'rangedDamagePct');
}

/** Armure : réduction % des dégâts subis — branché dans `combat/damage.ts`. */
export function heroArmorPct(hero: HeroState, catalog: Record<string, HeroSkillDef>): number {
  return sumRankField(hero, catalog, 'armorReductionPct');
}

/** Magie par école : réduction % du coût en mana des sorts — branché dans `hero/spells.ts`. */
export function heroManaCostReduction(hero: HeroState, catalog: Record<string, HeroSkillDef>): number {
  return sumRankField(hero, catalog, 'manaCostReductionPct');
}
