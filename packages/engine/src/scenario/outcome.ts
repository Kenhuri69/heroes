import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';

/**
 * Évalue les conditions de victoire/défaite du scénario (doc 02 §6, plan
 * phase-3.5) et pose `draft.outcome` + émet `GameEnded`/`PlayerEliminated` une
 * seule fois. **No-op si `draft.scenario` est null** (partie libre) — le golden
 * et les parties proto restent inchangés.
 *
 * STUB (cadrage) : implémentation dans le lot R (moteur conditions). Signature
 * figée — appelé après `EndTurn` (bascule de jour), `applyConsequences` et la
 * capture de ville.
 */
export function evaluateOutcome(draft: GameState, _events: GameEvent[]): void {
  if (!draft.scenario || draft.outcome) return;
  // Lot R : élimination des joueurs sans ville ni héros, puis évaluation des
  // conditions (eliminateAllEnemies/captureTown/defeatHero/surviveDays) du
  // point de vue du joueur local ; pose draft.outcome + push GameEnded.
}
