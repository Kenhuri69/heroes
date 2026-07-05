import { rollRange } from '../core/rng';
import type { GameState } from '../core/state';
import { heroArtifactBonus } from '../hero/artifacts';
import { heroArmorPct, heroLuck, heroMeleePct, heroRangedPct } from '../hero/skills';
import type { SpellStatus } from '../hero/types';
import { canShoot } from './actions';
import { hexDistance } from './hex';
import { clamp, isShooterMeleePenalized, recordLoss } from './state-helpers';
import type { CombatSideId, CombatStack, CombatUnitDef, CombatState } from './types';
import type { CombatRulesConfig } from '../adventure/config';
import type { GameEvent } from '../core/events';
import type { Draft } from './draft';

/**
 * Dégâts (doc 02 §5.3) : formule commune à la résolution réelle (avec RNG,
 * `performStrike`) et à la prévisualisation (`estimateDamage`, sans RNG) —
 * même code, seule la source des dégâts de base diffère.
 *
 * Attribut héros (décision plan phase-3.2 #4) : l'attaque/défense effectives
 * injectent `heroAttackOf`/`heroDefenseOf` (attribut + artefacts) et la somme
 * des `attackMod`/`defenseMod` des statuts actifs de la pile (buffs/debuffs de
 * sort) ; `heroDamagePct`/`heroArmorPct` portent les compétences combat
 * (Attaque au corps/Tir, Armure). Tout reste à 0 hors héros lié — comportement
 * d'arène inchangé. Le moral du héros (Commandement) n'est PAS branché ici :
 * `moraleOf` vit dans `state-helpers.ts`, hors périmètre du lot K.
 */

interface MultiplierInput {
  strikerAttack: number;
  targetDefense: number;
  targetDefending: boolean;
  targetMarks: number;
  meleePenalized: boolean;
  rules: CombatRulesConfig;
  /** Bonus % de dégâts (compétence Attaque au corps/Tir du héros attaquant) — 0 hors héros. */
  heroDamagePct?: number;
  /** Réduction % d'armure du héros défenseur (compétence Armure) — 0 hors héros. */
  heroArmorPct?: number;
  /** Burst de la capacité `consumeMarks` (doc 05 §3.1) : ×(1+bonus) cette frappe — 0 si inactif. */
  markConsumeBonus?: number;
  /** Bonus de la forme démon (`demonform`, doc 05 §4) : ×(1+bonus) tant que transformé — 0 sinon. */
  demonBonus?: number;
}

/** Paramètres de la capacité `demonform` (doc 05 §4) d'une unité, ou `null`. */
export function demonformParams(
  def: CombatUnitDef,
): { damageBonus: number; magicResistance: number } | null {
  const ability = def.abilities.find((a) => a.id === 'demonform');
  if (!ability) return null;
  return {
    damageBonus: Number(ability.params?.['damageBonus'] ?? 0),
    magicResistance: Number(ability.params?.['magicResistance'] ?? 0),
  };
}

/**
 * Résistance à la magie d'une pile (doc 05 §4) : la forme humaine d'une unité
 * `demonform` réduit les dégâts de sort ; la forme démon (transformée) non.
 */
export function magicResistanceOf(def: CombatUnitDef, transformed: boolean): number {
  const demon = demonformParams(def);
  return demon && !transformed ? demon.magicResistance : 0;
}

/**
 * Plan de consommation de Marque (capacité générique `consumeMarks`, doc 05
 * §3.1) : si l'attaquant porte la capacité et que la cible a assez de charges,
 * renvoie le coût et le bonus de dégâts de la frappe ; sinon `null`. Pur (aucun
 * effet de bord) — la frappe réelle consomme, la prévisualisation ne fait que
 * lire le bonus.
 */
