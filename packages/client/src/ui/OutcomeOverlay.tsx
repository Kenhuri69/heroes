import { createEmptyState } from '@heroes/engine';
import { appStore, useApp } from '../app/store';
import { t } from '../app/i18n';
import './OutcomeOverlay.css';

/**
 * Overlay victoire/défaite (doc 02 §6, plan phase-3.5 lot U) : monté par
 * `Shell` dès que `game.outcome !== null`. Non fermable autrement que par
 * « Retour au menu » — la partie est terminée, comme la modale de choix de
 * compétence (pas de clic-extérieur).
 */
export function OutcomeOverlay() {
  useApp((s) => s.locale); // réactivité i18n
  const outcome = useApp((s) => s.game.outcome);
  if (!outcome) return null;

  const backToMenu = (): void => {
    appStore.setState({
      game: createEmptyState(),
      screen: 'menu',
      modals: [],
    });
  };

  return (
    <div class="modal-backdrop">
      <div
        class="modal outcome-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={t(outcome.status === 'won' ? 'outcome.won' : 'outcome.lost')}
        data-testid="outcome-overlay"
      >
        <h2 data-testid="outcome-status">{t(outcome.status === 'won' ? 'outcome.won' : 'outcome.lost')}</h2>
        <button class="menu-button" data-testid="outcome-back-to-menu" onClick={backToMenu}>
          {t('outcome.backToMenu')}
        </button>
      </div>
    </div>
  );
}
