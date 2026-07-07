import type { GameState } from '@heroes/engine';
import { dispatch } from '../app/dispatch';
import { t, commandErrorMessage } from '../app/i18n';
import { pushToast } from './toasts';
import './SkillChoice.css';

/**
 * Modale de choix du trésor (doc 02 §2.2, doc 08 §2.3) : montée quand
 * `game.pendingTreasure` appartient au joueur humain, non annulable — un choix
 * or OU XP doit être fait (fidélité HoMM), le moteur bloque `MoveHero`/`EndTurn`
 * en attendant. Réutilise le style de `SkillChoice` (même famille de modale
 * forcée). Si le moteur rejette, l'erreur est surfacée (remédiation CL3).
 */
export function TreasureChoice({ pending }: { pending: NonNullable<GameState['pendingTreasure']> }) {
  const choose = (choice: 'gold' | 'xp'): void => {
    dispatch({ type: 'ResolveTreasure', heroId: pending.heroId, choice }).catch((err: unknown) => {
      pushToast(commandErrorMessage(err));
    });
  };

  return (
    <div class="modal-backdrop">
      <div
        class="modal skill-choice"
        role="dialog"
        aria-modal="true"
        aria-label={t('treasure.title')}
        data-testid="treasure-choice"
      >
        <header class="modal-header">
          <h2>{t('treasure.title')}</h2>
        </header>
        <p class="skill-choice-subtitle">{t('treasure.subtitle')}</p>
        <ul class="skill-choice-list">
          <li>
            <button
              class="skill-choice-option"
              data-testid="treasure-choice-gold"
              onClick={() => choose('gold')}
            >
              <span class="skill-choice-name">{t('treasure.takeGold', { gold: pending.gold })}</span>
            </button>
          </li>
          <li>
            <button
              class="skill-choice-option"
              data-testid="treasure-choice-xp"
              onClick={() => choose('xp')}
            >
              <span class="skill-choice-name">{t('treasure.takeXp', { xp: pending.xp })}</span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
