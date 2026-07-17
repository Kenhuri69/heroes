import type { HeroState } from '../core/state';
import { heroArtifactBonus } from './artifacts';
import type { ArtifactDef, HeroSkillDef, SkillRankEffect, SpellSchool } from './types';

/**
 * Champs SCALAIRES du vocabulaire d'effets — agrégés à plat. On EXCLUT les champs
 * OBJET (`conditional`, interprété au niveau unité via `conditionalUnitBonus` ;
 * `startingArmyBonus`, armée de départ H-COND-EXACT lue à `StartGame`) : jamais
 * sommés à plat.
 */
type NumericEffectField = Exclude<keyof SkillRankEffect, 'conditional' | 'startingArmyBonus'>;

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
  field: NumericEffectField,
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
function sumHouseField(hero: HeroState, field: NumericEffectField): number {
  return sumHeroEffectField(hero, field);
}

/**
 * Somme générique d'un champ scalaire d'effet de héros sur sa Maison + sa
 * spécialité — version EXPORTÉE de `sumHouseField`, consommée hors de ce module
 * par les points d'extension H-COND-EXACT : `raiseUndeadPctPerLevel`
 * (`faction/effects.ts`) et `startingSymbiosisStacks` (`combat/setup.ts`).
 * Aucun nom de faction/Maison/héros — que des ids opaques.
 */
export function sumHeroEffectField(hero: HeroState, field: NumericEffectField): number {
  let total = 0;
  for (const effect of hero.houseEffects) total += effect[field] ?? 0;
  for (const effect of hero.specialtyEffects) total += effect[field] ?? 0;
  // Perks d'archétype (doc 18 C1, lot 3.1) — même vocabulaire, même agrégation.
  for (const effect of hero.archetypeEffects ?? []) total += effect[field] ?? 0;
  return total;
}

/** Cap de base des piles d'armée d'un héros (doc 02 §5.1). */
export const BASE_ARMY_STACKS = 7;

/**
 * Cap de piles de l'armée d'UN héros (doc 18 C1, lot 3.1) : 7 de base +
 * `armySlotsBonus` agrégé (perk Might via archétype, cumulable avec une
 * compétence/Maison future). Consommé par TOUS les sites qui ajoutent une pile
 * à une armée de héros — la garnison de ville reste à 7 (trait de héros).
 */
export function heroArmyCap(hero: HeroState): number {
  return BASE_ARMY_STACKS + Math.max(0, sumHeroEffectField(hero, 'armySlotsBonus'));
}

/**
 * Actions de héros autorisées par round de combat (doc 18 C1, lot 3.1) :
 * 1 de base (doc 02 §1 « sort OU frappe ») + `heroActionsPerRound` agrégé
 * (perk Magic). À 2, le héros peut sort ET frappe dans le même round.
 */
export function heroActionsAllowed(hero: HeroState): number {
  return 1 + Math.max(0, sumHeroEffectField(hero, 'heroActionsPerRound'));
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
  field: NumericEffectField,
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

/**
 * Rayon de vision EFFECTIF du héros en tuiles (H-ARTEQUIP) : rayon de base +
 * bonus Recherche/Maison (`heroVisionBonus`) + bonus plat d'artefact équipé
 * (« longue-vue », `bonus.vision`). Helper UNIQUE consommé par tous les sites de
 * révélation du brouillard (mouvement, téléport, StartGame, recrutement, sort
 * d'aventure) et par le rendu de vision live du client — dédup du motif
 * `baseRadius + heroVisionBonus(…)`.
 */
export function heroVisionRadius(
  hero: HeroState,
  baseRadius: number,
  skillCatalog: Record<string, HeroSkillDef>,
  artifactCatalog: Record<string, ArtifactDef>,
): number {
  return baseRadius + heroVisionBonus(hero, skillCatalog) + heroArtifactBonus(hero, artifactCatalog).vision;
}

/** Tactique (C-TACTICS, doc 02 §5.1) : profondeur de la bande de placement pré-combat (0 = pas de phase). */
export function heroTacticsColumns(hero: HeroState, catalog: Record<string, HeroSkillDef>): number {
  return sumRankField(hero, catalog, 'tacticsColumns');
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

/** Prière de bataille (F-SKILLS.2) — PV soignés/ressuscités 1×/combat ; 0 ⇒ action indisponible. */
export function heroBattlePrayerHp(hero: HeroState, catalog: Record<string, HeroSkillDef>): number {
  return sumRankField(hero, catalog, 'battleResurrectHp') + sumHouseField(hero, 'battleResurrectHp');
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
 * Cercle de base apprenable sans compétence Sagesse (doc 02 §1.3, H2, fidélité
 * HoMM3) : seuls les cercles 1 et 2 sont libres ; les cercles 3 à 5 exigent
 * Sagesse (basic → 3, avancé → 4, expert → 5).
 */
export const BASE_LEARNABLE_CIRCLE = 2;

/**
 * Cercle de sort le plus élevé que ce héros peut APPRENDRE à la guilde des mages
 * (G2/H2) : base 2, relevé par la compétence Sagesse (`learnCircle` du rang
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

/**
 * Maîtrise d'une école de magie (doc 02 §1.3, C-SPELLUI.4) : rang le plus élevé
 * parmi les compétences DÉCLARANT cette `school` (une Magie du Feu de rang 2 ⇒
 * maîtrise 2 en Feu). `0` = aucune compétence de cette école (maîtrise de base).
 * Pure et générique (aucune école en dur) ; le grimoire client l'affiche pour
 * situer la proficience du héros (qui pilote la réduction de coût de mana, A6).
 */
export function heroSchoolMastery(
  hero: HeroState,
  catalog: Record<string, HeroSkillDef>,
  school: SpellSchool,
): number {
  let max = 0;
  for (const [skillId, rank] of Object.entries(hero.skills)) {
    if (catalog[skillId]?.school === school && rank > max) max = rank;
  }
  return max;
}
