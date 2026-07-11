import type { Scenario, VictoryCondition } from '@heroes/content';
import { useApp } from '../app/store';
import { t, resolveLoc, resolveScenarioName } from '../app/i18n';
import './briefing.css';

/**
 * Fiche de scénario (doc 08 §2.5, lot N-BRIEFING) — interposée entre le clic sur
 * un scénario/événement du menu et son démarrage. Purement informative :
 * objectifs (victoire/défaite), faction jouée et nombre d'adversaires, lus du
 * `Scenario` déjà en store (aucun id de faction/scénario en dur). Client pur —
 * le démarrage passe toujours par `heroes:start-scenario` (contrat `main.ts`
 * inchangé). Modale simple dans la pile (doc 08 §3) : Commencer / Retour.
 */

/** Nom localisé d'une faction (`@loc:faction.<id>.name`, vit dans le paquet). */
function factionName(id: string): string {
  return resolveLoc(`@loc:faction.${id}.name`);
}

/** Libellé générique d'une condition de victoire/défaite (jamais de nom en dur). */
function conditionLabel(c: VictoryCondition): string {
  switch (c.type) {
    case 'surviveDays':
      return t('briefing.objective.surviveDays', { days: c.days });
    default:
      return t(`briefing.objective.${c.type}`);
  }
}

export function BriefingScreen({
  scenarioId,
  onClose,
}: {
  scenarioId: string;
  onClose: () => void;
}) {
  useApp((s) => s.locale); // réactivité i18n
  const scenario = useApp((s) => s.scenarios.find((sc) => sc.id === scenarioId)) as
    | Scenario
    | undefined;

  // Scénario introuvable (retiré du store entre-temps) : rien à briefer.
  if (!scenario) return null;

  const human = scenario.players.find((p) => p.controller === 'human');
  const aiCount = scenario.players.filter((p) => p.controller === 'ai').length;
  const objectives = human ? scenario.objectives[human.id] : undefined;

  function start() {
    onClose();
    window.dispatchEvent(
      new CustomEvent('heroes:start-scenario', { detail: { scenarioId } }),
    );
  }

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div
        class="modal briefing-panel chrome-framed"
        role="dialog"
        aria-modal="true"
        aria-label={t('briefing.title')}
        data-testid="briefing-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header class="modal-header">
          <h2>{resolveScenarioName(scenario.name)}</h2>
          <button
            class="modal-close"
            data-testid="briefing-close"
            aria-label={t('briefing.close')}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <dl class="briefing-facts">
          {human && (
            <div class="briefing-row">
              <dt>{t('briefing.faction')}</dt>
              <dd data-testid="briefing-faction">{factionName(human.factionId)}</dd>
            </div>
          )}
          {objectives && (
            <>
              <div class="briefing-row">
                <dt>{t('briefing.victory')}</dt>
                <dd data-testid="briefing-victory">{conditionLabel(objectives.victory)}</dd>
              </div>
              <div class="briefing-row">
                <dt>{t('briefing.defeat')}</dt>
                <dd data-testid="briefing-defeat">{conditionLabel(objectives.defeat)}</dd>
              </div>
            </>
          )}
          <div class="briefing-row">
            <dt>{t('briefing.opponents')}</dt>
            <dd data-testid="briefing-opponents">{aiCount}</dd>
          </div>
        </dl>

        <div class="briefing-actions">
          <button class="menu-button" data-testid="briefing-cancel" onClick={onClose}>
            {t('briefing.cancel')}
          </button>
          <button class="menu-button briefing-start" data-testid="briefing-start" onClick={start}>
            {t('briefing.start')}
          </button>
        </div>
      </div>
    </div>
  );
}
