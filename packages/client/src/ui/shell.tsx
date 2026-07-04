import { render } from 'preact';
import { RESOURCE_IDS, weekOf } from '@heroes/engine';
import { useApp } from '../app/store';
import { dispatch } from '../app/dispatch';
import { PLAYER_ID } from '../app/game';
import { saveGame, restoreSavedGame } from '../app/save';
import { appStore } from '../app/store';
import { RESOURCE_COLORS } from '../render/mapObjects';
import { CombatUi } from './combat';
import './styles.css';

export function mountUi(root: HTMLElement): void {
  render(<Shell />, root);
}

function Shell() {
  const started = useApp((s) => s.game.started);
  const inCombat = useApp((s) => s.game.combat !== null);
  if (!started) return null;
  if (inCombat) return <CombatUi />;
  return (
    <>
      <ResourceBar />
      <TurnBar />
    </>
  );
}

/** Bandeau haut compact, tap = détail plus tard (doc 08 §2.1 mobile). */
function ResourceBar() {
  const resources = useApp((s) => s.game.players.find((p) => p.id === PLAYER_ID)?.resources);
  if (!resources) return null;
  return (
    <header class="resource-bar">
      {RESOURCE_IDS.map((id) => (
        <span class="resource" key={id} data-resource={id}>
          <i style={{ background: `#${(RESOURCE_COLORS[id] ?? 0xffffff).toString(16).padStart(6, '0')}` }} />
          <span data-testid={`resource-${id}`}>{resources[id]}</span>
        </span>
      ))}
    </header>
  );
}

/** Fourchette de force du gardien visé (doc 02 §2.2) — libellés FR (i18n : 2.5). */
const BAND_LABELS: Record<string, string> = {
  few: 'Quelques défenseurs',
  several: 'Plusieurs défenseurs',
  pack: 'Un groupe',
  lots: 'Une troupe',
  horde: 'Une horde',
  throng: 'Une foule',
  legion: 'Une légion',
};

function guardianBand(count: number, bands: { max: number | null; key: string }[]): string {
  const band = bands.find((b) => b.max === null || count <= b.max);
  return (band && BAND_LABELS[band.key]) ?? '';
}

/** Jour/semaine, points de mouvement, sauvegarde et gros bouton fin de tour (doc 08 §2.1). */
function TurnBar() {
  const day = useApp((s) => s.game.calendar.day);
  const hero = useApp((s) => s.game.heroes.find((h) => h.playerId === PLAYER_ID));
  const hint = useApp((s) => s.guardianHint);
  const bands = useApp((s) => s.strengthBands);
  return (
    <>
      <div class="status-bar">
        <span data-testid="calendar">
          Jour {day} · Semaine {weekOf(day)}
        </span>
        {hero && <span data-testid="movement-points">PM {hero.movementPoints}</span>}
        {hint && (
          <span class="guardian-hint" data-testid="guardian-hint">
            ⚔ {guardianBand(hint.count, bands)}
          </span>
        )}
      </div>
      <div class="actions">
        <button data-testid="save" onClick={() => void saveGame(appStore.getState().game, 'manual')}>
          Sauvegarder
        </button>
        <button data-testid="load" onClick={() => void restoreSavedGame('manual')}>
          Charger
        </button>
        <button
          class="end-turn"
          data-testid="end-turn"
          onClick={() => void dispatch({ type: 'EndTurn', playerId: PLAYER_ID })}
        >
          Fin de tour
        </button>
      </div>
    </>
  );
}
