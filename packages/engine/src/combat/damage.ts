import { rollRange } from '../core/rng';
import type { GameState } from '../core/state';
import { heroArtifactBonus } from '../hero/artifacts';
import { heroArmorPct, heroLuck, heroMeleePct, heroRangedPct } from '../hero/skills';
import type { SpellStatus } from '../hero/types';
import { canShootTarget } from './actions';
import { hexDistance } from './hex';
import { clamp, collectCasualties, isShooterMeleePenalized, recordLoss } from './state-helpers';
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
 * d'arène inchangé. Le moral du héros (Commandement) n'est pas traité ici mais
 * dans `moraleOf` (`state-helpers.ts`), qui l'ajoute au moral de pile.
 */

interface MultiplierInput {
  strikerAttack: number;
  targetDefense: number;
  /**
   * Attribut Défense du HÉROS défenseur (points), appliqué à sa pente dédiée
   * `heroDefenseStep` (−2,5 %/pt, doc 02 §1.1) — distincte de la pente unités.
   * Hors de `targetDefense` (donc non affecté par le ×1,3 de Défendre). 0 hors héros.
   */
  heroDefense?: number;
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
  /** Multiplicateur de Défense en Défendant (`shieldWall`, A2a) — défaut `rules.defendDefenseMultiplier`. */
  defendMultiplier?: number;
  /** Bonus de charge : ×(1+bonus) de la frappe volontaire après déplacement (`charge`, A2a) — 0 sinon. */
  chargeBonus?: number;
  /** Modificateur MULTIPLICATIF des dégâts infligés par l'attaquant (malédiction « Faux funeste », A2c) — 0 sinon. */
  dealtDamageMod?: number;
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

/** Paramètres de la capacité `symbiosis` (doc 14 §2, Beta 5.3) d'une unité, ou `null`. */
export function symbiosisParams(
  def: CombatUnitDef,
): { attackPerRound: number; defensePerRound: number; maxStacks: number } | null {
  const ability = def.abilities.find((a) => a.id === 'symbiosis');
  if (!ability) return null;
  return {
    attackPerRound: Number(ability.params?.['attackPerRound'] ?? 0),
    defensePerRound: Number(ability.params?.['defensePerRound'] ?? 0),
    maxStacks: Number(ability.params?.['maxStacks'] ?? 0),
  };
}

/** Bonus d'Attaque de Symbiose d'une pile (paliers × params) — 0 hors capacité. */
export function symbiosisAttackBonus(def: CombatUnitDef, stacks: number): number {
  return (symbiosisParams(def)?.attackPerRound ?? 0) * stacks;
}

/** Bonus de Défense de Symbiose d'une pile (paliers × params) — 0 hors capacité. */
export function symbiosisDefenseBonus(def: CombatUnitDef, stacks: number): number {
  return (symbiosisParams(def)?.defensePerRound ?? 0) * stacks;
}

/**
 * Résistance à la magie d'une pile : la forme humaine d'une unité `demonform`
 * réduit les dégâts de sort (doc 05 §4) ; la forme démon (transformée) non. La
 * capacité **autonome** `magicResistance(value)` (A2a — Bibliothécaire AH 30 %,
 * doc 05 §4) s'applique en permanence. On prend le max des deux sources.
 */
export function magicResistanceOf(def: CombatUnitDef, transformed: boolean): number {
  const demon = demonformParams(def);
  const fromDemon = demon && !transformed ? demon.magicResistance : 0;
  const standalone = def.abilities.find((a) => a.id === 'magicResistance');
  const fromStandalone = standalone ? Number(standalone.params?.['value'] ?? 0) : 0;
  return Math.max(fromDemon, fromStandalone);
}

/** Multiplicateur de Défense propre à `shieldWall` (Frère-Lame, doc 03 §3), ou `null`. */
export function shieldWallMultiplier(def: CombatUnitDef): number | null {
  const ability = def.abilities.find((a) => a.id === 'shieldWall');
  if (!ability) return null;
  return Number(ability.params?.['defendMultiplier'] ?? 0) || null;
}

/** Bonus de dégâts par hex parcouru avant la frappe (`charge`, doc 03/04 §3) — 0 hors capacité. */
export function chargePerHex(def: CombatUnitDef): number {
  const ability = def.abilities.find((a) => a.id === 'charge');
  return ability ? Number(ability.params?.['perHex'] ?? 0) : 0;
}

/** Fraction de dégâts rendue en soin/relève par `lifeDrain` (Vampire, doc 04 §3) — 0 hors capacité. */
export function lifeDrainPct(def: CombatUnitDef): number {
  const ability = def.abilities.find((a) => a.id === 'lifeDrain');
  return ability ? Number(ability.params?.['pct'] ?? 0) : 0;
}

/** Probabilité d'esquive d'`incorporeal` (Spectre, doc 04 §3, A2b) — 0 hors capacité. */
export function incorporealDodge(def: CombatUnitDef): number {
  const ability = def.abilities.find((a) => a.id === 'incorporeal');
  return ability ? Number(ability.params?.['dodge'] ?? 0) : 0;
}

/**
 * Bonus de dégâts total de `swarm` (Élève AH doc 05 §4, Chœur Vox doc 16 §4,
 * A3b) : si au moins `minAllies` autres piles alliées de l'attaquant sont
 * adjacentes à la cible, chaque créature de l'attaquant inflige `bonus` de plus
 * (∝ effectif). L'attaquant lui-même est exclu du décompte ⇒ préviz stable
 * (indépendante de la position finale de l'attaquant). 0 hors capacité/condition.
 */
export function swarmBonus(
  strikerDef: CombatUnitDef,
  striker: CombatStack,
  victim: CombatStack,
  combat: CombatState,
): number {
  const ability = strikerDef.abilities.find((a) => a.id === 'swarm');
  if (!ability) return 0;
  const bonus = Number(ability.params?.['bonus'] ?? 0);
  const minAllies = Number(ability.params?.['minAllies'] ?? 0);
  if (bonus <= 0 || minAllies <= 0) return 0;
  const allies = combat.stacks.filter(
    (s) => s.side === striker.side && s.id !== striker.id && s.count > 0 && hexDistance(s.pos, victim.pos) === 1,
  ).length;
  return allies >= minAllies ? striker.count * bonus : 0;
}

/** Statut infligé par `curseOnHit` (Zombie/Cavalier funeste, doc 04 §3, A2c), ou `null`. */
export function curseOnHitPlan(
  def: CombatUnitDef,
): { chance: number; attackMod: number; defenseMod: number; speedMod: number; damageDealtMod: number; rounds: number } | null {
  const ability = def.abilities.find((a) => a.id === 'curseOnHit');
  if (!ability) return null;
  const rounds = Number(ability.params?.['rounds'] ?? 0);
  if (rounds <= 0) return null;
  return {
    chance: Number(ability.params?.['chance'] ?? 0),
    attackMod: Number(ability.params?.['attackMod'] ?? 0),
    defenseMod: Number(ability.params?.['defenseMod'] ?? 0),
    speedMod: Number(ability.params?.['speedMod'] ?? 0),
    damageDealtMod: Number(ability.params?.['damageDealtMod'] ?? 0),
    rounds,
  };
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
    heroDefense,
    targetDefending,
    targetMarks,
    meleePenalized,
    rules,
    heroDamagePct,
    heroArmorPct: armorPct,
    markConsumeBonus,
    demonBonus,
    defendMultiplier,
    chargeBonus,
    dealtDamageMod,
  } = input;
  const effectiveDefense = targetDefending
    ? Math.floor(targetDefense * (defendMultiplier ?? rules.defendDefenseMultiplier))
    : targetDefense;
  const diff = strikerAttack - effectiveDefense;
  // Pente unités (±0,05/pt) MOINS la pente héros dédiée (−0,025/pt de Défense
  // du héros défenseur, doc 02 §1.1) — bornes communes ±(reduction/bonus)Max.
  const raw = rules.attackDefenseStep * diff - rules.heroDefenseStep * (heroDefense ?? 0);
  const factor = clamp(raw, -rules.damageReductionMax, rules.damageBonusMax);
  let mult = 1 + factor;
  if (meleePenalized) mult *= rules.rangedMeleePenalty;
  mult *= 1 + rules.markBonusPerStack * targetMarks;
  mult *= 1 + (markConsumeBonus ?? 0);
  mult *= 1 + (demonBonus ?? 0);
  mult *= 1 + (chargeBonus ?? 0);
  // Malédiction « Faux funeste » (A2c) : réduit multiplicativement les dégâts que
  // l'attaquant inflige tant qu'il porte le statut (damageDealtMod ≤ 0).
  mult *= 1 + (dealtDamageMod ?? 0);
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

/**
 * Chance du héros (compétence + artefacts + fontaine), bornée **[-3,3]**
 * (C-BADLUCK, doc 02 §5.3) — 0 si aucun héros. Une chance négative peut être
 * infligée par un futur malus ; le signe pilote coup de chance (×2) vs
 * malchance (×0,5) dans `performStrike`.
 */
export function heroLuckOf(state: GameState, combat: CombatState, side: CombatSideId): number {
  const hero = heroForSide(state, combat, side);
  if (!hero) return 0;
  const total =
    heroLuck(hero, state.skillCatalog) +
    heroArtifactBonus(hero, state.artifactCatalog).luck +
    hero.visitLuck;
  return clamp(total, -3, 3);
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

/** Somme d'un modificateur de statut temporaire (buff/debuff de sort, malédiction) sur une pile. */
function statusModSum(statuses: SpellStatus[], key: 'attackMod' | 'defenseMod' | 'damageDealtMod'): number {
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
  /** Bonus de charge de CETTE frappe (`perHex × hexes parcourus`, A2a) — 0 par défaut. */
  chargeBonus?: number;
}

/** Une frappe réelle (RNG threadé via `draft.rng`) : dégâts, pertes, marque, mort éventuelle. */
export function performStrike(
  draft: Draft,
  events: GameEvent[],
  params: StrikeParams,
): { targetDied: boolean } {
  const { striker, victim, strikerDef, victimDef, meleePenalized, retaliation, ranged, rules, chargeBonus } = params;
  let base = 0;
  for (let i = 0; i < striker.count; i++) {
    const r = rollRange(draft.rng, strikerDef.stats.damage[0], strikerDef.stats.damage[1]);
    draft.rng = r.state;
    base += r.value;
  }
  const combat = draft.combat;
  // `swarm` (A3b) : bonus plat de meute quand la cible est cernée par les alliés.
  if (combat) base += swarmBonus(strikerDef, striker, victim, combat);
  const strikerAttack =
    strikerDef.stats.attack +
    (combat ? heroAttackOf(draft, combat, striker.side) : 0) +
    statusModSum(striker.statuses, 'attackMod') +
    // Symbiose (doc 14 §2, Beta 5.3) : bonus d'Attaque = paliers accumulés × params.
    symbiosisAttackBonus(strikerDef, striker.symbiosisStacks);
  // Défense d'UNITÉ (pente ±0,05) : stats + statuts + murs de siège + Symbiose.
  // La Défense du HÉROS est appliquée à part (pente −0,025, A3) via computeMultiplier.
  const targetDefense =
    victimDef.stats.defense +
    statusModSum(victim.statuses, 'defenseMod') +
    // Murs du Fort (doc 02 §4.1, Alpha 4.13) : bonus de défense aux piles en
    // garnison (camp défenseur) pendant un siège ; 0 hors combat de ville.
    (combat && victim.side === 'defender' ? combat.wallDefenseBonus : 0) +
    // Symbiose (doc 14 §2) : bonus de Défense = paliers accumulés × params.
    symbiosisDefenseBonus(victimDef, victim.symbiosisStacks);
  const heroDefense = combat ? heroDefenseOf(draft, combat, victim.side) : 0;
  const heroDamagePct = combat
    ? ranged
      ? heroRangedPctOf(draft, combat, striker.side)
      : heroMeleePctOf(draft, combat, striker.side)
    : 0;
  const heroArmor = combat ? heroArmorPctOf(draft, combat, victim.side) : 0;
  // D5 : `consumeMarks` (doc 05 §3.1 « à l'attaque ») ne se déclenche QUE sur une
  // frappe VOLONTAIRE, jamais en riposte — sinon un défenseur marqué consommait
  // ses propres charges en ripostant.
  const consume = retaliation ? null : consumeMarksPlan(strikerDef, victim.marks);
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
    heroDefense,
    targetDefending: victim.defending,
    targetMarks: victim.marks,
    meleePenalized,
    rules,
    heroDamagePct,
    heroArmorPct: heroArmor,
    markConsumeBonus: consume?.damageBonus ?? 0,
    demonBonus: demon && striker.transformed ? demon.damageBonus : 0,
    // `shieldWall` (A2a) : le défenseur qui Défend a un multiplicateur propre.
    defendMultiplier: shieldWallMultiplier(victimDef) ?? rules.defendDefenseMultiplier,
    // `charge` (A2a) : bonus fourni par l'appelant (mêlée volontaire uniquement).
    chargeBonus: retaliation ? 0 : (chargeBonus ?? 0),
    // Malédiction « Faux funeste » (A2c) : dégâts infligés réduits tant que le statut tient.
    dealtDamageMod: statusModSum(striker.statuses, 'damageDealtMod'),
  });
  // Chance/malchance (C-BADLUCK, doc 02 §5.3) : un SEUL jet, interprété selon le
  // signe de la chance — |chance| × 4 %/point de déclencher soit un coup de
  // chance (×2), soit un coup de malchance (×0,5). Chance nulle ⇒ jamais.
  const luck = combat ? heroLuckOf(draft, combat, striker.side) : 0;
  const luckRoll = rollRange(draft.rng, 0, 99);
  draft.rng = luckRoll.state;
  const triggered = luckRoll.value < Math.round(rules.luckChancePerPoint * Math.abs(luck) * 100);
  const lucky = triggered && luck > 0;
  const unlucky = triggered && luck < 0;
  // `incorporeal` (Spectre, doc 04 §3, A2b) : la VICTIME peut esquiver la frappe
  // (dégâts 0). Jet gated sur la présence de la capacité ⇒ n'ajoute un tirage
  // qu'aux combats concernés (flux RNG des autres inchangé, golden stable).
  const dodgeChance = incorporealDodge(victimDef);
  let dodged = false;
  if (dodgeChance > 0) {
    const dodgeRoll = rollRange(draft.rng, 0, 99);
    draft.rng = dodgeRoll.state;
    dodged = dodgeRoll.value < Math.round(dodgeChance * 100);
  }
  const damage = dodged ? 0 : Math.round(base * mult * (lucky ? 2 : unlucky ? 0.5 : 1));

