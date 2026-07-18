import { useApp } from '../app/store';
import { t } from '../app/i18n';
import './ShortcutsOverlay.css';

/**
 * Aide des raccourcis clavier (lot X7, plan `ux-enrichissement-2026-07`) — les
 * raccourcis desktop existent (M8) mais étaient indécouvrables. Overlay ouvert
 * par la touche `?` (ou depuis l'astuce d'Options). Confort **desktop
 * uniquement**, jamais requis : tout reste jouable à la souris/au doigt.
 * Fermeture par bouton, backdrop ou Échap (handler global de `shell.tsx`) —
 * modale simple dans la pile (doc 08 §3, pile ≤ 2).
 */
const ROWS: readonly { keys: string; label: string }[] = [
  { keys: 'E', label: 'shortcuts.endTurn' },
  { keys: 'H', label: 'shortcuts.hero' },
  { keys: 'N', label: 'shortcuts.nextHero' },
  { keys: 'T', label: 'shortcuts.town' },
  { keys: '?', label: 'shortcuts.help' },
  { keys: 'Espace', label: 'shortcuts.combatWait' },
  { keys: 'D', label: 'shortcuts.combatDefend' },
  { keys: 'Échap', label: 'shortcuts.escClose' },
];

export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  useApp((s) => s.locale); // réactivité i18n
  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div
        class="modal shortcuts-panel chrome-framed"
        role="dialog"
        aria-modal="true"
        aria-label={t('shortcuts.title')}
        data-testid="shortcuts-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header class="modal-header">
          <h2>{t('shortcuts.title')}</h2>
          <button
            class="modal-close"
            data-testid="shortcuts-close"
            aria-label={t('shortcuts.close')}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <p class="options-hint">{t('shortcuts.hint')}</p>
        <dl class="shortcuts-list">
          {ROWS.map((r) => (
            <div class="shortcuts-row" key={r.keys}>
              <dt>
                <kbd class="shortcuts-key">{r.keys}</kbd>
              </dt>
              <dd>{t(r.label)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
