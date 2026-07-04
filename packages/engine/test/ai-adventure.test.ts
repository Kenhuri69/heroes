import { produce } from 'immer';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import type { GameEvent } from '../src/core/events';
import { createEmptyState, emptyResources, RESOURCE_IDS, type GameState } from '../src/core/state';
import { hashState } from '../src/core/serialize';
import { runAiTurn } from '../src/ai/adventure';
import type { AdventureMapDef } from '../src/adventure/map';
import { testCatalog, testConfig, testMap } from './fixtures';
import { testBuildingCatalog, testTown, testUnitCatalogWithEconomy } from './town-fixtures';

/**
 * `runAiTurn` (doc 11 §3.5, plan phase-3.5 lot S) : propriété « IA vs IA se
 * termine », déterminisme, et cas ciblés (ramassage, ville). Contrat testé :
 * `runAiTurn` ne pousse jamais `EndTurn` — c'est au test de le faire, comme
 * le driver réel (client / property test) le ferait.
 */

const CATALOG = testCatalog();
const config = testConfig();
const arbSeed = fc.integer({ min: 0, max: 2 ** 31 - 1 });

function aiGame(seed: number, map: AdventureMapDef = testMap()): GameState {
  const players: PlayerSetup[] = [
    { id: 'p1', startingResources: emptyResources(), controller: 'ai' },
    { id: 'p2', startingResources: emptyResources(), controller: 'ai' },
  ];
  const cmd: Command = {
    type: 'StartGame',
    seed,
    players,
    map,
    config,
    unitCatalog: CATALOG,
  };
  return apply(createEmptyState(), cmd).state;
}

/** Joue le tour du joueur courant (IA) puis `EndTurn`, jusqu'au plafond de jours `dayCap`. */
function runAiUntilDayCap(state: GameState, dayCap: number): GameState {
  let iterations = 0;
  const maxIterations = dayCap * state.players.length + 10;
  while (state.calendar.day < dayCap && !state.outcome) {
    if (++iterations > maxIterations) {
      throw new Error('ai-adventure.test : trop d’itérations, boucle infinie suspectée');
    }
    const current = state.players[state.currentPlayer];
    if (!current) break;
    const events: GameEvent[] = [];
    state = produce(state, (draft) => {
      runAiTurn(draft, current.id, events);
    });
    state = apply(state, { type: 'EndTurn', playerId: current.id }).state;
  }
  return state;
}

describe('runAiTurn — propriété « IA vs IA se termine »', () => {
  it(
    'progresse sans throw jusqu’au plafond de jours, invariants respectés',
    () => {
      fc.assert(
        fc.property(arbSeed, (seed) => {
          const result = runAiUntilDayCap(aiGame(seed), 200);
          expect(result.calendar.day).toBeGreaterThanOrEqual(200);
          for (const player of result.players) {
            for (const id of RESOURCE_IDS) expect(player.resources[id]).toBeGreaterThanOrEqual(0);
          }
          for (const hero of result.heroes) expect(hero.army.length).toBeLessThanOrEqual(7);
        }),
        { numRuns: 20 },
      );
    },
    20_000,
  );

  it('déterminisme : même seed ⇒ même hashState après N tours IA', () => {
    fc.assert(
      fc.property(arbSeed, (seed) => {
        const run = (): GameState => runAiUntilDayCap(aiGame(seed), 30);
        expect(hashState(run())).toBe(hashState(run()));
      }),
      { numRuns: 20 },
    );
  });
});

describe('runAiTurn — cas ciblés', () => {
  it('un héros IA ramasse une ressource adjacente', () => {
    const map: AdventureMapDef = {
      ...testMap(),
      objects: [{ id: 'gold-adjacent', type: 'resource', pos: { x: 1, y: 0 }, resource: 'gold', amount: 250 }],
    };
    const players: PlayerSetup[] = [{ id: 'p1', startingResources: emptyResources(), controller: 'ai' }];
    const state = apply(createEmptyState(), {
      type: 'StartGame',
      seed: 1,
      players,
      map,
      config,
      unitCatalog: CATALOG,
    }).state;

    const events: GameEvent[] = [];
    const next = produce(state, (draft) => {
      runAiTurn(draft, 'p1', events);
    });

    expect(next.heroes[0]?.pos).toEqual({ x: 1, y: 0 });
    expect(next.players[0]?.resources.gold).toBe(250);
    expect(next.map?.objects).toHaveLength(0);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'ResourcePicked', resource: 'gold', amount: 250 }),
    );
  });

  it('une ville IA construit un bâtiment abordable puis recrute le tier abordable', () => {
    const players: PlayerSetup[] = [
      { id: 'p1', startingResources: { ...emptyResources(), gold: 1000 }, controller: 'ai' },
    ];
    const town = testTown({
      ownerPlayerId: 'p1',
      buildings: { dwelling1: 1 }, // townHall/fort pas encore construits
      stock: { 'red-grunt': 10 },
    });
    const state = apply(createEmptyState(), {
      type: 'StartGame',
      seed: 1,
      players,
      map: { ...testMap(), objects: [] }, // pas de ressource au sol : n'affecte pas l'or du build/recrutement
      config,
      unitCatalog: testUnitCatalogWithEconomy(),
      buildingCatalog: testBuildingCatalog(),
      towns: [town],
    }).state;

    const events: GameEvent[] = [];
    const next = produce(state, (draft) => {
      runAiTurn(draft, 'p1', events);
    });

    const nextTown = next.towns[0];
    expect(nextTown?.buildings.townHall).toBe(1); // premier bâtiment abordable/prérequis ok (ordre alphabétique)
    expect(events).toContainEqual({ type: 'TownBuilt', townId: 'town-1', buildingId: 'townHall', level: 1 });

    expect(nextTown?.garrison).toContainEqual({ unitId: 'red-grunt', count: 10 });
    expect(nextTown?.stock['red-grunt']).toBe(0);
    expect(next.players[0]?.resources.gold).toBe(1000 - 10 * 50); // recrutement : 50 or/unité
    expect(events).toContainEqual({ type: 'UnitsRecruited', townId: 'town-1', unitId: 'red-grunt', count: 10 });
  });

  it('ne joue pas un joueur humain ni une partie déjà finie', () => {
    const players: PlayerSetup[] = [{ id: 'p1', startingResources: emptyResources() }]; // controller défaut 'human'
    const state = apply(createEmptyState(), {
      type: 'StartGame',
      seed: 1,
      players,
      map: testMap(),
      config,
      unitCatalog: CATALOG,
    }).state;
    const events: GameEvent[] = [];
    const next = produce(state, (draft) => {
      runAiTurn(draft, 'p1', events);
    });
    expect(next).toEqual(state);
    expect(events).toHaveLength(0);
  });
});
