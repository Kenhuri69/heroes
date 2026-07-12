import { killsFromDamage, magicResistanceOf } from './damage';
import type { Draft } from './draft';
import { hexDistance } from './hex';
import { combatRules, collectCasualties, hasAbility, recordLoss } from './state-helpers';
import type { CombatState, CombatStack, CombatUnitDef } from './types';
import type { GameEvent } from '../core/events';
import { rollRange } from '../core/rng';
import type { SpellDef } from '../hero/types';
import { spellDamageAmount, spellHealAmount, spellStatusDuration } from '../hero/spells';

/**
 * Résolution des EFFETS de sort sur les piles de combat — cœur PARTAGÉ entre le
 * lancer du héros (`hero/handleCastSpell`) et le lancer d'unité (`spellcaster`,
 * A2h). Vit dans la couche combat (le rendu/hero en dépend, jamais l'inverse) :
 * `hero/spells.ts` n'apporte que des maths pures ⇒ aucun cycle d'import.
 */

/**
 * Params de la capacité `spellcaster` (A2h) d'une unité, ou `null` : `spellId`
 * embarqué, `charges` (lancers/combat), `power` (Pouvoir effectif — les unités
 * n'ont pas d'attribut Pouvoir, il pilote dégâts/soin/durée). Générique.
 */
export function spellcasterParams(def: CombatUnitDef): { spellId: string; charges: number; power: number } | null {
  const ability = def.abilities.find((a) => a.id === 'spellcaster');
  if (!ability) return null;
  const spellId = String(ability.params?.['spellId'] ?? '');
  const charges = Number(ability.params?.['charges'] ?? 0);
  if (!spellId || charges <= 0) return null;
  return { spellId, charges, power: Number(ability.params?.['power'] ?? 0) };
}

/**
 * Piles affectées : la cible seule ; ou la cible + ses alliées adjacentes en
 * `splash` (C7) ; ou **toutes** les piles vivantes du camp de la cible en `all`
 * (H-SPELLS.1 — sorts de masse : le camp visé est celui de la pile choisie).
 */
export function spellTargets(
  combat: CombatState,
  area: 'splash' | 'all' | undefined,
  center: CombatStack,
): CombatStack[] {
  if (area === 'all') {
    return combat.stacks.filter((s) => s.count > 0 && s.side === center.side);
  }
  if (area !== 'splash') return [center];
  return combat.stacks.filter(
    (s) => s.count > 0 && s.side === center.side && (s.id === center.id || hexDistance(s.pos, center.pos) === 1),
  );
}

/** Applique les dégâts d'un sort à UNE pile (kills, firstHp, bilan, mort) — retourne {amount, kills}. */
export function damageOneStack(
  draft: Draft,
  combat: CombatState,
  target: CombatStack,
  amount: number,
  events: GameEvent[],
): { amount: number; kills: number } {
  const targetDef = draft.unitCatalog[target.unitId];
  if (!targetDef) return { amount: 0, kills: 0 };
  const pool = (target.count - 1) * targetDef.stats.hp + target.firstHp;
  const kills = killsFromDamage(pool, targetDef.stats.hp, target.count, amount);
  const remaining = Math.max(0, pool - amount);
  const newCount = target.count - kills;
  target.count = newCount;
  target.firstHp = newCount > 0 ? remaining - (newCount - 1) * targetDef.stats.hp : 0;
  recordLoss(combat, target.side, target.unitId, kills);
  if (target.count <= 0) {
    events.push({ type: 'StackDied', stackId: target.id });
    const idx = combat.stacks.findIndex((s) => s.id === target.id);
    if (idx !== -1) combat.stacks.splice(idx, 1);
  }
  return { amount, kills };
}

/**
 * Applique l'effet d'un sort (damage/heal/applyMarks/buff/debuff) aux piles
 * affectées (cible + adjacentes si `splash`). Le **Pouvoir** (`power`) et la
 * **chance** (`luck`, pour les sorts de dégâts) sont fournis par l'appelant :
 * héros = attributs du héros ; unité `spellcaster` = params de la capacité
 * (luck 0). Consomme le RNG UNIQUEMENT pour un sort de dégâts (jet de chance),
 * exactement comme l'ancien chemin héros. Retourne {amount, kills}.
 */
