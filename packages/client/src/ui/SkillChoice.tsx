import type { HeroState } from '@heroes/engine';
import { dispatch } from '../app/dispatch';
import { t, resolveSkillName, commandErrorMessage } from '../app/i18n';
import { pushToast } from './toasts';
import './SkillChoice.css';

/**
 * Modale de choix de compétence à la montée de niveau (doc 02 §1.2, doc 08
 * §2.3) : montée quand `hero.pendingSkillChoices.length > 0`, non annulable
 * (pas de bouton fermer/clic-extérieur — un choix doit être fait, comme en
 * HoMM). Si le moteur rejette le choix, la modale reste ouverte et l'erreur
 * est surfacée (remédiation CL3) — plus d'échec avalé en silence.
 */
export function SkillChoice({ hero }: { hero: HeroState }) {
  const choose = (skillId: string): void => {
    dispatch({ type: 'ChooseSkill', heroId: hero.id, skillId }).catch((err: unknown) => {
      pushToast(commandErrorMessage(err));
    });
  };

  return (
    <div class="modal-backdrop">
      <div
        class="modal skill-choice"
        role="dialog"
        aria-modal="true"
        aria-label={t('skillChoice.title')}
        data-testid="skill-choice"
      >
        <header class="modal-header">
          <h2>{t('skillChoice.title')}</h2>
        </header>
        <p class="skill-choice-subtitle">{t('skillChoice.subtitle')}</p>
        <ul class="skill-choice-list">
          {hero.pendingSkillChoices.map((skillId) => {
            const targetRank = Math.min((hero.skills[skillId] ?? 0) + 1, 3);
            return (
              <li key={skillId}>
                <button
                  class="skill-choice-option"
                  data-testid={`skill-choice-${skillId}`}
                  onClick={() => choose(skillId)}
                >
                  <span class="skill-choice-name">{resolveSkillName(skillId)}</span>
                  <span class="skill-choice-rank">{t(`skill.rank.${targetRank}`)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