export function consumeMarksPlan(
  strikerDef: CombatUnitDef,
  victimMarks: number,
): { cost: number; damageBonus: number; suppressRetaliation: boolean; immobilizeRounds: number } | null {
  const ability = strikerDef.abilities.find((a) => a.id === 'consumeMarks');
  if (!ability) return null;
  const cost = Number(ability.params?.['cost'] ?? 0);
  const damageBonus = Number(ability.params?.['damageBonus'] ?? 0);
  const suppressRetaliation = ability.params?.['suppressRetaliation'] === true;
  const immobilizeRounds = Number(ability.params?.['immobilizeRounds'] ?? 0);
  if (cost <= 0 || victimMarks < cost) return null;
  return { cost, damageBonus, suppressRetaliation, immobilizeRounds };
}

/** Multiplicateur global (diff attaque/défense, pénalité mêlée forcée, marques, héros) — sans chance. */
export function computeMultiplier(input: MultiplierInput): number {
  const {
    strikerAttack,
    targetDefense,
    targetDefending,
    targetMarks,
    meleePenalized,
    rules,
    heroDamagePct,
    heroArmorPct: armorPct,
    markConsumeBonus,
    demonBonus,
  } = input;
  const effectiveDefense = targetDefending
    ? Math.floor(targetDefense * rules.defendDefenseMultiplier)
    : targetDefense;
  const diff = strikerAttack - effectiveDefense;
  const factor = clamp(rules.attackDefenseStep * diff, -rules.damageReductionMax, rules.damageBonusMax);
  let mult = 1 + factor;
  if (meleePenalized) mult *= rules.rangedMeleePenalty;
  mult *= 1 + rules.markBonusPerStack * targetMarks;
  mult *= 1 + (markConsumeBonus ?? 0);
  mult *= 1 + (demonBonus ?? 0);
  mult *= 1 + (heroDamagePct ?? 0);
  mult *= 1 - (armorPct ?? 0);
  return mult;
}

/** Héros lié au camp `side` du combat (`attackerHeroId`/`defenderHeroId`), ou aucun. */
function heroForSide(state: GameState, combat: CombatState, side: CombatSideId) {
  const heroId = side === 'attacker' ? combat.attackerHeroId : combat.defenderHeroId;
  return heroId ? state.heroes.find((h) => h.id === heroId) : undefined;
}

/** Attaque additionnelle du héros lié au camp (attribut + artefacts) — 0 si aucun héros. */
export function heroAttackOf(state: GameState, combat: CombatState, side: CombatSideId): number {
  const hero = heroForSide(state, combat, side);
  if (!hero) return 0;
  return hero.attributes.attack + heroArtifactBonus(hero, state.artifactCatalog).attack;
}

/** Défense additionnelle du héros lié au camp (attribut + artefacts) — 0 si aucun héros. */
export function heroDefenseOf(state: GameState, combat: CombatState, side: CombatSideId): number {
  const hero = heroForSide(state, combat, side);
  if (!hero) return 0;
  return hero.attributes.defense + heroArtifactBonus(hero, state.artifactCatalog).defense;
}

/** Chance du héros (compétence + artefacts), bornée [0,3] — 0 si aucun héros. */
export function heroLuckOf(state: GameState, combat: CombatState, side: CombatSideId): number {
  const hero = heroForSide(state, combat, side);
  if (!hero) return 0;
  const total = heroLuck(hero, state.skillCatalog) + heroArtifactBonus(hero, state.artifactCatalog).luck;
  return clamp(total, 0, 3);
}

/** Bonus % de dégâts mêlée du héros lié au camp (compétence Attaque au corps) — fraction (0,10 = +10 %). */
function heroMeleePctOf(state: GameState, combat: CombatState, side: CombatSideId): number {
  const hero = heroForSide(state, combat, side);
  return hero ? heroMeleePct(hero, state.skillCatalog) / 100 : 0;
}

/** Bonus % de dégâts à distance du héros lié au camp (compétence Tir) — fraction. */
function heroRangedPctOf(state: GameState, combat: CombatState, side: CombatSideId): number {
  const hero = heroForSide(state, combat, side);
  return hero ? heroRangedPct(hero, state.skillCatalog) / 100 : 0;
}

