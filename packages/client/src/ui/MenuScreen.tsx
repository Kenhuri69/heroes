import { useEffect, useState } from 'preact/hooks';
import { hasAnySave, restoreLatestSave } from '../app/save';
import { t, resolveScenarioName } from '../app/i18n';
import { useApp } from '../app/store';
import { navigate, openModal } from '../app/router';
import { logoUrl, titleBackgroundUrl } from '../render/assets';
import { AssetImg } from './AssetImg';
import './menu.css';

/**
 * Menu principal (doc 08 §2.5). Contrat d'intégration (mountUi(root) figé,
 * pas de callback passé au shell) :
 * - « Continuer » appelle `restoreLatestSave()` — en cas de succès, `save.ts`
 *   bascule lui-même le store sur l'écran 'adventure' (`GameLoaded` émis).
 * - « Nouvelle partie » émet un CustomEvent DOM `heroes:new-game` sur
 *   `window` : c'est `main.ts` (intégration) qui l'écoute pour construire et
 *   lancer une commande `StartGame`, ce composant ne connaît pas la config.
 * - Un scénario (plan phase-3.5, lot U) émet `heroes:start-scenario` avec
 *   `{ scenarioId }` en detail — même découplage, `main.ts` résout la carte
 *   (async) et construit la commande. La liste vient de `appStore.scenarios`
 *   (peuplé par `main.ts` au chargement) : ce composant ne connaît aucun id
 *   de scénario en dur.
 */
export function MenuScreen() {
  useApp((s) => s.locale); // réactivité i18n (t() lit le store hors hook)
  const scenarios = useApp((s) => s.scenarios);
  const campaigns = useApp((s) => s.campaigns);
  const campaignProgress = useApp((s) => s.campaignProgress);
  const [canContinue, setCanContinue] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void hasAnySave().then((found) => {
      if (!cancelled) setCanContinue(found);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const bg = titleBackgroundUrl();

  return (
    <div class="menu-screen" style={bg ? { backgroundImage: `url(${bg})` } : undefined}>
      <div class="menu-logo" data-testid="menu-logo">
        <AssetImg
          src={logoUrl()}
          alt={t('menu.title')}
          fallback={<h1 class="menu-title-text">{t('menu.title')}</h1>}
        />
      </div>
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
        <button
          class="menu-button"
          data-testid="menu-skirmish"
          onClick={() => openModal({ kind: 'skirmish' })}
        >
          {t('menu.skirmish')}
        </button>
        <button
          class="menu-button"
          data-testid="menu-editor"
          onClick={() => navigate('editor')}
        >
          {t('menu.editor')}
        </button>
        <button class="menu-button" data-testid="menu-options" onClick={() => openModal({ kind: 'options' })}>
          {t('menu.options')}
        </button>
      </nav>
      {campaigns.length > 0 && (
        <nav class="menu-actions menu-campaigns" data-testid="menu-campaigns">
          <h2 class="menu-section-title">{t('menu.campaigns')}</h2>
          {campaigns.map((campaign) => {
            const done = campaignProgress[campaign.id] ?? 0;
            return (
              <div class="menu-campaign" key={campaign.id} data-testid={`menu-campaign-${campaign.id}`}>
                <h3 class="menu-campaign-name">{resolveScenarioName(campaign.nameKey)}</h3>
                {campaign.chapters.map((chapter, i) => {
                  const locked = i > done; // chapitre débloqué si i ≤ chapitres faits
                  return (
                    <button
                      class="menu-button menu-chapter"
                      key={chapter.id}
                      disabled={locked}
                      data-testid={`menu-chapter-${campaign.id}-${i}`}
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent('heroes:start-chapter', {
                            detail: { campaignId: campaign.id, chapterIndex: i },
                          }),
                        )
                      }
                    >
                      {`${i + 1}. ${resolveScenarioName(chapter.titleKey)}`}
                      {locked ? ' 🔒' : done > i ? ' ✓' : ''}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>
      )}
      {scenarios.length > 0 && (
        <nav class="menu-actions menu-scenarios" data-testid="menu-scenarios">
          <h2 class="menu-section-title">{t('menu.scenarios')}</h2>
          {scenarios.map((scenario) => (
            <button
              class="menu-button"
              key={scenario.id}
              data-testid={`menu-scenario-${scenario.id}`}
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent('heroes:start-scenario', { detail: { scenarioId: scenario.id } }),
                )
              }
            >
              {resolveScenarioName(scenario.name)}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
