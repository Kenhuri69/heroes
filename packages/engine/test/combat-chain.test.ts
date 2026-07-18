import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { estimateSpell } from '../src/hero';
import { seedRng } from '../src/core/rng';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import { initLedger } from '../src/combat/state-helpers';
import type { CombatState, CombatStack, CombatUnitDef } from '../src/combat/types';
import type { SpellDef } from '../src/hero/types';
import { testConfig } from './fixtures';

/**
 * H-SPELLS.4 — Chaîne : un sort `damage` doté de `chain` frappe la cible puis
 * rebondit vers les ennemis les plus proches, dégâts décroissants par saut.
 * Générique (champ déclaratif), zéro faction (ids opaques).
 */

const CHAIN: SpellDef = {
  id: 'chain-spell', school: 'air', circle: 4, manaCost: 20, kind: 'damage', base: 16, perPower: 4,
  chain: { jumps: 2, falloffPct: 40 },
};

function unit(id: string): CombatUnitDef {
  return { id, groupId: `${id}-g`, nativeTerrain: 'swamp', stats: { hp: 100, attack: 5, defense: 5, damage: [4, 4], speed: 5 }, abilities: [] };
}

function hero(): HeroState {
  return {
    id: 'hero-a', playerId: 'p1', pos: { x: 0, y: 0 }, movementPoints: 0, naval: false, army: [], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, mana: 30, manaMax: 30, skills: {}, visitLuck: 0, visitMorale: 0,
    spells: ['chain-spell'], artifacts: Array.from({ length: 10 }, () => null), pendingSkillChoices: [], pendingAttributeChoices: [],
    factionId: '', houseId: '', houseEffects: [], name: '', specialtyId: '', specialtyEffects: [], warMachines: [], rosterId: '',
  };
}

function stack(over: Pick<CombatStack, 'id' | 'side' | 'unitId' | 'count'> & Partial<CombatStack>): CombatStack {
  return {
    slot: 0, firstHp: 100, pos: { col: 0, row: 0 }, retaliationsLeft: 1, waited: false, defending: false,
    ammo: null, spellCharges: 0, marks: 0, immobilizedRounds: 0, transformed: false, symbiosisStacks: 0, acted: false, statuses: [],
    ...over,
  };
}

function chainState(enemies: CombatStack[]): GameState {
  const stacks = [stack({ id: 'attacker-0', side: 'attacker', unitId: 'ally', count: 2, pos: { col: 0, row: 2 } }), ...enemies];
  const combat: CombatState = {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [], stacks, activeStackId: 'attacker-0',
    playerSide: 'attacker', heroId: null, guardianObjectId: null, townId: null, wallDefenseBonus: 0,
    attackerHeroId: 'hero-a', defenderHeroId: null, heroCastThisRound: [], heroAttackUsed: [], finished: false, winner: null,
  };
  initLedger(combat);
  return {
    ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(),
    unitCatalog: { ally: unit('ally'), foe: unit('foe') }, spellCatalog: { 'chain-spell': CHAIN }, heroes: [hero()], combat,
  };
}

describe('H-SPELLS.4 — Chaîne d’éclairs', () => {
  it('frappe la cible puis rebondit sur les 2 ennemis proches, dégâts décroissants', () => {
    const state = chainState([
      stack({ id: 'defender-0', side: 'defender', unitId: 'foe', count: 1, pos: { col: 10, row: 2 } }),
      stack({ id: 'defender-1', side: 'defender', unitId: 'foe', count: 1, pos: { col: 11, row: 2 } }),
      stack({ id: 'defender-2', side: 'defender', unitId: 'foe', count: 1, pos: { col: 13, row: 2 } }),
    ]);
    const { state: next, events } = apply(state, { type: 'CastSpell', spellId: 'chain-spell', targetStackId: 'defender-0' });
    const hp = (id: string): number => next.combat!.stacks.find((s) => s.id === id)!.firstHp;
    // Puissance 0 ⇒ base 16 ; sauts × 0,6 puis × 0,36 : 16, round(9.6)=10, round(5.76)=6.
    expect(100 - hp('defender-0')).toBe(16);
    expect(100 - hp('defender-1')).toBe(10);
    expect(100 - hp('defender-2')).toBe(6);
    expect(events.find((e) => e.type === 'SpellCast')).toMatchObject({ amount: 32 });
  });

  it('un seul ennemi : pas de saut (dégâts pleins uniquement)', () => {
    const state = chainState([stack({ id: 'defender-0', side: 'defender', unitId: 'foe', count: 1, pos: { col: 10, row: 2 } })]);
    const { state: next } = apply(state, { type: 'CastSpell', spellId: 'chain-spell', targetStackId: 'defender-0' });
    expect(100 - next.combat!.stacks.find((s) => s.id === 'defender-0')!.firstHp).toBe(16);
  });

  it('la préviz agrège la chaîne (16 + 10 + 6 = 32)', () => {
    const state = chainState([
      stack({ id: 'defender-0', side: 'defender', unitId: 'foe', count: 1, pos: { col: 10, row: 2 } }),
      stack({ id: 'defender-1', side: 'defender', unitId: 'foe', count: 1, pos: { col: 11, row: 2 } }),
      stack({ id: 'defender-2', side: 'defender', unitId: 'foe', count: 1, pos: { col: 13, row: 2 } }),
    ]);
    expect(estimateSpell(state, 'chain-spell', 'defender-0')).toMatchObject({ kind: 'damage', amount: 32 });
  });
});
