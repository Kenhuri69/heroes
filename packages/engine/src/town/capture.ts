import type { Command, CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';

type CaptureCmd = Extract<Command, { type: 'CaptureTown' }>;

/**
 * Capture (doc 02 §4.1, décision plan phase-3.1 point 9) — MVP 3.1 : une
 * ville sans garnison est prise immédiatement. La prise par combat (garnison
 * non vide) arrive avec l'IA d'aventure en 3.5 : rejetée pour l'instant.
 */
export function validateCaptureTown(state: GameState, cmd: CaptureCmd): CommandError | null {
  const town = state.towns.find((t) => t.id === cmd.townId);
  if (!town) return { code: 'unknownTown', message: `ville inconnue '${cmd.townId}'` };
  if (town.garrison.length > 0)
    return {
      code: 'invalidAction',
      message: `'${cmd.townId}' est défendue : la prise par combat arrive en 3.5`,
    };
  return null;
}

export function handleCaptureTown(draft: GameState, cmd: CaptureCmd, events: GameEvent[]): void {
  const town = draft.towns.find((t) => t.id === cmd.townId);
  if (!town) return; // exclu par validate
  town.ownerPlayerId = cmd.playerId;
  events.push({ type: 'TownCaptured', townId: town.id, playerId: cmd.playerId });
}
