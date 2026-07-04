import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';
import { applyAction, canShoot, reachableHexes } from './actions';
import { estimateDamage } from './damage';
import type { Draft } from './draft';
import { hexDistance, type OffsetPos } from './hex';
import type { CombatActionInput } from './types';

/**
 * IA basique (doc 02 §5.6, raffinée au lot B) : tire sur la cible la plus
 * meurtrière si possible, sinon frappe en mêlée un ennemi atteignable, sinon
 * se rapproche du plus proche, sinon défend. Garantit toujours une action
 * qui fait progresser le combat (jamais de blocage à deux IA).
 */
export function chooseAction(state: GameState, stackId: string): CombatActionInput {
  const combat = state.combat;
  if (!combat) throw new Error(`chooseAction: aucun combat en cours`);
  const stack = combat.stacks.find((s) => s.id === stackId);
  if (!stack) throw new Error(`chooseAction: pile introuvable '${stackId}'`);
  const enemies = combat.stacks.filter((s) => s.side !== stack.side && s.count > 0);
  if (enemies.length === 0) return { type: 'defend' };

  if (canShoot(state, stackId)) {
    let best = enemies[0] as (typeof enemies)[number];
    let bestScore = -Infinity;
    for (const e of enemies) {
      const est = estimateDamage(state, stackId, e.id);
      const score = est.killsMax * 1_000_000 + est.damageMax;
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return { type: 'attack', targetStackId: best.id };
  }

  const adjacent = enemies.find((e) => hexDistance(stack.pos, e.pos) === 1);
  if (adjacent) return { type: 'attack', targetStackId: adjacent.id };

  let nearest = enemies[0] as (typeof enemies)[number];
  let nearestDist = hexDistance(stack.pos, nearest.pos);
  for (const e of enemies) {
    const d = hexDistance(stack.pos, e.pos);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = e;
    }
  }

  const reachable = reachableHexes(state, stackId);
  const approachHex = reachable.find((p) => hexDistance(p, nearest.pos) === 1);
  if (approachHex) return { type: 'attack', targetStackId: nearest.id, from: approachHex };

  let bestMove: OffsetPos | null = null;
  let bestDist = nearestDist;
  for (const p of reachable) {
    const d = hexDistance(p, nearest.pos);
    if (d < bestDist) {
      bestDist = d;
      bestMove = p;
    }
  }
  if (bestMove) return { type: 'move', to: bestMove };
  return { type: 'defend' };
}

/** Garde-fou : une vraie boucle infinie serait un bug de règles, pas un cas à masquer. */
const MAX_AI_ITERATIONS = 20_000;

/** Fait jouer l'IA tant que la pile active appartient au camp NON-joueur. */
export function runAiIfNeeded(draft: Draft, events: GameEvent[]): void {
  let iterations = 0;
  for (;;) {
    const combat = draft.combat;
    if (!combat || combat.finished || !combat.activeStackId) return;
    const active = combat.stacks.find((s) => s.id === combat.activeStackId);
    if (!active || active.side === combat.playerSide) return;
    if (++iterations > MAX_AI_ITERATIONS) {
      throw new Error('runAiIfNeeded: dépassement d’itérations (boucle infinie suspectée)');
    }
    const action = chooseAction(draft, active.id);
    applyAction(draft, events, active.id, action);
  }
}

/** L'IA joue aussi le camp joueur jusqu'à la fin (doc 02 §5.5). */
export function runAutoCombat(draft: Draft, events: GameEvent[]): void {
  let iterations = 0;
  for (;;) {
    const combat = draft.combat;
    if (!combat || combat.finished || !combat.activeStackId) return;
    if (++iterations > MAX_AI_ITERATIONS) {
      throw new Error('runAutoCombat: dépassement d’itérations (boucle infinie suspectée)');
    }
    const action = chooseAction(draft, combat.activeStackId);
    applyAction(draft, events, combat.activeStackId, action);
  }
}
