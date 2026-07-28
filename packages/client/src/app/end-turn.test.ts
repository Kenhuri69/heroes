import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '@heroes/engine';
import { appStore } from './store';

/**
 * Lot R0 (B3) : « Fin de tour » ne peut plus être un no-op muet. `dispatch` est
 * remplacé par un double qui rejette — on vérifie le toast d'erreur ET que le tour
 * n'est pas consommé (l'état de jeu ne bouge pas).
 */
const dispatchMock = vi.fn<(cmd: unknown) => Promise<never>>(() =>
  Promise.reject(new Error('EndTurn refusée')),
);
vi.mock('./dispatch', () => ({ dispatch: (cmd: unknown) => dispatchMock(cmd) }));

const { requestEndTurn } = await import('./end-turn');

const game = {
  players: [{ id: 'p1', controller: 'human' }],
  currentPlayer: 0,
  heroes: [],
  config: null,
  calendar: { day: 3, week: 1, month: 1 },
} as unknown as GameState;

beforeEach(() => {
  dispatchMock.mockClear();
  appStore.setState({ toasts: [], game, confirmEndTurn: false, pendingEndTurn: null });
});

describe('requestEndTurn — rejet surfacé (B3)', () => {
  it('un dispatch qui rejette produit un toast d’erreur, le tour n’est pas consommé', async () => {
    requestEndTurn();
    expect(dispatchMock).toHaveBeenCalledWith({ type: 'EndTurn', playerId: 'p1' });

    await vi.waitFor(() => expect(appStore.getState().toasts).toHaveLength(1));
    expect(appStore.getState().toasts[0]?.kind).toBe('error');
    // Tour NON consommé : même joueur actif, même jour (l'état n'a pas avancé).
    expect(appStore.getState().game.currentPlayer).toBe(0);
    expect(appStore.getState().game.calendar.day).toBe(3);
  });

  it('appuis répétés ⇒ un seul toast (anti-spam)', async () => {
    requestEndTurn();
    requestEndTurn();
    requestEndTurn();
    await vi.waitFor(() => expect(appStore.getState().toasts.length).toBeGreaterThan(0));
    expect(appStore.getState().toasts).toHaveLength(1);
    expect(dispatchMock).toHaveBeenCalledTimes(3);
  });
});
