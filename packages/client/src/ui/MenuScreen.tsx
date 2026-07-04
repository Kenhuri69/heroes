import { useEffect, useState } from 'preact/hooks';
import { hasAnySave, restoreLatestSave } from '../app/save';
import { t } from '../app/i18n';
import { useApp } from '../app/store';
import { OptionsPanel } from './OptionsPanel';
import './menu.css';

/**
 * Menu principal (doc 08 §2.5). Contrat d'intégration (mountUi(root) figé,
 * pas de callback passé au shell) :
 * - « Continuer » appelle `restoreLatestSave()` — en cas de succès, `save.ts`
 *   bascule lui-même le store sur l'écran 'game' (`GameLoaded` émis).
 * - « Nouvelle partie » émet un CustomEvent DOM `heroes:new-game` sur
 *   `window` : c'est `main.ts` (intégration) qui l'écoute pour construire et
 *   lancer une commande `StartGame`, ce composant ne connaît pas la config.
 */
export function MenuScreen() {
  useApp((s) => s.locale); // réactivité i18n (t() lit le store hors hook)
  const [canContinue, setCanContinue] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void hasAnySave().then((found) => {
      if (!cancelled) setCanContinue(found);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div class="menu-screen">
      <h1 class="menu-title">{t('menu.title')}</h1>
      <nav class="menu-actions">
        <button
          class="menu-button"
          data-testid="menu-continue"
          disabled={!canContinue}
          onClick={() => void restoreLatestSave()}
        >
          {t('menu.continue')}
        </button>
        <button
          class="menu-button"
          data-testid="menu-new-game"
          onClick={() => window.dispatchEvent(new CustomEvent('heroes:new-game'))}
        >
          {t('menu.newGame')}
        </button>
        <button class="menu-button" data-testid="menu-options" onClick={() => setOptionsOpen(true)}>
          {t('menu.options')}
        </button>
      </nav>
      {optionsOpen && <OptionsPanel onClose={() => setOptionsOpen(false)} />}
    </div>
  );
}
