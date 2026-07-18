import { describe, expect, it } from 'vitest';
import { placeSide } from '../src/combat/setup';
import { COMBAT_COLS, COMBAT_ROWS } from '../src/combat/hex';
import type { ArmyStack, CombatUnitDef } from '../src/combat/types';

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

/**
 * S5b (plan siege-visual-remediation, audit doc 19 §2.5) : une machine de guerre
 * (`warMachine`) est placée HORS formation, en fin de colonne de départ — jamais
 * dans la colonne de front (avant : le chariot débordait en 1ʳᵉ ligne). Décision
 * GÉNÉRIQUE par capacité, aucun id d'unité en dur.
 */
describe('placeSide — S5b (machines de guerre hors formation)', () => {
  const machineDef = (id: string): CombatUnitDef =>
    ({ id, groupId: 'wm', nativeTerrain: '', stats: { hp: 100, attack: 0, defense: 10, damage: [1, 1], speed: 1 }, abilities: [{ id: 'warMachine' }] }) as CombatUnitDef;
  const troopDef = (id: string): CombatUnitDef =>
    ({ id, groupId: 'g', nativeTerrain: '', stats: { hp: 10, attack: 5, defense: 5, damage: [1, 2], speed: 4 }, abilities: [] }) as CombatUnitDef;

  it('7 créatures + 4 machines ⇒ aucune machine hors colonne de départ, positions distinctes', () => {
    const creatures: ArmyStack[] = Array.from({ length: 7 }, (_, i) => ({ unitId: `c-${i}`, count: 10 }));
    const machines: ArmyStack[] = ['catapult', 'ballista', 'tent', 'cart'].map((id) => ({ unitId: id, count: 1 }));
    const army = [...creatures, ...machines];
    const catalog: Record<string, CombatUnitDef> = {};
    for (const c of creatures) catalog[c.unitId] = troopDef(c.unitId);
    for (const m of machines) catalog[m.unitId] = machineDef(m.unitId);

    for (const [col, side] of [
      [0, 'attacker'],
      [COMBAT_COLS - 1, 'defender'],
    ] as const) {
      const stacks = placeSide(side, army, catalog, col);
      const machineIds = new Set(machines.map((m) => m.unitId));
      const machineStacks = stacks.filter((s) => machineIds.has(s.unitId));
      // Toutes les machines restent dans la colonne de départ (jamais en front).
      expect(machineStacks).toHaveLength(4);
      for (const s of machineStacks) expect(s.pos.col).toBe(col);
      // Positions toutes distinctes et dans les bornes (aucune collision).
      const keys = new Set(stacks.map((s) => `${s.pos.col},${s.pos.row}`));
      expect(keys.size).toBe(army.length);
      for (const s of stacks) {
        expect(s.pos.row).toBeGreaterThanOrEqual(0);
        expect(s.pos.row).toBeLessThan(COMBAT_ROWS);
      }
      // Les ids/slots restent indexés sur l'armée (ordre inchangé).
      stacks.forEach((s, i) => expect(s.slot).toBe(i));
    }
  });

  it('armée SANS machine mais catalogue peuplé ⇒ formule historique (no-op, golden)', () => {
    const army: ArmyStack[] = Array.from({ length: 6 }, (_, i) => ({ unitId: `c-${i}`, count: 10 }));
    const catalog: Record<string, CombatUnitDef> = {};
    for (const c of army) catalog[c.unitId] = troopDef(c.unitId);
    const stacks = placeSide('attacker', army, catalog, 0);
    stacks.forEach((s, i) => {
      expect(s.pos).toEqual({ col: 0, row: legacyRow(i, army.length) });
    });
  });
});
