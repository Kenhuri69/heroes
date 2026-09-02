import { beforeEach, describe, expect, it } from 'vitest';
import { CURRENT_SAVE_VERSION, createEmptyState, type GameState } from '@heroes/engine';
import { appStore } from './store';
import { enterLoadedGame } from './load-game';
import { armDailyRefresh, dailyRefreshContext } from './daily-refresh';

/**
 * Revue 2026-09 (C2/C3/C5) : point d'entrée unique d'une partie chargée — purge
 * l'état client PAR PARTIE (chapitre de campagne, contrats journaliers armés,
 * accusé hot-seat, match en ligne, cinématique) sauf ce que la sauvegarde
 * embarque explicitement dans son contexte.
 */
const loaded: GameState = { ...createEmptyState(), started: true, saveVersion: CURRENT_SAVE_VERSION };

beforeEach(() => {
  appStore.setState({
    activeChapter: { campaignId: 'camp', chapterIndex: 2 },
    onlineMatch: { id: 'm1', nextSeq: 3, myPlayerId: 'p1', status: 'active' },
    turnAck: 'p2',
    aiFailure: true,
    cutsceneActive: true,
    modals: [{ kind: 'options' } as never],
  });
  armDailyRefresh('fac-x', 42);
});

describe('enterLoadedGame', () => {
  it('sans contexte : une escarmouche chargée ne fait plus avancer la campagne ni recevoir ses contrats', () => {
    enterLoadedGame(loaded);
    const s = appStore.getState();
    expect(s.activeChapter).toBeNull();
    expect(dailyRefreshContext()).toBeNull();
    expect(s.onlineMatch).toBeNull();
    expect(s.turnAck).toBeNull();
    expect(s.aiFailure).toBe(false);
    expect(s.cutsceneActive).toBe(false);
    expect(s.modals).toEqual([]);
    expect(s.screen).toBe('adventure');
  });

  it('avec contexte : chapitre actif et contrats journaliers de LA partie chargée sont restaurés', () => {
    enterLoadedGame(loaded, {
      context: { activeChapter: { campaignId: 'saved', chapterIndex: 0 }, dailyRefresh: { humanFactionId: 'fac-y', baseSeed: 7 } },
    });
    expect(appStore.getState().activeChapter).toEqual({ campaignId: 'saved', chapterIndex: 0 });
    expect(dailyRefreshContext()).toEqual({ humanFactionId: 'fac-y', baseSeed: 7 });
  });

  it('match en ligne : posé dans le même appel (jamais un `setState` séparé)', () => {
    enterLoadedGame(loaded, { onlineMatch: { id: 'm2', nextSeq: 0, myPlayerId: 'p1', status: 'open' } });
    expect(appStore.getState().onlineMatch?.id).toBe('m2');
  });
});
