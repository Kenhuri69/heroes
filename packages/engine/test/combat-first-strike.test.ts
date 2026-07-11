import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyState, type GameState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { roundActionOrder } from '../src/combat/state-helpers';
import { advanceTurn } from '../src/combat/turns';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import type { GameEvent } from '../src/core/events';
import { testConfig } from './fixtures';

/**
 * Lot A2g — `firstStrike` : à VITESSE d'initiative égale, la pile qui « frappe
 * en premier » passe avant celles sans `firstStrike` (priorité de vague,
 * indépendante du camp/slot). Capacité sans état ⇒ pas de bump save.
 */

function unit(over: Partial<CombatUnitDef> & { id: string }): CombatUnitDef {
  return {
    groupId: `${over.id}-g`,
    nativeTerrain: 'swamp', // jamais le terrain de combat 'grass' ⇒ vitesses pures
    stats: { hp: 10, attack: 3, defense: 3, damage: [1, 2], speed: 5 },
    abilities: [],
    ...over,
  };
}

function stack(
  partial: Pick<CombatStack, 'id' | 'side' | 'slot' | 'unitId'> & Partial<CombatStack>,
): CombatStack {
  return {
    count: 5, firstHp: 10, pos: { col: 0, row: partial.slot }, retaliationsLeft: 1, waited: false,
    defending: false, ammo: null, spellCharges: 0, marks: 0, immobilizedRounds: 0, transformed: false,
    symbiosisStacks: 0, acted: false, statuses: [],
    ...partial,
  };
}

function combatWith(catalog: Record<string, CombatUnitDef>, stacks: CombatStack[]): CombatState {
  return {
    terrain: 'grass', round: 1, obstacles: [], stacks, activeStackId: stacks[0]?.id ?? null,
    playerSide: 'attacker', heroId: null, guardianObjectId: null, townId: null, wallDefenseBonus: 0,
    attackerHeroId: null, defenderHeroId: null, heroCastThisRound: false, heroAttackUsed: [],
    finished: false, winner: null,
  };
}

const catalog: Record<string, CombatUnitDef> = {
  striker: unit({ id: 'striker', abilities: [{ id: 'firstStrike' }] }),
  plain: unit({ id: 'plain' }),
};

describe('A2g — firstStrike', () => {
  it('à vitesse égale, la pile firstStrike (défenseur) passe avant la pile ordinaire (attaquant)', () => {
    const combat = combatWith(catalog, [
      stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'plain' }),
      stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'striker' }),
    ]);
    const order = roundActionOrder(combat, catalog).current.map((s) => s.id);
    // Sans firstStrike, le départage attaquant placerait 'attacker-0' d'abord ;
    // la priorité firstStrike inverse ⇒ 'defender-0' agit en premier.
    expect(order).toEqual(['defender-0', 'attacker-0']);
  });

  it('non-régression : deux piles ordinaires de même vitesse ⇒ attaquant puis défenseur', () => {
    const combat = combatWith(catalog, [
      stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'plain' }),
      stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'plain' }),
    ]);
    const order = roundActionOrder(combat, catalog).current.map((s) => s.id);
    expect(order).toEqual(['attacker-0', 'defender-0']);
  });

  it('n’intervient qu’à égalité de vitesse : une pile plus rapide sans firstStrike reste devant', () => {
    const fast = { ...catalog, fast: unit({ id: 'fast', stats: { hp: 10, attack: 3, defense: 3, damage: [1, 2], speed: 8 } }) };
    const combat = combatWith(fast, [
      stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'fast' }), // vitesse 8, pas de firstStrike
      stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'striker' }), // vitesse 5 + firstStrike
    ]);
    const order = roundActionOrder(combat, fast).current.map((s) => s.id);
    expect(order).toEqual(['attacker-0', 'defender-0']); // la vitesse prime, firstStrike ne départage qu'à égalité
  });

  it('le moteur (advanceTurn) honore la priorité : la pile active devient la firstStrike', () => {
    const combat = combatWith(catalog, [
      stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'plain', acted: true }),
      stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'striker' }),
      stack({ id: 'defender-1', side: 'defender', slot: 1, unitId: 'plain' }),
    ]);
    const state: GameState = { ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(), unitCatalog: catalog, combat };
    const events: GameEvent[] = [];
    const next = produce(state, (draft) => { advanceTurn(draft, events); });
    // defender-0 (striker) et defender-1 (plain) sont à vitesse 5 ; firstStrike
    // place le striker en tête de la vague ⇒ pile active.
    expect(next.combat?.activeStackId).toBe('defender-0');
  });
});
