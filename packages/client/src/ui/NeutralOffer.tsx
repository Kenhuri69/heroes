import { RESOURCE_IDS, neutralChoiceAllowed, type NeutralOffer as Offer, type NeutralOfferChoice } from '@heroes/engine';
import { dispatch } from '../app/dispatch';
import { t, commandErrorMessage, resolveUnitName, resolveFactionResourceName } from '../app/i18n';
import { useApp } from '../app/store';
import { pushToast } from './toasts';
import './SkillChoice.css';

const CORE_RESOURCE_IDS: ReadonlySet<string> = new Set<string>(RESOURCE_IDS);

function resourceLabel(id: string): string {
  return CORE_RESOURCE_IDS.has(id) ? t(`resource.${id}`) : resolveFactionResourceName(id);
}

/**
 * Modale de proposition d'un gardien neutre dominé (LE5 A4) : montée quand
 * `game.pendingNeutralOffer` appartient au joueur humain, non annulable — le
 * moteur bloque `MoveHero`/`EndTurn` en attendant. « Combattre » est toujours
 * proposé ; « Laisser partir » si le gardien fuit ; « Rallier » si Diplomatie le
 * permet (grisé quand l'or manque). Même famille de modale forcée que
 * `TriggerChoice`.
 */
export function NeutralOffer({ pending }: { pending: Offer }) {
  const game = useApp((s) => s.game);
  const guardian = game.map?.objects.find((o) => o.id === pending.guardianObjectId);
  const creature =
    guardian?.type === 'guardian'
      ? t('neutralOffer.creature', { count: guardian.count, unit: resolveUnitName(guardian.unitId) })
      : '';
  const cost = Object.entries(pending.joinCost ?? {})
    .map(([id, amount]) => `${amount} ${resourceLabel(id)}`)
    .join(', ');
  const choose = (choice: NeutralOfferChoice): void => {
    dispatch({ type: 'ResolveNeutralOffer', heroId: pending.heroId, choice }).catch((err: unknown) => {
      pushToast(commandErrorMessage(err), 'error');
    });
  };

  return (
    <div class="modal-backdrop">
      <div
        class="modal skill-choice"
        role="dialog"
        aria-modal="true"
        aria-label={t('neutralOffer.title')}
        data-testid="neutral-offer"
      >
        <header class="modal-header">
          <h2>{t('neutralOffer.title')}</h2>
        </header>
        <p class="skill-choice-subtitle">
          {t(pending.release ? 'neutralOffer.subtitleFlee' : 'neutralOffer.subtitleJoin', { creature })}
        </p>
        <ul class="skill-choice-list">
          <li>
            <button class="skill-choice-option" data-testid="neutral-offer-fight" onClick={() => choose('fight')}>
              <span class="skill-choice-name">{t('neutralOffer.fight')}</span>
            </button>
          </li>
          {pending.release && (
            <li>
              <button class="skill-choice-option" data-testid="neutral-offer-release" onClick={() => choose('release')}>
                <span class="skill-choice-name">{t('neutralOffer.release')}</span>
              </button>
            </li>
          )}
          {pending.joinCost && (
            <li>
              <button
                class="skill-choice-option"
                data-testid="neutral-offer-join"
                disabled={!neutralChoiceAllowed(game, pending, 'join')}
                onClick={() => choose('join')}
              >
                <span class="skill-choice-name">{t('neutralOffer.join', { cost })}</span>
              </button>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
