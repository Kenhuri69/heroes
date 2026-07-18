import { useEffect, useState } from 'preact/hooks';
import type { Scenario } from '@heroes/content';
import { hasAnySave, restoreLatestSave } from '../app/save';
import { t, resolveScenarioName } from '../app/i18n';
import { useApp } from '../app/store';
import { navigate, openModal } from '../app/router';
import { eventStatus } from '../app/timed-events';
import { isOnline } from '../app/net';
import { logoUrl, titleBackgroundUrl } from '../render/assets';
import { AssetImg } from './AssetImg';
import { OnlinePanel } from './OnlinePanel';
import './menu.css';

/**
 * Menu principal (doc 08 §2.5). Contrat d'intégration (mountUi(root) figé,
 * pas de callback passé au shell) :
 * - « Continuer » appelle `restoreLatestSave()` — en cas de succès, `save.ts`
 *   bascule lui-même le store sur l'écran 'adventure' (`GameLoaded` émis).
 * - « Nouvelle partie » ouvre la modale de configuration `NewGameScreen`
 *   (`openModal({kind:'newgame'})`) : c'est cet écran qui émet ensuite
 *   `heroes:start-newgame` avec la config, résolue et jouée par `main.ts`.
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
  const [showOnline, setShowOnline] = useState(false);

  // Événements temporaires (doc 13 §4.3, N4d) : statut selon l'horloge CLIENT.
  // Les scénarios sans `availability` restent dans la liste permanente ; un
  // événement « à venir » (avant `from`) est masqué, l'expiré passe en archive.
  const now = Date.now();
  const regularScenarios = scenarios.filter((s) => eventStatus(s, now) === null);
  const events = scenarios
    .map((s) => ({ s, status: eventStatus(s, now) }))
    .filter((e): e is { s: Scenario; status: 'active' | 'archived' } =>
      e.status === 'active' || e.status === 'archived',
    );

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
        <div class="menu-continue-slot">
          <button
            class="menu-button"
            data-testid="menu-continue"
            disabled={!canContinue}
            onClick={() => void restoreLatestSave()}
          >
            {t('menu.continue')}
          </button>
          {!canContinue && (
            <span class="menu-continue-hint" data-testid="menu-continue-hint">
              {t('menu.continueEmpty')}
            </span>
          )}
        </div>
        <button
          class="menu-button"
          data-testid="menu-new-game"
          onClick={() => openModal({ kind: 'newgame' })}
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
        {isOnline() && (
          <button class="menu-button" data-testid="menu-online" onClick={() => setShowOnline(true)}>
            {t('menu.online')}
          </button>
        )}
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
      {regularScenarios.length > 0 && (
        <nav class="menu-actions menu-scenarios" data-testid="menu-scenarios">
          <h2 class="menu-section-title">{t('menu.scenarios')}</h2>
          {regularScenarios.map((scenario) => (
            <button
              class="menu-button"
              key={scenario.id}
              data-testid={`menu-scenario-${scenario.id}`}
              onClick={() => openModal({ kind: 'briefing', scenarioId: scenario.id })}
            >
              {resolveScenarioName(scenario.name)}
            </button>
          ))}
        </nav>
      )}
      {events.length > 0 && (
        <nav class="menu-actions menu-events" data-testid="menu-events">
          <h2 class="menu-section-title">{t('menu.events')}</h2>
          {events.map(({ s, status }) => (
            <button
              class="menu-button"
              key={s.id}
              data-testid={`menu-scenario-${s.id}`}
              onClick={() => openModal({ kind: 'briefing', scenarioId: s.id })}
            >
              <span class={`menu-event-badge menu-event-${status}`} data-testid={`menu-event-badge-${s.id}`}>
                {t(`menu.event.${status}`)}
              </span>
              {resolveScenarioName(s.name)}
            </button>
          ))}
        </nav>
      )}
      {showOnline && <OnlinePanel onClose={() => setShowOnline(false)} />}
    </div>
  );
}