/** Réduction % d'armure du héros lié au camp défenseur (compétence Armure) — fraction. */
function heroArmorPctOf(state: GameState, combat: CombatState, side: CombatSideId): number {
  const hero = heroForSide(state, combat, side);
  return hero ? heroArmorPct(hero, state.skillCatalog) / 100 : 0;
}

/** Somme d'un modificateur de statut temporaire (buff/debuff de sort) sur une pile. */
function statusModSum(statuses: SpellStatus[], key: 'attackMod' | 'defenseMod'): number {
  return statuses.reduce((sum, s) => sum + s[key], 0);
}

/** Pertes entières (créatures + PV entamés) infligées par un total de dégâts. */
export function killsFromDamage(pool: number, hp: number, count: number, damage: number): number {
  const remaining = Math.max(0, pool - damage);
  const newCount = remaining <= 0 ? 0 : Math.min(count, Math.ceil(remaining / hp));
  return count - newCount;
}

interface StrikeParams {
  striker: CombatStack;
  victim: CombatStack;
  strikerDef: CombatUnitDef;
  victimDef: CombatUnitDef;
  meleePenalized: boolean;
  retaliation: boolean;
  /**
   * Frappe à distance (compétence Tir) vs mêlée (compétence Attaque au corps) —
   * décidé par l'appelant (`canShoot`), pas ré-approximé ici : la résolution et
   * la prévisualisation (`estimateDamage`) partagent ainsi le même critère
   * (remédiation R1 E5). Une riposte est toujours une mêlée (`false`).
   */
  ranged: boolean;
  rules: CombatRulesConfig;
}

