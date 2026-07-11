import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyState, type GameState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { applyAction } from '../src/combat/actions';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import type { GameEvent } from '../src/core/events';
import { testConfig } from './fixtures';

/**
 * CAP-MORAL `fear` (Sombral, doc 16 §4) : une frappe qui touche a une chance
 * d'effrayer la cible ⇒ elle saute son prochain tour (réutilise
 * `immobilizedRounds`). `chance: 1` ⇒ application déterministe (pas de tirage).
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
    spellCharges: 0,
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

function runAttack(s: GameState): { events: GameEvent[]; next: GameState } {
  const events: GameEvent[] = [];
  const next = produce(s, (draft) => {
    applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
  });
  return { events, next };
}

const bigDefender = () =>
  stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 }, firstHp: 1000 });

const feared = (events: GameEvent[]) => events.some((e) => e.type === 'StackFeared');
// La cible effrayée saute son tour dès l'avance d'initiative (advanceTurn) : le
// skip émet `StackImmobilized` et reconsomme `immobilizedRounds` (comme pinningShot).
const skipped = (events: GameEvent[]) =>
  events.some((e) => e.type === 'StackImmobilized' && e.stackId === 'defender-0');

describe('CAP-MORAL — fear', () => {
  it('effraie la cible à 100 % ⇒ StackFeared + saut de tour de la cible', () => {
    const catalog = {
      atk: unit({ id: 'atk', abilities: [{ id: 'fear', params: { chance: 1, rounds: 1 } }] }),
      def: unit({ id: 'def', stats: { hp: 1000, attack: 0, defense: 5, damage: [0, 0], speed: 1 } }),
    };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 } });
    const { events } = runAttack(state(catalog, [attacker, bigDefender()]));
    expect(events).toContainEqual({ type: 'StackFeared', targetId: 'defender-0' });
    expect(skipped(events)).toBe(true); // la cible effrayée saute son tour
  });

  it('sans capacité `fear` : ni peur ni saut de tour', () => {
    const catalog = {
      atk: unit({ id: 'atk' }), // pas de fear
      def: unit({ id: 'def', stats: { hp: 1000, attack: 0, defense: 5, damage: [0, 0], speed: 1 } }),
    };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 } });
    const { events } = runAttack(state(catalog, [attacker, bigDefender()]));
    expect(feared(events)).toBe(false);
    expect(skipped(events)).toBe(false);
  });

  it('chance 0 : jamais effrayée', () => {
    const catalog = {
      atk: unit({ id: 'atk', abilities: [{ id: 'fear', params: { chance: 0, rounds: 1 } }] }),
      def: unit({ id: 'def', stats: { hp: 1000, attack: 0, defense: 5, damage: [0, 0], speed: 1 } }),
    };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 } });
    const { events } = runAttack(state(catalog, [attacker, bigDefender()]));
    expect(feared(events)).toBe(false);
    expect(skipped(events)).toBe(false);
  });

  it('une frappe esquivée (incorporeal) n’effraie pas', () => {
    const catalog = {
      atk: unit({ id: 'atk', abilities: [{ id: 'fear', params: { chance: 1, rounds: 1 } }] }),
      def: unit({ id: 'def', stats: { hp: 1000, attack: 0, defense: 5, damage: [0, 0], speed: 1 }, abilities: [{ id: 'incorporeal', params: { dodge: 1 } }] }),
    };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 } });
    const { events } = runAttack(state(catalog, [attacker, bigDefender()]));
    expect(feared(events)).toBe(false);
  });
});
