import type { HeroState } from '../core/state';
import type { HeroSkillDef, SkillRankEffect, SpellSchool } from './types';

/**
 * Compétences secondaires (doc 02 §1.3, décision plan phase-3.2 #5) : effets
 * déclaratifs par rang (`HeroSkillDef.ranks`, index 0 = Novice). Fonctions
 * pures lisant uniquement `hero.skills` + `state.skillCatalog`, toutes
 * consommées par le moteur : luck/moral/mêlée/tir/armure dans `combat/damage.ts`
 * et `combat/state-helpers.ts`, PM dans `core/engine.ts` (`heroDailyMovement`),
 * vision dans `adventure/movement.ts` (`revealAround`), or/jour dans
 * `core/engine.ts` (`DayStarted`), réduction de coût de mana dans
 * `hero/spells.ts` (`effectiveManaCost`).
 *
 * Allégeance de Maison (doc 16 §3.1, signature `houseAllegiance`) : chaque
 * accesseur additionne AUSSI les effets résolus de la Maison du héros
 * (`hero.houseEffects`), qui réutilisent le même vocabulaire d'effets — c'est
 * l'unique interprétation moteur des Maisons, sans jamais nommer de faction.
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

/**
 * Somme du champ `field` sur les effets déclaratifs PROPRES AU HÉROS : sa Maison
 * (doc 16 §3.1, signature `houseAllegiance`) ET sa spécialité (doc 02 §1.2,
 * H-NAMED). Les deux réutilisent le vocabulaire d'effets des compétences : elles
 * s'agrègent donc AU MÊME TITRE que les compétences dans chaque accesseur
 * ci-dessous — l'unique point du moteur qui les interprète, sans jamais nommer
 * de faction, de Maison ni de héros.
 */
function sumHouseField(hero: HeroState, field: keyof SkillRankEffect): number {
  let total = 0;
  for (const effect of hero.houseEffects) total += effect[field] ?? 0;
  for (const effect of hero.specialtyEffects) total += effect[field] ?? 0;
  return total;
}

/**
 * Effets de Maison **TOWN-SCOPED** (F-HOUSES, doc 16 §3.1 — Le Blaireau) : somme
 * du champ `field` sur les effets de Maison/spécialité des héros du
 * **propriétaire** présents SUR la tuile de la ville (option B — « le héros
 * apporte sa Maison à la ville où il se tient »). Intermittent par conception.
 * Jumeau town-scoped de `sumHouseField` ; ne nomme jamais de faction ni de Maison.
 * Consommé par `applyWeeklyGrowth` (`garrisonGrowthPct`) et le siège
 * (`garrisonDefense`).
 */
export function townHouseField(
  heroes: readonly HeroState[],
  ownerPlayerId: string,
  townPos: { x: number; y: number },
  field: keyof SkillRankEffect,
): number {
  let total = 0;
  for (const hero of heroes) {
    if (hero.playerId !== ownerPlayerId) continue;
    if (hero.pos.x !== townPos.x || hero.pos.y !== townPos.y) continue;
    for (const effect of hero.houseEffects) total += effect[field] ?? 0;
    for (const effect of hero.specialtyEffects) total += effect[field] ?? 0;
  }
  return total;
}

/** Logistique : bonus % de points de mouvement quotidiens (`heroDailyMovement`). */
export function heroMovementBonus(hero: HeroState, catalog: Record<string, HeroSkillDef>): number {
  return sumRankField(hero, catalog, 'movementBonusPct') + sumHouseField(hero, 'movementBonusPct');
}

/** Recherche : bonus de rayon de vision — branché dans la révélation du brouillard (`revealAround`). */
export function heroVisionBonus(hero: HeroState, catalog: Record<string, HeroSkillDef>): number {
  return sumRankField(hero, catalog, 'visionBonus') + sumHouseField(hero, 'visionBonus');
}

