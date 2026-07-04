import { heroLuckOf, killsFromDamage } from '../combat/damage';
import { combatRules, collectCasualties } from '../combat/state-helpers';
import { checkCombatEnd } from '../combat/turns';
import type { CombatState } from '../combat/types';
import type { Command, CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import { rollRange } from '../core/rng';
import type { GameState } from '../core/state';
import {
  effectiveManaCost,
  effectivePower,
  spellDamageAmount,
  spellHealAmount,
  spellStatusDuration,
} from './spells';

/**
 * Points d'entrée héros (sorts en combat + choix de compétence) appelés par
 * `core/engine.ts` — signatures FIGÉES en cadrage (plan phase-3.2). Lot K :
 * implémentation ici (fichiers frères dans `hero/`), sans toucher aux
 * signatures ni à `core/`.
 */

type Draft = GameState;
type CastSpellCmd = Extract<Command, { type: 'CastSpell' }>;
type ChooseSkillCmd = Extract<Command, { type: 'ChooseSkill' }>;

/** Héros lié au camp joueur (`combat.playerSide`) — seul camp habilité à lancer un sort (décision plan #2). */
function heroForPlayerSide(state: GameState, combat: CombatState) {
  const heroId = combat.playerSide === 'attacker' ? combat.attackerHeroId : combat.defenderHeroId;
  return heroId ? state.heroes.find((h) => h.id === heroId) : undefined;
}

export function validateCastSpell(state: GameState, cmd: CastSpellCmd): CommandError | null {
  const combat = state.combat;
  if (!combat) return { code: 'noCombat', message: 'aucun combat en cours' };
  const activeStack = combat.stacks.find((s) => s.id === combat.activeStackId);
  if (!activeStack || activeStack.side !== combat.playerSide)
    return { code: 'invalidAction', message: 'ce n’est pas au joueur de jouer' };
  const hero = heroForPlayerSide(state, combat);
  if (!hero) return { code: 'invalidAction', message: 'aucun héros lié au camp joueur' };
  if (combat.heroCastThisRound)
    return { code: 'heroAlreadyCast', message: 'le héros a déjà lancé un sort ce round' };
  const spell = state.spellCatalog[cmd.spellId];
  if (!spell) return { code: 'unknownSpell', message: `sort inconnu '${cmd.spellId}'` };
  if (!hero.spells.includes(cmd.spellId))
    return { code: 'spellNotKnown', message: `sort non appris '${cmd.spellId}'` };
  const manaCost = effectiveManaCost(hero, state.skillCatalog, spell);
  if (hero.mana < manaCost) return { code: 'notEnoughMana', message: 'mana insuffisante' };
  const target = combat.stacks.find((s) => s.id === cmd.targetStackId);
  if (!target || target.count <= 0)
    return { code: 'invalidTarget', message: `cible invalide '${cmd.targetStackId}'` };
  return null;
}

export function validateChooseSkill(state: GameState, cmd: ChooseSkillCmd): CommandError | null {
  const hero = state.heroes.find((h) => h.id === cmd.heroId);
  if (!hero) return { code: 'unknownHero', message: `héros inconnu '${cmd.heroId}'` };
  if (hero.pendingSkillChoices.length === 0)
    return { code: 'noPendingChoice', message: 'aucune proposition de compétence en attente' };
  if (!hero.pendingSkillChoices.includes(cmd.skillId))
    return { code: 'unknownSkill', message: `proposition inconnue '${cmd.skillId}'` };
  return null;
}

export function handleCastSpell(draft: Draft, cmd: CastSpellCmd, events: GameEvent[]): void {
  const combat = draft.combat;
  if (!combat) return; // exclu par validate
  const hero = heroForPlayerSide(draft, combat);
  const spell = draft.spellCatalog[cmd.spellId];
  const target = combat.stacks.find((s) => s.id === cmd.targetStackId);
  if (!hero || !spell || !target) return; // exclu par validate

  hero.mana -= effectiveManaCost(hero, draft.skillCatalog, spell);
  combat.heroCastThisRound = true;
  const power = effectivePower(hero, draft.artifactCatalog);

  let amount = 0;
  let kills = 0;

  if (spell.kind === 'damage') {
    const targetDef = draft.unitCatalog[target.unitId];
    if (targetDef) {
      const luck = heroLuckOf(draft, combat, combat.playerSide);
      const rules = combatRules(draft);
      const luckRoll = rollRange(draft.rng, 0, 99);
      draft.rng = luckRoll.state;
      const lucky = luckRoll.value < Math.round(rules.luckChancePerPoint * luck * 100);
      amount = spellDamageAmount(spell, power, lucky);
      const pool = (target.count - 1) * targetDef.stats.hp + target.firstHp;
      kills = killsFromDamage(pool, targetDef.stats.hp, target.count, amount);
      const remaining = Math.max(0, pool - amount);
      const newCount = target.count - kills;
      target.count = newCount;
      target.firstHp = newCount > 0 ? remaining - (newCount - 1) * targetDef.stats.hp : 0;
      if (target.count <= 0) {
        events.push({ type: 'StackDied', stackId: target.id });
        const idx = combat.stacks.findIndex((s) => s.id === target.id);
        if (idx !== -1) combat.stacks.splice(idx, 1);
      }
    }
  } else if (spell.kind === 'heal') {
    const targetDef = draft.unitCatalog[target.unitId];
    if (targetDef) {
      amount = spellHealAmount(spell, power);
      // Plafond de soin : `CombatStack` (types.ts figé) ne porte pas
      // l'effectif initial de la pile — approximé par l'effectif courant +
      // les pertes déjà enregistrées pour cette unité/ce camp dans le bilan
      // de combat (`collectCasualties`). Choix documenté (décision plan #3).
      const lostSoFar =
        collectCasualties(combat).find((c) => c.side === target.side && c.unitId === target.unitId)
          ?.lost ?? 0;
      const maxCount = target.count + lostSoFar;
      const currentPool = (target.count - 1) * targetDef.stats.hp + target.firstHp;
      const maxPool = maxCount * targetDef.stats.hp;
      const newPool = Math.min(maxPool, currentPool + amount);
      const newCount = Math.min(maxCount, Math.max(1, Math.ceil(newPool / targetDef.stats.hp)));
      target.count = newCount;
      target.firstHp = newPool - (newCount - 1) * targetDef.stats.hp;
    }
  } else {
    // buff / debuff (doc 02 §1.4) : statut temporaire sur la pile ciblée.
    target.statuses.push({
      spellId: spell.id,
      attackMod: spell.attackMod ?? 0,
      defenseMod: spell.defenseMod ?? 0,
      speedMod: spell.speedMod ?? 0,
      roundsLeft: spellStatusDuration(power),
    });
  }

  events.push({
    type: 'SpellCast',
    heroId: hero.id,
    spellId: spell.id,
    targetId: cmd.targetStackId,
    amount,
    kills,
  });

  // Un sort de dégâts peut achever le dernier défenseur adverse : le combat
  // doit se terminer immédiatement, comme après une frappe (`applyAction`).
  checkCombatEnd(draft, events);
}

export function handleChooseSkill(draft: Draft, cmd: ChooseSkillCmd, events: GameEvent[]): void {
  const hero = draft.heroes.find((h) => h.id === cmd.heroId);
  if (!hero) return; // exclu par validate
  const current = hero.skills[cmd.skillId];
  const rank = current !== undefined ? Math.min(3, current + 1) : 1;
  hero.skills[cmd.skillId] = rank;
  hero.pendingSkillChoices = [];
  events.push({ type: 'SkillLearned', heroId: hero.id, skillId: cmd.skillId, rank });
}

/**
 * Estimation min/max d'un sort SANS RNG (doc 08 §2.4) — prévisualisation
 * obligatoire, utilisée par l'UI et l'IA future.
 */
export interface SpellEstimate {
  amount: number;
  kills: number;
  kind: 'damage' | 'heal' | 'buff' | 'debuff';
}

export function estimateSpell(
  state: GameState,
  spellId: string,
  targetStackId: string,
): SpellEstimate {
  const combat = state.combat;
  if (!combat) throw new Error('estimateSpell: aucun combat en cours');
  const spell = state.spellCatalog[spellId];
  if (!spell) throw new Error(`estimateSpell: sort inconnu '${spellId}'`);
  const target = combat.stacks.find((s) => s.id === targetStackId);
  if (!target) throw new Error(`estimateSpell: cible introuvable '${targetStackId}'`);
  const hero = heroForPlayerSide(state, combat);
  const power = hero ? effectivePower(hero, state.artifactCatalog) : 0;

  if (spell.kind === 'damage') {
    const targetDef = state.unitCatalog[target.unitId];
    if (!targetDef) throw new Error(`estimateSpell: unité inconnue '${target.unitId}'`);
    const amount = spellDamageAmount(spell, power, false);
    const pool = (target.count - 1) * targetDef.stats.hp + target.firstHp;
    const kills = killsFromDamage(pool, targetDef.stats.hp, target.count, amount);
    return { amount, kills, kind: 'damage' };
  }
  if (spell.kind === 'heal') {
    return { amount: spellHealAmount(spell, power), kills: 0, kind: 'heal' };
  }
  return { amount: 0, kills: 0, kind: spell.kind };
}
