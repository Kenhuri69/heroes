import { appStore, useApp } from '../app/store';
import { t } from '../app/i18n';
import { playerColor } from '../render/playerColors';
import { FactionBadge } from './FactionBadge';
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
  // En PvP asynchrone (NET-PVPUI) l'adversaire est DISTANT : pas de « passez
  // l'appareil » — l'`OnlineWaitOverlay` gère l'attente du tour adverse.
  const online = useApp((s) => s.onlineMatch !== null);

  const humans = game.players.filter((p) => p.controller === 'human');
  const active = game.players[game.currentPlayer];
  const show =
    !online &&
    humans.length >= 2 &&
    !game.combat &&
    !game.outcome &&
    active?.controller === 'human' &&
    active.id !== turnAck;
  if (!show || !active) return null;

  const seat = game.players.findIndex((p) => p.id === active.id) + 1;
  // I9 : identité du siège — couleur du joueur (voile + pastille) et blason de
  // faction (motif non chromatique = second canal a11y). La faction du siège est
  // portée par son héros, à défaut par sa ville.
  const color = playerColor(game.players, active.id);
  const colorCss = `#${color.toString(16).padStart(6, '0')}`;
  const factionId =
    game.heroes.find((h) => h.playerId === active.id)?.factionId ??
    game.towns.find((tn) => tn.ownerPlayerId === active.id)?.factionId;

  return (
    // Backdrop OPAQUE (B34) : le plateau du joueur suivant ne doit pas transparaître.
    // La teinte est posée SUR l'encre opaque (color-mix), jamais une transparence.
    <div class="modal-backdrop handoff-backdrop" style={{ '--seat-color': colorCss }}>
      <div
        class="modal outcome-overlay handoff-tinted"
        role="dialog"
        aria-modal="true"
        aria-label={t('handoff.title')}
        data-testid="handoff-overlay"
      >
        <div class="handoff-seat-crest">
          {factionId && <FactionBadge factionId={factionId} />}
          <span class="handoff-seat-swatch" style={{ background: colorCss }} aria-hidden="true" />
        </div>
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
