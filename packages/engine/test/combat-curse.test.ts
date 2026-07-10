import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyState, type GameState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { applyAction } from '../src/combat/actions';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import type { GameEvent } from '../src/core/events';
import { testConfig } from './fixtures';

/**
 * Lot A2c — `curseOnHit` : une frappe qui touche applique un statut à la cible.
 * `chance: 1` ⇒ application déterministe (pas de tirage). Damage [n,n] fixe.
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

function runAttack(s: GameState, from?: { col: number; row: number }): { events: GameEvent[]; next: GameState } {
  const events: GameEvent[] = [];
  const next = produce(s, (draft) => {
    applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0', ...(from ? { from } : {}) });
  });
  return { events, next };
}

const strikes = (events: GameEvent[]) =>
  events.filter((e) => e.type === 'StackAttacked') as Extract<GameEvent, { type: 'StackAttacked' }>[];

describe('A2c — curseOnHit', () => {
  it('applique le statut à 100 % (Faux funeste : −20 % dégâts) + event StackCursed', () => {
    const catalog = {
      atk: unit({
        id: 'atk',
        stats: { hp: 100, attack: 5, defense: 5, damage: [10, 10], speed: 6 },
        abilities: [{ id: 'curseOnHit', params: { chance: 1, damageDealtMod: -0.2, rounds: 2 } }],
      }),
      def: unit({ id: 'def', stats: { hp: 1000, attack: 0, defense: 5, damage: [0, 0], speed: 1 } }),
    };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 }, firstHp: 100 });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 }, firstHp: 1000 });
    const { events, next } = runAttack(state(catalog, [attacker, defender]));
    expect(events).toContainEqual({ type: 'StackCursed', targetId: 'defender-0', spellId: 'curse:atk' });
    const status = next.combat?.stacks.find((s) => s.id === 'defender-0')?.statuses.find((s) => s.spellId === 'curse:atk');
    expect(status).toMatchObject({ damageDealtMod: -0.2, roundsLeft: 2 });
  });

  it('Faux funeste réduit les dégâts infligés par la pile maudite (−20 %)', () => {
    const catalog = {
      cursed: unit({ id: 'cursed', stats: { hp: 100, attack: 5, defense: 5, damage: [10, 10], speed: 6 } }),
      def: unit({ id: 'def', stats: { hp: 1000, attack: 0, defense: 5, damage: [0, 0], speed: 1 } }),
    };
    // La pile attaquante porte déjà « Faux funeste » (−20 %).
    const attacker = stack({
      id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'cursed', count: 1, pos: { col: 0, row: 0 }, firstHp: 100,
      statuses: [{ spellId: 'curse:x', attackMod: 0, defenseMod: 0, speedMod: 0, damageDealtMod: -0.2, roundsLeft: 2 }],
    });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 }, firstHp: 1000 });
    const strike = strikes(runAttack(state(catalog, [attacker, defender])).events)[0];
    // diff 0 → mult 1 × (1 − 0,2) → round(10 × 0,8) = 8
    expect(strike?.damage).toBe(8);
  });

  it('Affaiblissement (defenseMod) affaiblit la Défense de la cible', () => {
    const catalog = {
      atk: unit({
        id: 'atk',
        stats: { hp: 100, attack: 5, defense: 5, damage: [10, 10], speed: 6 },
        abilities: [{ id: 'curseOnHit', params: { chance: 1, defenseMod: -2, rounds: 3 } }],
      }),
      def: unit({ id: 'def', stats: { hp: 1000, attack: 0, defense: 5, damage: [0, 0], speed: 1 } }),
    };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 }, firstHp: 100 });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 }, firstHp: 1000 });
    const next = runAttack(state(catalog, [attacker, defender])).next;
    const status = next.combat?.stacks.find((s) => s.id === 'defender-0')?.statuses.find((s) => s.spellId === 'curse:atk');
    expect(status).toMatchObject({ defenseMod: -2, roundsLeft: 3 });
  });

  it('une frappe esquivée (incorporeal) ne maudit pas', () => {
    const catalog = {
      atk: unit({
        id: 'atk',
        stats: { hp: 100, attack: 5, defense: 5, damage: [10, 10], speed: 6 },
        abilities: [{ id: 'curseOnHit', params: { chance: 1, defenseMod: -2, rounds: 3 } }],
      }),
      def: unit({ id: 'def', stats: { hp: 1000, attack: 0, defense: 5, damage: [0, 0], speed: 1 }, abilities: [{ id: 'incorporeal', params: { dodge: 1 } }] }),
    };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 }, firstHp: 100 });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 }, firstHp: 1000 });
    const { events, next } = runAttack(state(catalog, [attacker, defender]));
    expect(events.some((e) => e.type === 'StackCursed')).toBe(false);
    expect(next.combat?.stacks.find((s) => s.id === 'defender-0')?.statuses).toHaveLength(0);
  });
});
