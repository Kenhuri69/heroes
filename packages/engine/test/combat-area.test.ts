import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyState, type GameState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { applyAction } from '../src/combat/actions';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import type { GameEvent } from '../src/core/events';
import { testConfig } from './fixtures';

/**
 * Lot A3c — `areaAttack` : une frappe volontaire éclabousse les piles ENNEMIES
 * adjacentes à la cible d'une fraction (`pct`) des dégâts, épargnant les
 * morts-vivants si `sparesUndead`. Damage [n,n] fixe (déterministe).
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
    finished: false, attackerHeroId: null, defenderHeroId: null, heroCastThisRound: [],
    heroAttackUsed: [], winner: null,
  };
  return { ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(), unitCatalog: catalog, combat };
}

const catalog = {
  liche: unit({ id: 'liche', stats: { hp: 100, attack: 5, defense: 5, damage: [10, 10], speed: 6 }, abilities: [{ id: 'shooter', params: { ammo: 10 } }, { id: 'areaAttack', params: { pct: 0.5, sparesUndead: true } }] }),
  foe: unit({ id: 'foe', stats: { hp: 1000, attack: 0, defense: 5, damage: [0, 0], speed: 1 } }),
  bones: unit({ id: 'bones', stats: { hp: 1000, attack: 0, defense: 5, damage: [0, 0], speed: 1 }, abilities: [{ id: 'undead' }] }),
};

function runShot(s: GameState): { events: GameEvent[]; next: GameState } {
  const events: GameEvent[] = [];
  const next = produce(s, (draft) => {
    applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
  });
  return { events, next };
}

const strikes = (events: GameEvent[]) =>
  events.filter((e) => e.type === 'StackAttacked') as Extract<GameEvent, { type: 'StackAttacked' }>[];

describe('A3c — areaAttack', () => {
  it('éclabousse les ennemis adjacents à la cible d’une fraction des dégâts', () => {
    // Liche tire (loin) sur la cible en (8,5) ; un ennemi vivant est adjacent en (8,4).
    const shooter = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'liche', count: 1, ammo: 10, pos: { col: 0, row: 0 } });
    const target = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'foe', count: 1, pos: { col: 8, row: 5 }, firstHp: 1000 });
    const splashed = stack({ id: 'defender-1', side: 'defender', slot: 1, unitId: 'foe', count: 1, pos: { col: 8, row: 4 }, firstHp: 1000 });
    const { events } = runShot(state(catalog, [shooter, target, splashed]));
    const byTarget = new Map(strikes(events).map((s) => [s.targetId, s.damage]));
    // Primaire : diff 0 → 10. Éclaboussure : round(10 × 0,5) = 5 sur l'adjacent.
    expect(byTarget.get('defender-0')).toBe(10);
    expect(byTarget.get('defender-1')).toBe(5);
  });

  it('épargne les morts-vivants adjacents (sparesUndead)', () => {
    const shooter = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'liche', count: 1, ammo: 10, pos: { col: 0, row: 0 } });
    const target = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'foe', count: 1, pos: { col: 8, row: 5 }, firstHp: 1000 });
    const undeadNeighbour = stack({ id: 'defender-1', side: 'defender', slot: 1, unitId: 'bones', count: 1, pos: { col: 8, row: 4 }, firstHp: 1000 });
    const { events } = runShot(state(catalog, [shooter, target, undeadNeighbour]));
    const hitIds = strikes(events).map((s) => s.targetId);
    expect(hitIds).toContain('defender-0');
    expect(hitIds).not.toContain('defender-1'); // mort-vivant épargné
  });

  it('n’éclabousse pas les alliés adjacents à la cible', () => {
    const shooter = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'liche', count: 1, ammo: 10, pos: { col: 0, row: 0 } });
    const target = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'foe', count: 1, pos: { col: 8, row: 5 }, firstHp: 1000 });
    // Un ALLIÉ du tireur adjacent à la cible ne doit pas être touché.
    const ally = stack({ id: 'attacker-1', side: 'attacker', slot: 1, unitId: 'foe', count: 1, pos: { col: 8, row: 4 }, firstHp: 1000 });
    const { events } = runShot(state(catalog, [shooter, target, ally]));
    expect(strikes(events).map((s) => s.targetId)).not.toContain('attacker-1');
  });
});
