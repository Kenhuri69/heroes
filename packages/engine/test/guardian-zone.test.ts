import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { PlayerSetup } from '../src/core/commands';
import type { GameEvent } from '../src/core/events';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { runAiTurn } from '../src/ai/adventure';
import { findPath } from '../src/adventure/path';
import { guardianZone } from '../src/adventure/zone-of-control';
import type { AdventureMapDef, GridPos } from '../src/adventure/map';
import { testCatalog, testConfig, testMap } from './fixtures';

/**
 * Zone de contrôle des gardiens (LE3 A1, doc 02 §2.2) : les 8 voisines d'un
 * gardien arrêtent le héros et ouvrent le combat ; l'A* n'y fait que s'arrêter.
 * Règle opt-in (`adventure.guardianZoneOfControl`) : éteinte, rien ne change.
 */

type Guard = { id: string; pos: GridPos; count?: number };

function mapWith(guards: Guard[], extra: AdventureMapDef['objects'] = []): AdventureMapDef {
  const base = testMap();
  return {
    ...base,
    objects: [
      ...extra,
      ...guards.map((g) => ({ id: g.id, type: 'guardian' as const, pos: g.pos, unitId: 'blue-wolf', count: g.count ?? 1 })),
    ],
  };
}

function game(map: AdventureMapDef, zoc: boolean, controller: 'human' | 'ai' = 'human', army = 100): GameState {
  const players: PlayerSetup[] = [
    { id: 'p1', startingResources: emptyResources(), startingArmy: [{ unitId: 'red-grunt', count: army }], controller },
  ];
  return apply(createEmptyState(), {
    type: 'StartGame',
    seed: 3,
    players,
    map,
    config: { ...testConfig(), guardianZoneOfControl: zoc },
    unitCatalog: testCatalog(),
    buildingCatalog: {},
    towns: [],
  }).state;
}

const move = (state: GameState, path: GridPos[]) =>
  apply(state, { type: 'MoveHero', heroId: 'hero-p1', path });

