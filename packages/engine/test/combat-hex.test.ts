import { describe, expect, it } from 'vitest';
import { createEmptyState, type GameState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { attackableTargets, meleeOriginsFor } from '../src/combat/actions';
import {
  axialToOffset,
  hexDistance,
  hexNeighbors,
  hexRound,
  inCombatBounds,
  offsetToAxial,
  sameHex,
  COMBAT_COLS,
  COMBAT_ROWS,
} from '../src/combat/hex';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import { testConfig } from './fixtures';

// Couverture directe de la géométrie hex (aucun test dédié jusqu'ici,
// remédiation CL9) + des helpers de ciblage partagés avec le client.

describe('combat/hex — géométrie', () => {
  it('offsetToAxial ∘ axialToOffset = identité', () => {
    for (let row = 0; row < COMBAT_ROWS; row++) {
      for (let col = 0; col < COMBAT_COLS; col++) {
        const p = { col, row };
        expect(axialToOffset(offsetToAxial(p))).toEqual(p);
      }
    }
  });

  it('hexDistance : 0 sur place, 1 entre voisins', () => {
    const p = { col: 3, row: 4 };
    expect(hexDistance(p, p)).toBe(0);
    for (const n of hexNeighbors(p)) expect(hexDistance(p, n)).toBe(1);
  });

  it('hexNeighbors : 6 voisins au centre, tronqué aux bords', () => {
    expect(hexNeighbors({ col: 5, row: 5 })).toHaveLength(6);
    expect(hexNeighbors({ col: 0, row: 0 }).length).toBeLessThan(6);
    for (const n of hexNeighbors({ col: 0, row: 0 })) expect(inCombatBounds(n)).toBe(true);
  });

  it('inCombatBounds : dedans / dehors', () => {
    expect(inCombatBounds({ col: 0, row: 0 })).toBe(true);
    expect(inCombatBounds({ col: COMBAT_COLS - 1, row: COMBAT_ROWS - 1 })).toBe(true);
    expect(inCombatBounds({ col: -1, row: 0 })).toBe(false);
    expect(inCombatBounds({ col: COMBAT_COLS, row: 0 })).toBe(false);
  });

  it('sameHex', () => {
    expect(sameHex({ col: 2, row: 3 }, { col: 2, row: 3 })).toBe(true);
    expect(sameHex({ col: 2, row: 3 }, { col: 2, row: 4 })).toBe(false);
  });

  it('hexRound : q + r + s = 0 (arrondi cubique valide)', () => {
    const { q, r } = hexRound(1.2, -0.7);
    expect(q + r + (-q - r)).toBe(0);
    expect(Number.isInteger(q) && Number.isInteger(r)).toBe(true);
  });
});

// --- Fixtures minimales de combat (mêmes conventions que combat-validation) ---

function unit(id: string): CombatUnitDef {
  return {
    id,
    groupId: `${id}-group`,
    nativeTerrain: 'swamp',
    stats: { hp: 10, attack: 5, defense: 5, damage: [1, 2], speed: 5 },
    abilities: [],
  };
}

function stack(
  partial: Pick<CombatStack, 'id' | 'side' | 'slot' | 'unitId' | 'count' | 'pos'> & Partial<CombatStack>,
): CombatStack {
  return {
    firstHp: 10,
    retaliationsLeft: 1,
    waited: false,
    defending: false,
    ammo: null,
    marks: 0,
    immobilizedRounds: 0,
    transformed: false,
    symbiosisStacks: 0,
    acted: false,
    statuses: [],
    ...partial,
  };
}

function manualState(stacks: CombatStack[], activeStackId: string): GameState {
  const combat: CombatState = {
    terrain: 'grass',
    round: 1,
    obstacles: [],
    stacks,
    activeStackId,
    playerSide: 'attacker',
    heroId: null,
    guardianObjectId: null,
    townId: null,
    wallDefenseBonus: 0,
    finished: false,
    attackerHeroId: null,
    defenderHeroId: null,
    heroCastThisRound: false,
    heroAttackUsed: [],
    winner: null,
  };
  return {
    ...createEmptyState(),
    started: true,
    rng: seedRng(1),
    config: testConfig(),
    unitCatalog: { atk: unit('atk'), def: unit('def') },
    combat,
  };
}

describe('attackableTargets (CL9)', () => {
  it('mêlée : seule la cible adjacente ou atteignable est attaquable', () => {
    const attacker = stack({ id: 'a0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 1, row: 0 } });
    const near = stack({ id: 'd0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 2, row: 0 } });
    const far = stack({ id: 'd1', side: 'defender', slot: 1, unitId: 'def', count: 1, pos: { col: 11, row: 9 } });
    const ids = attackableTargets(manualState([attacker, near, far], 'a0'), 'a0').map((s) => s.id);
    expect(ids).toContain('d0');
    expect(ids).not.toContain('d1');
  });

  it('ne cible ni les alliés ni les piles mortes', () => {
    const attacker = stack({ id: 'a0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 1, row: 0 } });
    const ally = stack({ id: 'a1', side: 'attacker', slot: 1, unitId: 'atk', count: 1, pos: { col: 2, row: 0 } });
    const dead = stack({ id: 'd0', side: 'defender', slot: 0, unitId: 'def', count: 0, pos: { col: 0, row: 0 } });
    const ids = attackableTargets(manualState([attacker, ally, dead], 'a0'), 'a0').map((s) => s.id);
    expect(ids).toEqual([]);
  });

  it('tireur (munitions, aucun ennemi adjacent) : toutes les cibles vivantes', () => {
    const shooter = stack({ id: 'a0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, ammo: 5, pos: { col: 0, row: 0 } });
    const e1 = stack({ id: 'd0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 6, row: 4 } });
    const e2 = stack({ id: 'd1', side: 'defender', slot: 1, unitId: 'def', count: 1, pos: { col: 11, row: 9 } });
    const ids = attackableTargets(manualState([shooter, e1, e2], 'a0'), 'a0').map((s) => s.id);
    expect(ids.sort()).toEqual(['d0', 'd1']);
  });
});

describe('meleeOriginsFor (CL9)', () => {
  it('déjà adjacent : la pile reste sur place', () => {
    const attacker = stack({ id: 'a0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 1, row: 0 } });
    const target = stack({ id: 'd0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 2, row: 0 } });
    expect(meleeOriginsFor(manualState([attacker, target], 'a0'), 'a0', 'd0')).toEqual([{ col: 1, row: 0 }]);
  });

  it('cible distante : des hex atteignables adjacents à la cible', () => {
    const attacker = stack({ id: 'a0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 } });
    const target = stack({ id: 'd0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 3, row: 0 } });
    const origins = meleeOriginsFor(manualState([attacker, target], 'a0'), 'a0', 'd0');
    expect(origins.length).toBeGreaterThan(0);
    for (const o of origins) expect(hexDistance(o, { col: 3, row: 0 })).toBe(1);
  });
});
