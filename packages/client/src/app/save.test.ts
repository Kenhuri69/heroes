import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { CURRENT_SAVE_VERSION, createEmptyState, type GameState } from '@heroes/engine';
import { appStore } from './store';
import { loadGame, restoreSavedGame, saveGame } from './save';

/**
 * Revue 2026-09 (C1/C3, file d'écriture) : la sauvegarde IndexedDB n'est acquise
 * qu'au commit de transaction, les écritures d'un slot sont sérialisées dans
 * l'ordre d'appel, et le contexte client (chapitre actif) voyage avec le slot.
 * IndexedDB simulé en mémoire (`fake-indexeddb`) — aucun navigateur requis.
 */
function game(day: number): GameState {
  const s = createEmptyState();
  return { ...s, started: true, saveVersion: CURRENT_SAVE_VERSION, calendar: { ...s.calendar, day } };
}

beforeEach(() => {
  appStore.setState({ activeChapter: null, onlineMatch: null, turnAck: null });
});

describe('saveGame / loadGame (IndexedDB)', () => {
  it('aller-retour : la partie sauvée est rechargée à l’identique', async () => {
    await saveGame(game(4), 'manual', { activeChapter: null, dailyRefresh: null });
    const loaded = await loadGame('manual');
    expect(loaded?.calendar.day).toBe(4);
  });

  it('deux écritures rapprochées sur le même slot commitent dans l’ordre : la dernière gagne', async () => {
    const first = saveGame(game(7), 'auto', { activeChapter: null, dailyRefresh: null });
    const second = saveGame(game(8), 'auto', { activeChapter: null, dailyRefresh: null });
    await Promise.all([first, second]);
    expect((await loadGame('auto'))?.calendar.day).toBe(8);
  });

  it('le contexte client (chapitre de campagne actif) est restauré au chargement', async () => {
    await saveGame(game(2), 'manual', { activeChapter: { campaignId: 'camp', chapterIndex: 1 }, dailyRefresh: null });
    appStore.setState({ activeChapter: { campaignId: 'autre', chapterIndex: 0 } });
    expect(await restoreSavedGame('manual')).toBe(true);
    expect(appStore.getState().activeChapter).toEqual({ campaignId: 'camp', chapterIndex: 1 });
    expect(appStore.getState().game.calendar.day).toBe(2);
    expect(appStore.getState().screen).toBe('adventure');
  });
});
