import { useApp } from '../app/store';
import { t } from '../app/i18n';
import './newgame.css';

/**
 * Overlay bloquant de chargement (doc 09) : affiché pendant la génération de
 * carte de « Nouvelle partie », qui peut prendre du temps. Barre de progression
 * pilotée par `store.loading` ({label, progress}), avancée par étapes dans
 * `main.ts`. `null` = aucun chargement (pas de rendu).
 */
export function LoadingOverlay() {
  useApp((s) => s.locale); // réactivité i18n
  const loading = useApp((s) => s.loading);
  if (!loading) return null;
  const pct = Math.round(Math.min(1, Math.max(0, loading.progress)) * 100);
  return (
    <div class="loading-overlay" role="dialog" aria-modal="true" data-testid="loading-overlay">
      <div class="loading-panel">
        <h2 class="loading-title">{t('loading.title')}</h2>
        <p class="loading-label" data-testid="loading-label">
          {t(loading.label)}
        </p>
        <div
          class="loading-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <div class="loading-bar-fill" data-testid="loading-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span class="loading-pct" data-testid="loading-pct">
          {pct}%
        </span>
      </div>
    </div>
  );
}
