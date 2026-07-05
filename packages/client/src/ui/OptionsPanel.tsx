import { useState } from 'preact/hooks';
import { appStore, useApp } from '../app/store';
import { t, setLocale } from '../app/i18n';
import { exportSave, importSave } from '../app/save';
import { COMBAT_SPEEDS } from '../app/ui-constants';
import './options.css';

const FONT_SCALE_PERCENT: Record<1 | 2 | 3, string> = { 1: '100%', 2: '112.5%', 3: '125%' };
const FONT_SCALES = [1, 2, 3] as const;

/**
 * Modale Options (doc 08 §3, ≤ 2 niveaux) : langue FR/EN, taille de texte
 * (3 crans, doc 08 §4), vitesse de combat par défaut. En jeu (écran
 * 'adventure'), ajoute export/import `.heroes` — sauvegarde/chargement
 * manuels restent dans la barre principale (`shell.tsx`), pas dupliqués ici.
 * Fermeture par bouton ou touche Échap (gérée par le handler global de
 * `shell.tsx`).
 */
export function OptionsPanel({ onClose }: { onClose: () => void }) {
  useApp((s) => s.locale); // réactivité i18n
  const locale = useApp((s) => s.locale);
  const fontScale = useApp((s) => s.fontScale);
  const combatSpeed = useApp((s) => s.combatSpeed);
  const screen = useApp((s) => s.screen);
  const [message, setMessage] = useState<string | null>(null);

  const applyFontScale = (scale: 1 | 2 | 3): void => {
    appStore.setState({ fontScale: scale });
    document.documentElement.style.fontSize = FONT_SCALE_PERCENT[scale];
  };

  const doExport = (): void => {
    exportSave(appStore.getState().game)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'partie.heroes';
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => setMessage(t('options.exportError')));
  };

  const onImportFile = (e: Event): void => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;
    importSave(file)
      .then((ok) => setMessage(ok ? null : t('options.importError')))
      .catch(() => setMessage(t('options.importError')));
  };

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div
        class="modal options-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('options.title')}
        onClick={(e) => e.stopPropagation()}
      >
        <header class="modal-header">
          <h2>{t('options.title')}</h2>
          <button class="modal-close" data-testid="options-close" aria-label={t('options.close')} onClick={onClose}>
            ×
          </button>
        </header>

        <section class="options-section">
          <h3>{t('options.language')}</h3>
          <div class="segmented" role="group">
            <button
              class={locale === 'fr' ? 'active' : ''}
              data-testid="options-locale-fr"
              onClick={() => setLocale('fr')}
            >
              FR
            </button>
            <button
              class={locale === 'en' ? 'active' : ''}
              data-testid="options-locale-en"
              onClick={() => setLocale('en')}
            >
              EN
            </button>
          </div>
        </section>

        <section class="options-section">
          <h3>{t('options.fontScale')}</h3>
          <div class="segmented" role="group">
            {FONT_SCALES.map((scale) => (
              <button
                key={scale}
                class={fontScale === scale ? 'active' : ''}
                data-testid={`options-fontscale-${scale}`}
                onClick={() => applyFontScale(scale)}
              >
                {FONT_SCALE_PERCENT[scale]}
              </button>
            ))}
          </div>
        </section>

        <section class="options-section">
          <h3>{t('options.combatSpeed')}</h3>
          <div class="segmented" role="group">
            {COMBAT_SPEEDS.map((speed) => (
              <button
                key={speed}
                class={combatSpeed === speed ? 'active' : ''}
                onClick={() => appStore.setState({ combatSpeed: speed })}
              >
                ×{speed}
              </button>
            ))}
          </div>
        </section>

        {screen === 'adventure' && (
          <section class="options-section">
            <h3>{t('options.dataSection')}</h3>
            <div class="options-save-actions">
              <button data-testid="options-export" onClick={doExport}>
                {t('options.export')}
              </button>
              <label class="options-import-label">
                {t('options.import')}
                <input type="file" accept=".heroes" data-testid="options-import" onChange={onImportFile} />
              </label>
            </div>
            {message && (
              <p class="options-message" data-testid="options-message">
                {message}
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
