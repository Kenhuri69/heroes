import type { HeroState } from '@heroes/engine';
import { dispatch } from '../app/dispatch';
import { t, commandErrorMessage } from '../app/i18n';
import { pushToast } from './toasts';
import './SkillChoice.css';

type Attribute = 'attack' | 'defense' | 'power' | 'knowledge';

/**
 * Modale de choix d'attribut à la montée de niveau (doc 02 §1.2, H-LEVELCHOICE)
 * — montée quand `hero.pendingAttributeChoices.length > 0`, non annulable (un
 * choix doit être fait, comme en HoMM). Présente la PREMIÈRE paire de la file ;
 * les montées suivantes s'enchaînent. Réutilise le style de `SkillChoice`.
 */
export function AttributeChoice({ hero }: { hero: HeroState }) {
  const pair = hero.pendingAttributeChoices[0];
  if (!pair) return null;

  const choose = (attribute: Attribute): void => {
    dispatch({ type: 'ChooseAttribute', heroId: hero.id, attribute }).catch((err: unknown) => {
      pushToast(commandErrorMessage(err), 'error');
    });
  };

  return (
    <div class="modal-backdrop">
      <div
        class="modal skill-choice attribute-choice"
        role="dialog"
        aria-modal="true"
        aria-label={t('attributeChoice.title')}
        data-testid="attribute-choice"
      >
        <header class="modal-header">
          <h2>{t('attributeChoice.title')}</h2>
        </header>
        <p class="skill-choice-subtitle">{t('attributeChoice.subtitle')}</p>
        <ul class="skill-choice-list">
          {pair.map((attribute) => (
            <li key={attribute}>
              <button
                class="skill-choice-option"
                data-testid={`attribute-choice-${attribute}`}
                onClick={() => choose(attribute)}
              >
                <span class="skill-choice-name">{t(`attribute.${attribute}`)}</span>
                <span class="skill-choice-rank">+1</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
