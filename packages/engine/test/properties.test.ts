import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import { findPath, isPassable } from '../src/adventure/path';
import type { Command, PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, weekOf, type GameState } from '../src/core/state';
import { nextU32, seedRng } from '../src/core/rng';
import { hashState } from '../src/core/serialize';
import { testConfig, testMap } from './fixtures';

const arbSeed = fc.integer({ min: 0, max: 2 ** 31 - 1 });
const arbPlayerIds = fc.uniqueArray(fc.string({ minLength: 1, maxLength: 8 }), {
  minLength: 1,
  maxLength: 8,
});

function start(seed: number, ids: string[]): GameState {
  const players: PlayerSetup[] = ids.map((id) => ({
    id,
    startingResources: emptyResources(),
  }));
  return apply(createEmptyState(), {
    type: 'StartGame',
    seed,
    players,
    map: testMap(),
    config: testConfig(),
  }).state;
}

/** Joue N tours dans l'ordre légal et retourne l'état final. */
function playTurns(state: GameState, turns: number): GameState {
  let s = state;
  for (let i = 0; i < turns; i++) {
    const current = s.players[s.currentPlayer];
    if (!current) throw new Error('joueur courant invalide');
    const cmd: Command = { type: 'EndTurn', playerId: current.id };
    s = apply(s, cmd).state;
  }
  return s;
}

describe('propriétés du moteur', () => {
  it('replay déterministe : même seed + mêmes commandes ⇒ même hash final', () => {
    fc.assert(
      fc.property(arbSeed, arbPlayerIds, fc.integer({ min: 0, max: 60 }), (seed, ids, turns) => {
        const a = playTurns(start(seed, ids), turns);
        const b = playTurns(start(seed, ids), turns);
        expect(hashState(a)).toBe(hashState(b));
      }),
    );
  });

  it('calendrier : après T tours, jour = 1 + floor(T / nbJoueurs), semaine cohérente', () => {
    fc.assert(
      fc.property(arbSeed, arbPlayerIds, fc.integer({ min: 0, max: 100 }), (seed, ids, turns) => {
        const s = playTurns(start(seed, ids), turns);
        const expectedDay = 1 + Math.floor(turns / ids.length);
        expect(s.calendar.day).toBe(expectedDay);
        expect(weekOf(s.calendar.day)).toBe(Math.floor((expectedDay - 1) / 7) + 1);
      }),
    );
  });

  it('apply ne mute jamais son entrée, quel que soit l’enchaînement', () => {
    fc.assert(
      fc.property(arbSeed, arbPlayerIds, fc.integer({ min: 1, max: 30 }), (seed, ids, turns) => {
        let s = start(seed, ids);
        for (let i = 0; i < turns; i++) {
          const current = s.players[s.currentPlayer];
          if (!current) throw new Error('joueur courant invalide');
          const before = JSON.stringify(s);
          const next = apply(s, { type: 'EndTurn', playerId: current.id }).state;
          expect(JSON.stringify(s)).toBe(before);
          s = next;
        }
      }),
    );
  });

  it('mouvement : parcours aléatoires ⇒ points ≥ 0, héros sur tuile franchissable, or ≥ 0', () => {
    const config = testConfig();
    const map = testMap();
    const arbTargets = fc.array(
      fc.record({
        x: fc.integer({ min: 0, max: map.width - 1 }),
        y: fc.integer({ min: 0, max: map.height - 1 }),
      }),
      { minLength: 1, maxLength: 20 },
    );
    fc.assert(
      fc.property(arbSeed, arbTargets, (seed, targets) => {
        let s = start(seed, ['p1']);
        for (const target of targets) {
          const hero = s.heroes[0];
          if (!hero) throw new Error('héros absent');
          const path = findPath(config, map, hero.pos, target);
          const cmd: Command =
            path && validate(s, { type: 'MoveHero', heroId: hero.id, path }) === null
              ? { type: 'MoveHero', heroId: hero.id, path }
              : { type: 'EndTurn', playerId: 'p1' };
          s = apply(s, cmd).state;
          const h = s.heroes[0];
          if (!h) throw new Error('héros absent');
          expect(h.movementPoints).toBeGreaterThanOrEqual(0);
          expect(isPassable(config, map, h.pos)).toBe(true);
          for (const p of s.players) expect(p.resources.gold).toBeGreaterThanOrEqual(0);
        }
      }),
    );
  });

  it('RNG : la séquence ne dépend que de l’état, jamais du contexte d’appel', () => {
    fc.assert(
      fc.property(arbSeed, fc.integer({ min: 1, max: 200 }), (seed, n) => {
        let s = seedRng(seed);
        for (let i = 0; i < n; i++) s = nextU32(s).state;
        // reprendre depuis un état sérialisé ⇒ même suite
        const resumed = JSON.parse(JSON.stringify(s)) as typeof s;
        expect(nextU32(resumed).value).toBe(nextU32(s).value);
      }),
    );
  });
});
