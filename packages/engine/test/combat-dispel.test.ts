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
 * H-SPELLS.4 — Dissipation réelle : un sort `dispel` retire tous les statuts
 * temporaires de sort de la pile ENNEMIE ciblée (buffs/poison/malédiction).
 * Générique (réutilise `stack.statuses`), zéro faction (ids opaques).
 */

const DISPEL: SpellDef = {
  id: 'dispel-spell', school: 'neutral', circle: 3, manaCost: 12, kind: 'dispel', base: 0, perPower: 0,
};

function unit(id: string): CombatUnitDef {
  return { id, groupId: `${id}-g`, nativeTerrain: 'swamp', stats: { hp: 10, attack: 5, defense: 5, damage: [4, 4], speed: 5 }, abilities: [] };
}

function hero(mana: number): HeroState {
  return {
    id: 'hero-a', playerId: 'p1', pos: { x: 0, y: 0 }, movementPoints: 0, army: [], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, mana, manaMax: mana, skills: {}, visitLuck: 0,
    spells: ['dispel-spell'], artifacts: Array.from({ length: 10 }, () => null), pendingSkillChoices: [], pendingAttributeChoices: [],
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

function dispelState(enemyStatuses: SpellStatus[]): GameState {
  const stacks = [
    stack({ id: 'attacker-0', side: 'attacker', unitId: 'ally', count: 2, pos: { col: 0, row: 2 } }),
    stack({ id: 'defender-0', side: 'defender', unitId: 'foe', count: 5, pos: { col: 10, row: 2 }, statuses: enemyStatuses }),
  ];
  const combat: CombatState = {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [], stacks, activeStackId: 'attacker-0',
    playerSide: 'attacker', heroId: null, guardianObjectId: null, townId: null, wallDefenseBonus: 0,
    attackerHeroId: 'hero-a', defenderHeroId: null, heroCastThisRound: [], heroAttackUsed: [], finished: false, winner: null,
  };
  initLedger(combat);
  return {
    ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(),
    unitCatalog: { ally: unit('ally'), foe: unit('foe') }, spellCatalog: { 'dispel-spell': DISPEL }, heroes: [hero(20)], combat,
  };
}

describe('H-SPELLS.4 — Dissipation', () => {
  it('retire tous les statuts de la pile ennemie et émet SpellCast(amount = statuts retirés)', () => {
    const state = dispelState([
      status({ spellId: 'buff', attackMod: 3 }),
      status({ spellId: 'poison', damagePerRound: 4 }),
    ]);
    const { state: next, events } = apply(state, { type: 'CastSpell', spellId: 'dispel-spell', targetStackId: 'defender-0' });
    const foe = next.combat?.stacks.find((s) => s.id === 'defender-0');
    expect(foe?.statuses).toHaveLength(0);
    expect(events.find((e) => e.type === 'SpellCast')).toMatchObject({ spellId: 'dispel-spell', amount: 2 });
    // La mana est bien débitée (coût 12).
    expect(next.heroes[0]?.mana).toBe(8);
  });

  it('cible sans statut : dissipation inoffensive (amount 0), pas de crash', () => {
    const state = dispelState([]);
    const { state: next, events } = apply(state, { type: 'CastSpell', spellId: 'dispel-spell', targetStackId: 'defender-0' });
    expect(next.combat?.stacks.find((s) => s.id === 'defender-0')?.statuses).toHaveLength(0);
    expect(events.find((e) => e.type === 'SpellCast')).toMatchObject({ amount: 0 });
  });

  it('la préviz annonce le nombre de statuts à retirer', () => {
    const state = dispelState([status({ spellId: 'buff', attackMod: 3 })]);
    expect(estimateSpell(state, 'dispel-spell', 'defender-0')).toMatchObject({ kind: 'dispel', amount: 1 });
  });

  it('vise l’ennemi, jamais un allié (contrainte de camp)', () => {
    const state = dispelState([]);
    expect(validate(state, { type: 'CastSpell', spellId: 'dispel-spell', targetStackId: 'attacker-0' })?.code).toBe('invalidTarget');
  });
});