/** Économie : or/jour supplémentaire — branché dans le revenu quotidien (`core/engine.ts`). */
export function heroGoldPerDay(hero: HeroState, catalog: Record<string, HeroSkillDef>): number {
  return sumRankField(hero, catalog, 'goldPerDay') + sumHouseField(hero, 'goldPerDay');
}

/** Chance (compétence) — combiné aux artefacts et borné [0,3] dans `combat/damage.ts`. */
export function heroLuck(hero: HeroState, catalog: Record<string, HeroSkillDef>): number {
  return sumRankField(hero, catalog, 'luckBonus') + sumHouseField(hero, 'luckBonus');
}

/** Commandement (compétence) — moral, branché au moral de pile via `moraleOf` (state-helpers.ts). */
export function heroMorale(hero: HeroState, catalog: Record<string, HeroSkillDef>): number {
  return sumRankField(hero, catalog, 'moraleBonus') + sumHouseField(hero, 'moraleBonus');
}

/** Attaque au corps : bonus % de dégâts en mêlée — branché dans `combat/damage.ts`. */
export function heroMeleePct(hero: HeroState, catalog: Record<string, HeroSkillDef>): number {
  return sumRankField(hero, catalog, 'meleeDamagePct') + sumHouseField(hero, 'meleeDamagePct');
}

/** Tir : bonus % de dégâts à distance — branché dans `combat/damage.ts`. */
export function heroRangedPct(hero: HeroState, catalog: Record<string, HeroSkillDef>): number {
  return sumRankField(hero, catalog, 'rangedDamagePct') + sumHouseField(hero, 'rangedDamagePct');
}

/** Armure : réduction % des dégâts subis — branché dans `combat/damage.ts`. */
export function heroArmorPct(hero: HeroState, catalog: Record<string, HeroSkillDef>): number {
  return sumRankField(hero, catalog, 'armorReductionPct') + sumHouseField(hero, 'armorReductionPct');
}

/**
 * Cercle de base apprenable sans compétence Sagesse (doc 02 §1.3, H2) : les
 * cercles 1 à 3 sont libres ; les hauts cercles (4-5) exigent Sagesse.
 */
export const BASE_LEARNABLE_CIRCLE = 3;

/**
 * Cercle de sort le plus élevé que ce héros peut APPRENDRE à la guilde des mages
 * (G2/H2) : base 3, relevé par la compétence Sagesse (`learnCircle` du rang
 * courant). N'affecte PAS le lancement d'un sort déjà connu — seulement
 * l'apprentissage. Prend le max (pas la somme) : un seul palier de déblocage.
 */
export function heroLearnableCircle(hero: HeroState, catalog: Record<string, HeroSkillDef>): number {
  let max = BASE_LEARNABLE_CIRCLE;
  for (const [skillId, rank] of Object.entries(hero.skills)) {
    const unlock = catalog[skillId]?.ranks[rank - 1]?.learnCircle;
    if (unlock !== undefined && unlock > max) max = unlock;
  }
  return max;
}

/**
 * Magie par école (doc 02 §1.3) : réduction % du coût en mana des sorts de
 * `school` — seules les compétences DÉCLARANT cette école comptent (A6). Une
 * compétence Magie du Feu ne réduit pas un sort d'Eau/de Traque. Branché dans
 * `hero/spells.ts` (`effectiveManaCost`, qui transmet `spell.school`).
 */
export function heroManaCostReduction(
  hero: HeroState,
  catalog: Record<string, HeroSkillDef>,
  school: SpellSchool,
): number {
  let total = 0;
  for (const [skillId, rank] of Object.entries(hero.skills)) {
    const def = catalog[skillId];
    if (!def || def.school !== school) continue;
    total += def.ranks[rank - 1]?.manaCostReductionPct ?? 0;
  }
  // La réduction de coût de mana d'une Maison (doc 16) est agnostique de l'école
  // (contrairement à la compétence Magie par école, A6) : elle s'applique à tout sort.
  return total + sumHouseField(hero, 'manaCostReductionPct');
}
