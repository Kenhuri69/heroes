import { replayCommands, currentTurnPlayerId, type Command, type GameState } from '@heroes/engine';
import { getMatch, getMoves, postMove, profileId } from './net';
import { appStore } from './store';
import { eventBus } from './events';
import { t } from './i18n';
import { pushToast } from '../ui/toasts';

/**
 * Boucle de tour PvP asynchrone (NET-PVPUI slice B). Le netcode est **déjà**
 * complet et déterministe (`engine/net`) : une partie ≡ un journal de commandes
 * (1ᵉʳ = `StartGame`). Ce module fait le lien UI ↔ serveur :
 *   - reconstruire l'état par rejeu (`openOnlineMatch`) ;
 *   - capturer les commandes de MON tour et les poster (`recordOnlineTurn`) ;
 *   - savoir quand c'est mon tour (`isMyOnlineTurn`) pour l'overlay d'attente.
 * Zéro moteur/serveur : tout est du pilotage client derrière le gate en ligne.
 */

// Lot du tour courant en cours de constitution (vidé après chaque post).
let turnBuffer: Command[] = [];

/** Reconstruit l'état d'un match depuis le serveur et le charge dans le store. */
export async function openOnlineMatch(id: string): Promise<void> {
  const detail = await getMatch(id);
  const { moves } = await getMoves(id, -1);
  const log: Command[] = [detail.setup, ...moves.flatMap((m) => m.commands)];
  const game = replayCommands(log);
  const mine = profileId();
  const myPlayerId = detail.players.find((p) => p.profile_id === mine)?.player_id ?? null;
  turnBuffer = [];
  appStore.setState({
    game,
    onlineMatch: { id, nextSeq: moves.length, myPlayerId },
    screen: 'adventure',
    modals: [],
  });
  // Réutilise le canal de chargement (recentrage caméra, reprise éventuelle).
  eventBus.emit([{ type: 'GameLoaded' }]);
}

/** Re-synchronise le match courant (re-rejoue le journal serveur à jour). */
export async function refreshOnlineMatch(): Promise<void> {
  const om = appStore.getState().onlineMatch;
  if (om) await openOnlineMatch(om.id);
}

/** Est-ce à MON tour de jouer dans le match en ligne courant ? */
export function isMyOnlineTurn(game: GameState): boolean {
  const om = appStore.getState().onlineMatch;
  return !!om && currentTurnPlayerId(game) === om.myPlayerId;
}

/**
 * Appelé par `dispatch` après chaque commande appliquée. Si un match en ligne est
 * actif ET que c'était mon tour (état AVANT la commande), bufferise la commande ;
 * sur `EndTurn`, poste le lot (`postMove`) validé par le serveur. Un rejet
 * (409 seq / 422 illégal) déclenche une re-synchro pour éviter toute divergence.
 */
export async function recordOnlineTurn(cmd: Command, gameBefore: GameState): Promise<void> {
  const om = appStore.getState().onlineMatch;
  if (!om || currentTurnPlayerId(gameBefore) !== om.myPlayerId) return;
  turnBuffer.push(cmd);
  if (cmd.type !== 'EndTurn') return;
  const batch = turnBuffer;
  turnBuffer = [];
  try {
    const r = await postMove(om.id, om.nextSeq, batch);
    appStore.setState({ onlineMatch: { ...om, nextSeq: r.seq + 1 } });
  } catch {
    pushToast(t('toast.matchPostError'), 'error');
    await refreshOnlineMatch();
  }
}
