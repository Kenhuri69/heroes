import { killsFromDamage, magicResistanceOf } from './damage';
import { handleStackDeath } from './death';
import type { Draft } from './draft';
import { hexDistance } from './hex';
import { combatRules, hasAbility, recordLoss, recordRevive, stackLostSoFar } from './state-helpers';
import type { CombatState, CombatStack, CombatUnitDef } from './types';
import type { GameEvent } from '../core/events';
import { rollRange } from '../core/rng';
import type { SpellDef } from '../hero/types';
import { isHostileStatus, spellDamageAmount, spellHealAmount, spellStatusDuration } from '../hero/spells';

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

/**
 * Cibles d'un sort à **chaîne** (H-SPELLS.4) : la cible `center` puis, à chaque
 * saut, l'ennemi vivant le plus proche NON encore touché (départage stable par
 * distance puis id), jusqu'à `jumps` sauts. Pure et déterministe — partagée par
 * la résolution et la prévisualisation. `center` est une pile ENNEMIE (validé).
 */
export function chainTargets(combat: CombatState, center: CombatStack, jumps: number): CombatStack[] {
  const chosen: CombatStack[] = [center];
  const pool = combat.stacks.filter((s) => s.count > 0 && s.side === center.side && s.id !== center.id);
  let from = center;
  for (let i = 0; i < jumps; i++) {
    let best: CombatStack | undefined;
    let bestDist = Infinity;
    for (const s of pool) {
      if (chosen.includes(s)) continue;
      const d = hexDistance(from.pos, s.pos);
      if (d < bestDist || (d === bestDist && best !== undefined && s.id < best.id)) {
        best = s;
        bestDist = d;
      }
    }
    if (!best) break;
    chosen.push(best);
    from = best;
  }
  return chosen;
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
  recordLoss(combat, target, kills);
  if (target.count <= 0) handleStackDeath(combat, target, targetDef, events);
  return { amount, kills };
}

/**
 * Soigne/ressuscite UNE pile alliée de `hp` PV (doc 02 §1.4). La résurrection est
 * intra-pile : le plafond remonte à `count + pertes déjà subies` (`lostSoFar` du
 * ledger) ⇒ des créatures tuées reviennent. Cœur PARTAGÉ par le sort de soin et
 * la Prière de bataille (F-SKILLS.2). Retourne PV réellement rendus + créatures
 * relevées (Δ effectif).
 */
export function resurrectStack(
  draft: Draft,
  combat: CombatState,
  target: CombatStack,
  hp: number,
): { healed: number; revived: number } {
  const def = draft.unitCatalog[target.unitId];
  if (!def || target.count <= 0) return { healed: 0, revived: 0 };
  // Plafond INTRA-pile (B4) : les pertes de CETTE pile, pas celles d'une autre
  // pile du même unitId — et décrément du ledger pour que les créatures relevées
  // puis retuées ne comptent qu'une fois (XP/Nécromancie/bilan/plafond).
  const r = resolveResurrect(def, target, stackLostSoFar(combat, target), hp);
  target.count = r.newCount;
  target.firstHp = r.newFirstHp;
  recordRevive(combat, target, r.revived);
  return { healed: r.healed, revived: r.revived };
}

/**
 * Maths PURES de la résurrection intra-pile (sans mutation) — partagées par
 * l'application (`resurrectStack`) et la prévisualisation (`estimateHeroRally`).
 * `lostSoFar` = créatures déjà tuées de la pile (plafond de remontée).
 */
