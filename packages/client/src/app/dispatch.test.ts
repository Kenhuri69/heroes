import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Command, GameState } from '@heroes/engine';
import { appStore } from './store';
import { eventBus } from './events';

/**
 * Lot R0 (B1) : un tour IA qui lève ne fige plus la partie en silence.
 *
 * Le moteur est doublé (`validate` accepte tout, `apply` est scripté) : on n'y
 * teste aucune règle, seulement le pilotage client de la boucle IA — c'est bien
 * le sujet (`packages/client`), le moteur a ses propres tests.
 */
const applyMock = vi.fn();
vi.mock('@heroes/engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@heroes/engine')>();
  return {
    ...actual,
    validate: () => null,
    apply: (state: GameState, cmd: Command) => applyMock(state, cmd) as unknown,
  };
});

const { dispatch, installAiResume } = await import('./dispatch');

/** `requestAnimationFrame` n'existe pas hors navigateur — `yieldToPaint` en a besoin. */
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
  setTimeout(() => cb(0), 0);
  return 0;
}) as typeof globalThis.requestAnimationFrame;

function stateWith(currentPlayer: number): GameState {
  return {
    players: [
      { id: 'p1', controller: 'human' },
      { id: 'p2', controller: 'ai' },
    ],
    currentPlayer,
    heroes: [],
    towns: [],
    combat: null,
    outcome: null,
    calendar: { day: 3, week: 1, month: 1 },
  } as unknown as GameState;
}

beforeEach(() => {
  applyMock.mockReset();
  appStore.setState({
    toasts: [],
    game: stateWith(0),
    aiTurn: null,
    aiFailure: false,
    // reduceMotion ⇒ pacing 0 : la boucle ne s'endort pas 350 ms par tour.
    reduceMotionOption: true,
    onlineMatch: null,
  });
});

describe('runAiLoop — échec d’un tour IA isolé (B1)', () => {
  it('rend la main au joueur (rollback), prévient, et ne rejette pas le dispatch', async () => {
    const humanState = appStore.getState().game;
    applyMock.mockImplementation((state: GameState, cmd: Command) => {
      if (cmd.type === 'AiTurn') throw new Error('bug du tour IA');
      return { state: stateWith(1), events: [] }; // EndTurn ⇒ la main passe à l'IA
    });

    await expect(dispatch({ type: 'EndTurn', playerId: 'p1' })).resolves.toBeTruthy();

    // (a) le joueur humain peut encore agir : la main est revenue à son siège…
    const after = appStore.getState();
    expect(after.game.currentPlayer).toBe(0);
    expect(after.game.players[after.game.currentPlayer]?.controller).toBe('human');
    // …sur l'état d'avant le dispatch (tour non consommé, aucun état fabriqué).
    expect(after.game).toBe(humanState);
    // (b) le joueur est prévenu, (c) l'indicateur de tour IA est retombé.
    expect(after.toasts).toHaveLength(1);
    expect(after.toasts[0]?.kind).toBe('error');
    expect(after.aiTurn).toBeNull();
    expect(after.aiFailure).toBe(false); // rollback suffisant : pas d'overlay bloquant
  });

  it('sans état de repli humain (reprise après chargement) ⇒ état bloqué SIGNALÉ', async () => {
    installAiResume();
    appStore.setState({ game: stateWith(1) }); // sauvegarde reprise en plein relais IA
    applyMock.mockImplementation(() => {
      throw new Error('bug du tour IA');
    });

    eventBus.emit([{ type: 'GameLoaded' }]);

    await vi.waitFor(() => expect(appStore.getState().aiFailure).toBe(true));
    const after = appStore.getState();
    expect(after.toasts.some((toast) => toast.kind === 'error')).toBe(true);
    expect(after.aiTurn).toBeNull();
  });
});
