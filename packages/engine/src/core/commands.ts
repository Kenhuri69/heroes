import type { Resources } from './state';

export interface PlayerSetup {
  id: string;
  /** Ressources de départ — fournies par le scénario/les données, jamais en dur. */
  startingResources: Resources;
}

/**
 * Union des commandes — petites et sérialisables : c'est le format de replay
 * et le futur protocole réseau (doc 07 §3). S'étend par phase :
 * `MoveHero`/`PickChoice` en 2.3, `CombatAction` en 2.4.
 */
export type Command =
  | { type: 'StartGame'; seed: number; players: PlayerSetup[] }
  | { type: 'EndTurn'; playerId: string };

export interface CommandError {
  code:
    | 'gameAlreadyStarted'
    | 'gameNotStarted'
    | 'noPlayers'
    | 'duplicatePlayerId'
    | 'notYourTurn';
  message: string;
}

export class EngineError extends Error {
  constructor(readonly detail: CommandError) {
    super(`${detail.code}: ${detail.message}`);
    this.name = 'EngineError';
  }
}
