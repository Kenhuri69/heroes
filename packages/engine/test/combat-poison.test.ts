import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyState, type GameState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { applyAction } from '../src/combat/actions';
import { advanceTurn } from '../src/combat/turns';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import type { GameEvent } from '../src/core/events';
import { testConfig } from './fixtures';

/**
 * Lot A2f — `poisonSting` : une frappe de mêlée applique un poison qui inflige
 * `damagePerRound` au début de chaque round pendant `rounds`, puis expire.
 * Damage de frappe [n,n] fixe, cible à gros PV pour isoler le poison.
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
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [], stacks, activeStackId: 'attacker-0',
    playerSide: 'attacker', heroId: null, guardianObjectId: null, townId: null, wallDefenseBonus: 0,
    finished: false, attackerHeroId: null, defenderHeroId: null, heroCastThisRound: [],
    heroAttackUsed: [], winner: null,
  };
  return { ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(), unitCatalog: catalog, combat };
}

const catalog = {
  manticore: unit({ id: 'manticore', abilities: [{ id: 'poisonSting', params: { damagePerRound: 6, rounds: 3 } }] }),
  // Cible passive, sans riposte pour isoler la frappe (dégâts nuls de toute façon).
  foe: unit({ id: 'foe', stats: { hp: 1000, attack: 0, defense: 5, damage: [0, 0], speed: 1 } }),
};

const poisonEvents = (events: GameEvent[]) =>
  events.filter((e) => e.type === 'StackPoisoned') as Extract<GameEvent, { type: 'StackPoisoned' }>[];

describe('A2f — poisonSting', () => {
  it('applique un statut de poison à la frappe de mêlée', () => {
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'manticore', count: 1, pos: { col: 2, row: 5 } });
    const target = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'foe', count: 1, pos: { col: 3, row: 5 }, firstHp: 1000, retaliationsLeft: 0 });
    const events: GameEvent[] = [];
    const next = produce(state(catalog, [attacker, target]), (draft) => {
      applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
    });
    const poison = next.combat?.stacks.find((s) => s.id === 'defender-0')?.statuses.find((s) => s.spellId === 'poison:manticore');
    expect(poison).toMatchObject({ damagePerRound: 6, roundsLeft: 3 });
  });

  it('inflige les dégâts de poison au début de chaque round puis expire après `rounds`', () => {
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'manticore', count: 1, pos: { col: 2, row: 5 } });
    const target = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'foe', count: 1, pos: { col: 3, row: 5 }, firstHp: 1000, retaliationsLeft: 0 });
    const events: GameEvent[] = [];
    const afterHit = produce(state(catalog, [attacker, target]), (draft) => {
      applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
    });

    // 3 transitions de round ⇒ 3 ticks de poison (6 PV chacun), puis le statut expire.
    const rounds: number[] = [];
    let cur = afterHit;
    for (let i = 0; i < 4; i++) {
      const evs: GameEvent[] = [];
      cur = produce(cur, (draft) => {
        const combat = draft.combat as CombatState;
        for (const s of combat.stacks) { s.acted = true; s.waited = false; }
        advanceTurn(draft, evs);
      });
      rounds.push(poisonEvents(evs).reduce((sum, e) => sum + e.damage, 0));
    }
    expect(rounds).toEqual([6, 6, 6, 0]); // 3 ticks puis plus de poison (expiré)
    const dmgTaken = 1000 - (cur.combat?.stacks.find((s) => s.id === 'defender-0')?.firstHp ?? 0);
    expect(dmgTaken).toBe(28); // 10 (dard de mêlée) + 18 (3 × 6 poison)
  });

  it('un poison mortel retire la pile et peut clore le combat', () => {
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'manticore', count: 1, pos: { col: 2, row: 5 } });
    // Cible à 4 PV : la frappe (10) la tue direct — on teste plutôt un poison seul.
    const frail = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'foe', count: 1, pos: { col: 5, row: 5 }, firstHp: 4, retaliationsLeft: 0,
      statuses: [{ spellId: 'poison:manticore', attackMod: 0, defenseMod: 0, speedMod: 0, damageDealtMod: 0, damagePerRound: 6, roundsLeft: 2 }] });
    const events: GameEvent[] = [];
    const next = produce(state(catalog, [attacker, frail]), (draft) => {
      const combat = draft.combat as CombatState;
      for (const s of combat.stacks) { s.acted = true; s.waited = false; }
      advanceTurn(draft, events);
    });
    // Poison (6) > PV (4) ⇒ la pile meurt, combat terminé (attaquant seul survivant).
    expect(poisonEvents(events).some((e) => e.stackId === 'defender-0' && e.kills === 1)).toBe(true);
    expect(next.combat).toBeNull();
  });
});
