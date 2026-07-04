import type { GridPos } from '../adventure/map';

/**
 * Événements descriptifs émis par `apply` : la présentation (Pixi, sons,
 * toasts) les consomme pour animer ; aucun n'est nécessaire à la correction
 * des règles (doc 07 §3).
 */
export type GameEvent =
  | { type: 'GameStarted'; seed: number; playerIds: string[] }
  | { type: 'TurnEnded'; playerId: string }
  | { type: 'DayStarted'; day: number }
  | { type: 'WeekStarted'; week: number }
  /** Un pas de héros — le rendu anime tuile par tuile (doc 07 §3). */
  | { type: 'MoveStepped'; heroId: string; from: GridPos; to: GridPos; movementPointsLeft: number }
  | {
      type: 'ResourcePicked';
      heroId: string;
      playerId: string;
      objectId: string;
      resource: string;
      amount: number;
      pos: GridPos;
    };
