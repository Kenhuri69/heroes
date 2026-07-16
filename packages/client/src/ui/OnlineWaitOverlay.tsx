import { useEffect } from 'preact/hooks';
import { currentTurnPlayerId } from '@heroes/engine';
import { useApp } from '../app/store';
import { t } from '../app/i18n';
import { navigate } from '../app/router';
import { pollOnlineMatch, refreshOnlineMatch } from '../app/online-match';
import { pushToast } from './toasts';
import './OutcomeOverlay.css';
import './HandoffOverlay.css';

/** Intervalle de sondage « c'est ton tour » (ms) — jeu tour-par-tour async. */
const POLL_MS = 12_000;

/**
 * Overlay bloquant du PvP asynchrone (NET-PVPUI slices B/C) : monté par `Shell`
 * quand une partie en ligne est active MAIS que ce n'est pas mon tour (ou qu'elle
 * est finie). Couvre tout le plateau ⇒ gate d'entrée simple pendant le tour
 * adverse. **Slice C** : sonde périodiquement le serveur (`pollOnlineMatch`) tant
 * qu'on attend — l'overlay se lève seul dès que l'adversaire a joué ; détecte
 * aussi la fin/abandon par statut serveur.
 */
export function OnlineWaitOverlay() {
  useApp((s) => s.locale); // réactivité i18n
  const game = useApp((s) => s.game);
  const onlineMatch = useApp((s) => s.onlineMatch);

  const status = onlineMatch?.status;
  const gameOver = !!game.outcome || status === 'finished' || status === 'abandoned';
  const myTurn = !!onlineMatch && currentTurnPlayerId(game) === onlineMatch.myPlayerId;
  const visible = !!onlineMatch && (!myTurn || gameOver);
  const shouldPoll = visible && !gameOver;

  // Sondage scoppé à l'attente : coupé en partie finie, à mon tour (overlay
  // démonté) et quand l'onglet est masqué. Nettoyé au démontage.
  useEffect(() => {
    if (!shouldPoll) return;
    const tick = (): void => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void pollOnlineMatch();
    };
    const h = setInterval(tick, POLL_MS);
    return () => clearInterval(h);
  }, [shouldPoll, onlineMatch?.id]);

  if (!visible) return null;
  const abandoned = status === 'abandoned';
  const titleKey = gameOver ? (abandoned ? 'online.wait.abandoned' : 'online.wait.over') : 'online.wait.title';
  const hintKey = gameOver
    ? abandoned
      ? 'online.wait.abandonedHint'
      : 'online.wait.overHint'
    : 'online.wait.hint';
  const doRefresh = (): void => {
    void refreshOnlineMatch().catch(() => pushToast(t('toast.matchError'), 'error'));
  };
  return (
    <div class="modal-backdrop handoff-backdrop">
      <div
        class="modal outcome-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={t('online.wait.title')}
        data-testid="online-wait-overlay"
      >
        <h2>{t(titleKey)}</h2>
        <p>{t(hintKey)}</p>
        {!gameOver && (
          <button class="menu-button" data-testid="online-wait-refresh" onClick={doRefresh}>
            {t('online.wait.refresh')}
          </button>
        )}
        <button class="menu-button" data-testid="online-wait-leave" onClick={() => navigate('menu')}>
          {t('online.wait.leave')}
        </button>
      </div>
    </div>
  );
}
