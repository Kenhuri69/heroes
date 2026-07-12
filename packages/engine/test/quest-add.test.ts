import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import type { QuestDef } from '../src/quest/types';
import { testConfig, testMap } from './fixtures';
import { testUnitCatalogWithEconomy } from './town-fixtures';

/**
 * N-DAILYREFRESH (doc 13 §4.2) — `AddQuests` ajoute des quêtes en cours de partie
 * (rafraîchissement des contrats journaliers). Générique et idempotent.
 */
function startedGame(): GameState {
  const players: PlayerSetup[] = [{ id: 'p1', startingResources: emptyResources() }];
  const cmd: Command = {
    type: 'StartGame',
    seed: 1,
    players,
    map: testMap(),
    config: testConfig(),
    unitCatalog: testUnitCatalogWithEconomy(),
  };
  return apply(createEmptyState(), cmd).state;
}

/** Quête « survivre 3 jours » — jamais satisfaite au jour 1 (reste active). */
function dailyDef(id: string): QuestDef {
  return { id, steps: [{ id: `${id}-step`, condition: { type: 'surviveDays', days: 3 } }], rewards: [] };
}

describe('N-DAILYREFRESH — AddQuests', () => {
  it('crée `state.quests` quand la partie n’en avait pas + émet QuestStarted', () => {
    const start = startedGame();
    expect(start.quests).toBeNull();
    const { state, events } = apply(start, { type: 'AddQuests', quests: [dailyDef('daily-a')] });
    expect(state.quests?.quests.map((q) => q.def.id)).toEqual(['daily-a']);
    expect(state.quests?.quests[0]?.status).toBe('active');
    expect(events).toContainEqual({ type: 'QuestStarted', questId: 'daily-a' });
  });

  it('ajoute aux quêtes existantes sans écraser', () => {
    const s1 = apply(startedGame(), { type: 'AddQuests', quests: [dailyDef('daily-a')] }).state;
    const s2 = apply(s1, { type: 'AddQuests', quests: [dailyDef('daily-b')] }).state;
    expect(s2.quests?.quests.map((q) => q.def.id)).toEqual(['daily-a', 'daily-b']);
  });

  it('est idempotent : une déf déjà présente est ignorée', () => {
    const s1 = apply(startedGame(), { type: 'AddQuests', quests: [dailyDef('daily-a')] }).state;
    const { state, events } = apply(s1, {
      type: 'AddQuests',
      quests: [dailyDef('daily-a'), dailyDef('daily-c')],
    });
    expect(state.quests?.quests.map((q) => q.def.id)).toEqual(['daily-a', 'daily-c']);
    // Un seul QuestStarted (pour la nouvelle) — la déf en double n'en émet pas.
    expect(events.filter((e) => e.type === 'QuestStarted')).toEqual([
      { type: 'QuestStarted', questId: 'daily-c' },
    ]);
  });

  it('rejette hors partie démarrée (gameNotStarted)', () => {
    expect(validate(createEmptyState(), { type: 'AddQuests', quests: [dailyDef('daily-a')] })?.code).toBe(
      'gameNotStarted',
    );
  });
});
