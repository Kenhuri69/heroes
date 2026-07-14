import { describe, expect, it } from 'vitest';
import { placeSide } from '../src/combat/setup';
import { COMBAT_COLS, COMBAT_ROWS } from '../src/combat/hex';
import type { ArmyStack } from '../src/combat/types';

/**
 * B33 (plan code-review-performance) : `placeSide` produisait des collisions de
 * spawn dès n > COMBAT_ROWS piles d'un camp. Le débordement round-robin sur les
 * colonnes adjacentes garantit des positions distinctes pour tout n raisonnable,
 * SANS changer les positions pour n ≤ COMBAT_ROWS (golden préservé).
 */

function makeArmy(n: number): ArmyStack[] {
  return Array.from({ length: n }, (_, i) => ({ unitId: `u-${i}`, count: 1 }));
}

/** Formule historique (avant B33) — référence de non-régression pour n ≤ COMBAT_ROWS. */
function legacyRow(i: number, n: number): number {
  return Math.floor((i + 0.5) * (COMBAT_ROWS / n));
}

describe('placeSide — B33 (collisions de spawn)', () => {
  it('12 piles ⇒ 12 positions distinctes, dans les bornes du plateau', () => {
    for (const [col, side] of [
      [0, 'attacker'],
      [COMBAT_COLS - 1, 'defender'],
    ] as const) {
      const stacks = placeSide(side, makeArmy(12), {}, col);
      const keys = new Set(stacks.map((s) => `${s.pos.col},${s.pos.row}`));
      expect(keys.size).toBe(12);
      for (const s of stacks) {
        expect(s.pos.col).toBeGreaterThanOrEqual(0);
        expect(s.pos.col).toBeLessThan(COMBAT_COLS);
        expect(s.pos.row).toBeGreaterThanOrEqual(0);
        expect(s.pos.row).toBeLessThan(COMBAT_ROWS);
      }
    }
  });

  it('n ≤ 9 : positions identiques à la formule historique (golden)', () => {
    for (let n = 1; n <= 9; n++) {
      for (const [col, side] of [
        [0, 'attacker'],
        [COMBAT_COLS - 1, 'defender'],
      ] as const) {
        const stacks = placeSide(side, makeArmy(n), {}, col);
        stacks.forEach((s, i) => {
          expect(s.pos).toEqual({ col, row: legacyRow(i, n) });
        });
      }
    }
  });

  it('le débordement reste distinct et borné jusqu à un n déraisonnable', () => {
    const n = COMBAT_ROWS * 3; // 3 colonnes de débordement — bien au-delà du contenu actuel
    const stacks = placeSide('defender', makeArmy(n), {}, COMBAT_COLS - 1);
    const keys = new Set(stacks.map((s) => `${s.pos.col},${s.pos.row}`));
    expect(keys.size).toBe(n);
    for (const s of stacks) expect(s.pos.col).toBeGreaterThanOrEqual(COMBAT_COLS - 3);
  });
});