  const pool = (victim.count - 1) * victimDef.stats.hp + victim.firstHp;
  const remaining = Math.max(0, pool - damage);
  const newCount = remaining <= 0 ? 0 : Math.min(victim.count, Math.ceil(remaining / victimDef.stats.hp));
  const kills = victim.count - newCount;
  victim.count = newCount;
  victim.firstHp = newCount > 0 ? remaining - (newCount - 1) * victimDef.stats.hp : 0;

  if (combat) recordLoss(combat, victim.side, victim.unitId, kills);

  // Consommation des charges de Marque (capacité générique `consumeMarks`,
  // doc 05 §3.1) : le burst de dégâts a déjà été appliqué via `mult` ; on retire
  // les charges dépensées. Avant la ré-application de `mark` ci-dessous. Une
  // frappe esquivée (A2b) ne consomme rien (aucun impact).
  if (consume && !dodged) {
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

  // Une frappe esquivée (A2b) n'applique pas de Marque (aucun impact).
  if (!dodged && strikerDef.abilities.some((a) => a.id === 'mark') && victim.count > 0) {
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
    unlucky,
    dodged,
    retaliation,
    ranged,
  });

  // `lifeDrain` (Vampire, doc 04 §3, A2a) : la pile qui frappe en mêlée se
  // soigne/relève de `pct × dégâts` — plafonné à son effectif de départ
  // (effectif courant + pertes déjà enregistrées, même plafond que le soin de
  // sort). Jamais au tir. Le striker est toujours vivant ici (c'est lui qui frappe).
  const drainPct = ranged ? 0 : lifeDrainPct(strikerDef);
  if (combat && drainPct > 0 && damage > 0 && striker.count > 0) {
    const heal = Math.floor(damage * drainPct);
    if (heal > 0) {
      const strikerPool = (striker.count - 1) * strikerDef.stats.hp + striker.firstHp;
      const lostSoFar =
        collectCasualties(combat).find((c) => c.side === striker.side && c.unitId === striker.unitId)?.lost ?? 0;
      const maxCount = striker.count + lostSoFar;
      const newPool = Math.min(maxCount * strikerDef.stats.hp, strikerPool + heal);
      if (newPool > strikerPool) {
        const drainCount = Math.min(maxCount, Math.max(1, Math.ceil(newPool / strikerDef.stats.hp)));
        striker.count = drainCount;
        striker.firstHp = newPool - (drainCount - 1) * strikerDef.stats.hp;
        events.push({ type: 'StackHealed', stackId: striker.id, amount: newPool - strikerPool });
      }
    }
  }

