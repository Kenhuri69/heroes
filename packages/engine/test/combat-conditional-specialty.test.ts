import { describe, expect, it } from 'vitest';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { conditionalUnitBonus } from '../src/combat/state-helpers';
import { estimateDamage } from '../src/combat';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import { testConfig } from './fixtures';

/**
 * Lot H-COND — spécialité conditionnelle (doc 04 §5 / 05 §7 / 14 §5) : bonus de
 * combat ciblé sur une UNITÉ (`unitId`) et/ou mis à l'échelle par NIVEAU. Point
 * d'extension GÉNÉRIQUE (aucune faction/héros en dur) : `conditionalUnitBonus`.
 */

function unit(over: Partial<CombatUnitDef> & { id: string }): CombatUnitDef {
  return { groupId: `${over.id}-g`, nativeTerrain: 'x', stats: { hp: 10, attack: 5, defense: 5, damage: [4, 4], speed: 5 }, abilities: [], ...over };
}

function stack(partial: Pick<CombatStack, 'id' | 'side' | 'slot' | 'unitId'> & Partial<CombatStack>): CombatStack {
  return {
    count: 5, firstHp: 10, pos: { col: 0, row: partial.slot }, retaliationsLeft: 1, waited: false,
    defending: false, ammo: null, spellCharges: 0, marks: 0, immobilizedRounds: 0, transformed: false,
    symbiosisStacks: 0, acted: false, statuses: [], ...partial,
  };
}

function hero(over: Partial<HeroState>): HeroState {
  return {
    id: 'hero-1', playerId: 'p1', pos: { x: 0, y: 0 }, movementPoints: 0, army: [], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, mana: 0, manaMax: 0, skills: {},
    visitLuck: 0, spells: [], artifacts: Array.from({ length: 10 }, () => null), pendingSkillChoices: [],
    visitMorale: 0,
    pendingAttributeChoices: [], factionId: '', houseId: '', houseEffects: [], name: '', specialtyId: '',
    specialtyEffects: [], warMachines: [], rosterId: '', ...over,
  };
}

function combatState(over: Partial<CombatState> = {}): CombatState {
  return {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [], stacks: [], activeStackId: null, playerSide: 'attacker',
    heroId: null, guardianObjectId: null, townId: null, wallDefenseBonus: 0, attackerHeroId: null,
    defenderHeroId: null, heroCastThisRound: [], heroAttackUsed: [], finished: false, winner: null, ...over,
  };
}

const catalog: Record<string, CombatUnitDef> = { vamp: unit({ id: 'vamp' }), grunt: unit({ id: 'grunt' }) };

function state(over: Partial<GameState>): GameState {
  return { ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(), unitCatalog: catalog, ...over };
}

// Spécialité « Vhalen » générique : +1 att/+1 déf aux `vamp`, par 2 niveaux.
const VHALEN_SPEC = [{ conditional: { unitId: 'vamp', perLevels: 2, attack: 1, defense: 1 } }];

describe('H-COND — conditionalUnitBonus (point d’extension générique)', () => {
  it('applique le bonus à l’unité ciblée, mis à l’échelle par niveau (ceil)', () => {
    const combat = combatState({ attackerHeroId: 'hero-1' });
    const s = state({ heroes: [hero({ specialtyEffects: VHALEN_SPEC, level: 3 })], combat });
    // level 3, perLevels 2 ⇒ ceil(3/2)=2 ⇒ +2.
    expect(conditionalUnitBonus(s, combat, 'attacker', 'vamp', 'attack')).toBe(2);
    expect(conditionalUnitBonus(s, combat, 'attacker', 'vamp', 'defense')).toBe(2);
    // level 1 ⇒ ceil(1/2)=1 ⇒ +1.
    const s1 = state({ heroes: [hero({ specialtyEffects: VHALEN_SPEC, level: 1 })], combat });
    expect(conditionalUnitBonus(s1, combat, 'attacker', 'vamp', 'attack')).toBe(1);
  });

  it('n’affecte pas une autre unité que la ciblée', () => {
    const combat = combatState({ attackerHeroId: 'hero-1' });
    const s = state({ heroes: [hero({ specialtyEffects: VHALEN_SPEC, level: 4 })], combat });
    expect(conditionalUnitBonus(s, combat, 'attacker', 'grunt', 'attack')).toBe(0);
  });

  it('0 sans héros lié au camp', () => {
    const combat = combatState({});
    const s = state({ heroes: [], combat });
    expect(conditionalUnitBonus(s, combat, 'attacker', 'vamp', 'attack')).toBe(0);
  });

  it('bonus PLAT (sans perLevels) indépendant du niveau', () => {
    const combat = combatState({ attackerHeroId: 'hero-1' });
    const spec = [{ conditional: { unitId: 'vamp', speed: 1 } }];
    const s = state({ heroes: [hero({ specialtyEffects: spec, level: 9 })], combat });
    expect(conditionalUnitBonus(s, combat, 'attacker', 'vamp', 'speed')).toBe(1);
  });

  it('en combat : l’unité ciblée frappe plus fort avec la spécialité (préviz dégâts)', () => {
    const att = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'vamp' });
    const def = stack({ id: 'defender-0', side: 'defender', slot: 5, unitId: 'grunt', pos: { col: 1, row: 5 } });
    const combat = combatState({ stacks: [att, def], activeStackId: 'attacker-0', attackerHeroId: 'hero-1' });
    const base = state({ heroes: [hero({ level: 4 })], combat });
    const withSpec = state({ heroes: [hero({ specialtyEffects: VHALEN_SPEC, level: 4 })], combat });
    const dmgBase = estimateDamage(base, 'attacker-0', 'defender-0').damageMax;
    const dmgSpec = estimateDamage(withSpec, 'attacker-0', 'defender-0').damageMax;
    expect(dmgSpec).toBeGreaterThan(dmgBase); // +att conditionnel ⇒ plus de dégâts
  });
});
