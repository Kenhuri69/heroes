import { describe, expect, it } from 'vitest';
import { seedRng } from '../src/core/rng';
import { createEmptyState, type GameState } from '../src/core/state';
import { siegeEliteDamage } from '../src/combat/state-helpers';
import { estimateDamage } from '../src/combat/damage';
import type { BuildingDef, TownState } from '../src/town/types';
import type { CombatState, CombatStack, CombatUnitDef } from '../src/combat/types';
import { testConfig } from './fixtures';

/**
 * Lot F-BUILDEFF.5 — Cercle Abîme : aura de bâtiment générique `eliteDamagePct`
 * (+% dégâts aux piles T≥`eliteMinTier` du camp DÉFENSEUR en siège). Bâtiment/
 * faction GÉNÉRIQUES (`abyss`/`t8`/`t6`) — aucun nom de faction dans le moteur.
 */

function unit(over: Partial<CombatUnitDef> & { id: string }): CombatUnitDef {
  return {
    groupId: `${over.id}-g`, nativeTerrain: 'swamp',
    stats: { hp: 100, attack: 10, defense: 5, damage: [10, 10], speed: 6 }, abilities: [], ...over,
  };
}

const CATALOG: Record<string, CombatUnitDef> = {
  t8: unit({ id: 't8', tier: 8 }),
  t6: unit({ id: 't6', tier: 6 }),
  foe: unit({ id: 'foe', stats: { hp: 1000, attack: 5, defense: 5, damage: [1, 1], speed: 5 } }),
};

const BUILDINGS: Record<string, BuildingDef> = {
  abyss: {
    id: 'abyss', maxLevel: 1,
    levels: [{ cost: {}, requires: [], effect: { type: 'heroAura', eliteDamagePct: 10, eliteMinTier: 7 } }],
  },
};

function town(over: Partial<TownState> = {}): TownState {
  return {
    id: 't1', ownerPlayerId: 'p1', pos: { x: 5, y: 5 }, factionId: '', buildings: { abyss: 1 },
    builtToday: false, garrison: [], stock: {}, spellPool: [], sharedGrowthChoice: {}, ...over,
  };
}

function stack(over: Pick<CombatStack, 'id' | 'side' | 'unitId'> & Partial<CombatStack>): CombatStack {
  return {
    slot: 0, count: 1, firstHp: 100, pos: { col: 0, row: 0 }, retaliationsLeft: 1, waited: false,
    defending: false, ammo: null, spellCharges: 0, marks: 0, immobilizedRounds: 0, transformed: false,
    symbiosisStacks: 0, acted: false, statuses: [], ...over,
  };
}

function combatState(over: Partial<CombatState> = {}): CombatState {
  return {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [], stacks: [], activeStackId: null,
    playerSide: 'attacker', heroId: 'hero-a', guardianObjectId: null, townId: 't1', wallDefenseBonus: 0,
    attackerHeroId: null, defenderHeroId: null, heroCastThisRound: [], heroAttackUsed: [], finished: false,
    winner: null, ...over,
  };
}

function state(over: Partial<GameState> = {}): GameState {
  return {
    ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(), unitCatalog: CATALOG,
    buildingCatalog: BUILDINGS, towns: [town()], ...over,
  };
}

describe('F-BUILDEFF.5 — siegeEliteDamage (pur)', () => {
  it('+10 % pour un défenseur T8 en siège de la ville dotée', () => {
    expect(siegeEliteDamage(state(), combatState(), 'defender', CATALOG.t8!)).toBeCloseTo(0.1);
  });

  it('rien pour un défenseur T6 (sous le seuil eliteMinTier 7)', () => {
    expect(siegeEliteDamage(state(), combatState(), 'defender', CATALOG.t6!)).toBe(0);
  });

  it('rien pour le camp ATTAQUANT (assiégeant), même T8', () => {
    expect(siegeEliteDamage(state(), combatState(), 'attacker', CATALOG.t8!)).toBe(0);
  });

  it('rien hors siège (combat.townId null)', () => {
    expect(siegeEliteDamage(state(), combatState({ townId: null }), 'defender', CATALOG.t8!)).toBe(0);
  });

  it('rien si la ville n’a pas le bâtiment', () => {
    expect(siegeEliteDamage(state({ towns: [town({ buildings: {} })] }), combatState(), 'defender', CATALOG.t8!)).toBe(0);
  });
});

describe('F-BUILDEFF.5 — dégâts en combat', () => {
  it('un défenseur T8 en siège Abîme frappe plus fort qu’un T8 sans aura', () => {
    const attacker = stack({ id: 'attacker-0', side: 'attacker', unitId: 'foe', pos: { col: 0, row: 3 } });
    const defender = stack({ id: 'defender-0', side: 'defender', unitId: 't8', pos: { col: 1, row: 3 } });
    const combat = combatState({ stacks: [attacker, defender] });
    // Le défenseur T8 frappe l'assiégeant (foe). Avec Abîme (+10 %) vs sans.
    const withAura = estimateDamage(state({ combat }), 'defender-0', 'attacker-0');
    const without = estimateDamage(state({ towns: [town({ buildings: {} })], combat }), 'defender-0', 'attacker-0');
    expect(withAura.damageMax).toBeGreaterThan(without.damageMax);
  });
});
