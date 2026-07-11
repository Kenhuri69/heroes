import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyState, type GameState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { applyAction } from '../src/combat/actions';
import { estimateDamage } from '../src/combat/damage';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import type { GameEvent } from '../src/core/events';
import { testConfig } from './fixtures';

/**
 * Lot A3b — `swarm` : +`bonus`/créature quand ≥ `minAllies` autres piles alliées
 * de l'attaquant sont adjacentes à la cible. Damage [n,n] fixe.
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
  swarmer: unit({ id: 'swarmer', stats: { hp: 100, attack: 5, defense: 5, damage: [10, 10], speed: 6 }, abilities: [{ id: 'swarm', params: { bonus: 1, minAllies: 2 } }] }),
  ally: unit({ id: 'ally', stats: { hp: 100, attack: 5, defense: 5, damage: [1, 1], speed: 5 } }),
  def: unit({ id: 'def', stats: { hp: 1000, attack: 0, defense: 5, damage: [0, 0], speed: 1 } }),
};

/** Cible en (5,5) ; l'attaquant frappe depuis (4,5) (adjacent). `alliesAround` autres alliés adjacents. */
function scenario(alliesAround: number): GameState {
  const target = { col: 5, row: 5 };
  const around = [
    { col: 6, row: 5 }, { col: 5, row: 4 }, { col: 5, row: 6 },
  ];
  const stacks: CombatStack[] = [
    stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'swarmer', count: 3, pos: { col: 4, row: 5 } }),
    stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: target, firstHp: 1000 }),
  ];
  for (let i = 0; i < alliesAround; i++) {
    stacks.push(stack({ id: `ally-${i}`, side: 'attacker', slot: i + 1, unitId: 'ally', count: 1, pos: around[i] as { col: number; row: number } }));
  }
  return state(catalog, stacks);
}

function strikeDamage(s: GameState): number {
  const events: GameEvent[] = [];
  produce(s, (draft) => {
    applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
  });
  const strike = events.find((e) => e.type === 'StackAttacked') as Extract<GameEvent, { type: 'StackAttacked' }>;
  return strike.damage;
}

describe('A3b — swarm', () => {
  it('≥ 2 alliés adjacents à la cible : +bonus/créature (3 créatures → +3)', () => {
    // base 3×10 = 30 ; swarm 3×1 = +3 → 33 (diff 0, mult 1).
    expect(strikeDamage(scenario(2))).toBe(33);
  });

  it('1 seul allié adjacent : condition non remplie, pas de bonus', () => {
    expect(strikeDamage(scenario(1))).toBe(30);
  });

  it('estimateDamage reflète le bonus de meute', () => {
    const est = estimateDamage(scenario(2), 'attacker-0', 'defender-0');
    expect(est.damageMin).toBe(33);
    expect(est.damageMax).toBe(33);
  });

  it('sans la capacité swarm : aucun bonus même entouré', () => {
    const plainCatalog = { ...catalog, swarmer: unit({ id: 'swarmer', stats: { hp: 100, attack: 5, defense: 5, damage: [10, 10], speed: 6 } }) };
    const s = scenario(2);
    s.unitCatalog = plainCatalog;
    expect(strikeDamage(s)).toBe(30);
  });
});
