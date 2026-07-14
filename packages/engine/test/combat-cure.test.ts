import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import { estimateSpell } from '../src/hero';
import { seedRng } from '../src/core/rng';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import { initLedger } from '../src/combat/state-helpers';
import type { CombatState, CombatStack, CombatUnitDef } from '../src/combat/types';
import type { SpellDef, SpellStatus } from '../src/hero/types';
import { testConfig } from './fixtures';

/**
 * F-SCHOOLS — Purification : un sort `cure` (AMICAL) retire les statuts NÉFASTES
 * (debuff/malédiction/poison/silence) d'une pile ALLIÉE en conservant les buffs —
 * miroir amical de `dispel`. Générique (réutilise `stack.statuses`), zéro faction.
 */

const CURE: SpellDef = {
  id: 'cure-spell', school: 'water', circle: 2, manaCost: 8, kind: 'cure', base: 0, perPower: 0,
};

function unit(id: string): CombatUnitDef {
  return { id, groupId: `${id}-g`, nativeTerrain: 'swamp', stats: { hp: 10, attack: 5, defense: 5, damage: [4, 4], speed: 5 }, abilities: [] };
}

function hero(mana: number): HeroState {
  return {
    id: 'hero-a', playerId: 'p1', pos: { x: 0, y: 0 }, movementPoints: 0, army: [], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, mana, manaMax: mana, skills: {}, visitLuck: 0, visitMorale: 0,
    spells: ['cure-spell'], artifacts: Array.from({ length: 10 }, () => null), backpack: [], pendingSkillChoices: [], pendingAttributeChoices: [],
    factionId: '', houseId: '', houseEffects: [], name: '', specialtyId: '', specialtyEffects: [], warMachines: [], rosterId: '',
  };
}

function status(over: Partial<SpellStatus>): SpellStatus {
  return { spellId: 's', attackMod: 0, defenseMod: 0, speedMod: 0, damageDealtMod: 0, damagePerRound: 0, silenced: false, roundsLeft: 3, ...over };
}

function stack(over: Pick<CombatStack, 'id' | 'side' | 'unitId' | 'count'> & Partial<CombatStack>): CombatStack {
  return {
    slot: 0, firstHp: 10, pos: { col: 0, row: 0 }, retaliationsLeft: 1, waited: false, defending: false,
    ammo: null, spellCharges: 0, marks: 0, immobilizedRounds: 0, transformed: false, symbiosisStacks: 0, acted: false, statuses: [],
    ...over,
  };
}

function cureState(allyStatuses: SpellStatus[]): GameState {
  const stacks = [
    stack({ id: 'attacker-0', side: 'attacker', unitId: 'ally', count: 2, pos: { col: 0, row: 2 }, statuses: allyStatuses }),
    stack({ id: 'defender-0', side: 'defender', unitId: 'foe', count: 5, pos: { col: 10, row: 2 } }),
  ];
  const combat: CombatState = {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [], stacks, activeStackId: 'attacker-0',
    playerSide: 'attacker', heroId: null, guardianObjectId: null, townId: null, wallDefenseBonus: 0,
    attackerHeroId: 'hero-a', defenderHeroId: null, heroCastThisRound: [], heroAttackUsed: [], finished: false, winner: null,
  };
  initLedger(combat);
  return {
    ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(),
    unitCatalog: { ally: unit('ally'), foe: unit('foe') }, spellCatalog: { 'cure-spell': CURE }, heroes: [hero(20)], combat,
  };
}

describe('F-SCHOOLS — Purification (cure)', () => {
  it('retire les statuts néfastes de l’allié et conserve les buffs', () => {
    const state = cureState([
      status({ spellId: 'buff', attackMod: 3 }), // conservé
      status({ spellId: 'poison', damagePerRound: 4 }), // néfaste
      status({ spellId: 'malediction', damageDealtMod: -0.2 }), // néfaste
      status({ spellId: 'silence', silenced: true }), // néfaste
    ]);
    const { state: next, events } = apply(state, { type: 'CastSpell', spellId: 'cure-spell', targetStackId: 'attacker-0' });
    const ally = next.combat?.stacks.find((s) => s.id === 'attacker-0');
    expect(ally?.statuses.map((s) => s.spellId)).toEqual(['buff']);
    expect(events.find((e) => e.type === 'SpellCast')).toMatchObject({ spellId: 'cure-spell', amount: 3 });
    expect(next.heroes[0]?.mana).toBe(12); // coût 8
  });

  it('allié sans statut néfaste : purification inoffensive (amount 0)', () => {
    const state = cureState([status({ spellId: 'buff', speedMod: 2 })]);
    const { state: next, events } = apply(state, { type: 'CastSpell', spellId: 'cure-spell', targetStackId: 'attacker-0' });
    expect(next.combat?.stacks.find((s) => s.id === 'attacker-0')?.statuses).toHaveLength(1);
    expect(events.find((e) => e.type === 'SpellCast')).toMatchObject({ amount: 0 });
  });

  it('la préviz annonce le nombre de statuts néfastes purgés (les buffs exclus)', () => {
    const state = cureState([status({ spellId: 'buff', attackMod: 3 }), status({ spellId: 'slow', speedMod: -2 })]);
    expect(estimateSpell(state, 'cure-spell', 'attacker-0')).toMatchObject({ kind: 'cure', amount: 1 });
  });

  it('vise un allié, jamais l’ennemi (contrainte de camp)', () => {
    const state = cureState([]);
    expect(validate(state, { type: 'CastSpell', spellId: 'cure-spell', targetStackId: 'defender-0' })?.code).toBe('invalidTarget');
  });
});
