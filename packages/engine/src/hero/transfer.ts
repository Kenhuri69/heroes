import { isAdjacent } from '../adventure/map';
import type { Command, CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';

type TransferCmd = Extract<Command, { type: 'TransferBetweenHeroes' }>;

const MAX_STACKS = 7;

/**
 * Transfert d'armée/artefacts entre deux héros (UX-HEROSWAP, doc 02 §1.5, doc
 * 08 §2.3) — les deux héros appartiennent au **joueur actif** et occupent des
 * tuiles **adjacentes** (8 directions). Une entité par commande (`kind`), l'UI
 * enchaîne pour « tout donner ». Purement déterministe (aucun RNG). Aucun
 * événement dédié (surface `events.ts` figée, comme `GarrisonTransfer`) : le
 * rendu observe la mutation de `hero.army`/`hero.artifacts`.
 */
export function validateTransferBetweenHeroes(
  state: GameState,
  cmd: TransferCmd,
): CommandError | null {
  if (state.combat) return { code: 'combatActive', message: 'un combat est en cours' };
  if (cmd.fromHeroId === cmd.toHeroId)
    return { code: 'invalidTransfer', message: 'source et cible identiques' };
  const from = state.heroes.find((h) => h.id === cmd.fromHeroId);
  const to = state.heroes.find((h) => h.id === cmd.toHeroId);
  if (!from) return { code: 'unknownHero', message: `héros inconnu '${cmd.fromHeroId}'` };
  if (!to) return { code: 'unknownHero', message: `héros inconnu '${cmd.toHeroId}'` };
  const current = state.players[state.currentPlayer];
  if (!current || from.playerId !== current.id || to.playerId !== current.id)
    return { code: 'notYourHero', message: 'les deux héros doivent appartenir au joueur actif' };
  if (!isAdjacent(from.pos, to.pos))
    return { code: 'notAdjacent', message: 'les deux héros ne sont pas adjacents' };
  if (cmd.kind === 'army') {
    const stack = from.army[cmd.slot];
    if (!stack) return { code: 'invalidTransfer', message: `case d'armée invalide (${cmd.slot})` };
    const mergesIntoExisting = to.army.some((s) => s.unitId === stack.unitId);
    if (!mergesIntoExisting && to.army.length >= MAX_STACKS)
      return { code: 'invalidTransfer', message: 'armée cible pleine (7 piles max)' };
  } else {
    const artifactId = from.artifacts[cmd.slot];
    if (cmd.slot < 0 || cmd.slot >= from.artifacts.length || artifactId === null || artifactId === undefined)
      return { code: 'invalidTransfer', message: `slot d'artefact invalide (${cmd.slot})` };
    if (!to.artifacts.includes(null))
      return { code: 'invalidTransfer', message: 'aucun emplacement d’artefact libre chez la cible' };
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- pas d'événement dédié (surface figée events.ts)
export function handleTransferBetweenHeroes(draft: GameState, cmd: TransferCmd, events: GameEvent[]): void {
  const from = draft.heroes.find((h) => h.id === cmd.fromHeroId);
  const to = draft.heroes.find((h) => h.id === cmd.toHeroId);
  if (!from || !to) return; // exclu par validate
  if (cmd.kind === 'army') {
    const stack = from.army[cmd.slot];
    if (!stack) return; // exclu par validate
    from.army.splice(cmd.slot, 1);
    const existing = to.army.find((s) => s.unitId === stack.unitId);
    if (existing) existing.count += stack.count;
    else to.army.push({ unitId: stack.unitId, count: stack.count });
  } else {
    const artifactId = from.artifacts[cmd.slot];
    if (artifactId === null || artifactId === undefined) return; // exclu par validate
    const freeSlot = to.artifacts.indexOf(null);
    if (freeSlot === -1) return; // exclu par validate
    to.artifacts[freeSlot] = artifactId;
    from.artifacts[cmd.slot] = null;
  }
}
