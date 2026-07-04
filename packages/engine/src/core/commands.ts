import type { AdventureConfig } from '../adventure/config';
import type { AdventureMapDef, GridPos } from '../adventure/map';
import type { Resources } from './state';

export interface PlayerSetup {
  id: string;
  /** Ressources de départ — fournies par le scénario/les données, jamais en dur. */
  startingResources: Resources;
}

/**
 * Union des commandes — petites et sérialisables : c'est le format de replay
 * et le futur protocole réseau (doc 07 §3). S'étend par phase :
 * `CombatAction` en 2.4. `StartGame` embarque carte et constantes résolues
 * (validées par le pipeline de contenu) : le moteur ne fetch jamais rien.
 */
export type Command =
  | {
      type: 'StartGame';
      seed: number;
      players: PlayerSetup[];
      map: AdventureMapDef;
      config: AdventureConfig;
    }
  | {
      /** Chemin calculé par A* côté client ; le moteur revalide chaque pas. */
      type: 'MoveHero';
      heroId: string;
      path: GridPos[];
    }
  | { type: 'EndTurn'; playerId: string };

export interface CommandError {
  code:
    | 'gameAlreadyStarted'
    | 'gameNotStarted'
    | 'noPlayers'
    | 'duplicatePlayerId'
    | 'notYourTurn'
    | 'invalidMap'
    | 'unknownHero'
    | 'notYourHero'
    | 'invalidPath'
    | 'noMovementPoints';
  message: string;
}

export class EngineError extends Error {
  constructor(readonly detail: CommandError) {
    super(`${detail.code}: ${detail.message}`);
    this.name = 'EngineError';
  }
}
