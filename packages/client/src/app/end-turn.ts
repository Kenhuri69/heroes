import { dailyMovementPoints, type GameState } from '@heroes/engine';
import { appStore } from './store';
import { dispatch } from './dispatch';
import { humanHeroes, humanId } from './game';
import { refreshDailiesForCurrentDay } from './daily-refresh';

/**
 * Fin de tour humain (un seul point de sortie) : dispatch `EndTurn` — qui joue
 * aussi les tours IA jusqu'au prochain humain (le jour a alors avancé) — puis
 * rafraîchit les contrats journaliers du nouveau jour (N-DAILYREFRESH ; no-op
 * hors mode libre). Erreurs avalées comme l'ancien `void dispatch`.
 */
function endHumanTurn(playerId: string): void {
  void dispatch({ type: 'EndTurn', playerId })
    .then(() => refreshDailiesForCurrentDay())
    .catch(() => {
      /* rejet de validate/apply ou refresh — non bloquant (comportement historique) */
    });
}

/**
 * Fin de tour avec garde-fou (lot M8 C12, convention HoMM) : si l'option
 * `confirmEndTurn` est active et qu'au moins un héros humain n'a pas dépensé de
 * PM (`movementPoints` == max du jour), on demande confirmation (overlay
 * tap-tap) au lieu de finir le tour directement. Réutilisé par le bouton HUD et
 * le raccourci clavier `E`.
 */
function anyHumanHeroUnmoved(game: GameState): boolean {
  if (!game.config) return false;
  return humanHeroes(game).some(
    (h) => h.movementPoints >= dailyMovementPoints(game.config!, h.army, game.unitCatalog),
  );
}

export function requestEndTurn(): void {
  const { game, confirmEndTurn } = appStore.getState();
  // Tour d'un adversaire (IA) en cours : la fin de tour n'appartient pas à
  // l'humain — on ignore (le moteur la rejetterait ; on évite un toast d'erreur).
  if (game.players[game.currentPlayer]?.controller !== 'human') return;
  const playerId = humanId(game);
  if (confirmEndTurn && anyHumanHeroUnmoved(game)) {
    appStore.setState({ pendingEndTurn: { playerId } });
    return;
  }
  endHumanTurn(playerId);
}

/** Confirme la fin de tour en attente (overlay C12). */
export function confirmPendingEndTurn(): void {
  const pending = appStore.getState().pendingEndTurn;
  if (!pending) return;
  appStore.setState({ pendingEndTurn: null });
  endHumanTurn(pending.playerId);
}

/** Annule la confirmation en attente (le joueur revient au tour). */
export function cancelPendingEndTurn(): void {
  appStore.setState({ pendingEndTurn: null });
}
