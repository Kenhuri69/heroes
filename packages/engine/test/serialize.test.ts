import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { createEmptyState, emptyResources } from '../src/core/state';
import {
  deserializeState,
  hashState,
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
});
