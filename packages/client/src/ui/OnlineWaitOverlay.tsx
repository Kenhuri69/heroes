import { currentTurnPlayerId } from '@heroes/engine';
import { useApp } from '../app/store';
import { t } from '../app/i18n';
import { navigate } from '../app/router';
import { refreshOnlineMatch } from '../app/online-match';
import { pushToast } from './toasts';
import './OutcomeOverlay.css';
import './HandoffOverlay.css';

/**
 * Overlay bloquant du PvP asynchrone (NET-PVPUI slice B) : monté par `Shell`
 * quand une partie en ligne est active MAIS que ce n'est pas mon tour (ou que la
 * partie est finie). Couvre tout le plateau ⇒ gate d'entrée simple pendant le
 * tour adverse (pas de refonte des handlers de la carte). **Rafraîchir**
 * re-synchronise le journal serveur ; **Quitter** revient au menu.
 */
export function OnlineWaitOverlay() {
  useApp((s) => s.locale); // réactivité i18n
  const game = useApp((s) => s.game);
  const onlineMatch = useApp((s) => s.onlineMatch);
  if (!onlineMatch) return null;
  const over = !!game.outcome;
  const myTurn = currentTurnPlayerId(game) === onlineMatch.myPlayerId;
  if (myTurn && !over) return null; // à moi de jouer : pas d'overlay.

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
        <h2>{t(over ? 'online.wait.over' : 'online.wait.title')}</h2>
        <p>{t(over ? 'online.wait.overHint' : 'online.wait.hint')}</p>
        {!over && (
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
