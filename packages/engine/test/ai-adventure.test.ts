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
    // ~14 s en local : 20 s ne laissait aucune marge aux runners CI (timeouts
    // intermittents observés) — 40 s couvre la variance sans masquer un vrai gel
    // (la boucle a son propre garde-fou d'itérations).
    40_000,
  );

  it(
    'déterminisme : même seed ⇒ même hashState après N tours IA',
    () => {
      fc.assert(
        fc.property(arbSeed, (seed) => {
          const run = (): GameState => runAiUntilDayCap(aiGame(seed), 30);
          expect(hashState(run())).toBe(hashState(run()));
        }),
        { numRuns: 20 },
      );
    },
    // Property test lourd (20 seeds × 2 simulations × 30 jours) : sous charge CI, il
    // dépasse le défaut 5 s. Timeout explicite, aligné sur le test frère ci-dessus.
    20_000,
  );
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

  it('un héros IA fort marche sur un héros ennemi battable et le tue (H-VS-H)', () => {
    // Deux joueurs IA ; héros p1 fort (blue-wolf ×50) voisin d'un héros p2
    // faible (red-grunt ×1). Aucun objet collectable ⇒ priorité 2 (chasse).
    const map: AdventureMapDef = { ...testMap(), objects: [] };
    const players: PlayerSetup[] = [
      { id: 'p1', startingResources: emptyResources(), controller: 'ai' },
      { id: 'p2', startingResources: emptyResources(), controller: 'ai' },
    ];
    let state = apply(createEmptyState(), {
      type: 'StartGame',
      seed: 1,
      players,
      map,
      config,
      unitCatalog: CATALOG,
    }).state;

    // Place les héros côte à côte avec des armées asymétriques (p1 domine largement).
    state = produce(state, (draft) => {
      const a = draft.heroes.find((h) => h.playerId === 'p1');
      const b = draft.heroes.find((h) => h.playerId === 'p2');
      if (!a || !b) throw new Error('héros absents');
      a.pos = { x: 2, y: 2 };
      a.army = [{ unitId: 'blue-wolf', count: 50 }];
      b.pos = { x: 3, y: 3 };
      b.army = [{ unitId: 'red-grunt', count: 1 }];
    });

    const events: GameEvent[] = [];
    const next = produce(state, (draft) => {
      runAiTurn(draft, 'p1', events);
    });

    // Le héros ennemi faible est mort ; l'attaquant survit sur sa tuile.
    expect(next.heroes.find((h) => h.playerId === 'p2')).toBeUndefined();
    const attacker = next.heroes.find((h) => h.playerId === 'p1');
    expect(attacker).toBeDefined();
    expect(attacker?.pos).toEqual({ x: 2, y: 2 }); // n'entre pas sur la tuile (comme un gardien)
    expect(next.combat).toBeNull(); // combat auto-résolu
    expect(events).toContainEqual(expect.objectContaining({ type: 'CombatEnded', winner: 'attacker' }));
  });

  it('n’attaque PAS un héros ennemi trop fort (marge insuffisante)', () => {
    const map: AdventureMapDef = { ...testMap(), objects: [] };
    const players: PlayerSetup[] = [
      { id: 'p1', startingResources: emptyResources(), controller: 'ai' },
      { id: 'p2', startingResources: emptyResources(), controller: 'ai' },
    ];
    let state = apply(createEmptyState(), {
      type: 'StartGame',
      seed: 1,
      players,
      map,
      config,
      unitCatalog: CATALOG,
    }).state;
    state = produce(state, (draft) => {
      const a = draft.heroes.find((h) => h.playerId === 'p1');
      const b = draft.heroes.find((h) => h.playerId === 'p2');
      if (!a || !b) throw new Error('héros absents');
      a.pos = { x: 2, y: 2 };
      a.army = [{ unitId: 'red-grunt', count: 2 }]; // faible
      b.pos = { x: 3, y: 3 };
      b.army = [{ unitId: 'blue-wolf', count: 50 }]; // bien plus fort
    });

    const events: GameEvent[] = [];
    const next = produce(state, (draft) => {
      runAiTurn(draft, 'p1', events);
    });

    // Aucun combat de héros : les deux survivent (l'IA explore plutôt).
    expect(next.heroes.find((h) => h.playerId === 'p2')).toBeDefined();
    expect(next.heroes.find((h) => h.playerId === 'p1')).toBeDefined();
    expect(next.combat).toBeNull();
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

describe('Revue 2026-07 — B7 : siège ouvert par la capture IA auto-résolu', () => {
  it('capturer une ville tour-défendue (Fort ≥ 3, garnison vide) ne laisse pas de combat orphelin', () => {
    // Catalogue avec la tour de tir : `wouldSpawnSiegeTower` déclenche un siège
    // même à garnison vide — exactement le cas que `pickAdjacentCapturableTown`
    // considère « non défendu ».
    const catalog = {
      ...CATALOG,
      'arrow-tower': {
        id: 'arrow-tower', groupId: 'war-machine', nativeTerrain: '',
        stats: { hp: 400, attack: 12, defense: 12, damage: [10, 20] as [number, number], speed: 1 },
        abilities: [
          { id: 'shooter', params: { ammo: 999, noMeleePenalty: true } },
          { id: 'warMachine' }, { id: 'immobile' },
        ],
      },
    };
    const players: PlayerSetup[] = [
      {
        id: 'p1',
        startingResources: emptyResources(),
        controller: 'ai',
        startingArmy: [{ unitId: 'red-grunt', count: 200 }],
      },
    ];
    const town = testTown({ id: 'town-e', ownerPlayerId: null, pos: { x: 1, y: 0 }, buildings: { fort: 3 }, garrison: [] });
    const state = apply(createEmptyState(), {
      type: 'StartGame',
      seed: 1,
      players,
      map: { ...testMap(), objects: [] },
      config,
      unitCatalog: catalog,
      towns: [town],
    }).state;

    const events: GameEvent[] = [];
    const next = produce(state, (draft) => {
      runAiTurn(draft, 'p1', events);
    });

    // Le contrat « AiTurn = tour complet » tient : aucun combat laissé ouvert
    // (avant le correctif, draft.combat restait posé et le tour sortait sans fin).
    expect(next.combat).toBeNull();
    expect(events.some((e) => e.type === 'CombatEnded')).toBe(true);
    // 200 grunts écrasent la tour seule ⇒ la ville est capturée dans le tour.
    expect(next.towns[0]?.ownerPlayerId).toBe('p1');
  });
});
