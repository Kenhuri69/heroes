import { samePos } from '../adventure/map';
import type { Command, CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';

type TransferCmd = Extract<Command, { type: 'GarrisonTransfer' }>;

const MAX_STACKS = 7;

/**
 * Transfert garnison ↔ héros (doc 02 §4.1, décision plan phase-3.1 point 7) —
 * le héros doit être physiquement sur la tuile de la ville et lui appartenir.
 * Aucun événement dédié n'est prévu par la surface figée (`events.ts`) : le
 * rendu observe la mutation de `town.garrison`/`hero.army`.
 */
export function validateGarrisonTransfer(state: GameState, cmd: TransferCmd): CommandError | null {
  const town = state.towns.find((t) => t.id === cmd.townId);
  if (!town) return { code: 'unknownTown', message: `ville inconnue '${cmd.townId}'` };
  const hero = state.heroes.find((h) => h.id === cmd.heroId);
  if (!hero) return { code: 'invalidTransfer', message: `héros inconnu '${cmd.heroId}'` };
  if (hero.playerId !== town.ownerPlayerId || !samePos(hero.pos, town.pos))
    return {
      code: 'invalidTransfer',
      message: `'${cmd.heroId}' n'est pas dans sa ville '${cmd.townId}'`,
    };
  const source = cmd.from === 'town' ? town.garrison : hero.army;
  const stack = source[cmd.slot];
  if (!stack) return { code: 'invalidTransfer', message: `case source invalide (${cmd.slot})` };
  const destination = cmd.from === 'town' ? hero.army : town.garrison;
  const mergesIntoExisting = destination.some((s) => s.unitId === stack.unitId);
  if (!mergesIntoExisting && destination.length >= MAX_STACKS)
    return { code: 'invalidTransfer', message: 'destination pleine (7 piles max)' };
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- pas d'événement dédié (surface figée events.ts)
export function handleGarrisonTransfer(draft: GameState, cmd: TransferCmd, events: GameEvent[]): void {
  const town = draft.towns.find((t) => t.id === cmd.townId);
  const hero = draft.heroes.find((h) => h.id === cmd.heroId);
  if (!town || !hero) return; // exclu par validate
  const source = cmd.from === 'town' ? town.garrison : hero.army;
  const stack = source[cmd.slot];
  if (!stack) return; // exclu par validate
  source.splice(cmd.slot, 1);
  const destination = cmd.from === 'town' ? hero.army : town.garrison;
  const existing = destination.find((s) => s.unitId === stack.unitId);
  if (existing) existing.count += stack.count;
  else destination.push({ unitId: stack.unitId, count: stack.count });
}
