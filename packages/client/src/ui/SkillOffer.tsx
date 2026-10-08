import { dispatch } from '../app/dispatch';
import { useApp } from '../app/store';
import { t, resolveSkillName, commandErrorMessage, describeSkillEffect } from '../app/i18n';
import { pushToast } from './toasts';
import './SkillChoice.css';

/**
 * Modale de la cabane de la sorcière (lot R3) : montée quand
 * `game.pendingSkillOffer` appartient au joueur humain, non annulable — le moteur
 * bloque `MoveHero`/`EndTurn` en attendant. « Apprendre » consomme la visite,
 * « Refuser » la laisse disponible (le héros pourra revenir). Même famille de
 * modale forcée que `NeutralOffer`.
 */
export function SkillOffer({ pending }: { pending: { heroId: string; skillId: string } }) {
  const skillCatalog = useApp((s) => s.game.skillCatalog);
  const effect = describeSkillEffect(skillCatalog[pending.skillId]?.ranks[0]);
  const answer = (accept: boolean): void => {
    dispatch({ type: 'ResolveSkillOffer', heroId: pending.heroId, accept }).catch((err: unknown) => {
      pushToast(commandErrorMessage(err), 'error');
    });
  };

  return (
    <div class="modal-backdrop">
      <div class="modal skill-choice" role="dialog" aria-modal="true" aria-label={t('skillOffer.title')} data-testid="skill-offer">
        <header class="modal-header">
          <h2>{t('skillOffer.title')}</h2>
        </header>
        <p class="skill-choice-subtitle">{t('skillOffer.subtitle', { skill: resolveSkillName(pending.skillId) })}</p>
        {effect && <p class="skill-choice-effect">{effect}</p>}
        <ul class="skill-choice-list">
          <li>
            <button class="skill-choice-option" data-testid="skill-offer-learn" onClick={() => answer(true)}>
              <span class="skill-choice-name">{t('skillOffer.learn')}</span>
            </button>
          </li>
          <li>
            <button class="skill-choice-option" data-testid="skill-offer-refuse" onClick={() => answer(false)}>
              <span class="skill-choice-name">{t('skillOffer.refuse')}</span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
