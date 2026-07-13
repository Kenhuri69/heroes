import { describe, expect, it } from 'vitest';
import { createEmptyState, type GameState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { moraleOf } from '../src/combat/state-helpers';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import type { SpellStatus } from '../src/hero/types';
import { testConfig } from './fixtures';

/**
 * F-SCHOOLS (École de la Scène) — un statut de sort portant `moraleMod` module le
 * moral de la pile porteuse (Chant de Courage +1, Dissonance −1). Générique : ids
 * de sort/unité OPAQUES (aucun id de faction). Terrain neutre ⇒ moral de base 0.
 */

function unit(id: string, abilities: CombatUnitDef['abilities'] = []): CombatUnitDef {
  return {
    id,
    groupId: `${id}-g`,
    nativeTerrain: 'swamp',
    stats: { hp: 10, attack: 5, defense: 5, damage: [1, 2], speed: 5 },
    abilities,
  };
}

function status(moraleMod: number | undefined): SpellStatus {
  return {
    spellId: 's',
    attackMod: 0,
    defenseMod: 0,
    speedMod: 0,
    ...(moraleMod !== undefined && { moraleMod }),
    damageDealtMod: 0,
    damagePerRound: 0,
    silenced: false,
    roundsLeft: 3,
  };
}

function stack(id: string, unitId: string, statuses: SpellStatus[] = []): CombatStack {
  return {
    id, side: 'attacker', slot: 0, unitId, count: 5, pos: { col: 0, row: 0 },
    firstHp: 10, retaliationsLeft: 1, waited: false, defending: false, ammo: null, spellCharges: 0,
    marks: 0, immobilizedRounds: 0, transformed: false, symbiosisStacks: 0, acted: false, statuses,
  };
}

function state(catalog: Record<string, CombatUnitDef>, stacks: CombatStack[]): GameState {
  const combat: CombatState = {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [], stacks, activeStackId: stacks[0]?.id ?? null,
    playerSide: 'attacker', heroId: null, guardianObjectId: null, townId: null, wallDefenseBonus: 0,
    finished: false, attackerHeroId: null, defenderHeroId: null, heroCastThisRound: [],
    heroAttackUsed: [], winner: null,
  };
  return { ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(), unitCatalog: catalog, combat };
}

describe('F-SCHOOLS — moral par statut de sort', () => {
  it('un statut moraleMod +1 relève le moral de la pile', () => {
    const catalog = { s: unit('s') };
    const st = stack('a0', 's', [status(1)]);
    const g = state(catalog, [st]);
    expect(moraleOf(st, g.combat as CombatState, g)).toBe(1);
  });

  it('un statut moraleMod −1 abaisse le moral de la pile', () => {
    const catalog = { s: unit('s') };
    const st = stack('a0', 's', [status(-1)]);
    const g = state(catalog, [st]);
    expect(moraleOf(st, g.combat as CombatState, g)).toBe(-1);
  });

  it('un statut sans moraleMod est neutre (non-régression)', () => {
    const catalog = { s: unit('s') };
    const st = stack('a0', 's', [status(undefined)]);
    const g = state(catalog, [st]);
    expect(moraleOf(st, g.combat as CombatState, g)).toBe(0);
  });

  it('les moraleMod de plusieurs statuts se cumulent, bornés à +3', () => {
    const catalog = { s: unit('s') };
    const st = stack('a0', 's', [status(2), status(2)]);
    const g = state(catalog, [st]);
    // 2 + 2 = 4, borné à +3.
    expect(moraleOf(st, g.combat as CombatState, g)).toBe(3);
  });

  it('un porteur `moraleImmune` plancher à 0 malgré un moraleMod négatif', () => {
    const catalog = { s: unit('s', [{ id: 'moraleImmune', params: {} }]) };
    const st = stack('a0', 's', [status(-2)]);
    const g = state(catalog, [st]);
    expect(moraleOf(st, g.combat as CombatState, g)).toBe(0);
  });
});
