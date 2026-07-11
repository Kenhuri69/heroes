import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyState, type GameState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { applyAction } from '../src/combat/actions';
import { hexBehind } from '../src/combat/hex';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import type { GameEvent } from '../src/core/events';
import { testConfig } from './fixtures';

/**
 * Lot A3d — `breathAttack` : une frappe de mêlée touche aussi la pile ennemie
 * DERRIÈRE la cible (prolongement du souffle). Damage [n,n] fixe.
 */

function unit(over: Partial<CombatUnitDef> & { id: string }): CombatUnitDef {
  return {
    groupId: `${over.id}-g`,
    nativeTerrain: 'swamp',
    stats: { hp: 100, attack: 5, defense: 5, damage: [10, 10], speed: 6 },
    abilities: [],
    ...over,
  };
}

function stack(
  partial: Pick<CombatStack, 'id' | 'side' | 'slot' | 'unitId' | 'count' | 'pos'> & Partial<CombatStack>,
): CombatStack {
  return {
    firstHp: 100, retaliationsLeft: 1, waited: false, defending: false, ammo: null, spellCharges: 0,
    marks: 0, immobilizedRounds: 0, transformed: false, symbiosisStacks: 0, acted: false, statuses: [],
    ...partial,
  };
}

function state(catalog: Record<string, CombatUnitDef>, stacks: CombatStack[]): GameState {
  const combat: CombatState = {
    terrain: 'grass', round: 1, obstacles: [], stacks, activeStackId: 'attacker-0',
    playerSide: 'attacker', heroId: null, guardianObjectId: null, townId: null, wallDefenseBonus: 0,
    finished: false, attackerHeroId: null, defenderHeroId: null, heroCastThisRound: false,
    heroAttackUsed: [], winner: null,
  };
  return { ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(), unitCatalog: catalog, combat };
}

const catalog = {
  dragon: unit({ id: 'dragon', stats: { hp: 200, attack: 5, defense: 5, damage: [10, 10], speed: 8 }, abilities: [{ id: 'breathAttack', params: { pct: 0.6 } }] }),
  foe: unit({ id: 'foe', stats: { hp: 1000, attack: 0, defense: 5, damage: [0, 0], speed: 1 } }),
};

const strikes = (events: GameEvent[]) =>
  events.filter((e) => e.type === 'StackAttacked') as Extract<GameEvent, { type: 'StackAttacked' }>[];

describe('hexBehind', () => {
  it('renvoie la case au prolongement du segment', () => {
    // Attaquant (2,5) → cible (3,5) ⇒ derrière = (4,5).
    expect(hexBehind({ col: 2, row: 5 }, { col: 3, row: 5 })).toEqual({ col: 4, row: 5 });
  });
});

describe('A3d — breathAttack', () => {
  it('touche la pile ennemie derrière la cible d’une fraction des dégâts', () => {
    // Dragon en (2,5) frappe la cible en (3,5) ; une pile ennemie est derrière en (4,5).
    const dragon = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'dragon', count: 1, pos: { col: 2, row: 5 }, firstHp: 200 });
    const target = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'foe', count: 1, pos: { col: 3, row: 5 }, firstHp: 1000 });
    const behind = stack({ id: 'defender-1', side: 'defender', slot: 1, unitId: 'foe', count: 1, pos: { col: 4, row: 5 }, firstHp: 1000 });
    const events: GameEvent[] = [];
    produce(state(catalog, [dragon, target, behind]), (draft) => {
      applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
    });
    const byTarget = new Map(strikes(events).map((s) => [s.targetId, s.damage]));
    expect(byTarget.get('defender-0')).toBe(10); // primaire
    expect(byTarget.get('defender-1')).toBe(6); // round(10 × 0,6)
  });

  it('rien derrière la cible : pas de souffle secondaire', () => {
    const dragon = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'dragon', count: 1, pos: { col: 2, row: 5 }, firstHp: 200 });
    // `retaliationsLeft: 0` ⇒ pas de riposte, on isole le compte de frappes.
    const target = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'foe', count: 1, pos: { col: 3, row: 5 }, firstHp: 1000, retaliationsLeft: 0 });
    const events: GameEvent[] = [];
    produce(state(catalog, [dragon, target]), (draft) => {
      applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
    });
    expect(strikes(events)).toHaveLength(1); // frappe primaire seule
  });

  it('ne touche pas un allié situé derrière la cible', () => {
    const dragon = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'dragon', count: 1, pos: { col: 2, row: 5 }, firstHp: 200 });
    const target = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'foe', count: 1, pos: { col: 3, row: 5 }, firstHp: 1000 });
    const allyBehind = stack({ id: 'attacker-1', side: 'attacker', slot: 1, unitId: 'foe', count: 1, pos: { col: 4, row: 5 }, firstHp: 1000 });
    const events: GameEvent[] = [];
    produce(state(catalog, [dragon, target, allyBehind]), (draft) => {
      applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
    });
    expect(strikes(events).map((s) => s.targetId)).not.toContain('attacker-1');
  });
});
