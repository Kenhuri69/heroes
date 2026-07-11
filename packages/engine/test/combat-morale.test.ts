import { describe, expect, it } from 'vitest';
import { createEmptyState, type GameState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { moraleOf } from '../src/combat/state-helpers';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import { testConfig } from './fixtures';

/**
 * Lot A3a — capacités de moral `aura` (une pile ennemie module le moral adverse)
 * et `moraleImmune` (plancher à 0). Terrain 'grass' ; les unités ont un terrain
 * natif 'swamp' ⇒ pas de bonus natif (moral de base 0).
 */

function unit(id: string, abilities: CombatUnitDef['abilities'] = [], groupId = `${id}-g`): CombatUnitDef {
  return {
    id,
    groupId,
    nativeTerrain: 'swamp',
    stats: { hp: 10, attack: 5, defense: 5, damage: [1, 2], speed: 5 },
    abilities,
  };
}

function stack(id: string, side: CombatStack['side'], unitId: string): CombatStack {
  return {
    id, side, slot: 0, unitId, count: 5, pos: { col: 0, row: 0 },
    firstHp: 10, retaliationsLeft: 1, waited: false, defending: false, ammo: null, spellCharges: 0,
    marks: 0, immobilizedRounds: 0, transformed: false, symbiosisStacks: 0, acted: false, statuses: [],
  };
}

function state(catalog: Record<string, CombatUnitDef>, stacks: CombatStack[]): GameState {
  const combat: CombatState = {
    terrain: 'grass', round: 1, obstacles: [], stacks, activeStackId: stacks[0]?.id ?? null,
    playerSide: 'attacker', heroId: null, guardianObjectId: null, townId: null, wallDefenseBonus: 0,
    finished: false, attackerHeroId: null, defenderHeroId: null, heroCastThisRound: false,
    heroAttackUsed: [], winner: null,
  };
  return { ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(), unitCatalog: catalog, combat };
}

describe('A3a — aura', () => {
  it('une pile ennemie avec aura(-1) abaisse le moral des vivants adverses', () => {
    const catalog = {
      soldier: unit('soldier'),
      dragon: unit('dragon', [{ id: 'aura', params: { moraleMod: -1 } }]),
    };
    const ally = stack('a0', 'attacker', 'soldier');
    const enemy = stack('d0', 'defender', 'dragon');
    const s = state(catalog, [ally, enemy]);
    // Moral de base 0 (terrain neutre) − 1 (aura ennemie) = −1.
    expect(moraleOf(ally, s.combat as CombatState, s)).toBe(-1);
    // Le porteur d'aura est morts-vivants ? Non ici — mais l'aura ne s'auto-applique
    // pas (camp adverse uniquement) : son propre moral reste 0.
    expect(moraleOf(enemy, s.combat as CombatState, s)).toBe(0);
  });

  it('l’aura ne s’applique pas aux alliés du porteur', () => {
    const catalog = {
      dragon: unit('dragon', [{ id: 'aura', params: { moraleMod: -1 } }]),
      buddy: unit('buddy', [], 'buddy-g'),
    };
    const dragon = stack('a0', 'attacker', 'dragon');
    const buddy = stack('a1', 'attacker', 'buddy');
    buddy.slot = 1;
    const enemy = stack('d0', 'defender', 'buddy');
    const s = state(catalog, [dragon, buddy, enemy]);
    // buddy est du même camp que le dragon ⇒ aura ignorée ; malus multi-groupes
    // (dragon-g + buddy-g = 2 groupes) = −1.
    expect(moraleOf(buddy, s.combat as CombatState, s)).toBe(-1);
  });
});

describe('A3a — moraleImmune', () => {
  it('le moral d’une pile immune ne descend jamais sous 0', () => {
    const catalog = {
      angel: unit('angel', [{ id: 'moraleImmune' }]),
      dragon: unit('dragon', [{ id: 'aura', params: { moraleMod: -1 } }]),
    };
    const angel = stack('a0', 'attacker', 'angel');
    const enemy = stack('d0', 'defender', 'dragon');
    const s = state(catalog, [angel, enemy]);
    // base 0 − 1 (aura) = −1, mais immunité ⇒ plancher 0.
    expect(moraleOf(angel, s.combat as CombatState, s)).toBe(0);
  });

  it('l’immunité ne bloque pas le moral positif', () => {
    const catalog = { angel: unit('angel', [{ id: 'moraleImmune' }]) };
    const angel = stack('a0', 'attacker', 'angel');
    const s = state(catalog, [angel]);
    // Terrain natif = terrain de combat ⇒ +1 (l'immunité ne borne que le négatif).
    (s.unitCatalog['angel'] as CombatUnitDef).nativeTerrain = 'grass';
    expect(moraleOf(angel, s.combat as CombatState, s)).toBe(1);
  });
});
