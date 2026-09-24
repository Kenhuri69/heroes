import { describe, expect, it } from 'vitest';
import { forcedOverlayOpen } from './overlays';
import type { AppState } from './store';

/**
 * Revue 2026-09b E1 : les raccourcis carte se taisent sous tout overlay forcé.
 * État minimal forgé (le sélecteur ne lit que ces champs).
 */
function state(over: Partial<AppState> = {}, game: Record<string, unknown> = {}): AppState {
  return {
    modals: [],
    pendingEndTurn: null,
    aiTurn: null,
    aiFailure: false,
    onlineMatch: null,
    turnAck: null,
    cutsceneActive: false,
    dialogue: null,
    combatResult: null,
    pendingCoopInvite: null,
    mapCard: null,
    resourceDetail: null,
    loading: null,
    preBattlePending: false,
    ...over,
    game: {
      combat: null,
      outcome: null,
      currentPlayer: 0,
      players: [{ id: 'p1', controller: 'human' }, { id: 'p2', controller: 'ai' }],
      heroes: [],
      pendingTreasure: null,
      pendingTriggerChoice: null,
      ...game,
    },
  } as unknown as AppState;
}

describe('forcedOverlayOpen (E1)', () => {
  it('carte nue, tour humain solo ⇒ raccourcis permis', () => {
    expect(forcedOverlayOpen(state())).toBe(false);
  });

  it('hot-seat : le joueur actif n’a pas validé le passage d’appareil ⇒ bloqué', () => {
    const players = [
      { id: 'p1', controller: 'human' },
      { id: 'p2', controller: 'human' },
    ];
    expect(forcedOverlayOpen(state({ turnAck: 'p1' }, { players, currentPlayer: 1 }))).toBe(true);
    expect(forcedOverlayOpen(state({ turnAck: 'p2' }, { players, currentPlayer: 1 }))).toBe(false);
  });

  it('tour IA, dialogue, bilan, choix de compétence ⇒ bloqué', () => {
    expect(forcedOverlayOpen(state({}, { currentPlayer: 1 }))).toBe(true);
    expect(forcedOverlayOpen(state({ dialogue: {} as AppState['dialogue'] }))).toBe(true);
    expect(forcedOverlayOpen(state({ combatResult: {} as AppState['combatResult'] }))).toBe(true);
    const heroes = [{ playerId: 'p1', pendingSkillChoices: [['a', 'b']], pendingAttributeChoices: [] }];
    expect(forcedOverlayOpen(state({}, { heroes }))).toBe(true);
  });
});