/** Une frappe réelle (RNG threadé via `draft.rng`) : dégâts, pertes, marque, mort éventuelle. */
export function performStrike(
  draft: Draft,
  events: GameEvent[],
  params: StrikeParams,
): { targetDied: boolean } {
  const { striker, victim, strikerDef, victimDef, meleePenalized, retaliation, ranged, rules } = params;
  let base = 0;
  for (let i = 0; i < striker.count; i++) {
    const r = rollRange(draft.rng, strikerDef.stats.damage[0], strikerDef.stats.damage[1]);
    draft.rng = r.state;
    base += r.value;
  }
  const combat = draft.combat;
  const strikerAttack =
    strikerDef.stats.attack +
    (combat ? heroAttackOf(draft, combat, striker.side) : 0) +
    statusModSum(striker.statuses, 'attackMod');
  const targetDefense =
    victimDef.stats.defense +
    (combat ? heroDefenseOf(draft, combat, victim.side) : 0) +
    statusModSum(victim.statuses, 'defenseMod');
  const heroDamagePct = combat
    ? ranged
      ? heroRangedPctOf(draft, combat, striker.side)
      : heroMeleePctOf(draft, combat, striker.side)
    : 0;
  const heroArmor = combat ? heroArmorPctOf(draft, combat, victim.side) : 0;
  const consume = consumeMarksPlan(strikerDef, victim.marks);
  // `demonform` (doc 05 §4) : bascule en forme démon à la 1ʳᵉ attaque, puis
  // toutes ses frappes gagnent le bonus (et la résistance à la magie est perdue).
  const demon = demonformParams(strikerDef);
  if (demon && !striker.transformed) {
    striker.transformed = true;
    events.push({ type: 'StackTransformed', stackId: striker.id });
  }
  const mult = computeMultiplier({
    strikerAttack,
    targetDefense,
    targetDefending: victim.defending,
    targetMarks: victim.marks,
    meleePenalized,
    rules,
    heroDamagePct,
    heroArmorPct: heroArmor,
    markConsumeBonus: consume?.damageBonus ?? 0,
    demonBonus: demon && striker.transformed ? demon.damageBonus : 0,
  });
  const luck = combat ? heroLuckOf(draft, combat, striker.side) : 0;
  const luckRoll = rollRange(draft.rng, 0, 99);
  draft.rng = luckRoll.state;
  const lucky = luckRoll.value < Math.round(rules.luckChancePerPoint * luck * 100);
  const damage = Math.round(base * mult * (lucky ? 2 : 1));

  const pool = (victim.count - 1) * victimDef.stats.hp + victim.firstHp;
  const remaining = Math.max(0, pool - damage);
  const newCount = remaining <= 0 ? 0 : Math.min(victim.count, Math.ceil(remaining / victimDef.stats.hp));
  const kills = victim.count - newCount;
  victim.count = newCount;
  victim.firstHp = newCount > 0 ? remaining - (newCount - 1) * victimDef.stats.hp : 0;

  if (combat) recordLoss(combat, victim.side, victim.unitId, kills);

  // Consommation des charges de Marque (capacité générique `consumeMarks`,
  // doc 05 §3.1) : le burst de dégâts a déjà été appliqué via `mult` ; on retire
  // les charges dépensées. Avant la ré-application de `mark` ci-dessous.
  if (consume) {
    victim.marks = Math.max(0, victim.marks - consume.cost);
    // `expose` (doc 05 §3.1) : la cible perd sa riposte cette attaque — la
    // riposte est décidée sur `retaliationsLeft` dans `actions.ts`.
    if (consume.suppressRetaliation) victim.retaliationsLeft = 0;
    // `pinningShot` (doc 05 §3.1) : la cible saute son/ses prochain(s) tour(s).
    if (consume.immobilizeRounds > 0)
      victim.immobilizedRounds = Math.max(victim.immobilizedRounds, consume.immobilizeRounds);
    events.push({
      type: 'MarksConsumed',
      strikerId: striker.id,
      targetId: victim.id,
      consumed: consume.cost,
    });
  }

  if (strikerDef.abilities.some((a) => a.id === 'mark') && victim.count > 0) {
    const before = victim.marks;
    victim.marks = Math.min(rules.marksMax, victim.marks + 1);
    if (victim.marks !== before) {
      events.push({ type: 'MarkApplied', targetId: victim.id, marks: victim.marks });
    }
  }

  events.push({
    type: 'StackAttacked',
    attackerId: striker.id,
    targetId: victim.id,
    damage,
    kills,
    lucky,
    retaliation,
  });

  const targetDied = victim.count <= 0;
  if (targetDied && combat) {
    events.push({ type: 'StackDied', stackId: victim.id });
    const idx = combat.stacks.findIndex((s) => s.id === victim.id);
    if (idx !== -1) combat.stacks.splice(idx, 1);
  }
  return { targetDied };
}

