import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import { estimateSpell } from '../src/hero';
import { seedRng } from '../src/core/rng';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import { initLedger } from '../src/combat/state-helpers';
import type { CombatState, CombatStack, CombatUnitDef } from '../src/combat/types';
import type { SpellDef } from '../src/hero/types';
import { testConfig } from './fixtures';

/**
 * H-SPELLS.4+ — Invocation : un sort `summon` place une pile FRAÎCHE de créatures
 * du camp du lanceur (cible-proxy alliée). La créature est décrite inline dans le
 * sort, enregistrée dans `unitCatalog` au lancer. Générique, zéro faction.
 */

const SUMMON: SpellDef = {
  id: 'sum-spell', school: 'earth', circle: 3, manaCost: 16, kind: 'summon', base: 2, perPower: 1,
  summon: {
    unit: { id: 'elem', nativeTerrain: 'grass', stats: { hp: 25, attack: 9, defense: 9, damage: [5, 9], speed: 5 }, abilities: [] },
  },
};

function unit(id: string): CombatUnitDef {
  return { id, groupId: `${id}-g`, nativeTerrain: 'swamp', stats: { hp: 10, attack: 5, defense: 5, damage: [4, 4], speed: 5 }, abilities: [] };
}

function hero(spells: string[], power = 0): HeroState {
  return {
    id: 'hero-a', playerId: 'p1', pos: { x: 0, y: 0 }, movementPoints: 0, naval: false, army: [], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power, knowledge: 0 }, mana: 40, manaMax: 40, skills: {}, visitLuck: 0, visitMorale: 0,
    spells, artifacts: Array.from({ length: 10 }, () => null), backpack: [], pendingSkillChoices: [], pendingAttributeChoices: [],
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

function summonState(heroPower = 0): GameState {
  const stacks = [
    stack({ id: 'attacker-0', side: 'attacker', unitId: 'ally', count: 3, pos: { col: 0, row: 2 } }),
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
    unitCatalog: { ally: unit('ally'), foe: unit('foe') }, spellCatalog: { 'sum-spell': SUMMON }, heroes: [hero(['sum-spell'], heroPower)], combat,
  };
}

describe('H-SPELLS.4+ — Invocation (summon)', () => {
  it('place une pile fraîche du camp du lanceur, effectif = base + perPower×Pouvoir', () => {
    const state = summonState(3); // Pouvoir 3 ⇒ 2 + 1×3 = 5
    expect(estimateSpell(state, 'sum-spell', 'attacker-0')).toMatchObject({ kind: 'summon', amount: 5 });
    const { state: next, events } = apply(state, { type: 'CastSpell', spellId: 'sum-spell', targetStackId: 'attacker-0' });
    const summoned = next.combat?.stacks.filter((s) => s.unitId === 'elem');
    expect(summoned).toHaveLength(1);
    expect(summoned?.[0]).toMatchObject({ side: 'attacker', count: 5, firstHp: 25 });
    expect(next.unitCatalog['elem']).toMatchObject({ id: 'elem', groupId: 'elem' }); // enregistrée
    expect(events.find((e) => e.type === 'StackResurrected')).toMatchObject({ unitId: 'elem', count: 5 });
    expect(next.heroes[0]?.mana).toBe(24); // 40 − 16
  });

  it('place la pile invoquée sur un hex libre du camp du lanceur (colonne arrière)', () => {
    const state = summonState(0); // effectif 2
    const { state: next } = apply(state, { type: 'CastSpell', spellId: 'sum-spell', targetStackId: 'attacker-0' });
    const summoned = next.combat?.stacks.find((s) => s.unitId === 'elem');
    expect(summoned?.pos.col).toBe(0); // ligne arrière de l'attaquant, hex libre
    expect(summoned?.count).toBe(2);
  });

  it('vise un allié, jamais l’ennemi (sort amical)', () => {
    const state = summonState();
    expect(validate(state, { type: 'CastSpell', spellId: 'sum-spell', targetStackId: 'defender-0' })?.code).toBe('invalidTarget');
  });

  it('slot unique : une invocation n’écrase pas une pile invoquée existante', () => {
    const state = summonState(0);
    // Simule une pile déjà invoquée au slot 100 (id `attacker-100`).
    state.combat!.stacks.push(
      stack({ id: 'attacker-100', side: 'attacker', unitId: 'elem', count: 2, slot: 100, firstHp: 25, pos: { col: 0, row: 8 } }),
    );
    state.unitCatalog['elem'] = { id: 'elem', groupId: 'elem', nativeTerrain: 'grass', stats: SUMMON.summon!.unit.stats, abilities: [] };
    const { state: next } = apply(state, { type: 'CastSpell', spellId: 'sum-spell', targetStackId: 'attacker-0' });
    const elems = next.combat?.stacks.filter((s) => s.unitId === 'elem') ?? [];
    expect(elems).toHaveLength(2); // l'existante + la nouvelle
    expect(new Set(elems.map((s) => s.id)).size).toBe(2); // ids distincts, pas d'écrasement
    expect(elems.some((s) => s.id === 'attacker-100')).toBe(true); // l'existante préservée
  });
});
