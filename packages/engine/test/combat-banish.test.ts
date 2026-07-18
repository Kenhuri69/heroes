import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { seedRng } from '../src/core/rng';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import type { SpellDef } from '../src/hero/types';
import type { CombatState, CombatStack, CombatUnitDef } from '../src/combat/types';
import { testConfig } from './fixtures';

/**
 * Lot F-SCHOOLS.5 — Bannissement (`SpellKind 'banish'` + capacité `banishable`,
 * doc 05 §6) : retire une pile ENNEMIE `banishable` dont le total de PV ≤ seuil.
 * IDs génériques (`summon`/`solid`/`ally`) — aucune faction moteur.
 */

function unit(over: Partial<CombatUnitDef> & { id: string }): CombatUnitDef {
  return {
    groupId: `${over.id}-g`, nativeTerrain: 'swamp',
    stats: { hp: 10, attack: 5, defense: 5, damage: [4, 4], speed: 6 }, abilities: [], ...over,
  };
}

function stack(over: Pick<CombatStack, 'id' | 'side' | 'unitId'> & Partial<CombatStack>): CombatStack {
  return {
    slot: 0, count: 1, firstHp: 10, pos: { col: 0, row: 0 }, retaliationsLeft: 1, waited: false,
    defending: false, ammo: null, spellCharges: 0, marks: 0, immobilizedRounds: 0, transformed: false,
    symbiosisStacks: 0, acted: false, statuses: [], ...over,
  };
}

// `summon` est banishable ; `solid` ne l'est pas.
const CATALOG: Record<string, CombatUnitDef> = {
  ally: unit({ id: 'ally' }),
  summon: unit({ id: 'summon', abilities: [{ id: 'banishable' }] }),
  solid: unit({ id: 'solid', abilities: [] }),
};
// seuil = base 40 + perPower 0 × Pouvoir 0 = 40.
const BANISH: SpellDef = { id: 'ban', school: 'traque', circle: 4, manaCost: 5, kind: 'banish', base: 40, perPower: 0 };

function hero(): HeroState {
  return {
    id: 'hero-a', playerId: 'p1', pos: { x: 0, y: 0 }, movementPoints: 0, naval: false, army: [], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, mana: 30, manaMax: 30, skills: {},
    visitLuck: 0, spells: ['ban'], artifacts: Array.from({ length: 10 }, () => null), pendingSkillChoices: [],
    visitMorale: 0,
    pendingAttributeChoices: [], factionId: '', houseId: '', houseEffects: [], name: '', specialtyId: '',
    specialtyEffects: [], warMachines: [], rosterId: '',
  };
}

function stateWith(defenders: CombatStack[]): GameState {
  const combat: CombatState = {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [],
    stacks: [stack({ id: 'attacker-0', side: 'attacker', unitId: 'ally', pos: { col: 0, row: 3 } }), ...defenders],
    activeStackId: 'attacker-0', playerSide: 'attacker', heroId: 'hero-a', guardianObjectId: null,
    townId: null, wallDefenseBonus: 0, attackerHeroId: 'hero-a', defenderHeroId: null,
    heroCastThisRound: [], heroAttackUsed: [], finished: false, winner: null,
  };
  return {
    ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(), unitCatalog: CATALOG,
    spellCatalog: { ban: BANISH }, heroes: [hero()], combat,
  };
}

const present = (s: GameState, id: string) => s.combat!.stacks.some((x) => x.id === id && x.count > 0);

describe('F-SCHOOLS.5 — Bannissement', () => {
  it('bannit une pile `banishable` dont le total de PV ≤ seuil', () => {
    // 3 × 10 PV = 30 ≤ 40 ⇒ bannie.
    const foe = stack({ id: 'defender-0', side: 'defender', unitId: 'summon', count: 3, pos: { col: 5, row: 3 } });
    // Une 2ᵉ pile pour que le combat ne se termine pas au retrait.
    const other = stack({ id: 'defender-1', side: 'defender', unitId: 'solid', pos: { col: 6, row: 3 } });
    const { state: next } = apply(stateWith([foe, other]), { type: 'CastSpell', spellId: 'ban', targetStackId: 'defender-0' });
    expect(present(next, 'defender-0')).toBe(false);
    expect(present(next, 'defender-1')).toBe(true);
  });

  it('épargne une pile non-`banishable` (même sous le seuil)', () => {
    const foe = stack({ id: 'defender-0', side: 'defender', unitId: 'solid', count: 1, pos: { col: 5, row: 3 } });
    const other = stack({ id: 'defender-1', side: 'defender', unitId: 'summon', pos: { col: 6, row: 3 } });
    const { state: next } = apply(stateWith([foe, other]), { type: 'CastSpell', spellId: 'ban', targetStackId: 'defender-0' });
    expect(present(next, 'defender-0')).toBe(true);
  });

  it('épargne une pile `banishable` dont le total de PV dépasse le seuil', () => {
    // 5 × 10 = 50 > 40 ⇒ intacte.
    const foe = stack({ id: 'defender-0', side: 'defender', unitId: 'summon', count: 5, pos: { col: 5, row: 3 } });
    const other = stack({ id: 'defender-1', side: 'defender', unitId: 'solid', pos: { col: 6, row: 3 } });
    const { state: next } = apply(stateWith([foe, other]), { type: 'CastSpell', spellId: 'ban', targetStackId: 'defender-0' });
    expect(present(next, 'defender-0')).toBe(true);
    expect(next.combat!.stacks.find((x) => x.id === 'defender-0')!.count).toBe(5);
  });
});
