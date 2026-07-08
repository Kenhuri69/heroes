import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import {
  createEmptyState,
  emptyResources,
  CURRENT_SAVE_VERSION,
  type GameState,
} from '../src/core/state';
import type { Command } from '../src/core/commands';
import type { TownState } from '../src/town/types';
import {
  deserializeState,
  hashState,
  readSaveVersion,
  serializeState,
  stableStringify,
} from '../src/core/serialize';
import { testConfig, testMap } from './fixtures';

describe('sérialisation', () => {
  it('stableStringify est insensible à l’ordre des clés', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } })).toBe(
      stableStringify({ a: { c: [3, { e: 5, f: 4 }], d: 2 }, b: 1 }),
    );
  });

  it('save → load → hash identique (snapshot sans perte)', () => {
    let state = apply(createEmptyState(), {
      type: 'StartGame',
      seed: 2026,
      players: [
        { id: 'p1', startingResources: { ...emptyResources(), gold: 2500, wood: 10 } },
        { id: 'p2', startingResources: { ...emptyResources(), gold: 2500, ore: 10 } },
      ],
      map: testMap(),
      config: testConfig(),
      unitCatalog: {},
      buildingCatalog: {},
      towns: [],
    }).state;
    state = apply(state, {
      type: 'MoveHero',
      heroId: 'hero-p1',
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ],
    }).state;
    for (const playerId of ['p1', 'p2', 'p1']) {
      state = apply(state, { type: 'EndTurn', playerId }).state;
    }

    const loaded = deserializeState(serializeState(state));
    expect(loaded).toEqual(state);
    expect(hashState(loaded)).toBe(hashState(state));

    // et la partie rechargée continue exactement pareil
    const a = apply(state, { type: 'EndTurn', playerId: 'p2' });
    const b = apply(loaded, { type: 'EndTurn', playerId: 'p2' });
    expect(hashState(a.state)).toBe(hashState(b.state));
  });

  /**
   * Régression (plan phase-3.7) : les champs d'état introduits en 3.4/3.5
   * (`scenario`, `outcome`, `factionCatalog`, `factionId` héros/ville,
   * `controller`, `eliminated`) doivent survivre au round-trip de sauvegarde.
   * La couverture existante ne portait que sur une partie libre — ces champs
   * y valent leur défaut (null/''/{}), donc le round-trip ne les exerçait pas.
   */
  it('save → load → hash identique pour un état de scénario (champs 3.4/3.5)', () => {
    const town: TownState = {
      id: 'town-1',
      ownerPlayerId: 'p1',
      pos: { x: 0, y: 0 },
      factionId: 'faction-a',
      buildings: {},
      builtToday: false,
      garrison: [],
      stock: {},
      spellPool: [],
    };
    const start: Command = {
      type: 'StartGame',
      seed: 7,
      players: [
        { id: 'p1', startingResources: emptyResources(), startingFactionId: 'faction-a' },
        {
          id: 'p2',
          startingResources: emptyResources(),
          startingFactionId: 'faction-b',
          controller: 'ai',
        },
      ],
      map: testMap(),
      config: testConfig(),
      unitCatalog: {},
      buildingCatalog: {},
      towns: [town],
      factionCatalog: {
        'faction-b': {
          bonuses: [
            {
              type: 'raiseUndeadOnVictory',
              unitId: 'skeleton',
              percentHpRaised: 20,
              capBase: 10,
              capPerExisting: 1,
            },
          ],
        },
      },
      scenario: {
        objectives: {
          p1: {
            victory: { type: 'surviveDays', days: 1 },
            defeat: { type: 'defeatHero', heroId: 'hero-p1' },
          },
        },
      },
    };

    let state: GameState = apply(createEmptyState(), start).state;
    // Fin de tour du joueur local : `surviveDays: 1` est satisfait (jour 1) —
    // pose `outcome` et exerce le champ de bout en bout.
    state = apply(state, { type: 'EndTurn', playerId: 'p1' }).state;

    // Pré-conditions : les champs ciblés sont réellement peuplés (sinon le
    // test ne prouverait rien).
    expect(state.scenario).not.toBeNull();
    expect(state.outcome).not.toBeNull();
    expect(state.factionCatalog['faction-b']).toBeDefined();
    expect(state.towns[0]?.factionId).toBe('faction-a');
    expect(state.heroes.find((h) => h.id === 'hero-p1')?.factionId).toBe('faction-a');
    expect(state.players.find((p) => p.id === 'p2')?.controller).toBe('ai');

    const loaded = deserializeState(serializeState(state));
    expect(loaded).toEqual(state);
    expect(hashState(loaded)).toBe(hashState(state));
  });
});

describe('garde de version de sauvegarde (plan phase-3.8)', () => {
  it('un état neuf porte CURRENT_SAVE_VERSION', () => {
    expect(createEmptyState().saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(readSaveVersion(serializeState(createEmptyState()))).toBe(CURRENT_SAVE_VERSION);
  });

  it('readSaveVersion lit la version d’un snapshot arbitraire', () => {
    expect(readSaveVersion('{"saveVersion":1,"started":false}')).toBe(1);
    expect(readSaveVersion('{"saveVersion":99}')).toBe(99);
  });

  it('readSaveVersion rend null sur JSON invalide ou version absente/non numérique', () => {
    expect(readSaveVersion('pas du json')).toBeNull();
    expect(readSaveVersion('null')).toBeNull();
    expect(readSaveVersion('42')).toBeNull();
    expect(readSaveVersion('{"started":true}')).toBeNull();
    expect(readSaveVersion('{"saveVersion":"2"}')).toBeNull();
    expect(readSaveVersion('{"saveVersion":null}')).toBeNull();
  });
});
