import { produce } from 'immer';
import { EngineError, type Command, type CommandError } from './commands';
import type { GameEvent } from './events';
import { seedRng } from './rng';
import { weekOf, type GameState } from './state';

export interface EngineResult {
  state: GameState;
  events: GameEvent[];
}

type Draft = GameState;
type Handlers = {
  [K in Command['type']]: (
    draft: Draft,
    cmd: Extract<Command, { type: K }>,
    events: GameEvent[],
  ) => void;
};

/** Règle d'or (doc 07 §2) : fonction pure (état, commande) → état + événements. */
export function apply(state: GameState, cmd: Command): EngineResult {
  const err = validate(state, cmd);
  if (err) throw new EngineError(err);
  const events: GameEvent[] = [];
  const next = produce(state, (draft) => {
    handlers[cmd.type](draft, cmd as never, events);
  });
  return { state: next, events };
}

export function validate(state: GameState, cmd: Command): CommandError | null {
  switch (cmd.type) {
    case 'StartGame': {
      if (state.started)
        return { code: 'gameAlreadyStarted', message: 'la partie est déjà démarrée' };
      if (cmd.players.length === 0)
        return { code: 'noPlayers', message: 'au moins un joueur est requis' };
      if (new Set(cmd.players.map((p) => p.id)).size !== cmd.players.length)
        return { code: 'duplicatePlayerId', message: 'IDs de joueurs en double' };
      return null;
    }
    case 'EndTurn': {
      if (!state.started)
        return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
      const current = state.players[state.currentPlayer];
      if (!current || current.id !== cmd.playerId)
        return { code: 'notYourTurn', message: `ce n’est pas le tour de ${cmd.playerId}` };
      return null;
    }
  }
}

const handlers: Handlers = {
  StartGame(draft, cmd, events) {
    draft.started = true;
    draft.rng = seedRng(cmd.seed);
    draft.calendar.day = 1;
    draft.currentPlayer = 0;
    draft.players = cmd.players.map((p) => ({
      id: p.id,
      resources: { ...p.startingResources },
    }));
    events.push({ type: 'GameStarted', seed: cmd.seed, playerIds: cmd.players.map((p) => p.id) });
    events.push({ type: 'DayStarted', day: 1 });
    events.push({ type: 'WeekStarted', week: 1 });
  },

  EndTurn(draft, cmd, events) {
    events.push({ type: 'TurnEnded', playerId: cmd.playerId });
    draft.currentPlayer += 1;
    if (draft.currentPlayer < draft.players.length) return;
    // Un jour = un tour de chaque joueur (doc 02 §2.3).
    draft.currentPlayer = 0;
    draft.calendar.day += 1;
    events.push({ type: 'DayStarted', day: draft.calendar.day });
    const week = weekOf(draft.calendar.day);
    if (week !== weekOf(draft.calendar.day - 1)) {
      events.push({ type: 'WeekStarted', week });
    }
  },
};
