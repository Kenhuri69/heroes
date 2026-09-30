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
        movementPoints: 0, naval: false,
        army: [],
        xp: 0,
        level: 1,
        attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 },
        mana: 0,
        manaMax: 0,
        skills: {},
        visitLuck: 0,
        visitMorale: 0,
        spells: [],
        artifacts: [null, null, null],
        pendingSkillChoices: [],
        pendingAttributeChoices: [],
        factionId: '',
        houseId: '',
        houseEffects: [],
        name: '',
        specialtyId: '',
        specialtyEffects: [],
        warMachines: [],
        rosterId: '',
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
    s.heroes[0]!.pos = { x: 1, y: 0 }; // LE2/M14 : le héros ATTEINT la tuile
    const after = run(s);
    expect(after.events.map((e) => e.type)).toEqual(['QuestAdvanced', 'QuestCompleted']);
    expect(after.state.heroes[0]!.artifacts[0]).toBe('sceau-terni');
  });

  it('B2 — récompense artefact avec inventaire plein : rangée au SAC (jamais de 11ᵉ slot, jamais perdue)', () => {
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
    s.heroes[0]!.pos = { x: 1, y: 0 };
    const after = run(s);
    expect(after.state.heroes[0]!.artifacts).toEqual(['a', 'b', 'c']); // pas de 4ᵉ slot équipé
    expect(after.state.heroes[0]!.backpack).toContain('sceau-terni'); // rangée au sac
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

/** Quête d'une seule étape, récompense optionnelle. */
function oneStep(condition: QuestState['quests'][number]['def']['steps'][number]['condition'], rewards: QuestState['quests'][number]['def']['rewards'] = []): QuestState {
  return { quests: [{ def: { id: 'q', steps: [{ id: 's', condition }], rewards }, stepIndex: 0, status: 'active' }] };
}

function vanquished(objectId: string, playerId: string, heroId: string): GameEvent {
  return { type: 'GuardianVanquished', objectId, playerId, heroId, gold: 0, resource: null, resourceAmount: 0, artifactId: null };
}

function runWith(state: GameState, events: GameEvent[]): { state: GameState; events: GameEvent[] } {
  const next = produce(state, (draft: GameState) => evaluateQuests(draft, events));
  return { state: next, events };
}

describe('LE2/M14 — quêtes validées par un héros, pas par la vue', () => {
  it('visitTile : une tuile seulement VUE ne valide plus l’étape', () => {
    const s = baseState(oneStep({ type: 'visitTile', x: 2, y: 0 }));
    s.map = { width: 4, height: 1, tiles: [], objects: [] } as unknown as GameState['map'];
    s.players[0]!.explored = [1, 1, 1, 1]; // tout est vu, mais le héros est en (0,0)
    expect(run(s).state.quests!.quests[0]!.status).toBe('active');
  });

  it('visitTile : un héros qui TRAVERSE la tuile pendant la commande la valide', () => {
    const s = baseState(oneStep({ type: 'visitTile', x: 2, y: 0 }));
    s.heroes[0]!.pos = { x: 3, y: 0 };
    const step: GameEvent = { type: 'MoveStepped', heroId: 'h1', from: { x: 1, y: 0 }, to: { x: 2, y: 0 }, movementPointsLeft: 0 };
    expect(runWith(s, [step]).state.quests!.quests[0]!.status).toBe('completed');
  });

  it('defeatGuardian : un gardien tué par UN AUTRE joueur ne valide pas la quête', () => {
    const s = baseState(oneStep({ type: 'defeatGuardian', objectId: 'g1' }));
    const after = runWith(s, [vanquished('g1', 'p2', 'h-ennemi')]);
    expect(after.state.quests!.quests[0]!.status).toBe('active');
    expect(after.state.quests!.vanquishedBy?.['g1']?.playerId).toBe('p2');
  });

  it('defeatGuardian : une victoire du joueur, même AVANT que l’étape soit courante, compte', () => {
    const quests: QuestState = {
      quests: [
        {
          def: {
            id: 'q',
            steps: [
              { id: 'a', condition: { type: 'ownUnits', unitId: 'u', count: 1 } },
              { id: 'b', condition: { type: 'defeatGuardian', objectId: 'g1' } },
            ],
            rewards: [],
          },
          stepIndex: 0,
          status: 'active',
        },
      ],
    };
    const first = runWith(baseState(quests), [vanquished('g1', 'p1', 'h1')]).state; // étape a pas encore faite
    expect(first.quests!.quests[0]!.stepIndex).toBe(0);
    const s = structuredClone(first) as GameState;
    s.heroes[0]!.army = [{ unitId: 'u', count: 1 }];
    expect(run(s).state.quests!.quests[0]!.status).toBe('completed');
  });
});

describe('LE2/M19 — récompense au héros qui valide, jamais perdue', () => {
  function withTwoHeroes(q: QuestState): GameState {
    const s = baseState(q);
    s.heroes.push({ ...structuredClone(s.heroes[0]!), id: 'h2', pos: { x: 2, y: 0 } });
    return s;
  }

  it('les unités vont au héros qui a atteint la tuile, pas au premier héros', () => {
    const s = withTwoHeroes(oneStep({ type: 'visitTile', x: 2, y: 0 }, [{ type: 'units', unitId: 'reward-unit', count: 4 }]));
    const after = run(s).state;
    expect(after.heroes.find((h) => h.id === 'h2')?.army).toContainEqual({ unitId: 'reward-unit', count: 4 });
    expect(after.heroes.find((h) => h.id === 'h1')?.army).toEqual([]);
  });

  it('armée pleine ⇒ garnison de la ville possédée la plus proche, annoncée par l’événement', () => {
    const s = baseState(oneStep({ type: 'ownUnits', unitId: 'u0', count: 1 }, [{ type: 'units', unitId: 'reward-unit', count: 4 }]));
    s.heroes[0]!.army = Array.from({ length: 7 }, (_, i) => ({ unitId: `u${i}`, count: 1 }));
    const town = (id: string, x: number) =>
      ({ id, pos: { x, y: 0 }, ownerPlayerId: 'p1', factionId: '', buildings: {}, garrison: [], stock: {}, builtToday: false }) as unknown as GameState['towns'][number];
    s.towns = [town('loin', 9), town('pres', 2)];
    const { state, events } = run(s);
    expect(state.towns.find((t) => t.id === 'pres')?.garrison).toEqual([{ unitId: 'reward-unit', count: 4 }]);
    expect(events).toContainEqual({ type: 'QuestCompleted', questId: 'q', rerouted: { townId: 'pres', unitId: 'reward-unit', count: 4 } });
  });
});
