import type { GameEvent } from '../core/events';
import { rollRange } from '../core/rng';
import type { Draft } from './draft';
import { collectCasualties, combatRules, effectiveSpeed, moraleOf } from './state-helpers';
import type { CombatSideId, CombatStack, CombatState } from './types';

/**
 * Ordre de jeu par vagues (doc 02 §5.2) : vitesse décroissante, attente en fin
 * de round par vitesse croissante ; moral négatif peut sauter un tour au
 * moment où il arrive. Fin de combat : victoire/conséquences/CombatEnded.
 */

function pickNext(
  candidates: CombatStack[],
  combat: CombatState,
  catalog: Draft['unitCatalog'],
  direction: 'asc' | 'desc',
): CombatStack | undefined {
  const sorted = [...candidates].sort((a, b) => {
    const sa = effectiveSpeed(a, combat, catalog);
    const sb = effectiveSpeed(b, combat, catalog);
    if (sa !== sb) return direction === 'desc' ? sb - sa : sa - sb;
    if (a.side !== b.side) return a.side === 'attacker' ? -1 : 1;
    return a.slot - b.slot;
  });
  return sorted[0];
}

/**
 * Choisit la prochaine pile active : vagues normales (vitesse décroissante),
 * puis piles en attente (vitesse croissante), sinon nouveau round. Applique
 * le saut de tour pour moral négatif. Émet CombatRoundStarted/CombatTurnStarted.
 */
export function advanceTurn(draft: Draft, events: GameEvent[]): void {
  const combat = draft.combat;
  if (!combat || combat.finished) return;
  const rules = combatRules(draft);
  for (;;) {
    const alive = combat.stacks;
    const mainPhase = alive.filter((s) => !s.acted && !s.waited);
    const waitPhase = alive.filter((s) => !s.acted && s.waited);
    let next = mainPhase.length > 0 ? pickNext(mainPhase, combat, draft.unitCatalog, 'desc') : undefined;
    if (!next) next = waitPhase.length > 0 ? pickNext(waitPhase, combat, draft.unitCatalog, 'asc') : undefined;
    if (!next) {
      // Round terminé : personne à faire jouer — round suivant.
      combat.round += 1;
      for (const s of alive) {
        s.acted = false;
        s.waited = false;
        s.retaliationsLeft = 1;
      }
      events.push({ type: 'CombatRoundStarted', round: combat.round });
      continue;
    }
    next.defending = false; // levé quand le tour de la pile revient (doc 02 §5.2)
    const moral = moraleOf(next, combat, draft.unitCatalog);
    if (moral < 0) {
      const roll = rollRange(draft.rng, 0, 99);
      draft.rng = roll.state;
      if (roll.value < Math.abs(moral) * rules.moraleChancePerPoint * 100) {
        next.acted = true;
        events.push({ type: 'MoraleTriggered', stackId: next.id, positive: false });
        continue;
      }
    }
    combat.activeStackId = next.id;
    events.push({ type: 'CombatTurnStarted', stackId: next.id });
    return;
  }
}

/**
 * Fin de combat : un camp sans pile ⇒ victoire de l'autre. Applique les
 * conséquences (armée du héros, gardien) AVANT de nullifier `draft.combat`.
 * Retourne `true` si le combat est bien terminé (le code appelant doit
 * s'arrêter immédiatement, ne pas tenter d'avancer le tour).
 */
export function checkCombatEnd(draft: Draft, events: GameEvent[]): boolean {
  const combat = draft.combat;
  if (!combat) return true;
  const attackerAlive = combat.stacks.some((s) => s.side === 'attacker' && s.count > 0);
  const defenderAlive = combat.stacks.some((s) => s.side === 'defender' && s.count > 0);
  if (attackerAlive && defenderAlive) return false;
  const winner: CombatSideId = attackerAlive ? 'attacker' : 'defender';
  combat.finished = true;
  combat.winner = winner;
  combat.activeStackId = null;
  applyConsequences(draft, combat, winner);
  const casualties = collectCasualties(combat);
  events.push({ type: 'CombatEnded', winner, casualties });
  draft.combat = null;
  return true;
}

function applyConsequences(draft: Draft, combat: CombatState, winner: CombatSideId): void {
  if (!combat.heroId) return; // arène : rien à appliquer
  const hero = draft.heroes.find((h) => h.id === combat.heroId);
  if (winner === 'attacker') {
    if (hero) {
      hero.army = combat.stacks
        .filter((s) => s.side === 'attacker' && s.count > 0)
        .map((s) => ({ unitId: s.unitId, count: s.count }));
    }
    if (draft.map && combat.guardianObjectId) {
      const idx = draft.map.objects.findIndex((o) => o.id === combat.guardianObjectId);
      if (idx !== -1) draft.map.objects.splice(idx, 1);
    }
  } else {
    if (hero) {
      const idx = draft.heroes.findIndex((h) => h.id === combat.heroId);
      if (idx !== -1) draft.heroes.splice(idx, 1);
    }
    if (draft.map && combat.guardianObjectId) {
      const obj = draft.map.objects.find((o) => o.id === combat.guardianObjectId);
      if (obj && obj.type === 'guardian') {
        obj.count = combat.stacks
          .filter((s) => s.side === 'defender')
          .reduce((sum, s) => sum + s.count, 0);
      }
    }
  }
}