describe('LE3 A1 — zone de contrôle des gardiens', () => {
  it('passer à côté d’un gardien ⇒ interception : le héros paie le pas et reste avant la zone', () => {
    const state = game(mapWith([{ id: 'wolf', pos: { x: 3, y: 1 } }]), true);
    const { state: next, events } = move(state, [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }]);
    expect(next.heroes[0]?.pos).toEqual({ x: 1, y: 0 });
    expect(next.combat?.guardianObjectId).toBe('wolf');
    expect(state.heroes[0]!.movementPoints - next.heroes[0]!.movementPoints).toBe(200);
    expect(events.some((e) => e.type === 'CombatStarted')).toBe(true);
  });

  it('règle éteinte : le même chemin longe le gardien sans combat', () => {
    const state = game(mapWith([{ id: 'wolf', pos: { x: 3, y: 1 } }]), false);
    const { state: next } = move(state, [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }]);
    expect(next.heroes[0]?.pos).toEqual({ x: 3, y: 0 });
    expect(next.combat).toBeNull();
  });

  it('deux gardiens au bord : un seul combat — celui que le chemin visait, sinon le premier par id', () => {
    const map = mapWith([
      { id: 'z-late', pos: { x: 3, y: 1 } },
      { id: 'a-first', pos: { x: 1, y: 3 } },
    ]);
    const aimed = move(game(map, true), [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 1 }]).state;
    expect(aimed.combat?.guardianObjectId).toBe('z-late');
    const passing = move(game(map, true), [{ x: 1, y: 1 }, { x: 2, y: 2 }]).state;
    expect(passing.combat?.guardianObjectId).toBe('a-first');
  });

  it('A* : contourne la zone, s’y arrête si c’est le but, n’y entre qu’une case avant le gardien visé', () => {
    const state = game(mapWith([{ id: 'wolf', pos: { x: 3, y: 1 } }]), true);
    const { config, map } = state;
    const zone = guardianZone(config!, map!, 0)!;
    const inZone = (p: GridPos): boolean => zone.has(p.y * map!.width + p.x);
    const around = findPath(config!, map!, { x: 0, y: 0 }, { x: 7, y: 0 })!;
    expect(around).not.toBeNull();
    expect(around.some(inZone)).toBe(false);
    const toZone = findPath(config!, map!, { x: 0, y: 0 }, { x: 2, y: 0 })!;
    expect(toZone.at(-1)).toEqual({ x: 2, y: 0 });
    const toGuard = findPath(config!, map!, { x: 0, y: 0 }, { x: 3, y: 1 }, [], true)!;
    expect(toGuard.at(-1)).toEqual({ x: 3, y: 1 });
    expect(toGuard.filter(inZone)).toHaveLength(1);
    expect(inZone(toGuard.at(-2)!)).toBe(true);
    // Règle éteinte : ligne droite le long du gardien.
    const off = game(mapWith([{ id: 'wolf', pos: { x: 3, y: 1 } }]), false);
    expect(findPath(off.config!, off.map!, { x: 0, y: 0 }, { x: 4, y: 0 })).toHaveLength(4);
  });

  it('IA : ne vise jamais un butin dans la zone d’un gardien qu’elle ne bat pas', () => {
    const gold = { id: 'gold-z', type: 'resource' as const, pos: { x: 2, y: 0 }, resource: 'gold' as const, amount: 500 };
    const map = mapWith([{ id: 'wolf', pos: { x: 3, y: 1 }, count: 500 }], [gold]);
    let state = game(map, true, 'ai', 5);
    state = produce(state, (d) => {
      d.players[0]!.explored = d.players[0]!.explored.map(() => 1);
    });
    const events: GameEvent[] = [];
    const next = produce(state, (d) => {
      runAiTurn(d, 'p1', events);
    });
    expect(events.some((e) => e.type === 'CombatStarted')).toBe(false);
    expect(next.heroes.find((h) => h.id === 'hero-p1')).toBeDefined();
    expect(next.map!.objects.some((o) => o.id === 'gold-z')).toBe(true);
    // Sans la règle, le même tas d'or se ramasse.
    let off = game(map, false, 'ai', 5);
    off = produce(off, (d) => {
      d.players[0]!.explored = d.players[0]!.explored.map(() => 1);
    });
    const offNext = produce(off, (d) => {
      runAiTurn(d, 'p1', []);
    });
    expect(offNext.map!.objects.some((o) => o.id === 'gold-z')).toBe(false);
  });
});

describe('LE3 A1 — IA vs IA avec zone de contrôle', () => {
  it('se termine et reste déterministe (gardiens au milieu, règle active)', () => {
    const map = mapWith([
      { id: 'g-mid', pos: { x: 4, y: 4 }, count: 2 },
      { id: 'g-side', pos: { x: 7, y: 7 }, count: 3 },
    ]);
    const run = (): string => {
      let state = apply(createEmptyState(), {
        type: 'StartGame',
        seed: 11,
        players: [
          { id: 'p1', startingResources: emptyResources(), startingArmy: [{ unitId: 'red-grunt', count: 20 }], controller: 'ai' },
          { id: 'p2', startingResources: emptyResources(), startingArmy: [{ unitId: 'red-grunt', count: 20 }], controller: 'ai' },
        ],
        map,
        config: { ...testConfig(), guardianZoneOfControl: true },
        unitCatalog: testCatalog(),
      }).state;
      for (let i = 0; i < 40 && !state.outcome; i++) {
        const current = state.players[state.currentPlayer]!;
        state = produce(state, (d) => {
          runAiTurn(d, current.id, []);
        });
        expect(state.combat).toBeNull();
        state = apply(state, { type: 'EndTurn', playerId: current.id }).state;
      }
      return JSON.stringify([state.heroes.map((h) => [h.id, h.pos]), state.map!.objects.map((o) => o.id)]);
    };
    expect(run()).toBe(run());
  });
});