export function applySpellToTargets(
  draft: Draft,
  combat: CombatState,
  spell: SpellDef,
  center: CombatStack,
  power: number,
  luck: number,
  events: GameEvent[],
): { amount: number; kills: number } {
  const targets = spellTargets(combat, spell.area, center);
  let amount = 0;
  let kills = 0;

  if (spell.kind === 'damage') {
    const rules = combatRules(draft);
    const luckRoll = rollRange(draft.rng, 0, 99);
    draft.rng = luckRoll.state;
    const lucky = luckRoll.value < Math.round(rules.luckChancePerPoint * luck * 100);
    for (const t of targets) {
      const def = draft.unitCatalog[t.unitId];
      if (!def) continue;
      // F-SCHOOLS.3 : un sort mange-Marques ajoute `marksDamagePct`%/charge au
      // bonus passif de Marque, puis consomme les Marques de la cible.
      const consumeBonus = spell.marksDamagePct ? (spell.marksDamagePct / 100) * t.marks : 0;
      const dmg = spellDamageAmount(
        spell,
        power,
        lucky,
        magicResistanceOf(def, t.transformed),
        rules.markBonusPerStack * t.marks + consumeBonus,
      );
      const r = damageOneStack(draft, combat, t, dmg, events);
      amount += r.amount;
      kills += r.kills;
      // Marques consommées (dépense de la ressource) — silencieux : l'`amount`
      // de `SpellCast` reflète déjà les dégâts amplifiés.
      if (spell.marksDamagePct && t.count > 0) t.marks = 0;
    }
  } else if (spell.kind === 'heal') {
    for (const t of targets) {
      const def = draft.unitCatalog[t.unitId];
      if (!def) continue;
      const heal = spellHealAmount(spell, power);
      const lostSoFar =
        collectCasualties(combat).find((c) => c.side === t.side && c.unitId === t.unitId)?.lost ?? 0;
      const maxCount = t.count + lostSoFar;
      const currentPool = (t.count - 1) * def.stats.hp + t.firstHp;
      const newPool = Math.min(maxCount * def.stats.hp, currentPool + heal);
      const newCount = Math.min(maxCount, Math.max(1, Math.ceil(newPool / def.stats.hp)));
      t.count = newCount;
      t.firstHp = newPool - (newCount - 1) * def.stats.hp;
      amount += heal;
    }
  } else if (spell.kind === 'applyMarks') {
    const marksMax = combatRules(draft).marksMax;
    for (const t of targets) {
      const before = t.marks;
      t.marks = Math.min(marksMax, t.marks + (spell.marks ?? 0));
      const posed = t.marks - before;
      amount += posed;
      if (posed > 0) events.push({ type: 'MarkApplied', targetId: t.id, marks: t.marks });
    }
  } else if (spell.kind === 'rally') {
    // F-SCHOOLS.6 (Heure de la Curée) : le camp du lanceur ne subit plus de
    // riposte en frappant une pile MARQUÉE, pour `max(1, base)` round(s). Effet
    // de camp (global), pas un statut de pile — estampillé sur le combat.
    combat.markedNoRetaliation = { side: center.side, roundsLeft: Math.max(1, spell.base) };
  } else if (spell.kind === 'banish') {
    // F-SCHOOLS.5 : bannit une pile ENNEMIE `banishable` (invoquée/démoniaque)
    // dont le total de PV ≤ seuil (`base + perPower × Pouvoir`) — retrait complet
    // (comme une mort de pile). Sinon fizzle. Générique : capacité opaque.
    const threshold = spell.base + spell.perPower * power;
    for (const t of targets) {
      const def = draft.unitCatalog[t.unitId];
      if (!def || !hasAbility(def, 'banishable')) continue;
      const pool = (t.count - 1) * def.stats.hp + t.firstHp;
      if (pool > threshold) continue;
      recordLoss(combat, t.side, t.unitId, t.count);
      amount += pool;
      t.count = 0;
      t.firstHp = 0;
      events.push({ type: 'StackDied', stackId: t.id });
      const idx = combat.stacks.findIndex((s) => s.id === t.id);
      if (idx !== -1) combat.stacks.splice(idx, 1);
    }
  } else {
    // buff / debuff / silence (doc 02 §1.4, doc 05 §6) : statut temporaire sur
    // chaque pile affectée. `silence` désactive le sort d'unité (`silenced`).
    for (const t of targets) {
      t.statuses.push({
        spellId: spell.id,
        attackMod: spell.attackMod ?? 0,
        defenseMod: spell.defenseMod ?? 0,
        speedMod: spell.speedMod ?? 0,
        damageDealtMod: 0,
        damagePerRound: 0,
        silenced: spell.kind === 'silence',
        roundsLeft: spellStatusDuration(power),
      });
    }
  }

  return { amount, kills };
}
