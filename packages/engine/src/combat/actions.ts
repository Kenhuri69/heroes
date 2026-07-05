import type { CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import { rollRange } from '../core/rng';
import type { GameState } from '../core/state';
import { performStrike } from './damage';
import type { Draft } from './draft';
import { COMBAT_COLS, COMBAT_ROWS, hexDistance, hexNeighbors, sameHex, type OffsetPos } from './hex';
import { advanceTurn, checkCombatEnd } from './turns';
import { combatRules, hasAbility, isShooterMeleePenalized, moraleOf } from './state-helpers';
import type { CombatActionInput, CombatStack } from './types';

/**
 * Actions de la pile active (doc 02 §5.2) : déplacement (BFS hex), tir/mêlée,
 * attendre, défendre. `reachableHexes`/`canShoot` sont aussi exposés à l'UI
 * (surbrillances, prévisualisation) et réutilisés par l'IA (`ai.ts`).
 */

function hexKey(p: OffsetPos): string {
  return `${p.col},${p.row}`;
}

/** Hexes atteignables en déplacement (portée = vitesse effective) — BFS coût 1/hex. */
export function reachableHexes(state: GameState, stackId: string): OffsetPos[] {
  const combat = state.combat;
  if (!combat) return [];
  const stack = combat.stacks.find((s) => s.id === stackId);
  if (!stack) return [];
  const def = state.unitCatalog[stack.unitId];
  if (!def) return [];
  const speed = def.stats.speed + (def.nativeTerrain === combat.terrain ? 1 : 0);
  const flying = hasAbility(def, 'flying');

  const blocked = new Set<string>();
  for (const o of combat.obstacles) blocked.add(hexKey(o));
  for (const s of combat.stacks) if (s.id !== stackId) blocked.add(hexKey(s.pos));

  if (flying) {
    const out: OffsetPos[] = [];
    for (let col = 0; col < COMBAT_COLS; col++) {
      for (let row = 0; row < COMBAT_ROWS; row++) {
        const p = { col, row };
        if (sameHex(p, stack.pos)) continue;
        if (hexDistance(stack.pos, p) > speed) continue;
        if (blocked.has(hexKey(p))) continue;
        out.push(p);
      }
    }
    return out;
  }

  const dist = new Map<string, number>();
  dist.set(hexKey(stack.pos), 0);
  const queue: OffsetPos[] = [stack.pos];
  const out: OffsetPos[] = [];
  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi++] as OffsetPos;
    const d = dist.get(hexKey(cur)) as number;
    if (d >= speed) continue;
    for (const n of hexNeighbors(cur)) {
      const nk = hexKey(n);
      if (dist.has(nk) || blocked.has(nk)) continue;
      dist.set(nk, d + 1);
      queue.push(n);
      out.push(n);
    }
  }
  return out;
}

/** La pile peut-elle tirer (tireur, munitions > 0, aucun ennemi adjacent) ? */
export function canShoot(state: GameState, stackId: string): boolean {
  const combat = state.combat;
  if (!combat) return false;
  const stack = combat.stacks.find((s) => s.id === stackId);
  if (!stack) return false;
  if (stack.ammo === null || stack.ammo <= 0) return false;
  const adjacent = combat.stacks.some(
    (s) => s.side !== stack.side && s.count > 0 && hexDistance(s.pos, stack.pos) === 1,
  );
  return !adjacent;
}