export function resolveResurrect(
  def: CombatUnitDef,
  target: CombatStack,
  lostSoFar: number,
  hp: number,
): { newCount: number; newFirstHp: number; healed: number; revived: number } {
  if (target.count <= 0) return { newCount: 0, newFirstHp: 0, healed: 0, revived: 0 };
  const maxCount = target.count + lostSoFar;
  const beforeCount = target.count;
  const currentPool = (target.count - 1) * def.stats.hp + target.firstHp;
  const newPool = Math.min(maxCount * def.stats.hp, currentPool + hp);
  const newCount = Math.min(maxCount, Math.max(1, Math.ceil(newPool / def.stats.hp)));
  return {
    newCount,
    newFirstHp: newPool - (newCount - 1) * def.stats.hp,
    healed: newPool - currentPool,
    revived: newCount - beforeCount,
  };
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
  /**
   * F-BONUS (Fléau persistant, doc 04 §2) : rounds ajoutés à la durée des statuts
   * posés — le CALLER ne le passe (> 0) que pour un sort de malédiction (`debuff`)
   * d'un héros doté. 0 par défaut (sort ordinaire, sort d'unité).
   */
  statusDurationBonus = 0,
  /**
   * Magie Irrésistible (signature du Donjon, doc 17 §2) : mods de dégâts de sort
   * du héros lanceur — `bonusPct` (fraction) majore les dégâts, `resistancePierce`
   * (0..1) atténue la résistance magique graduée de la cible. {0,0} par défaut
   * (sort ordinaire, sort d'unité `spellcaster`). Le caller ne le passe que pour
   * un sort de dégâts d'un héros doté ; le cœur ignore toute notion de faction.
   */
  damageMods: { bonusPct: number; resistancePierce: number } = { bonusPct: 0, resistancePierce: 0 },
): { amount: number; kills: number } {
  const targets = spellTargets(combat, spell.area, center);
  let amount = 0;
  let kills = 0;

  if (spell.kind === 'damage') {
    const rules = combatRules(draft);
    const luckRoll = rollRange(draft.rng, 0, 99);
    draft.rng = luckRoll.state;
    const lucky = luckRoll.value < Math.round(rules.luckChancePerPoint * luck * 100);
    // H-SPELLS.4 (chaîne) : la cible + les ennemis les plus proches, dégâts
    // décroissants par saut. Sinon, la/les pile(s) de zone (`spellTargets`) à plein.
    const hits = spell.chain
      ? chainTargets(combat, center, spell.chain.jumps).map((t, i) => ({
          t,
          mult: Math.pow(1 - spell.chain!.falloffPct / 100, i),
        }))
      : targets.map((t) => ({ t, mult: 1 }));
    for (const { t, mult } of hits) {
      const def = draft.unitCatalog[t.unitId];
      if (!def) continue;
      // F-SCHOOLS.3 : un sort mange-Marques ajoute `marksDamagePct`%/charge au
      // bonus passif de Marque, puis consomme les Marques de la cible.
      const consumeBonus = spell.marksDamagePct ? (spell.marksDamagePct / 100) * t.marks : 0;
      // Magie Irrésistible (doc 17 §2) : la résistance graduée de la cible est
      // atténuée de `resistancePierce`, puis les dégâts majorés de `bonusPct`.
      const resistance = Math.max(0, magicResistanceOf(def, t.transformed) - damageMods.resistancePierce);
      const dmg = Math.round(
        spellDamageAmount(spell, power, lucky, resistance, rules.markBonusPerStack * t.marks + consumeBonus) *
          mult *
          (1 + damageMods.bonusPct),
      );
      const r = damageOneStack(draft, combat, t, dmg, events);
      amount += r.amount;
      kills += r.kills;
      // Marques consommées (dépense de la ressource) — silencieux : l'`amount`
      // de `SpellCast` reflète déjà les dégâts amplifiés.
      if (spell.marksDamagePct && t.count > 0) t.marks = 0;
    }
  } else if (spell.kind === 'heal') {
    const heal = spellHealAmount(spell, power);
    for (const t of targets) {
      resurrectStack(draft, combat, t, heal);
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
  } else if (spell.kind === 'stealth') {
    // F-SCHOOLS.7 (Mue Éphémère) : la/les pile(s) alliée(s) deviennent furtives
    // (inciblables) jusqu'à leur prochaine action. Effet sans durée en rounds.
    for (const t of targets) t.stealthed = true;
  } else if (spell.kind === 'teleport') {
    // F-SCHOOLS.8 (Pas de Brume) : le déplacement se fait dans `castHeroSpell`
    // (il exige la destination `targetHex` que ce cœur partagé ne reçoit pas) —
    // no-op ici (le chemin unité `spellcaster` ne porte pas de sort teleport).
  } else if (spell.kind === 'rally') {
    // F-SCHOOLS.6 (Heure de la Curée) : le camp du lanceur ne subit plus de
    // riposte en frappant une pile MARQUÉE, pour `max(1, base)` round(s). Effet
    // de camp (global), pas un statut de pile — estampillé sur le combat.
    combat.markedNoRetaliation = { side: center.side, roundsLeft: Math.max(1, spell.base) };
  } else if (spell.kind === 'dispel') {
    // H-SPELLS.4 (Dissipation, doc 02 §1.4) : retire TOUS les statuts temporaires
    // de sort (buffs/debuffs/poison/silence) de la/les pile(s) ennemie(s) visée(s)
    // — « on souffle sur les enchantements d'autrui ». `amount` = nb de statuts
    // retirés (journal + préviz). Réutilise le tableau `statuses` : zéro champ neuf.
    for (const t of targets) {
      amount += t.statuses.length;
      t.statuses = [];
    }
  } else if (spell.kind === 'cure') {
    // F-SCHOOLS (Purification, doc 02 §1.4) : retire les statuts NÉFASTES d'une pile
    // ALLIÉE (debuff/malédiction/poison/silence) en conservant les buffs — miroir
    // amical de `dispel`. `amount` = nb de statuts purgés. Zéro champ neuf.
    for (const t of targets) {
      const before = t.statuses.length;
      t.statuses = t.statuses.filter((s) => !isHostileStatus(s));
      amount += before - t.statuses.length;
    }
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
      recordLoss(combat, t, t.count);
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
        // F-SCHOOLS (École de la Scène) : ± moral pendant le statut. Omis si absent
        // ⇒ statut sans champ `moraleMod` (neutre, forme de save inchangée).
        ...(spell.moraleMod !== undefined && { moraleMod: spell.moraleMod }),
        damageDealtMod: 0,
        damagePerRound: 0,
        silenced: spell.kind === 'silence',
        roundsLeft: spellStatusDuration(power) + statusDurationBonus,
      });
    }
  }

  return { amount, kills };
}
