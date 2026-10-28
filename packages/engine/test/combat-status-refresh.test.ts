import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { seedRng } from '../src/core/rng';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import type { SpellDef, SpellStatus } from '../src/hero/types';
import type { CombatState, CombatStack, CombatUnitDef } from '../src/combat/types';
import { testConfig } from './fixtures';

/**
 * Relancer un sort de statut déjà actif sur une pile rafraîchit le statut (mods du
 * nouveau lancer, durée pleine) au lieu de l'empiler ; un autre sort coexiste.
 * IDs génériques — aucune faction moteur.
 */

function unit(id: string): CombatUnitDef {
  return {
    id, groupId: `${id}-g`, nativeTerrain: 'swamp',
    stats: { hp: 20, attack: 5, defense: 5, damage: [4, 4], speed: 6 }, abilities: [],
  };
}

function stack(over: Pick<CombatStack, 'id' | 'side' | 'unitId'> & Partial<CombatStack>): CombatStack {
  return {
    slot: 0, count: 5, firstHp: 20, pos: { col: 0, row: 0 }, retaliationsLeft: 1, waited: false,
    defending: false, ammo: null, spellCharges: 0, marks: 0, immobilizedRounds: 0, transformed: false,
    symbiosisStacks: 0, acted: false, statuses: [], ...over,
  };
}

const status = (spellId: string, attackMod: number, roundsLeft: number): SpellStatus => ({
  spellId, attackMod, defenseMod: 0, speedMod: 0, damageDealtMod: 0, damagePerRound: 0,
  silenced: false, roundsLeft,
});

const WEAKEN: SpellDef = { id: 'weaken', school: 'neutral', circle: 1, manaCost: 5, kind: 'debuff', base: 0, perPower: 0, attackMod: -3 };

function hero(): HeroState {
  return {
    id: 'hero-a', playerId: 'p1', pos: { x: 0, y: 0 }, movementPoints: 0, naval: false, army: [], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, mana: 30, manaMax: 30, skills: {},
    visitLuck: 0, spells: ['weaken'], artifacts: Array.from({ length: 10 }, () => null), pendingSkillChoices: [],
    visitMorale: 0,
    pendingAttributeChoices: [], factionId: '', houseId: '', houseEffects: [], name: '', specialtyId: '',
    specialtyEffects: [], warMachines: [], rosterId: '',
  };
}

function stateWith(foeStatuses: SpellStatus[]): GameState {
  const combat: CombatState = {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [],
    stacks: [
      stack({ id: 'attacker-0', side: 'attacker', unitId: 'u', pos: { col: 4, row: 3 } }),
      stack({ id: 'defender-0', side: 'defender', unitId: 'u', pos: { col: 5, row: 3 }, statuses: foeStatuses }),
    ],
    activeStackId: 'attacker-0', playerSide: 'attacker', heroId: 'hero-a', guardianObjectId: null,
    townId: null, wallDefenseBonus: 0, attackerHeroId: 'hero-a', defenderHeroId: null,
    heroCastThisRound: [], heroAttackUsed: [], finished: false, winner: null,
  };
  return {
    ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(), unitCatalog: { u: unit('u') },
    spellCatalog: { weaken: WEAKEN }, heroes: [hero()], combat,
  };
}

function castOn(foeStatuses: SpellStatus[]): SpellStatus[] {
  const { state } = apply(stateWith(foeStatuses), { type: 'CastSpell', spellId: 'weaken', targetStackId: 'defender-0' });
  return state.combat!.stacks.find((s) => s.id === 'defender-0')!.statuses;
}

describe('statut de sort relancé', () => {
  it('relancer le même sort remplace le statut : un seul, durée pleine, mods non cumulés', () => {
    const fresh = castOn([]);
    expect(fresh).toHaveLength(1);
    const recast = castOn([status('weaken', -3, 1)]);
    expect(recast).toHaveLength(1);
    expect(recast[0]!.attackMod).toBe(-3);
    expect(recast[0]!.roundsLeft).toBe(fresh[0]!.roundsLeft);
  });

  it('un sort différent coexiste avec le nouveau statut', () => {
    const statuses = castOn([status('other', -1, 2)]);
    expect(statuses.map((s) => s.spellId).sort()).toEqual(['other', 'weaken']);
  });
});
