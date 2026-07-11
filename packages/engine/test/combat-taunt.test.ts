import { describe, expect, it } from 'vitest';
import { createEmptyState, type GameState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { attackableTargets, validateCombatAction } from '../src/combat/actions';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import { testConfig } from './fixtures';

/**
 * Lot A2e — `taunt` (provocation, doc 03 §3) : une attaque de MÊLÉE partant
 * d'une case adjacente à un provocateur ennemi DOIT viser ce provocateur. Le
 * TIR n'est pas concerné. Pas de nouvel état ⇒ pas de bump `CURRENT_SAVE_VERSION`.
 */

function unit(over: Partial<CombatUnitDef> & { id: string }): CombatUnitDef {
  return {
    groupId: `${over.id}-g`,
    nativeTerrain: 'grass',
    stats: { hp: 10, attack: 3, defense: 3, damage: [1, 2], speed: 0 },
    abilities: [],
    ...over,
  };
}

function stack(
  partial: Pick<CombatStack, 'id' | 'side' | 'slot' | 'unitId' | 'count' | 'pos'> & Partial<CombatStack>,
): CombatStack {
  return {
    firstHp: 10, retaliationsLeft: 1, waited: false, defending: false, ammo: null, spellCharges: 0,
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
  // Attaquant de mêlée immobile (speed 0 + terrain non natif ⇒ portée 0, frappe
  // seulement depuis sa case ⇒ scénario `attackableTargets` déterministe).
  grunt: unit({ id: 'grunt', nativeTerrain: 'swamp' }),
  // Tireur (canShoot si aucun ennemi adjacent).
  archer: unit({ id: 'archer', abilities: [{ id: 'shooter', params: { ammo: 6 } }] }),
  // Provocateur ennemi.
  conscrit: unit({ id: 'conscrit', abilities: [{ id: 'taunt' }] }),
  // Ennemi ordinaire (non protégé par lui-même).
  foe: unit({ id: 'foe' }),
};

describe('A2e — taunt (provocation)', () => {
  it('refuse une frappe de mêlée sur une cible tierce quand un provocateur est adjacent', () => {
    // Attaquant (3,5) adjacent au provocateur (4,5) ET à une cible ordinaire (2,5).
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'grunt', count: 1, pos: { col: 3, row: 5 } });
    const taunter = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'conscrit', count: 1, pos: { col: 4, row: 5 } });
    const other = stack({ id: 'defender-1', side: 'defender', slot: 1, unitId: 'foe', count: 1, pos: { col: 2, row: 5 } });
    const err = validateCombatAction(state(catalog, [attacker, taunter, other]), {
      action: { type: 'attack', targetStackId: 'defender-1' },
    });
    expect(err?.code).toBe('invalidAction');
  });

  it('autorise la frappe de mêlée sur le provocateur lui-même', () => {
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'grunt', count: 1, pos: { col: 3, row: 5 } });
    const taunter = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'conscrit', count: 1, pos: { col: 4, row: 5 } });
    const other = stack({ id: 'defender-1', side: 'defender', slot: 1, unitId: 'foe', count: 1, pos: { col: 2, row: 5 } });
    const err = validateCombatAction(state(catalog, [attacker, taunter, other]), {
      action: { type: 'attack', targetStackId: 'defender-0' },
    });
    expect(err).toBeNull();
  });

  it('le tir ignore la provocation (une cible adjacente à un provocateur reste tirable)', () => {
    // Tireur loin (0,5), sans ennemi adjacent ⇒ canShoot. Cible ordinaire (4,5)
    // avec un provocateur adjacent à ELLE (3,5) mais pas au tireur.
    const archer = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'archer', count: 1, pos: { col: 0, row: 5 }, ammo: 6 });
    const taunter = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'conscrit', count: 1, pos: { col: 3, row: 5 } });
    const target = stack({ id: 'defender-1', side: 'defender', slot: 1, unitId: 'foe', count: 1, pos: { col: 4, row: 5 } });
    const err = validateCombatAction(state(catalog, [archer, taunter, target]), {
      action: { type: 'attack', targetStackId: 'defender-1' },
    });
    expect(err).toBeNull();
  });

  it('attackableTargets n’expose pas la cible protégée en mêlée', () => {
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'grunt', count: 1, pos: { col: 3, row: 5 } });
    const taunter = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'conscrit', count: 1, pos: { col: 4, row: 5 } });
    const other = stack({ id: 'defender-1', side: 'defender', slot: 1, unitId: 'foe', count: 1, pos: { col: 2, row: 5 } });
    const ids = attackableTargets(state(catalog, [attacker, taunter, other]), 'attacker-0').map((s) => s.id);
    expect(ids).toContain('defender-0'); // le provocateur reste attaquable
    expect(ids).not.toContain('defender-1'); // la cible tierce est protégée
  });
});
