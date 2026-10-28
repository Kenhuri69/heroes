import type { GameEvent } from '../core/events';
import { areAllies, type GameState, type PlayerState } from '../core/state';
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
 * Jours restants à `playerId` pour reprendre une ville avant l'élimination (lot
 * LD1 — compte à rebours canon III, affiché par le client), ou `null` s'il tient
 * une ville ou n'en a jamais possédé. 1 = dernier jour.
 */
export function townlessDaysLeft(state: GameState, playerId: string): number | null {
  const p = state.players.find((pl) => pl.id === playerId);
  if (!p || p.eliminated || p.townlessDays < 0) return null;
  if (state.towns.some((t) => t.ownerPlayerId === playerId)) return null;
  return RETAKE_GRACE_DAYS + 1 - p.townlessDays;
}

/**
 * Interprétation d'une `VictoryCondition` du point de vue de `playerId` — pure,
 * aucune connaissance de scénario nommé (doc 02 §6, plan phase-3.5).
 */
export function conditionMet(draft: GameState, playerId: string, cond: VictoryCondition): boolean {
  switch (cond.type) {
    case 'eliminateAllEnemies': {
      // « Tous les ennemis » = tous sauf soi-même ET ses alliés (doc 02 §6). Un
      // allié encore vivant n'empêche pas la victoire ; sans alliance (team 0)
      // c'est le comportement historique (tout le monde est ennemi).
      const self = draft.players.find((p) => p.id === playerId);
      return draft.players.every(
        (p) => p.id === playerId || p.eliminated || (self ? areAllies(p, self) : false),
      );
    }
    case 'captureTown':
      return draft.towns.find((t) => t.id === cond.townId)?.ownerPlayerId === playerId;
    case 'defeatHero':
      // Un héros en réserve (fuite, LE6) a quitté la carte : battu, du point de
      // vue de la VICTOIRE d'un adversaire (cf. `defeatMet` pour sa propre défaite).
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
      // B3 : retirer les héros du joueur éliminé — sinon ils persistent comme
      // obstacles de pathfinding / cibles de gardiens et continuent de rapporter
      // (or/jour Économie, `core/engine.ts`).
      draft.heroes = draft.heroes.filter((h) => h.playerId !== p.id);
      events.push({ type: 'PlayerEliminated', playerId: p.id });
    }
  }

  // Sièges humains (lot LD1, clôt B27) : la partie continue tant qu'un humain
  // reste en jeu. Sans humain (IA contre IA), le premier joueur tient ce rôle.
  const humans = draft.players.filter((p) => p.controller === 'human');
  const locals = humans.length > 0 ? humans : draft.players.slice(0, 1);
  if (locals.length === 0) return;
  const objectivesOf = (p: PlayerState) => draft.scenario!.objectives[p.id];

  // Victoire d'un humain D'ABORD (doc 02 §6) : s'il atteint SON objectif, il
  // gagne — même si un adversaire remplit aussi le sien au même instant (ex. une
  // survie partagée `surviveDays`).
  const humanWinner = locals.find((p) => {
    const obj = objectivesOf(p);
    return !p.eliminated && obj !== undefined && conditionMet(draft, p.id, obj.victory);
  });
  if (humanWinner) {
    draft.outcome = { status: 'won', winnerPlayerId: humanWinner.id };
    events.push({ type: 'GameEnded', status: 'won', winnerPlayerId: humanWinner.id });
    return;
  }

  // Un humain dont la condition de défaite explicite est remplie sort du jeu ;
  // s'il en reste un autre, il est éliminé et la partie continue.
  const out = (p: PlayerState): boolean => {
    const defeat = objectivesOf(p)?.defeat;
    return p.eliminated || (defeat !== undefined && defeatMet(draft, p.id, defeat));
  };
  const remaining = locals.filter((p) => !out(p));

  // A10 : la victoire de CHAQUE joueur est évaluée (doc 02 §6 « par joueur »).
  // Un adversaire non éliminé qui remplit SON objectif (ex. l'IA capture
  // `start-town` dans conquest) ⇒ défaite. Un ALLIÉ d'un humain encore en jeu
  // ne fait pas perdre (victoire partagée).
  const isLocal = (p: PlayerState): boolean => locals.includes(p);
  const isEnemy = (p: PlayerState): boolean => !isLocal(p) && !remaining.some((h) => areAllies(p, h));
  const enemyWinner = draft.players.find((p) => {
    if (!isEnemy(p) || p.eliminated) return false;
    const obj = objectivesOf(p);
    return obj ? conditionMet(draft, p.id, obj.victory) : false;
  });
  if (remaining.length === 0 || enemyWinner) {
    const winner = enemyWinner ?? draft.players.find((p) => !isLocal(p) && !p.eliminated);
    draft.outcome = { status: 'lost', winnerPlayerId: winner?.id ?? '' };
    events.push({ type: 'GameEnded', status: 'lost', winnerPlayerId: draft.outcome.winnerPlayerId });
    return;
  }
  for (const p of locals) {
    if (p.eliminated || !out(p)) continue;
    p.eliminated = true;
    draft.heroes = draft.heroes.filter((h) => h.playerId !== p.id);
    events.push({ type: 'PlayerEliminated', playerId: p.id });
  }
}

/**
 * Condition de DÉFAITE de `playerId` (lot LD1, D-LD1b) : comme `conditionMet`,
 * sauf qu'un héros parti en réserve (fuite) ne fait pas perdre son propre
 * joueur — il est sauf. Il compte en revanche comme battu pour la victoire d'un
 * adversaire.
 */
function defeatMet(draft: GameState, playerId: string, cond: VictoryCondition): boolean {
  if (cond.type === 'defeatHero') {
    const inReserve = draft.players.some((p) => p.reserveHeroes?.some((h) => h.id === cond.heroId) ?? false);
    if (inReserve) return false;
  }
  return conditionMet(draft, playerId, cond);
}
