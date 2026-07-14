import { appStore, useApp } from '../app/store';
import { t } from '../app/i18n';
import './OutcomeOverlay.css';
import './HandoffOverlay.css';

/**
 * Overlay « passez l'appareil » du hot-seat (doc 08 §3, Alpha 4.15) : monté par
 * `Shell` entre deux tours humains pour masquer le plateau du joueur précédent
 * (le brouillard et le HUD sont re-keyés au joueur actif). Overlay **forcé**
 * (hors pile de modales) — on ne peut le fermer qu'en validant « Continuer ».
 * Ne s'affiche qu'en partie **multi-humain** (≥ 2 humains) ; invisible en solo.
 */
export function HandoffOverlay() {
  useApp((s) => s.locale); // réactivité i18n
  const game = useApp((s) => s.game);
  const turnAck = useApp((s) => s.turnAck);

  const humans = game.players.filter((p) => p.controller === 'human');
  const active = game.players[game.currentPlayer];
  const show =
    humans.length >= 2 &&
    !game.combat &&
    !game.outcome &&
    active?.controller === 'human' &&
    active.id !== turnAck;
  if (!show || !active) return null;

  const seat = game.players.findIndex((p) => p.id === active.id) + 1;

  return (
    // Backdrop OPAQUE (B34) : le plateau du joueur suivant ne doit pas transparaître.
    <div class="modal-backdrop handoff-backdrop">
      <div
        class="modal outcome-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={t('handoff.title')}
        data-testid="handoff-overlay"
      >
        <h2 data-testid="handoff-player">{t('handoff.turnOf', { n: seat })}</h2>
        <p>{t('handoff.pass')}</p>
        <button
          class="menu-button"
          data-testid="handoff-continue"
          onClick={() => appStore.setState({ turnAck: active.id })}
        >
          {t('handoff.continue')}
        </button>
      </div>
    </div>
  );
}
