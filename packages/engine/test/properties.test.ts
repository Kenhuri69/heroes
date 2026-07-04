import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, weekOf, type GameState } from '../src/core/state';
import { nextU32, seedRng } from '../src/core/rng';
import { hashState } from '../src/core/serialize';

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
  return apply(createEmptyState(), { type: 'StartGame', seed, players }).state;
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
