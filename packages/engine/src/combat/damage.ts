import { rollRange } from '../core/rng';
import type { GameState } from '../core/state';
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
 */

interface MultiplierInput {
  strikerAttack: number;
  targetDefense: number;
  targetDefending: boolean;
  targetMarks: number;
  meleePenalized: boolean;
  rules: CombatRulesConfig;
}

/** Multiplicateur global (diff attaque/défense, pénalité mêlée forcée, marques) — sans chance. */
export function computeMultiplier(input: MultiplierInput): number {
  const { strikerAttack, targetDefense, targetDefending, targetMarks, meleePenalized, rules } =
    input;
  const effectiveDefense = targetDefending
    ? Math.floor(targetDefense * rules.defendDefenseMultiplier)
    : targetDefense;
  const diff = strikerAttack - effectiveDefense;
  const factor = clamp(rules.attackDefenseStep * diff, -rules.damageReductionMax, rules.damageBonusMax);
  let mult = 1 + factor;
  if (meleePenalized) mult *= rules.rangedMeleePenalty;
  mult *= 1 + rules.markBonusPerStack * targetMarks;
  return mult;
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
  rules: CombatRulesConfig;
}

/** Une frappe réelle (RNG threadé via `draft.rng`) : dégâts, pertes, marque, mort éventuelle. */
export function performStrike(
  draft: Draft,
  events: GameEvent[],
  params: StrikeParams,
): { targetDied: boolean } {
  const { striker, victim, strikerDef, victimDef, meleePenalized, retaliation, rules } = params;
  let base = 0;
  for (let i = 0; i < striker.count; i++) {
    const r = rollRange(draft.rng, strikerDef.stats.damage[0], strikerDef.stats.damage[1]);
    draft.rng = r.state;
    base += r.value;
  }
  const mult = computeMultiplier({
    strikerAttack: strikerDef.stats.attack,
    targetDefense: victimDef.stats.defense,
    targetDefending: victim.defending,
    targetMarks: victim.marks,
    meleePenalized,
    rules,
  });
  // Chance : luck = 0 en 2.4 (décision plan #4, pas d'artefacts) — le tirage
  // est conservé pour garder une séquence RNG stable même si le trait luck
  // apparaît plus tard (héros/artefacts).
  const luck = 0;
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

  const combat = draft.combat;
  if (combat) recordLoss(combat, victim.side, victim.unitId, kills);

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
  const mult = computeMultiplier({
    strikerAttack: attackerDef.stats.attack,
    targetDefense: targetDef.stats.defense,
    targetDefending: target.defending,
    targetMarks: target.marks,
    meleePenalized,
    rules,
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
  const canRetaliate =
    !ranged && target.retaliationsLeft > 0 && !targetDef.abilities.some((a) => a.id === 'noRetaliation');
  if (canRetaliate) {
    const survivorsAfterMaxDamage = target.count - killsMax;
    const survivorsAfterMinDamage = target.count - killsMin;
    const retMeleePenalized = isShooterMeleePenalized(targetDef);
    const retMult = computeMultiplier({
      strikerAttack: targetDef.stats.attack,
      targetDefense: attackerDef.stats.defense,
      targetDefending: attacker.defending,
      targetMarks: attacker.marks,
      meleePenalized: retMeleePenalized,
      rules,
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
