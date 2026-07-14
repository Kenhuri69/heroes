import { describe, expect, it } from 'vitest';
import { validate } from '../src/core/engine';
import { isSpellImmune } from '../src/combat/state-helpers';
import { seedRng } from '../src/core/rng';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import { initLedger } from '../src/combat/state-helpers';
import type { CombatState, CombatStack, CombatUnitDef } from '../src/combat/types';
import type { SpellDef } from '../src/hero/types';
import { testConfig } from './fixtures';

/**
 * CAP-SPELLIMMUNE — la capacité `spellImmune` rend une pile INCIBLABLE par un
 * sort hostile (dégâts/debuff/…). Générique (ids opaques), zéro faction.
 */

const BOLT: SpellDef = { id: 'imm-bolt', school: 'fire', circle: 1, manaCost: 5, kind: 'damage', base: 6, perPower: 2 };
const HEAL: SpellDef = { id: 'imm-heal', school: 'water', circle: 1, manaCost: 5, kind: 'heal', base: 10, perPower: 2 };

function unit(id: string, immune = false): CombatUnitDef {
  return {
    id, groupId: `${id}-g`, nativeTerrain: 'swamp', stats: { hp: 10, attack: 5, defense: 5, damage: [4, 4], speed: 5 },
    abilities: immune ? [{ id: 'spellImmune' }] : [],
  };
}

function hero(): HeroState {
  return {
    id: 'hero-a', playerId: 'p1', pos: { x: 0, y: 0 }, movementPoints: 0, army: [], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, mana: 30, manaMax: 30, skills: {}, visitLuck: 0, visitMorale: 0,
    spells: ['imm-bolt', 'imm-heal'], artifacts: Array.from({ length: 10 }, () => null), pendingSkillChoices: [], pendingAttributeChoices: [],
    factionId: '', houseId: '', houseEffects: [], name: '', specialtyId: '', specialtyEffects: [], warMachines: [], rosterId: '',
  };
}

function stack(over: Pick<CombatStack, 'id' | 'side' | 'unitId' | 'count'> & Partial<CombatStack>): CombatStack {
  return {
    slot: 0, firstHp: 10, pos: { col: 0, row: 0 }, retaliationsLeft: 1, waited: false, defending: false,
    ammo: null, spellCharges: 0, marks: 0, immobilizedRounds: 0, transformed: false, symbiosisStacks: 0, acted: false, statuses: [],
    ...over,
  };
}

function state(): GameState {
  const stacks = [
    stack({ id: 'attacker-0', side: 'attacker', unitId: 'ally', count: 2, pos: { col: 0, row: 2 } }),
    stack({ id: 'defender-imm', side: 'defender', unitId: 'golem', count: 3, pos: { col: 10, row: 2 } }),
    stack({ id: 'defender-soft', side: 'defender', unitId: 'foe', count: 3, pos: { col: 10, row: 4 } }),
  ];
  const combat: CombatState = {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [], stacks, activeStackId: 'attacker-0',
    playerSide: 'attacker', heroId: null, guardianObjectId: null, townId: null, wallDefenseBonus: 0,
    attackerHeroId: 'hero-a', defenderHeroId: null, heroCastThisRound: [], heroAttackUsed: [], finished: false, winner: null,
  };
  initLedger(combat);
  return {
    ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(),
    unitCatalog: { ally: unit('ally'), golem: unit('golem', true), foe: unit('foe') },
    spellCatalog: { 'imm-bolt': BOLT, 'imm-heal': HEAL }, heroes: [hero()], combat,
  };
}

describe('CAP-SPELLIMMUNE — immunité aux sorts', () => {
  it('isSpellImmune reflète la capacité de l’unité', () => {
    const s = state();
    expect(isSpellImmune(s.unitCatalog, 'golem')).toBe(true);
    expect(isSpellImmune(s.unitCatalog, 'foe')).toBe(false);
    expect(isSpellImmune(s.unitCatalog, 'inconnu')).toBe(false);
  });

  it('un sort HOSTILE est refusé sur une pile immunisée', () => {
    expect(validate(state(), { type: 'CastSpell', spellId: 'imm-bolt', targetStackId: 'defender-imm' })?.code).toBe(
      'invalidTarget',
    );
  });

  it('un sort HOSTILE reste possible sur une pile non immunisée', () => {
    expect(validate(state(), { type: 'CastSpell', spellId: 'imm-bolt', targetStackId: 'defender-soft' })).toBeNull();
  });

  it('l’immunité ne concerne pas les sorts amis (soin sur allié valide)', () => {
    expect(validate(state(), { type: 'CastSpell', spellId: 'imm-heal', targetStackId: 'attacker-0' })).toBeNull();
  });
});
