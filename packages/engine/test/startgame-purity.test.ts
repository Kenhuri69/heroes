import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { Command } from '../src/core/commands';
import { createEmptyState, emptyResources } from '../src/core/state';
import type { QuestState } from '../src/quest/types';
import { testCatalog, testConfig, testMap } from './fixtures';

/**
 * Revue 2026-09 (M12) : `apply(state, cmd)` est une fonction PURE — la commande
 * de l'appelant ne doit être ni mutée ni gelée. `StartGame` aliasait
 * `cmd.quests` dans le draft : `evaluateQuests` (même `produce`) faisait avancer
 * une quête satisfaite d'emblée DANS l'objet de l'appelant, puis l'autoFreeze
 * d'Immer le gelait ⇒ un second `apply` de la même commande (replay, tests)
 * démarrait avec une quête déjà `completed`, sans `QuestAdvanced`.
 */
describe('StartGame — pureté vis-à-vis de la commande', () => {
  it('ne mute ni ne gèle `cmd.quests` (quête satisfaite dès le départ)', () => {
    const quests: QuestState = {
      quests: [
        {
          // `visitTile` sur la case de départ du héros (0,0) : franchie au 1er `evaluateQuests`.
          def: { id: 'q1', steps: [{ id: 's1', condition: { type: 'visitTile', x: 0, y: 0 } }], rewards: [] },
          stepIndex: 0,
          status: 'active',
        },
      ],
    };
    const cmd: Command = {
      type: 'StartGame',
      seed: 1,
      players: [{ id: 'p1', startingResources: emptyResources() }],
      map: testMap(),
      config: testConfig(),
      unitCatalog: testCatalog(),
      quests,
    };
    const snapshot = JSON.stringify(cmd.quests);
    const first = apply(createEmptyState(), cmd);
    expect(first.state.quests?.quests[0]?.status).toBe('completed'); // la quête a bien avancé… dans l'ÉTAT
    expect(JSON.stringify(cmd.quests)).toBe(snapshot); // …pas dans la commande
    expect(Object.isFrozen(cmd.quests)).toBe(false);
    // Rejouer la même commande produit les mêmes événements de quête.
    const second = apply(createEmptyState(), cmd);
    const questEvents = (evs: typeof first.events) => evs.filter((e) => e.type.startsWith('Quest')).map((e) => e.type);
    expect(questEvents(second.events)).toEqual(questEvents(first.events));
    expect(questEvents(first.events)).toContain('QuestCompleted');
  });
});