  // `curseOnHit` (Zombie/Cavalier funeste, doc 04 §3, A2c) : une frappe qui touche
  // (non esquivée, cible survivante — volontaire OU riposte) a une chance
  // d'appliquer/rafraîchir un statut sur la cible. Le jet est gated sur la
  // capacité (aucun tirage hors unité maudissante).
  const curse = dodged ? null : curseOnHitPlan(strikerDef);
  if (curse && victim.count > 0) {
    let applies = curse.chance >= 1;
    if (!applies && curse.chance > 0) {
      const roll = rollRange(draft.rng, 0, 99);
      draft.rng = roll.state;
      applies = roll.value < Math.round(curse.chance * 100);
    }
    if (applies) {
      const spellId = `curse:${strikerDef.id}`;
      const status: SpellStatus = {
        spellId,
        attackMod: curse.attackMod,
        defenseMod: curse.defenseMod,
        speedMod: curse.speedMod,
        damageDealtMod: curse.damageDealtMod,
        roundsLeft: curse.rounds,
      };
      const existing = victim.statuses.find((s) => s.spellId === spellId);
      if (existing) Object.assign(existing, status); // rafraîchit la durée/les mods
      else victim.statuses.push(status);
      events.push({ type: 'StackCursed', targetId: victim.id, spellId });
    }
  }

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

