import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyState, type GameState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { applyAction } from '../src/combat/actions';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import type { GameEvent } from '../src/core/events';
import { testConfig } from './fixtures';

/**
 * Lot A2b — `incorporeal` (esquive) et `strikeAndReturn` (frappe-retour).
 * Damage [n,n] déterministe ; esquive testée avec `dodge:1` (toujours).
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
    firstHp: 100,
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

function combatState(stacks: CombatStack[]): CombatState {
  return {
    terrain: 'grass',
    round: 1,
    obstacles: [],
    stacks,
    activeStackId: stacks[0]?.id ?? null,
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
}

function state(catalog: Record<string, CombatUnitDef>, stacks: CombatStack[]): GameState {
  return { ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(), unitCatalog: catalog, combat: combatState(stacks) };
}

const strikes = (events: GameEvent[]) =>
  events.filter((e) => e.type === 'StackAttacked') as Extract<GameEvent, { type: 'StackAttacked' }>[];

describe('A2b — incorporeal', () => {
  it('esquive (dodge 1) : dégâts 0, event.dodged, aucune Marque posée', () => {
    const catalog = {
      atk: unit({ id: 'atk', stats: { hp: 100, attack: 5, defense: 5, damage: [10, 10], speed: 6 }, abilities: [{ id: 'mark' }] }),
      def: unit({ id: 'def', stats: { hp: 1000, attack: 0, defense: 5, damage: [0, 0], speed: 1 }, abilities: [{ id: 'incorporeal', params: { dodge: 1 } }] }),
    };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 }, firstHp: 100 });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 }, firstHp: 1000 });
    const events: GameEvent[] = [];
    const next = produce(state(catalog, [attacker, defender]), (draft) => {
      applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
    });
    const strike = strikes(events)[0];
    expect(strike?.damage).toBe(0);
    expect(strike?.dodged).toBe(true);
    expect(strike?.kills).toBe(0);
    // Aucune Marque appliquée sur une frappe esquivée.
    expect(next.combat?.stacks.find((s) => s.id === 'defender-0')?.marks).toBe(0);
    expect(events.some((e) => e.type === 'MarkApplied')).toBe(false);
  });

  it('sans esquive (pas d’incorporeal) : frappe normale, dodged false', () => {
    const catalog = {
      atk: unit({ id: 'atk', stats: { hp: 100, attack: 5, defense: 5, damage: [10, 10], speed: 6 } }),
      def: unit({ id: 'def', stats: { hp: 1000, attack: 0, defense: 5, damage: [0, 0], speed: 1 } }),
    };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 }, firstHp: 100 });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 }, firstHp: 1000 });
    const events: GameEvent[] = [];
    produce(state(catalog, [attacker, defender]), (draft) => {
      applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
    });
    const strike = strikes(events)[0];
    expect(strike?.damage).toBe(10);
    expect(strike?.dodged).toBe(false);
  });
});

describe('A2b — strikeAndReturn', () => {
  it('frappe puis retour à l’origine, aucune riposte essuyée', () => {
    const catalog = {
      atk: unit({ id: 'atk', stats: { hp: 100, attack: 5, defense: 5, damage: [10, 10], speed: 6 }, abilities: [{ id: 'strikeAndReturn' }] }),
      // Défenseur dangereux : riposterait fort s'il le pouvait.
      def: unit({ id: 'def', stats: { hp: 1000, attack: 20, defense: 5, damage: [10, 10], speed: 1 } }),
    };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 }, firstHp: 100 });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 4, row: 0 }, firstHp: 1000 });
    const events: GameEvent[] = [];
    const next = produce(state(catalog, [attacker, defender]), (draft) => {
      applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0', from: { col: 3, row: 0 } });
    });
    // 1 seule frappe (celle de l'attaquant), aucune riposte.
    const list = strikes(events);
    expect(list).toHaveLength(1);
    expect(list[0]?.retaliation).toBe(false);
    // L'attaquant est revenu à sa case d'origine et n'a pas perdu de PV.
    const strikerAfter = next.combat?.stacks.find((s) => s.id === 'attacker-0');
    expect(strikerAfter?.pos).toEqual({ col: 0, row: 0 });
    expect(strikerAfter?.firstHp).toBe(100);
    // Deux déplacements : aller (0,0)→(3,0) puis retour (3,0)→(0,0).
    const moves = events.filter((e) => e.type === 'StackMoved');
    expect(moves).toHaveLength(2);
  });
});
