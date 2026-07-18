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
 * H-SPELLS.4+ — Résurrection de pile entière : un sort `resurrectFull` relève une
 * pile ALLIÉE entièrement anéantie (retirée du plateau, gardée au `graveyard`) au
 * camp du lanceur. Générique, zéro faction (ids opaques), zéro champ de save
 * (graveyard = champ optionnel de CombatState).
 */

const RES: SpellDef = {
  id: 'res-spell', school: 'earth', circle: 4, manaCost: 24, kind: 'resurrectFull', base: 60, perPower: 0,
};
const NUKE: SpellDef = {
  id: 'nuke-spell', school: 'fire', circle: 5, manaCost: 20, kind: 'damage', base: 999, perPower: 0,
};

function unit(id: string): CombatUnitDef {
  return { id, groupId: `${id}-g`, nativeTerrain: 'swamp', stats: { hp: 10, attack: 5, defense: 5, damage: [4, 4], speed: 5 }, abilities: [] };
}

function hero(spells: string[]): HeroState {
  return {
    id: 'hero-a', playerId: 'p1', pos: { x: 0, y: 0 }, movementPoints: 0, naval: false, army: [], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, mana: 40, manaMax: 40, skills: {}, visitLuck: 0, visitMorale: 0,
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

function baseState(stacks: CombatStack[], spells: string[], catalog: SpellDef[]): GameState {
  const combat: CombatState = {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [], stacks, activeStackId: stacks[0]?.id ?? null,
    playerSide: 'attacker', heroId: null, guardianObjectId: null, townId: null, wallDefenseBonus: 0,
    attackerHeroId: 'hero-a', defenderHeroId: null, heroCastThisRound: [], heroAttackUsed: [], finished: false, winner: null,
  };
  initLedger(combat);
  const spellCatalog: Record<string, SpellDef> = {};
  for (const s of catalog) spellCatalog[s.id] = s;
  return {
    ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(),
    unitCatalog: { ally: unit('ally'), foe: unit('foe') }, spellCatalog, heroes: [hero(spells)], combat,
  };
}

describe('H-SPELLS.4+ — Résurrection totale (resurrectFull)', () => {
  it('relève la pile morte du camp du lanceur à sa position d’origine', () => {
    const state = baseState(
      [
        stack({ id: 'attacker-0', side: 'attacker', unitId: 'ally', count: 3, pos: { col: 0, row: 2 } }),
        stack({ id: 'defender-0', side: 'defender', unitId: 'foe', count: 5, pos: { col: 10, row: 2 } }),
      ],
      ['res-spell'],
      [RES],
    );
    // Cimetière : une pile alliée anéantie (10 créatures perdues).
    state.combat!.graveyard = [{ id: 'attacker-1', unitId: 'ally', side: 'attacker', slot: 1, pos: { col: 0, row: 5 }, maxCount: 10 }];
    // Préviz : 60 PV / 10 PV = 6 créatures (plafonné à maxCount 10).
    expect(estimateSpell(state, 'res-spell', 'attacker-0')).toMatchObject({ kind: 'resurrectFull', amount: 6 });
    const { state: next, events } = apply(state, { type: 'CastSpell', spellId: 'res-spell', targetStackId: 'attacker-0' });
    const revived = next.combat?.stacks.find((s) => s.id === 'attacker-1');
    expect(revived).toMatchObject({ side: 'attacker', unitId: 'ally', count: 6, pos: { col: 0, row: 5 } });
    expect(next.combat?.graveyard).toEqual([]); // entrée consommée
    expect(events.find((e) => e.type === 'StackResurrected')).toMatchObject({ stackId: 'attacker-1', count: 6 });
    expect(next.heroes[0]?.mana).toBe(16); // coût 24
  });

  it('cimetière vide : fizzle (amount 0, aucune pile ajoutée)', () => {
    const state = baseState(
      [
        stack({ id: 'attacker-0', side: 'attacker', unitId: 'ally', count: 3, pos: { col: 0, row: 2 } }),
        stack({ id: 'defender-0', side: 'defender', unitId: 'foe', count: 5, pos: { col: 10, row: 2 } }),
      ],
      ['res-spell'],
      [RES],
    );
    const { state: next, events } = apply(state, { type: 'CastSpell', spellId: 'res-spell', targetStackId: 'attacker-0' });
    expect(next.combat?.stacks).toHaveLength(2);
    expect(events.find((e) => e.type === 'SpellCast')).toMatchObject({ amount: 0 });
  });

  it('vise un allié, jamais l’ennemi (contrainte de camp)', () => {
    const state = baseState(
      [
        stack({ id: 'attacker-0', side: 'attacker', unitId: 'ally', count: 3, pos: { col: 0, row: 2 } }),
        stack({ id: 'defender-0', side: 'defender', unitId: 'foe', count: 5, pos: { col: 10, row: 2 } }),
      ],
      ['res-spell'],
      [RES],
    );
    expect(validate(state, { type: 'CastSpell', spellId: 'res-spell', targetStackId: 'defender-0' })?.code).toBe('invalidTarget');
  });

  it('une pile anéantie est enregistrée au cimetière (mort → graveyard)', () => {
    const state = baseState(
      [
        stack({ id: 'attacker-0', side: 'attacker', unitId: 'ally', count: 3, pos: { col: 0, row: 2 } }),
        stack({ id: 'defender-0', side: 'defender', unitId: 'foe', count: 1, pos: { col: 10, row: 2 } }),
        // 2ᵉ pile défenseur : le combat continue après la mort de defender-0 (sinon
        // le combat se termine et `combat` — donc le cimetière — disparaît).
        stack({ id: 'defender-1', side: 'defender', unitId: 'foe', count: 5, pos: { col: 10, row: 5 } }),
      ],
      ['nuke-spell'],
      [NUKE],
    );
    const { state: next } = apply(state, { type: 'CastSpell', spellId: 'nuke-spell', targetStackId: 'defender-0' });
    expect(next.combat?.stacks.some((s) => s.id === 'defender-0')).toBe(false); // retirée
    expect(next.combat?.graveyard).toContainEqual(
      expect.objectContaining({ id: 'defender-0', unitId: 'foe', side: 'defender', maxCount: 1 }),
    );
  });
});