export function validateCombatAction(state: GameState, cmd: { action: CombatActionInput }): CommandError | null {
  const combat = state.combat;
  if (!combat) return { code: 'noCombat', message: 'aucun combat en cours' };
  const stack = combat.stacks.find((s) => s.id === combat.activeStackId);
  if (!stack) return { code: 'invalidAction', message: 'aucune pile active' };
  if (stack.side !== combat.playerSide)
    return { code: 'invalidAction', message: 'ce n’est pas au joueur de jouer' };
  const def = state.unitCatalog[stack.unitId];
  if (!def) return { code: 'invalidAction', message: `unité inconnue '${stack.unitId}'` };

  const action = cmd.action;
  switch (action.type) {
    case 'move': {
      const reachable = reachableHexes(state, stack.id);
      if (!reachable.some((p) => sameHex(p, action.to)))
        return { code: 'invalidAction', message: 'hex non atteignable' };
      return null;
    }
    case 'attack': {
      const target = combat.stacks.find((s) => s.id === action.targetStackId);
      if (!target || target.side === stack.side || target.count <= 0)
        return { code: 'invalidAction', message: 'cible invalide' };
      if (canShoot(state, stack.id)) return null;
      const dist = hexDistance(stack.pos, target.pos);
      if (dist === 1) return null;
      const from = action.from;
      if (!from) return { code: 'invalidAction', message: 'cible non adjacente : hex de départ requis' };
      if (hexDistance(from, target.pos) !== 1)
        return { code: 'invalidAction', message: 'hex de départ non adjacent à la cible' };
      const reachable = reachableHexes(state, stack.id);
      if (!reachable.some((p) => sameHex(p, from)))
        return { code: 'invalidAction', message: 'hex de départ inatteignable' };
      return null;
    }
    case 'wait':
      if (stack.waited) return { code: 'invalidAction', message: 'attente déjà utilisée ce round' };
      return null;
    case 'defend':
      return null;
  }
}

/** Résout l'action de `stackId` (pile active), avance le tour — sans jouer l'IA (voir index.ts). */
export function applyAction(
  draft: Draft,
  events: GameEvent[],
  stackId: string,
  action: CombatActionInput,
): void {
  switch (action.type) {
    case 'move':
      applyMove(draft, events, stackId, action);
      break;
    case 'attack':
      applyAttack(draft, events, stackId, action);
      break;
    case 'wait':
      applyWait(draft, events, stackId);
      break;
    case 'defend':
      applyDefend(draft, events, stackId);
      break;
  }
}

function afterAction(
  draft: Draft,
  events: GameEvent[],
  actorId: string,
  wasFirstAction: boolean,
  actionType: CombatActionInput['type'],
): void {
  const combat = draft.combat;
  if (!combat) return; // combat déjà terminé (checkCombatEnd a nullifié draft.combat)
  const actor = combat.stacks.find((s) => s.id === actorId);
  if (actor && actionType !== 'wait') {
    actor.acted = true;
    if (wasFirstAction) {
      const rules = combatRules(draft);
      const moral = moraleOf(actor, combat, draft.unitCatalog);
      if (moral > 0) {
        const roll = rollRange(draft.rng, 0, 99);
        draft.rng = roll.state;
        if (roll.value < moral * rules.moraleChancePerPoint * 100) {
          events.push({ type: 'MoraleTriggered', stackId: actor.id, positive: true });
          actor.defending = false;
          combat.activeStackId = actor.id;
          events.push({ type: 'CombatTurnStarted', stackId: actor.id });
          return;
        }
      }
    }
  }
  advanceTurn(draft, events);
}

function applyMove(
  draft: Draft,
  events: GameEvent[],
  stackId: string,
  action: Extract<CombatActionInput, { type: 'move' }>,
): void {
  const combat = draft.combat as NonNullable<Draft['combat']>;
  const stack = combat.stacks.find((s) => s.id === stackId) as CombatStack;
  const wasFirstAction = !stack.acted;
  const from = { ...stack.pos };
  stack.pos = { ...action.to };
  events.push({ type: 'StackMoved', stackId: stack.id, from, to: { ...stack.pos } });
  afterAction(draft, events, stack.id, wasFirstAction, 'move');
}

function applyWait(draft: Draft, events: GameEvent[], stackId: string): void {
  const combat = draft.combat as NonNullable<Draft['combat']>;
  const stack = combat.stacks.find((s) => s.id === stackId) as CombatStack;
  stack.waited = true;
  afterAction(draft, events, stack.id, false, 'wait');
}

