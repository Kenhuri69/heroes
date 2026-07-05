import { isAdjacent, samePos } from '../adventure/map';
import type { Command, CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';
import { evaluateOutcome } from '../scenario/outcome';

type CaptureCmd = Extract<Command, { type: 'CaptureTown' }>;

/**
 * Capture (doc 02 §4.1, décision plan phase-3.1 point 9) — MVP 3.1 : une
 * ville sans garnison est prise immédiatement. La prise par combat (garnison
 * non vide) arrive avec l'IA d'aventure en 3.5 : rejetée pour l'instant.
 *
 * Remédiation R1 (E3) : le moteur ne fait pas confiance au client. La capture
 * exige hors combat, par le joueur actif, avec un héros du joueur sur ou
 * adjacent à la ville (même règle que `pickAdjacentCapturableTown` de l'IA).
 */
export function validateCaptureTown(state: GameState, cmd: CaptureCmd): CommandError | null {
  if (state.combat) return { code: 'combatActive', message: 'un combat est en cours' };
  const current = state.players[state.currentPlayer];
  if (!current || current.id !== cmd.playerId)
    return { code: 'notYourTurn', message: `ce n’est pas le tour de ${cmd.playerId}` };
  const town = state.towns.find((t) => t.id === cmd.townId);
  if (!town) return { code: 'unknownTown', message: `ville inconnue '${cmd.townId}'` };
  if (town.ownerPlayerId === cmd.playerId)
    return { code: 'invalidAction', message: `'${cmd.townId}' appartient déjà à ${cmd.playerId}` };
  const hasHeroNear = state.heroes.some(
    (h) => h.playerId === cmd.playerId && (samePos(h.pos, town.pos) || isAdjacent(h.pos, town.pos)),
  );
  if (!hasHeroNear)
    return {
      code: 'invalidAction',
      message: `aucun héros de ${cmd.playerId} sur ou adjacent à '${cmd.townId}'`,
    };
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
  // Une ville peut changer de main (élimination de l'ancien propriétaire) :
  // conditions de victoire/défaite (doc 02 §6, plan phase-3.5) — no-op hors scénario.
  evaluateOutcome(draft, events);
}
