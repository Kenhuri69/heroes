import { useSyncExternalStore } from 'preact/compat';
import { useState } from 'preact/hooks';
import { useApp, appStore } from '../app/store';
import { dispatch } from '../app/dispatch';
import { t, resolveUnitName } from '../app/i18n';
import { combatPreview, type DamagePreview } from '../scenes/combat/preview';
import './combat.css';

const SPEEDS = [1, 2, 4] as const;

/** Rappel dismissible mémorisé pour la session (doc 08 §2.4 : pas d'API Screen Orientation). */
let landscapeHintDismissed = false;

/**
 * UI DOM de l'écran de combat (doc 08 §2.4) : bandeau haut (piles des deux
 * camps + round), barre d'actions bas, panneau de prévisualisation de
 * dégâts OBLIGATOIRE avant confirmation. Le canvas (`CombatScene`) ne rend
 * aucun de ces chiffres — uniquement cette couche DOM.
 */
export function CombatUi() {
  useApp((s) => s.locale); // réactivité i18n
  const combat = useApp((s) => s.game.combat);
  const combatSpeed = useApp((s) => s.combatSpeed);
  const preview = useSyncExternalStore(combatPreview.subscribe, combatPreview.get);
  if (!combat) return null;

  const active = combat.stacks.find((s) => s.id === combat.activeStackId);
  const isPlayerTurn = !combat.finished && active?.side === combat.playerSide;

  const attackers = combat.stacks.filter((s) => s.side === 'attacker').sort((a, b) => a.slot - b.slot);
  const defenders = combat.stacks.filter((s) => s.side === 'defender').sort((a, b) => a.slot - b.slot);

  const act = (action: 'wait' | 'defend'): void => {
    dispatch({ type: 'CombatAction', action: { type: action } }).catch(() => {
      /* moteur non implémenté (lot A en cours) : pas de crash côté UI */
    });
  };
  const auto = (): void => {
    dispatch({ type: 'AutoCombat' }).catch(() => {
      /* moteur non implémenté (lot A en cours) : pas de crash côté UI */
    });
  };

  return (
    <div class="combat-ui">
      <header class="combat-armies">
        <div class="combat-side combat-side-attacker">
          {attackers.map((s) => (
            <StackChip key={s.id} unitId={s.unitId} count={s.count} active={s.id === combat.activeStackId} />
          ))}
        </div>
        <div class="combat-round" data-testid="combat-round">
          {t('combat.round', { round: combat.round })}
        </div>
        <div class="combat-side combat-side-defender">
          {defenders.map((s) => (
            <StackChip key={s.id} unitId={s.unitId} count={s.count} active={s.id === combat.activeStackId} />
          ))}
        </div>
      </header>

      <div class="damage-preview" data-testid="damage-preview">
        {preview ? formatPreview(preview) : t('combat.damagePreviewPlaceholder')}
      </div>

      <LandscapeHint />

      <footer class="combat-actions">
        <button data-testid="combat-wait" disabled={!isPlayerTurn} onClick={() => act('wait')}>
          {t('combat.wait')}
        </button>
        <button data-testid="combat-defend" disabled={!isPlayerTurn} onClick={() => act('defend')}>
          {t('combat.defend')}
        </button>
        <button data-testid="combat-auto" disabled={!isPlayerTurn} onClick={auto}>
          {t('combat.auto')}
        </button>
        <div class="combat-speeds" data-testid="combat-speed">
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              class={combatSpeed === speed ? 'active' : ''}
              onClick={() => appStore.setState({ combatSpeed: speed })}
            >
              ×{speed}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}

/** Vignette d'une pile (bandeau haut) : effectif + nom localisé, pas d'icône de faction en 2.4. */
function StackChip({ unitId, count, active }: { unitId: string; count: number; active: boolean }) {
  return (
    <div class={`stack-chip${active ? ' stack-chip-active' : ''}`}>
      <span class="stack-chip-count">{count}</span>
      <span class="stack-chip-unit">{resolveUnitName(unitId)}</span>
    </div>
  );
}

/** Overlay « paysage recommandé » (doc 08 §2.4) — CSS le montre en portrait, dismissible pour la session. */
function LandscapeHint() {
  const [dismissed, setDismissed] = useState(landscapeHintDismissed);
  if (dismissed) return null;
  return (
    <div class="landscape-hint" data-testid="landscape-hint">
      <p>{t('combat.landscapeHint')}</p>
      <button
        onClick={() => {
          landscapeHintDismissed = true;
          setDismissed(true);
        }}
      >
        {t('combat.landscapeHintDismiss')}
      </button>
    </div>
  );
}

function formatPreview(p: DamagePreview): string {
  const damage = t('combat.damage', { min: p.damageMin, max: p.damageMax });
  const kills = p.killsMin === p.killsMax ? `${p.killsMin}` : `${p.killsMin}–${p.killsMax}`;
  const retal = p.retaliation
    ? t('combat.retaliationEstimate', { min: p.retaliation.damageMin, max: p.retaliation.damageMax })
    : t('combat.noRetaliation');
  return t('combat.previewSummary', { damage, kills, retal });
}
