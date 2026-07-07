import type { HeroState } from '../core/state';
import { heroArtifactBonus } from './artifacts';
import { heroManaCostReduction } from './skills';
import type { ArtifactDef, HeroSkillDef, SpellDef } from './types';

/**
 * Calculs purs des sorts (doc 02 §1.1, §1.4, décision plan phase-3.2 #3) —
 * aucun accès au combat ni au RNG : la mutation de l'état (pertes de pile,
 * statuts, mana) et le tirage de chance vivent dans `hero/index.ts`
 * (`handleCastSpell`), qui est le seul point à manipuler le draft Immer.
 */

/** Coût de mana effectif après réduction (compétences Magie par école). */
export function effectiveManaCost(
  hero: HeroState,
  skillCatalog: Record<string, HeroSkillDef>,
  spell: SpellDef,
): number {
  const reductionPct = heroManaCostReduction(hero, skillCatalog, spell.school);
  return Math.max(0, Math.round(spell.manaCost * (1 - reductionPct / 100)));
}

/** Pouvoir effectif (attribut + bonus d'artefacts) — pilote base/perPower des sorts. */
export function effectivePower(hero: HeroState, artifactCatalog: Record<string, ArtifactDef>): number {
  return hero.attributes.power + heroArtifactBonus(hero, artifactCatalog).power;
}

/**
 * Dégâts d'un sort (décision plan #3, doc 05 §6) :
 * `round((base + perPower × Pouvoir) × (1 + markBonus) × (1 − magicResistance) × (lucky ? 2 : 1))`.
 * `markBonus` = amplification des Marques de la cible (comme les frappes, doc 05
 * §3.1 : +8 %/charge) — 0 si la cible n'en porte pas. `magicResistance` = 0 hors
 * `demonform`.
 */
export function spellDamageAmount(
  spell: SpellDef,
  power: number,
  lucky: boolean,
  magicResistance = 0,
  markBonus = 0,
): number {
  return Math.round(
    (spell.base + spell.perPower * power) * (1 + markBonus) * (1 - magicResistance) * (lucky ? 2 : 1),
  );
}

/** Soin d'un sort — même base que les dégâts, sans résistance ni chance. */
export function spellHealAmount(spell: SpellDef, power: number): number {
  return Math.round(spell.base + spell.perPower * power);
}

/** Durée d'un buff/debuff en rounds — `Pouvoir`, minimum 1 (décision plan #3). */
export function spellStatusDuration(power: number): number {
  return Math.max(1, power);
}
