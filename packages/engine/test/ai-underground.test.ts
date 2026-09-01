import { produce } from 'immer';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { Command } from '../src/core/commands';
import type { GameEvent } from '../src/core/events';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { runAiTurn } from '../src/ai/adventure';
import { levelOf, type AdventureMapDef } from '../src/adventure/map';
import { testCatalog, testConfig, testMap } from './fixtures';

/**
 * L10.5 — l'IA emprunte les escaliers. Rien dans le moteur ne connaît la notion
 * d'escalier : c'est une paire de monolithes dont les extrémités changent de
 * couche. L'IA gagne UNE cible d'exploration de plus — une bouche de téléporteur
 * dont la couche d'arrivée garde des tuiles sous le brouillard.
 */

const CATALOG = testCatalog();
const config = testConfig();

/** Carte 10×10 à deux couches : prairie en surface, caverne praticable dessous. */
function twoLevelMap(): AdventureMapDef {
  const base = testMap();
  const size = base.width * base.height;
  const surface = new Array<string>(size).fill('grass');
  const cave = new Array<string>(size).fill('grass');
  return {
    ...base,
    levels: 2,
    terrain: [...surface, ...cave],
    road: new Array<boolean>(size * 2).fill(false),
    objects: [
      { id: 'stair-s', type: 'monolith', pos: { x: 5, y: 5 }, pairId: 'stair' },
      { id: 'stair-u', type: 'monolith', pos: { x: 5, y: 5, level: 1 }, pairId: 'stair' },
    ],
  };
}

function state(map: AdventureMapDef, seed = 1): GameState {
  const cmd: Command = {
    type: 'StartGame',
    seed,
    players: [
      { id: 'p1', startingResources: emptyResources(), controller: 'ai' },
      { id: 'p2', startingResources: emptyResources(), controller: 'ai' },
    ],
    map,
    config,
    unitCatalog: CATALOG,
    towns: [],
  };
  return apply(createEmptyState(), cmd).state;
}

function playAi(s: GameState, playerId = 'p1'): GameState {
  const events: GameEvent[] = [];
  return produce(s, (draft) => {
    runAiTurn(draft, playerId, events);
  });
}

/** Surface entièrement connue, souterrain encore sous le brouillard. */
function revealSurface(draft: GameState, playerId: string): void {
  const player = draft.players.find((p) => p.id === playerId);
  const map = draft.map;
  if (!player || !map) throw new Error('état incomplet');
  const size = map.width * map.height;
  player.explored = player.explored.map((v, i) => (i < size ? 1 : v));
}

describe('IA — téléporteur vers une couche inexplorée', () => {
  it('descend par l’escalier quand sa couche n’a plus rien à explorer', () => {
    let s = state(twoLevelMap());
    s = produce(s, (draft) => {
      revealSurface(draft, 'p1');
      const mine = draft.heroes.find((h) => h.playerId === 'p1');
      const foe = draft.heroes.find((h) => h.playerId === 'p2');
      if (!mine || !foe) throw new Error('héros absents');
      mine.pos = { x: 4, y: 5 }; // à un pas de la bouche
      mine.army = [{ unitId: 'blue-wolf', count: 10 }];
      foe.pos = { x: 9, y: 9 };
      foe.army = [{ unitId: 'blue-wolf', count: 200 }]; // trop fort : pas une proie
    });

    const hero = playAi(s).heroes.find((h) => h.playerId === 'p1');
    expect(levelOf(hero!.pos)).toBe(1);
    expect(hero!.pos).toMatchObject({ x: 5, y: 5 });
  });

  it('ignore l’escalier tant que sa propre couche garde de l’inexploré', () => {
    let s = state(twoLevelMap());
    s = produce(s, (draft) => {
      const mine = draft.heroes.find((h) => h.playerId === 'p1');
      const foe = draft.heroes.find((h) => h.playerId === 'p2');
      if (!mine || !foe) throw new Error('héros absents');
      // Surface volontairement NON révélée : l'exploration locale prime.
      mine.pos = { x: 4, y: 5 };
      mine.army = [{ unitId: 'blue-wolf', count: 10 }];
      foe.pos = { x: 9, y: 9 };
      foe.army = [{ unitId: 'blue-wolf', count: 200 }];
    });

    const hero = playAi(s).heroes.find((h) => h.playerId === 'p1');
    expect(levelOf(hero!.pos)).toBe(0);
  });

  it('ne descend pas non plus si le souterrain est déjà entièrement connu', () => {
    let s = state(twoLevelMap());
    s = produce(s, (draft) => {
      const player = draft.players.find((p) => p.id === 'p1');
      if (player) player.explored = player.explored.map(() => 1);
      const mine = draft.heroes.find((h) => h.playerId === 'p1');
      const foe = draft.heroes.find((h) => h.playerId === 'p2');
      if (!mine || !foe) throw new Error('héros absents');
      mine.pos = { x: 4, y: 5 };
      mine.army = [{ unitId: 'blue-wolf', count: 10 }];
      foe.pos = { x: 9, y: 9 };
      foe.army = [{ unitId: 'blue-wolf', count: 200 }];
    });

    const hero = playAi(s).heroes.find((h) => h.playerId === 'p1');
    expect(levelOf(hero!.pos)).toBe(0);
  });
});

/**
 * Property : la boucle IA vs IA ne se bloque pas sur une carte à deux couches
 * (le voyage inter-couches est un téléport, pas un pas — c'est exactement le
 * genre d'endroit où une boucle d'exploration part en vrille). On exige aussi
 * qu'au moins une graine mène réellement l'IA sous terre : sans quoi la
 * property passerait « verte » avec des escaliers jamais empruntés.
 */
describe('IA vs IA sur une carte à deux couches', () => {
  it(
    'se termine sans throw, et le souterrain finit par être visité',
    () => {
      let wentUnder = false;
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 2 ** 31 - 1 }), (seed) => {
          let s = state(twoLevelMap(), seed);
          for (let turn = 0; turn < 40 && !s.outcome; turn++) {
            const current = s.players[s.currentPlayer];
            if (!current) break;
            const events: GameEvent[] = [];
            s = produce(s, (draft) => {
              runAiTurn(draft, current.id, events);
            });
            if (s.heroes.some((h) => levelOf(h.pos) === 1)) wentUnder = true;
            s = apply(s, { type: 'EndTurn', playerId: current.id }).state;
          }
          for (const hero of s.heroes) expect(hero.army.length).toBeLessThanOrEqual(7);
        }),
        { numRuns: 5 },
      );
      expect(wentUnder).toBe(true);
    },
    20_000,
  );
});
