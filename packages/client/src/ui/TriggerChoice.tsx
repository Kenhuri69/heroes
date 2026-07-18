import type { GameState } from '@heroes/engine';
import { dispatch } from '../app/dispatch';
import { t, commandErrorMessage } from '../app/i18n';
import { pushToast } from './toasts';
import './SkillChoice.css';

/**
 * Modale de message à choix d'un trigger de carte (doc 18 A5) : montée quand
 * `game.pendingTriggerChoice` appartient au joueur humain, non annulable — une
 * option doit être choisie (le moteur bloque `MoveHero`/`EndTurn` en attendant).
 * Le texte et les libellés viennent du CONTENU (`textKey`/`labelKey`, résolus
 * i18n), jamais en dur. Réutilise le style `SkillChoice` (modale forcée). Si le
 * moteur rejette, l'erreur est surfacée (remédiation CL3).
 */
export function TriggerChoice({
  pending,
}: {
  pending: NonNullable<GameState['pendingTriggerChoice']>;
}) {
  const choose = (optionIndex: number): void => {
    dispatch({ type: 'ResolveTriggerChoice', heroId: pending.heroId, optionIndex }).catch(
      (err: unknown) => {
        pushToast(commandErrorMessage(err), 'error');
      },
    );
  };

  return (
    <div class="modal-backdrop">
      <div
        class="modal skill-choice"
        role="dialog"
        aria-modal="true"
        aria-label={t('triggerChoice.title')}
        data-testid="trigger-choice"
      >
        <header class="modal-header">
          <h2>{t('triggerChoice.title')}</h2>
        </header>
        <p class="skill-choice-subtitle">{t(pending.textKey)}</p>
        <ul class="skill-choice-list">
          {pending.options.map((option, i) => (
            <li key={i}>
              <button
                class="skill-choice-option"
                data-testid={`trigger-choice-${i}`}
                onClick={() => choose(i)}
              >
                <span class="skill-choice-name">{t(option.labelKey)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
