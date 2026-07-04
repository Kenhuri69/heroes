import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';
import type { VictoryCondition } from './types';

/**
 * Interprétation d'une `VictoryCondition` du point de vue de `playerId` — pure,
 * aucune connaissance de scénario nommé (doc 02 §6, plan phase-3.5).
 */
export function conditionMet(draft: GameState, playerId: string, cond: VictoryCondition): boolean {
  switch (cond.type) {
    case 'eliminateAllEnemies':
      return draft.players.every((p) => p.id === playerId || p.eliminated);
    case 'captureTown':
      return draft.towns.find((t) => t.id === cond.townId)?.ownerPlayerId === playerId;
    case 'defeatHero':
      return !draft.heroes.some((h) => h.id === cond.heroId);
    case 'surviveDays':
      return draft.calendar.day >= cond.days;
  }
}

/**
 * Évalue les conditions de victoire/défaite du scénario (doc 02 §6, plan
 * phase-3.5) et pose `draft.outcome` + émet `GameEnded`/`PlayerEliminated` une
 * seule fois. **No-op si `draft.scenario` est null** (partie libre) — le golden
 * et les parties proto restent inchangés.
 *
 * Appelé après `EndTurn` (bascule de jour), `checkCombatEnd` et la capture de
 * ville — un héros/une ville peut disparaître à ces trois occasions.
 */
export function evaluateOutcome(draft: GameState, events: GameEvent[]): void {
  if (!draft.scenario || draft.outcome) return;

  // Élimination : sans ville ni héros, un joueur ne joue plus (grâce de 7
  // jours du doc 02 §4 différée — élimination immédiate au MVP).
  for (const p of draft.players) {
    if (p.eliminated) continue;
    const hasTown = draft.towns.some((t) => t.ownerPlayerId === p.id);
    const hasHero = draft.heroes.some((h) => h.playerId === p.id);
    if (!hasTown && !hasHero) {
      p.eliminated = true;
      events.push({ type: 'PlayerEliminated', playerId: p.id });
    }
  }

  // Évaluation du point de vue du joueur local : le premier `human`, sinon le
  // premier joueur de la partie.
  const local = draft.players.find((p) => p.controller === 'human') ?? draft.players[0];
  if (!local) return;
  const objectives = draft.scenario.objectives[local.id];
  if (!objectives) return;

  if (conditionMet(draft, local.id, objectives.defeat) || local.eliminated) {
    const winner = draft.players.find((p) => p.id !== local.id && !p.eliminated);
    draft.outcome = { status: 'lost', winnerPlayerId: winner?.id ?? '' };
    events.push({ type: 'GameEnded', status: 'lost', winnerPlayerId: draft.outcome.winnerPlayerId });
    return;
  }
  if (conditionMet(draft, local.id, objectives.victory)) {
    draft.outcome = { status: 'won', winnerPlayerId: local.id };
    events.push({ type: 'GameEnded', status: 'won', winnerPlayerId: local.id });
  }
}
