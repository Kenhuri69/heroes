import { describe, expect, it } from 'vitest';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { moraleOf } from '../src/combat/state-helpers';
import { heroAttackOf, heroDefenseOf } from '../src/combat/damage';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import { testConfig } from './fixtures';

/**
 * Lot F-BONUS — bonus de combat passifs de faction (`combatBonus`, doc 03 §2 /
 * doc 06 §4) : Ferveur (+moral) et Formation (+défense) accordés à l'armée du
 * héros de la faction. Générique : faction de TEST (aucun nom de faction réel).
 */

function unit(over: Partial<CombatUnitDef> & { id: string }): CombatUnitDef {
  return { groupId: `${over.id}-g`, nativeTerrain: 'swamp', stats: { hp: 10, attack: 5, defense: 5, damage: [1, 2], speed: 5 }, abilities: [], ...over };
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

const catalog: Record<string, CombatUnitDef> = { grunt: unit({ id: 'grunt' }) };
// Faction de test portant Ferveur (+1 moral) et Formation (+2 déf ≈ +5 %).
const FACTION_CATALOG = { 'test-fac': { bonuses: [{ type: 'combatBonus' as const, morale: 1, defense: 2 }] } };

function state(over: Partial<GameState>): GameState {
  return { ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(), unitCatalog: catalog, ...over };
}

describe('F-BONUS — bonus de combat passifs de faction', () => {
  it('accorde +1 moral et +2 défense à l’armée du héros de la faction', () => {
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'grunt' });
    const combat = combatState({ stacks: [attacker], attackerHeroId: 'hero-1' });
    const s = state({ heroes: [hero({ factionId: 'test-fac' })], combat, factionCatalog: FACTION_CATALOG });
    // Moral : sans faction, terrain non natif ⇒ 0 ; avec Ferveur ⇒ +1.
    expect(moraleOf(attacker, combat, s)).toBe(1);
    // Défense de camp : +2 (Formation), attaque de camp : +0.
    expect(heroDefenseOf(s, combat, 'attacker')).toBe(2);
    expect(heroAttackOf(s, combat, 'attacker')).toBe(0);
  });

  it('n’affecte pas un camp sans faction (factionCatalog vide)', () => {
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'grunt' });
    const combat = combatState({ stacks: [attacker], attackerHeroId: 'hero-1' });
    const s = state({ heroes: [hero({ factionId: '' })], combat });
    expect(moraleOf(attacker, combat, s)).toBe(0);
    expect(heroDefenseOf(s, combat, 'attacker')).toBe(0);
  });

  it('n’affecte que le camp porteur, pas l’adversaire', () => {
    const att = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'grunt' });
    const def = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'grunt' });
    const combat = combatState({ stacks: [att, def], attackerHeroId: 'hero-1', defenderHeroId: 'hero-2' });
    const s = state({
      heroes: [hero({ id: 'hero-1', factionId: 'test-fac' }), hero({ id: 'hero-2', factionId: '' })],
      combat, factionCatalog: FACTION_CATALOG,
    });
    expect(heroDefenseOf(s, combat, 'attacker')).toBe(2); // porteur
    expect(heroDefenseOf(s, combat, 'defender')).toBe(0); // adversaire sans faction
  });
});
