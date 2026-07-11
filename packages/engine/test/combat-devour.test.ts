import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyState, type GameState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { applyAction } from '../src/combat/actions';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import type { GameEvent } from '../src/core/events';
import { testConfig } from './fixtures';

/**
 * Lot A2d — `devourMarks` (Pénitent) : sur une frappe volontaire, dévore TOUTES
 * les Marques du champ (+`perMark`/charge de dégâts) puis soigne le striker de
 * `healPerMark` par charge. Damage [n,n] fixe.
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
  penitent: unit({ id: 'penitent', stats: { hp: 200, attack: 5, defense: 5, damage: [10, 10], speed: 6 }, abilities: [{ id: 'devourMarks', params: { perMark: 0.02, healPerMark: 2 } }] }),
  foe: unit({ id: 'foe', stats: { hp: 1000, attack: 0, defense: 5, damage: [0, 0], speed: 1 } }),
};

describe('A2d — devourMarks', () => {
  it('dévore toutes les Marques du champ, +perMark/charge de dégâts, et se soigne', () => {
    // 5 charges au total : cible 3 + un autre ennemi 2.
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'penitent', count: 1, pos: { col: 0, row: 0 }, firstHp: 100 });
    const target = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'foe', count: 1, pos: { col: 1, row: 0 }, firstHp: 1000, marks: 3 });
    const other = stack({ id: 'defender-1', side: 'defender', slot: 1, unitId: 'foe', count: 1, pos: { col: 5, row: 5 }, firstHp: 1000, marks: 2 });
    const events: GameEvent[] = [];
    const next = produce(state(catalog, [attacker, target, other]), (draft) => {
      applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
    });
    // 5 charges → devourBonus 0,10 ; la cible marquée (3) ajoute aussi +0,24 (markBonusPerStack 0,08×3).
    // base 10 × (1 + 0,24) × (1 + 0,10) = 10 × 1,24 × 1,10 = 13,64 → 14.
    const strike = events.find((e) => e.type === 'StackAttacked') as Extract<GameEvent, { type: 'StackAttacked' }>;
    expect(strike.damage).toBe(14);
    // Toutes les Marques du champ sont dévorées (0 partout).
    expect(next.combat?.stacks.find((s) => s.id === 'defender-0')?.marks).toBe(0);
    expect(next.combat?.stacks.find((s) => s.id === 'defender-1')?.marks).toBe(0);
    expect(events).toContainEqual({ type: 'MarksDevoured', strikerId: 'attacker-0', consumed: 5 });
    // Soin : le striker (200 PV, 1 créature à 100/200) gagne 5×2 = 10 PV → firstHp 110.
    expect(next.combat?.stacks.find((s) => s.id === 'attacker-0')?.firstHp).toBe(110);
  });

  it('aucune Marque sur le champ : pas de bonus, pas d’event MarksDevoured', () => {
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'penitent', count: 1, pos: { col: 0, row: 0 }, firstHp: 100 });
    const target = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'foe', count: 1, pos: { col: 1, row: 0 }, firstHp: 1000 });
    const events: GameEvent[] = [];
    produce(state(catalog, [attacker, target]), (draft) => {
      applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
    });
    const strike = events.find((e) => e.type === 'StackAttacked') as Extract<GameEvent, { type: 'StackAttacked' }>;
    expect(strike.damage).toBe(10); // diff 0, aucune marque
    expect(events.some((e) => e.type === 'MarksDevoured')).toBe(false);
  });
});