function applyDefend(draft: Draft, events: GameEvent[], stackId: string): void {
  const combat = draft.combat as NonNullable<Draft['combat']>;
  const stack = combat.stacks.find((s) => s.id === stackId) as CombatStack;
  const wasFirstAction = !stack.acted;
  stack.defending = true;
  afterAction(draft, events, stack.id, wasFirstAction, 'defend');
}

function applyAttack(
  draft: Draft,
  events: GameEvent[],
  stackId: string,
  action: Extract<CombatActionInput, { type: 'attack' }>,
): void {
  const combat = draft.combat as NonNullable<Draft['combat']>;
  const rules = combatRules(draft);
  const catalog = draft.unitCatalog;
  const attacker = combat.stacks.find((s) => s.id === stackId) as CombatStack;
  const attackerDef = catalog[attacker.unitId];
  const target = combat.stacks.find((s) => s.id === action.targetStackId);
  if (!attackerDef || !target) return; // défensif : déjà validé
  const targetDef = catalog[target.unitId];
  if (!targetDef) return;
  const wasFirstAction = !attacker.acted;
  const ranged = canShoot(draft, attacker.id);
  const hasDoubleAttack = hasAbility(attackerDef, 'doubleAttack');

  if (ranged) {
    let shots = hasDoubleAttack ? 2 : 1;
    shots = Math.min(shots, attacker.ammo ?? 0);
    for (let i = 0; i < shots; i++) {
      if (!combat.stacks.some((s) => s.id === target.id)) break;
      attacker.ammo = (attacker.ammo ?? 0) - 1;
      const { targetDied } = performStrike(draft, events, {
        striker: attacker,
        victim: target,
        strikerDef: attackerDef,
        victimDef: targetDef,
        meleePenalized: false,
        retaliation: false,
        ranged: true,
        rules,
      });
      if (checkCombatEnd(draft, events)) return;
      if (targetDied) break;
    }
  } else {
    if (action.from) {
      const from = { ...attacker.pos };
      attacker.pos = { ...action.from };
      events.push({ type: 'StackMoved', stackId: attacker.id, from, to: { ...attacker.pos } });
    }
    const meleePenalized = isShooterMeleePenalized(attackerDef);
    const first = performStrike(draft, events, {
      striker: attacker,
      victim: target,
      strikerDef: attackerDef,
      victimDef: targetDef,
      meleePenalized,
      retaliation: false,
      ranged: false,
      rules,
    });
    if (checkCombatEnd(draft, events)) return;
    let attackerAlive = combat.stacks.some((s) => s.id === attacker.id);
    if (!first.targetDied && attackerAlive) {
      const canRetaliate =
        target.retaliationsLeft > 0 && !hasAbility(targetDef, 'noRetaliation');
      if (canRetaliate) {
        target.retaliationsLeft -= 1;
        const retMeleePenalized = isShooterMeleePenalized(targetDef);
        performStrike(draft, events, {
          striker: target,
          victim: attacker,
          strikerDef: targetDef,
          victimDef: attackerDef,
          meleePenalized: retMeleePenalized,
          retaliation: true,
          ranged: false,
          rules,
        });
        if (checkCombatEnd(draft, events)) return;
        attackerAlive = combat.stacks.some((s) => s.id === attacker.id);
      }
    }
    const targetAlive = combat.stacks.some((s) => s.id === target.id);
    if (hasDoubleAttack && attackerAlive && targetAlive) {
      performStrike(draft, events, {
        striker: attacker,
        victim: target,
        strikerDef: attackerDef,
        victimDef: targetDef,
        meleePenalized,
        retaliation: false,
        ranged: false,
        rules,
      });
      if (checkCombatEnd(draft, events)) return;
    }
  }
  afterAction(draft, events, attacker.id, wasFirstAction, 'attack');
}