/** Estimation min/max SANS RNG (doc 08 §2.4) — même formule, sans le tirage de chance. */
export function estimateDamage(
  state: GameState,
  attackerId: string,
  targetId: string,
): {
  damageMin: number;
  damageMax: number;
  killsMin: number;
  killsMax: number;
  retaliation: { damageMin: number; damageMax: number } | null;
} {
  const combat = state.combat;
  if (!combat) throw new Error('estimateDamage: aucun combat en cours');
  const attacker = combat.stacks.find((s) => s.id === attackerId);
  const target = combat.stacks.find((s) => s.id === targetId);
  if (!attacker || !target) throw new Error('estimateDamage: pile introuvable');
  const catalog = state.unitCatalog;
  const attackerDef = catalog[attacker.unitId];
  const targetDef = catalog[target.unitId];
  if (!attackerDef || !targetDef) throw new Error('estimateDamage: unité inconnue du catalogue');
  if (!state.config) throw new Error('estimateDamage: config absente');
  const rules = state.config.combat;

  const ranged = canShoot(state, attackerId);
  const meleePenalized = !ranged && isShooterMeleePenalized(attackerDef);
  const strikerAttack =
    attackerDef.stats.attack +
    heroAttackOf(state, combat, attacker.side) +
    statusModSum(attacker.statuses, 'attackMod');
  const targetDefenseVal =
    targetDef.stats.defense +
    heroDefenseOf(state, combat, target.side) +
    statusModSum(target.statuses, 'defenseMod');
  const heroDamagePct = ranged
    ? heroRangedPctOf(state, combat, attacker.side)
    : heroMeleePctOf(state, combat, attacker.side);
  const heroArmor = heroArmorPctOf(state, combat, target.side);
  const mult = computeMultiplier({
    strikerAttack,
    targetDefense: targetDefenseVal,
    targetDefending: target.defending,
    targetMarks: target.marks,
    meleePenalized,
    rules,
    heroDamagePct,
    heroArmorPct: heroArmor,
    markConsumeBonus: consumeMarksPlan(attackerDef, target.marks)?.damageBonus ?? 0,
    // `demonform` : la frappe transforme l'attaquant s'il ne l'est pas déjà, donc
    // la prévisualisation reflète toujours le bonus de la forme démon.
    demonBonus: demonformParams(attackerDef)?.damageBonus ?? 0,
  });
  const [dmgMin, dmgMax] = attackerDef.stats.damage;
  const baseMin = attacker.count * dmgMin;
  const baseMax = attacker.count * dmgMax;
  const damageMin = Math.round(baseMin * mult);
  const damageMax = Math.round(baseMax * mult);

  const pool = (target.count - 1) * targetDef.stats.hp + target.firstHp;
  const killsMin = killsFromDamage(pool, targetDef.stats.hp, target.count, damageMin);
  const killsMax = killsFromDamage(pool, targetDef.stats.hp, target.count, damageMax);

  let retaliation: { damageMin: number; damageMax: number } | null = null;
  // `expose` (doc 05 §3.1) : l'attaque va supprimer la riposte de la cible.
  const willExpose = consumeMarksPlan(attackerDef, target.marks)?.suppressRetaliation ?? false;
  const canRetaliate =
    !ranged &&
    !willExpose &&
    target.retaliationsLeft > 0 &&
    !targetDef.abilities.some((a) => a.id === 'noRetaliation');
  if (canRetaliate) {
    const survivorsAfterMaxDamage = target.count - killsMax;
    const survivorsAfterMinDamage = target.count - killsMin;
    const retMeleePenalized = isShooterMeleePenalized(targetDef);
    // Riposte : toujours une frappe de mêlée (compétence Attaque au corps du défenseur).
    const retStrikerAttack =
      targetDef.stats.attack +
      heroAttackOf(state, combat, target.side) +
      statusModSum(target.statuses, 'attackMod');
    const retTargetDefense =
      attackerDef.stats.defense +
      heroDefenseOf(state, combat, attacker.side) +
      statusModSum(attacker.statuses, 'defenseMod');
    const retMult = computeMultiplier({
      strikerAttack: retStrikerAttack,
      targetDefense: retTargetDefense,
      targetDefending: attacker.defending,
      targetMarks: attacker.marks,
      meleePenalized: retMeleePenalized,
      rules,
      heroDamagePct: heroMeleePctOf(state, combat, target.side),
      heroArmorPct: heroArmorPctOf(state, combat, attacker.side),
    });
    const [retDmgMin, retDmgMax] = targetDef.stats.damage;
    retaliation = {
      damageMin: Math.round(survivorsAfterMaxDamage * retDmgMin * retMult),
      damageMax: Math.round(survivorsAfterMinDamage * retDmgMax * retMult),
    };
  }

  return { damageMin, damageMax, killsMin, killsMax, retaliation };
}

/** Un ennemi est-il adjacent à la pile (utilisé par la pénalité de tir au contact) ? */
export function hasAdjacentEnemy(stack: CombatStack, combat: CombatState): boolean {
  return combat.stacks.some((s) => s.side !== stack.side && s.count > 0 && hexDistance(s.pos, stack.pos) === 1);
}

export type { CombatSideId };
