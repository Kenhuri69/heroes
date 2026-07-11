import type { Command, CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';
import { findPath, stepCost } from '../adventure/path';

type SendCaravanCmd = Extract<Command, { type: 'SendCaravan' }>;

const MAX_STACKS = 7;

/**
 * Caravanes inter-villes (T-CARAVAN, doc 02 §4.1) — une pile de garnison voyage
 * d'une ville possédée à une autre en un nombre de jours dérivé de l'A* existant
 * (vitesse de base, aucun PM de héros consommé). Non interceptable (HoMM3).
 */

/** Durée de trajet en jours entre deux tuiles, ou `null` si aucun chemin terrestre. */
function travelDays(state: GameState, from: GameState['towns'][number], to: GameState['towns'][number]): number | null {
  if (!state.config || !state.map) return null;
  const path = findPath(state.config, state.map, from.pos, to.pos);
  if (!path) return null;
  let cost = 0;
  let prev = from.pos;
  for (const step of path) {
    cost += stepCost(state.config, state.map, prev, step);
    prev = step;
  }
  return Math.max(1, Math.ceil(cost / state.config.movement.base));
}

export function validateSendCaravan(state: GameState, cmd: SendCaravanCmd): CommandError | null {
  const from = state.towns.find((t) => t.id === cmd.fromTownId);
  if (!from) return { code: 'unknownTown', message: `ville inconnue '${cmd.fromTownId}'` };
  const to = state.towns.find((t) => t.id === cmd.toTownId);
  if (!to) return { code: 'unknownTown', message: `ville inconnue '${cmd.toTownId}'` };
  if (cmd.fromTownId === cmd.toTownId)
    return { code: 'invalidCaravan', message: 'ville de départ et d’arrivée identiques' };
  const player = state.players[state.currentPlayer];
  if (!player || from.ownerPlayerId !== player.id || to.ownerPlayerId !== player.id)
    return { code: 'notYourTown', message: 'les deux villes doivent appartenir au joueur actif' };
  const stack = from.garrison[cmd.slot];
  if (!stack) return { code: 'invalidCaravan', message: `case de garnison invalide (${cmd.slot})` };
  if (travelDays(state, from, to) === null)
    return { code: 'invalidCaravan', message: 'aucun chemin terrestre entre les deux villes' };
  return null;
}

export function handleSendCaravan(draft: GameState, cmd: SendCaravanCmd, events: GameEvent[]): void {
  const from = draft.towns.find((t) => t.id === cmd.fromTownId);
  const to = draft.towns.find((t) => t.id === cmd.toTownId);
  if (!from || !to) return; // exclu par validate
  const stack = from.garrison[cmd.slot];
  if (!stack) return; // exclu par validate
  const days = travelDays(draft, from, to);
  if (days === null) return; // exclu par validate
  from.garrison.splice(cmd.slot, 1);
  draft.caravans.push({
    id: `carv-${draft.calendar.day}-${draft.caravans.length}`,
    playerId: from.ownerPlayerId as string,
    toTownId: to.id,
    army: [{ unitId: stack.unitId, count: stack.count }],
    daysLeft: days,
  });
  events.push({
    type: 'CaravanSent',
    playerId: from.ownerPlayerId as string,
    fromTownId: from.id,
    toTownId: to.id,
    days,
  });
}

/**
 * Avance toutes les caravanes d'un jour (appelé au `DayStarted`). Arrivée ⇒
 * dépôt en garnison si la ville appartient encore à l'expéditeur (fusion par
 * `unitId`, sinon slot libre) ; garnison pleine ⇒ attente ; ville capturée ⇒
 * caravane perdue.
 */
export function tickCaravans(draft: GameState, events: GameEvent[]): void {
  const remaining: typeof draft.caravans = [];
  for (const caravan of draft.caravans) {
    if (caravan.daysLeft > 0) caravan.daysLeft -= 1;
    if (caravan.daysLeft > 0) {
      remaining.push(caravan);
      continue;
    }
    const town = draft.towns.find((t) => t.id === caravan.toTownId);
    if (!town || town.ownerPlayerId !== caravan.playerId) {
      // Destination disparue / capturée : la caravane se disperse.
      events.push({ type: 'CaravanLost', playerId: caravan.playerId, toTownId: caravan.toTownId });
      continue;
    }
    // Places neuves requises (piles ne fusionnant avec aucune existante). Si la
    // garnison n'a pas la place pour toutes, la caravane attend un jour entier
    // sans rien déposer (dépôt atomique).
    const newStacks = caravan.army.filter((s) => !town.garrison.some((g) => g.unitId === s.unitId));
    if (town.garrison.length + newStacks.length > MAX_STACKS) {
      remaining.push(caravan);
      continue;
    }
    for (const stack of caravan.army) {
      const existing = town.garrison.find((s) => s.unitId === stack.unitId);
      if (existing) existing.count += stack.count;
      else town.garrison.push({ unitId: stack.unitId, count: stack.count });
      events.push({
        type: 'CaravanArrived',
        playerId: caravan.playerId,
        toTownId: town.id,
        unitId: stack.unitId,
        count: stack.count,
      });
    }
  }
  draft.caravans = remaining;
}
