import { apply } from '../core/engine';
import type { Command } from '../core/commands';
import { createEmptyState, type GameState } from '../core/state';
import { hashState } from '../core/serialize';

/**
 * Netcode déterministe (doc 07 §5, doc 09 Phase 4, doc 15) : une partie
 * asynchrone ≡ un journal ORDONNÉ de commandes (la 1ʳᵉ étant `StartGame`).
 * Rejouer le journal reconstruit l'état EXACT — c'est le « serveur autoritaire
 * par re-simulation » rendu presque gratuit par le moteur pur et seedé (même
 * idée que le golden replay, doc 07 §7). Ces helpers sont PURS et déterministes :
 * partagés par le serveur (validation d'un tour posté) et le client (rejeu).
 */

/** Rejoue un journal depuis l'état vide → état final. Lève si une commande est illégale. */
export function replayCommands(commands: readonly Command[]): GameState {
  let state = createEmptyState();
  for (const cmd of commands) state = apply(state, cmd).state;
  return state;
}

/** Empreinte canonique d'un journal — deux rejeux honnêtes coïncident (anti-triche). */
export function replayHash(commands: readonly Command[]): string {
  return hashState(replayCommands(commands));
}

/** Id du joueur dont c'est le tour (`null` si la partie est finie ou vide). */
export function currentTurnPlayerId(state: GameState): string | null {
  if (state.outcome) return null;
  return state.players[state.currentPlayer]?.id ?? null;
}

/** Résultat de `appendTurn` : le journal augmenté, ou un motif de rejet. */
export type AppendResult =
  | { ok: true; commands: Command[] }
  | { ok: false; reason: string };

/**
 * Valide l'ajout d'un lot de commandes d'un joueur à un journal existant (règle
 * du PvP asynchrone) : rejoue le journal de base, vérifie que c'est bien SON tour,
 * puis rejoue le lot — s'il lève, le tour est refusé. Le serveur (Worker) s'en
 * sert pour accepter/rejeter un tour posté SANS faire confiance au client.
 */
export function appendTurn(
  base: readonly Command[],
  playerId: string,
  batch: readonly Command[],
): AppendResult {
  let state: GameState;
  try {
    state = replayCommands(base);
  } catch (e) {
    return { ok: false, reason: `journal de base invalide : ${(e as Error).message}` };
  }
  if (currentTurnPlayerId(state) !== playerId) {
    return { ok: false, reason: `pas le tour de '${playerId}'` };
  }
  try {
    for (const cmd of batch) state = apply(state, cmd).state;
  } catch (e) {
    return { ok: false, reason: `commande illégale : ${(e as Error).message}` };
  }
  return { ok: true, commands: [...base, ...batch] };
}
