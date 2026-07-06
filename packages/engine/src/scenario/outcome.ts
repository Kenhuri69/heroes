import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';
import type { VictoryCondition } from './types';

/**
 * Grâce de reprise de ville (doc 02 §4.1) : un joueur qui perd sa dernière ville
 * mais garde un héros a ce nombre de jours pour en reprendre une avant d'être
 * éliminé. Constante de règle (comme la semaine de 7 jours de `weekOf`).
 */
export const RETAKE_GRACE_DAYS = 7;

/**
 * Met à jour le compteur de jours sans ville de chaque joueur — appelé **une
 * fois par jour** (bascule de jour). Remis à 0 dès qu'une ville est possédée,
 * incrémenté sinon. L'élimination proprement dite est décidée par
 * `evaluateOutcome` (qui lit ce compteur).
 */
export function tickTownGrace(draft: GameState): void {
  for (const p of draft.players) {
    if (p.eliminated) continue;
    const hasTown = draft.towns.some((t) => t.ownerPlayerId === p.id);
    // Sentinelle `-1` = jamais possédé (désarmé) : reste désarmé tant qu'aucune
    // ville n'est prise ; possède ⇒ 0 (armé) ; sinon incrémente les jours perdus.
    p.townlessDays = hasTown ? 0 : p.townlessDays < 0 ? -1 : p.townlessDays + 1;
  }
}

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

  // Élimination (doc 02 §4.1) : sans ville NI héros, un joueur ne joue plus
  // (irrécupérable → immédiat). Sans ville mais avec un héros, il bénéficie de
  // la grâce de reprise : éliminé seulement au-delà de `RETAKE_GRACE_DAYS` jours
  // sans ville (compteur `townlessDays` avancé une fois par jour par `tickTownGrace`).
  for (const p of draft.players) {
    if (p.eliminated) continue;
    const hasTown = draft.towns.some((t) => t.ownerPlayerId === p.id);
    const hasHero = draft.heroes.some((h) => h.playerId === p.id);
    if (hasTown) continue;
    if (!hasHero || p.townlessDays > RETAKE_GRACE_DAYS) {
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
