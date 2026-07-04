import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { Command } from '../src/core/commands';
import { createEmptyState, emptyResources } from '../src/core/state';
import { hashState } from '../src/core/serialize';

/**
 * Golden test de replay (doc 07 §7) : une partie scriptée est rejouée à chaque
 * commit ; toute divergence de simulation (RNG non seedé, règle modifiée par
 * accident, ordre d'itération instable…) casse ce test.
 *
 * Si une évolution VOULUE des règles change le hash : mettre à jour la valeur
 * dans le même commit, en l'expliquant dans le message.
 */
const GOLDEN_JOURNAL: Command[] = [
  {
    type: 'StartGame',
    seed: 20260704,
    players: [
      {
        id: 'player-red',
        startingResources: { ...emptyResources(), gold: 2500, wood: 5, ore: 5 },
      },
      {
        id: 'player-blue',
        startingResources: { ...emptyResources(), gold: 2500, wood: 5, ore: 5 },
      },
    ],
  },
  // 10 jours complets à 2 joueurs — traverse un début de semaine (jour 8)
  ...Array.from(
    { length: 20 },
    (_, i): Command => ({
      type: 'EndTurn',
      playerId: i % 2 === 0 ? 'player-red' : 'player-blue',
    }),
  ),
];

const GOLDEN_HASH = 'bb81d9db';

describe('golden replay', () => {
  it('le journal scripté produit toujours le même état final', () => {
    let state = createEmptyState();
    for (const cmd of GOLDEN_JOURNAL) state = apply(state, cmd).state;
    expect(state.calendar.day).toBe(11);
    expect(hashState(state)).toBe(GOLDEN_HASH);
  });
});
