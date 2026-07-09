import { describe, expect, it } from 'vitest';
import { roundActionOrder } from '../src/combat/state-helpers';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import { testCatalog } from './fixtures';

/**
 * Projection de l'ordre de passage (lot UX M1, doc 08 §2.4) : même tri que
 * `pickNext` (vague normale décroissante, attente croissante, départages
 * camp attaquant puis slot) — la 1ʳᵉ entrée est la pile active.
 */

function stack(over: Partial<CombatStack> & Pick<CombatStack, 'id' | 'side' | 'slot' | 'unitId'>): CombatStack {
  return {
    count: 10,
    firstHp: 6,
    pos: { col: 0, row: over.slot },
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
    ...over,
  };
}

function combatWith(stacks: CombatStack[]): CombatState {
  return {
    terrain: 'dirt', // aucun terrain natif du catalogue de test : vitesses pures
    round: 1,
    obstacles: [],
    stacks,
    activeStackId: stacks[0]?.id ?? null,
    playerSide: 'attacker',
    heroId: null,
    guardianObjectId: null,
    townId: null,
    wallDefenseBonus: 0,
    attackerHeroId: null,
    defenderHeroId: null,
    heroCastThisRound: false,
    heroAttackUsed: [],
    finished: false,
    winner: null,
  };
}

describe('roundActionOrder', () => {
  const catalog: Record<string, CombatUnitDef> = testCatalog();
  // vitesses du catalogue de test : blue-wolf 6 > red-archer 5 > red-grunt 4

  it('trie la vague normale par vitesse décroissante, départage attaquant puis slot', () => {
    const combat = combatWith([
      stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'red-grunt' }),
      stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'blue-wolf' }),
      stack({ id: 'defender-1', side: 'defender', slot: 1, unitId: 'red-grunt' }),
      stack({ id: 'attacker-1', side: 'attacker', slot: 1, unitId: 'red-archer' }),
    ]);
    const order = roundActionOrder(combat, catalog).current.map((s) => s.id);
    // wolf (6), archer (5), puis les deux grunts (4) : attaquant avant défenseur
    expect(order).toEqual(['defender-0', 'attacker-1', 'attacker-0', 'defender-1']);
  });

  it('place les piles en attente en fin de round, par vitesse croissante', () => {
    const combat = combatWith([
      stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'red-grunt' }),
      stack({ id: 'attacker-1', side: 'attacker', slot: 1, unitId: 'blue-wolf', waited: true }),
      stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'red-archer', waited: true }),
    ]);
    const order = roundActionOrder(combat, catalog).current.map((s) => s.id);
    // vague normale : grunt ; attente croissante : archer (5) avant wolf (6)
    expect(order).toEqual(['attacker-0', 'defender-0', 'attacker-1']);
  });

  it('exclut les piles ayant agi du round courant mais les garde dans la projection du suivant', () => {
    const combat = combatWith([
      stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'blue-wolf', acted: true }),
      stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'red-grunt' }),
    ]);
    const { current, next } = roundActionOrder(combat, catalog);
    expect(current.map((s) => s.id)).toEqual(['defender-0']);
    expect(next.map((s) => s.id)).toEqual(['attacker-0', 'defender-0']);
  });

  it('applique les modificateurs de vitesse des statuts (Hâte/Lenteur)', () => {
    const haste = { spellId: 'hate', attackMod: 0, defenseMod: 0, speedMod: 3, roundsLeft: 2 };
    const combat = combatWith([
      stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'red-grunt', statuses: [haste] }), // 4+3=7
      stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'blue-wolf' }), // 6
    ]);
    const order = roundActionOrder(combat, catalog).current.map((s) => s.id);
    expect(order).toEqual(['attacker-0', 'defender-0']);
  });

  it('rend des listes vides sur un combat terminé', () => {
    const combat = { ...combatWith([stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'red-grunt' })]), finished: true };
    expect(roundActionOrder(combat, catalog)).toEqual({ current: [], next: [] });
  });
});