  // C-LOS : la préviz partage le critère de tir PAR CIBLE (ligne de vue) avec
  // la résolution (`applyAttack`) — un tir bloqué s'affiche comme une mêlée.
  const ranged = canShootTarget(state, attackerId, targetId);
  const meleePenalized = !ranged && isShooterMeleePenalized(attackerDef);
  // Mêmes termes que `performStrike` (préviz = résolution sans RNG, doc 08 §2.4) :
  // Symbiose (attaque + défense), murs de siège, et Défense héros à part (A3/A5).
  const strikerAttack =
    attackerDef.stats.attack +
    heroAttackOf(state, combat, attacker.side) +
    statusModSum(attacker.statuses, 'attackMod') +
    symbiosisAttackBonus(attackerDef, attacker.symbiosisStacks);
  const targetDefenseVal =
    targetDef.stats.defense +
    statusModSum(target.statuses, 'defenseMod') +
    (target.side === 'defender' ? combat.wallDefenseBonus : 0) +
    symbiosisDefenseBonus(targetDef, target.symbiosisStacks);
  const heroDamagePct = ranged
    ? heroRangedPctOf(state, combat, attacker.side)
    : heroMeleePctOf(state, combat, attacker.side);
  const heroArmor = heroArmorPctOf(state, combat, target.side);
  const mult = computeMultiplier({
    strikerAttack,
    targetDefense: targetDefenseVal,
    heroDefense: heroDefenseOf(state, combat, target.side),
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
    // `shieldWall` (A2a) : multiplicateur de Défense propre du défenseur.
    defendMultiplier: shieldWallMultiplier(targetDef) ?? rules.defendDefenseMultiplier,
    // Malédiction « Faux funeste » (A2c) : dégâts infligés réduits par le statut.
    dealtDamageMod: statusModSum(attacker.statuses, 'damageDealtMod'),
    // `charge` (A2a) : distance de déplacement inconnue à la préviz (dépend du
    // `from` choisi) ⇒ non reflétée (comme la chance) — bonus de charge omis.
  });
  const [dmgMin, dmgMax] = attackerDef.stats.damage;
  // `swarm` (A3b) : bonus plat ajouté aux bornes (indépendant du multiplicateur,
  // comme les dégâts de base) — stable car l'attaquant est exclu du décompte.
  const swarm = swarmBonus(attackerDef, attacker, target, combat);
  const baseMin = attacker.count * dmgMin + swarm;
  const baseMax = attacker.count * dmgMax + swarm;
  const damageMin = Math.round(baseMin * mult);
  const damageMax = Math.round(baseMax * mult);

