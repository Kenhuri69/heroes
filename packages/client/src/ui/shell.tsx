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

/** Jour/semaine, points de mouvement, sauvegarde et gros bouton fin de tour (doc 08 §2.1). */
function TurnBar() {
  const day = useApp((s) => s.game.calendar.day);
  const hero = useApp((s) => s.game.heroes.find((h) => h.playerId === PLAYER_ID));
  return (
    <>
      <div class="status-bar">
        <span data-testid="calendar">
          Jour {day} · Semaine {weekOf(day)}
        </span>
        {hero && <span data-testid="movement-points">PM {hero.movementPoints}</span>}
      </div>
      <div class="actions">
        <button data-testid="save" onClick={() => void saveGame(appStore.getState().game)}>
          Sauvegarder
        </button>
        <button data-testid="load" onClick={() => void restoreSavedGame()}>
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
