import { useSyncExternalStore } from 'preact/compat';
import { useApp, appStore } from '../app/store';
import { dispatch } from '../app/dispatch';
import { combatPreview, type DamagePreview } from '../scenes/combat/preview';
import './combat.css';

const SPEEDS = [1, 2, 4] as const;

/**
 * UI DOM de l'écran de combat (doc 08 §2.4) : bandeau haut (piles des deux
 * camps + round), barre d'actions bas, panneau de prévisualisation de
 * dégâts OBLIGATOIRE avant confirmation. Le canvas (`CombatScene`) ne rend
 * aucun de ces chiffres — uniquement cette couche DOM.
 */
export function CombatUi() {
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
          Round {combat.round}
        </div>
        <div class="combat-side combat-side-defender">
          {defenders.map((s) => (
            <StackChip key={s.id} unitId={s.unitId} count={s.count} active={s.id === combat.activeStackId} />
          ))}
        </div>
      </header>

      <div class="damage-preview" data-testid="damage-preview">
        {preview ? formatPreview(preview) : 'Sélectionnez une cible pour prévisualiser les dégâts.'}
      </div>

      <footer class="combat-actions">
        <button data-testid="combat-wait" disabled={!isPlayerTurn} onClick={() => act('wait')}>
          Attendre
        </button>
        <button data-testid="combat-defend" disabled={!isPlayerTurn} onClick={() => act('defend')}>
          Défendre
        </button>
        <button data-testid="combat-auto" disabled={!isPlayerTurn} onClick={auto}>
          Auto ▶▶
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

/** Vignette d'une pile (bandeau haut) : effectif + unitId en libellé court, pas d'icône de faction en 2.4. */
function StackChip({ unitId, count, active }: { unitId: string; count: number; active: boolean }) {
  return (
    <div class={`stack-chip${active ? ' stack-chip-active' : ''}`}>
      <span class="stack-chip-count">{count}</span>
      <span class="stack-chip-unit">{unitId}</span>
    </div>
  );
}

function formatPreview(p: DamagePreview): string {
  const dmg = `${p.damageMin}–${p.damageMax} dégâts`;
  const kills =
    p.killsMin === p.killsMax ? `${p.killsMin}` : `${p.killsMin}–${p.killsMax}`;
  const retal = p.retaliation
    ? `riposte estimée : ${p.retaliation.damageMin}–${p.retaliation.damageMax}`
    : 'pas de riposte';
  return `${dmg}, ~${kills} morts · ${retal}`;
}