  const pool = (target.count - 1) * targetDef.stats.hp + target.firstHp;
  const killsMin = killsFromDamage(pool, targetDef.stats.hp, target.count, damageMin);
  const killsMax = killsFromDamage(pool, targetDef.stats.hp, target.count, damageMax);

  let retaliation: { damageMin: number; damageMax: number } | null = null;
  // `expose` (doc 05 §3.1) : l'attaque va supprimer la riposte de la cible.
  const willExpose = consumeMarksPlan(attackerDef, target.marks)?.suppressRetaliation ?? false;
  // `noRetaliation` porté par l'ATTAQUANT prive la victime de riposte (A2).
  // `unlimitedRetaliation` (Griffon, doc 03 §3, A2a) : la cible peut riposter
  // même sans charge de riposte restante.
  const canRetaliate =
    !ranged &&
    !willExpose &&
    (target.retaliationsLeft > 0 || targetDef.abilities.some((a) => a.id === 'unlimitedRetaliation')) &&
    !attackerDef.abilities.some((a) => a.id === 'noRetaliation') &&
    // `strikeAndReturn` (A2b) : l'attaquant se replie, aucune riposte.
    !attackerDef.abilities.some((a) => a.id === 'strikeAndReturn');
  if (canRetaliate) {
    const survivorsAfterMaxDamage = target.count - killsMax;
    const survivorsAfterMinDamage = target.count - killsMin;
    const retMeleePenalized = isShooterMeleePenalized(targetDef);
    // Riposte : toujours une frappe de mêlée (compétence Attaque au corps du défenseur).
    const retStrikerAttack =
      targetDef.stats.attack +
      heroAttackOf(state, combat, target.side) +
      statusModSum(target.statuses, 'attackMod') +
      symbiosisAttackBonus(targetDef, target.symbiosisStacks);
    const retTargetDefense =
      attackerDef.stats.defense +
      statusModSum(attacker.statuses, 'defenseMod') +
      (attacker.side === 'defender' ? combat.wallDefenseBonus : 0) +
      symbiosisDefenseBonus(attackerDef, attacker.symbiosisStacks);
    const retMult = computeMultiplier({
      strikerAttack: retStrikerAttack,
      targetDefense: retTargetDefense,
      heroDefense: heroDefenseOf(state, combat, attacker.side),
      targetDefending: attacker.defending,
      targetMarks: attacker.marks,
      meleePenalized: retMeleePenalized,
      rules,
      heroDamagePct: heroMeleePctOf(state, combat, target.side),
      heroArmorPct: heroArmorPctOf(state, combat, attacker.side),
      // `shieldWall` (A2a) : l'attaquant qui Défend a son multiplicateur propre.
      defendMultiplier: shieldWallMultiplier(attackerDef) ?? rules.defendDefenseMultiplier,
      // Malédiction « Faux funeste » (A2c) : le riposteur (`target`) peut être maudit.
      dealtDamageMod: statusModSum(target.statuses, 'damageDealtMod'),
      // D5 : une riposte ne consomme PAS de Marque ⇒ pas de burst `consumeMarks`
      // dans la préviz de riposte non plus (préviz = résolution).
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
