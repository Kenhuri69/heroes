import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { Command } from '../src/core/commands';
import type { GameEvent } from '../src/core/events';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import type { QuestState } from '../src/quest/types';
import { evaluateQuests } from '../src/quest/evaluate';
import { seedRng } from '../src/core/rng';
import { testConfig, testMap } from './fixtures';

/**
 * Système de quêtes générique (doc 13 §5–6, lot N2a) : le moteur interprète des
 * conditions génériques et applique des récompenses ; il ignore texte/dialogue/
 * faction. Ces tests vérifient l'évaluateur pur et le câblage `evaluateQuests`.
 */

function baseState(quests: QuestState | null): GameState {
  return {
    ...createEmptyState(),
    started: true,
    rng: seedRng(1),
    config: testConfig(),
    players: [
      {
        id: 'p1',
        resources: { gold: 0, wood: 0, ore: 0, crystal: 0, gems: 0, sulfur: 0, mercury: 0 },
        factionResources: {},
        explored: [],
        controller: 'human',
        eliminated: false,
        townlessDays: -1,
        huntContract: null,
        team: 0,
      },
    ],
    heroes: [
      {
        id: 'h1',
        playerId: 'p1',
        pos: { x: 0, y: 0 },
        movementPoints: 0,
        army: [],
        xp: 0,
        level: 1,
        attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 },
        mana: 0,
        manaMax: 0,
        skills: {},
        visitLuck: 0,
        spells: [],
        artifacts: [null, null, null],
        pendingSkillChoices: [],
        factionId: '',
        houseId: '',
        houseEffects: [],
        warMachines: [],
      },
    ],
    quests,
  };
}

function run(state: GameState): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const next = produce(state, (draft: GameState) => evaluateQuests(draft, events));
  return { state: next, events };
}

describe('quêtes — évaluateur générique', () => {
  it('avance une étape satisfaite puis complète la quête et applique la récompense', () => {
    const quests: QuestState = {
      quests: [
        {
          def: {
            id: 'q1',
            steps: [{ id: 's1', condition: { type: 'ownUnits', unitId: 'u', count: 3 } }],
            rewards: [{ type: 'resources', resources: { gold: 500 } }],
          },
          stepIndex: 0,
          status: 'active',
        },
      ],
    };
    // Condition non satisfaite : aucune avancée.
    const before = run(baseState(quests));
    expect(before.events).toHaveLength(0);
    expect(before.state.players[0]!.resources.gold).toBe(0);

    // On donne 3 unités au héros → étape satisfaite.
    const s = baseState(quests);
    s.heroes[0]!.army = [{ unitId: 'u', count: 3 }];
    const after = run(s);
    expect(after.events.map((e) => e.type)).toEqual(['QuestAdvanced', 'QuestCompleted']);
    expect(after.state.players[0]!.resources.gold).toBe(500);
    expect(after.state.quests!.quests[0]!.status).toBe('completed');
  });

  it('franchit plusieurs étapes déjà satisfaites en une passe, sans re-compléter', () => {
    const quests: QuestState = {
      quests: [
        {
          def: {
            id: 'q2',
            steps: [
              { id: 's1', condition: { type: 'buildStructure', buildingId: 'fort' } },
              { id: 's2', condition: { type: 'ownUnits', unitId: 'u', count: 1 } },
            ],
            rewards: [{ type: 'units', unitId: 'reward-unit', count: 2 }],
          },
          stepIndex: 0,
          status: 'active',
        },
      ],
    };
    const s = baseState(quests);
    s.towns = [
      {
        id: 't',
        pos: { x: 0, y: 0 },
        ownerPlayerId: 'p1',
        factionId: '',
        buildings: { fort: 1 },
        garrison: [],
        stock: {},
        builtToday: false,
      } as unknown as GameState['towns'][number],
    ];
    s.heroes[0]!.army = [{ unitId: 'u', count: 1 }];
    const after = run(s);
    expect(after.events.map((e) => e.type)).toEqual(['QuestAdvanced', 'QuestAdvanced', 'QuestCompleted']);
    // Récompense unités appliquée au héros.
    expect(after.state.heroes[0]!.army.find((a) => a.unitId === 'reward-unit')?.count).toBe(2);

    // Deuxième passe : quête complétée → aucun nouvel événement, pas de double récompense.
    const again = run(after.state);
    expect(again.events).toHaveLength(0);
    expect(again.state.heroes[0]!.army.find((a) => a.unitId === 'reward-unit')?.count).toBe(2);
  });

  it('récompense artefact : posée dans le premier slot libre', () => {
    const quests: QuestState = {
      quests: [
        {
          def: {
            id: 'q3',
            steps: [{ id: 's1', condition: { type: 'visitTile', x: 1, y: 0 } }],
            rewards: [{ type: 'artifact', artifactId: 'sceau-terni' }],
          },
          stepIndex: 0,
          status: 'active',
        },
      ],
    };
    const s = baseState(quests);
    s.map = { width: 4, height: 1, tiles: [], objects: [] } as unknown as GameState['map'];
    s.players[0]!.explored = [0, 1, 0, 0]; // tuile (1,0) explorée
    const after = run(s);
    expect(after.events.map((e) => e.type)).toEqual(['QuestAdvanced', 'QuestCompleted']);
    expect(after.state.heroes[0]!.artifacts[0]).toBe('sceau-terni');
  });

  it('B2 — récompense artefact avec inventaire plein : NON attribuée (jamais de slot supplémentaire)', () => {
    const quests: QuestState = {
      quests: [
        {
          def: {
            id: 'q3b',
            steps: [{ id: 's1', condition: { type: 'visitTile', x: 1, y: 0 } }],
            rewards: [{ type: 'artifact', artifactId: 'sceau-terni' }],
          },
          stepIndex: 0,
          status: 'active',
        },
      ],
    };
    const s = baseState(quests);
    s.heroes[0]!.artifacts = ['a', 'b', 'c']; // 3 slots, tous occupés (aucun null)
    s.map = { width: 4, height: 1, tiles: [], objects: [] } as unknown as GameState['map'];
    s.players[0]!.explored = [0, 1, 0, 0];
    const after = run(s);
    expect(after.state.heroes[0]!.artifacts).toEqual(['a', 'b', 'c']); // pas de 4ᵉ slot
  });

  it('no-op sans quêtes embarquées (partie libre) — aucun événement', () => {
    const after = run(baseState(null));
    expect(after.events).toHaveLength(0);
    expect(after.state.quests).toBeNull();
  });

  it('StartGame embarque les quêtes et émet QuestStarted', () => {
    const quests: QuestState = {
      quests: [
        {
          def: { id: 'q1', steps: [{ id: 's1', condition: { type: 'surviveDays', days: 99 } }], rewards: [] },
          stepIndex: 0,
          status: 'active',
        },
      ],
    };
    const startCmd: Command = {
      type: 'StartGame',
      seed: 1,
      players: [{ id: 'player-1', startingResources: emptyResources() }],
      map: testMap(),
      config: testConfig(),
      unitCatalog: {},
      buildingCatalog: {},
      towns: [],
      quests,
    };
    const { state, events } = apply(createEmptyState(), startCmd);
    expect(events.some((e) => e.type === 'QuestStarted' && e.questId === 'q1')).toBe(true);
    expect(state.quests?.quests[0]?.def.id).toBe('q1');
  });
});
