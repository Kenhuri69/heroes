import { describe, expect, it } from 'vitest';
import { moraleOf } from '../src/combat/state-helpers';
import { seedRng } from '../src/core/rng';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import type { CombatState, CombatStack, CombatUnitDef } from '../src/combat/types';
import type { ArtifactDef } from '../src/hero/types';
import { testConfig } from './fixtures';

/**
 * H-ARTEQUIP.2+ — Pendentif de bravoure : un artefact `grantsMoraleImmune` équipé
 * par le héros du camp plancher le moral de TOUTE son armée à 0 (miroir héros de
 * la capacité d'unité `moraleImmune`). Générique, zéro faction, dérivé de
 * l'équipement (pas de bump save).
 */

// Unité normale (ni morte-vivante ni machine) ⇒ compte dans les groupes de moral.
function unit(id: string, groupId: string): CombatUnitDef {
  return { id, groupId, nativeTerrain: 'swamp', stats: { hp: 10, attack: 5, defense: 5, damage: [4, 4], speed: 5 }, abilities: [] };
}

function hero(artifacts: (string | null)[]): HeroState {
  return {
    id: 'hero-a', playerId: 'p1', pos: { x: 0, y: 0 }, movementPoints: 0, naval: false, army: [], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, mana: 0, manaMax: 0, skills: {}, visitLuck: 0, visitMorale: 0,
    spells: [], artifacts, backpack: [], pendingSkillChoices: [], pendingAttributeChoices: [],
    factionId: '', houseId: '', houseEffects: [], name: '', specialtyId: '', specialtyEffects: [], warMachines: [], rosterId: '',
  };
}

function stack(id: string, unitId: string): CombatStack {
  return {
    id, side: 'attacker', slot: 0, unitId, count: 1, firstHp: 10, pos: { col: 0, row: 0 }, retaliationsLeft: 1,
    waited: false, defending: false, ammo: null, spellCharges: 0, marks: 0, immobilizedRounds: 0, transformed: false,
    symbiosisStacks: 0, acted: false, statuses: [],
  };
}

/** Armée à 4 groupes distincts ⇒ malus de moral −3 (raw = −3 avant plancher). */
function fourGroupState(artifacts: (string | null)[]): { state: GameState; combat: CombatState } {
  const stacks = [
    stack('attacker-0', 'a'),
    stack('attacker-1', 'b'),
    stack('attacker-2', 'c'),
    stack('attacker-3', 'd'),
  ];
  const combat: CombatState = {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [], stacks, activeStackId: 'attacker-0',
    playerSide: 'attacker', heroId: null, guardianObjectId: null, townId: null, wallDefenseBonus: 0,
    attackerHeroId: 'hero-a', defenderHeroId: null, heroCastThisRound: [], heroAttackUsed: [], finished: false, winner: null,
  };
  const PENDANT: ArtifactDef = { id: 'pendant', bonus: {}, grantsMoraleImmune: true };
  const state: GameState = {
    ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(),
    unitCatalog: { a: unit('a', 'a'), b: unit('b', 'b'), c: unit('c', 'c'), d: unit('d', 'd') },
    artifactCatalog: { pendant: PENDANT }, heroes: [hero(artifacts)], combat,
  };
  return { state, combat };
}

describe('H-ARTEQUIP.2+ — Pendentif de bravoure (grantsMoraleImmune)', () => {
  it('sans l’artefact : le malus multi-groupes descend le moral sous 0', () => {
    const { state, combat } = fourGroupState(Array.from({ length: 10 }, () => null));
    expect(moraleOf(combat.stacks[0]!, combat, state)).toBe(-3);
  });

  it('avec l’artefact équipé : le moral de l’armée est planché à 0', () => {
    const arts = Array.from({ length: 10 }, () => null) as (string | null)[];
    arts[0] = 'pendant';
    const { state, combat } = fourGroupState(arts);
    expect(moraleOf(combat.stacks[0]!, combat, state)).toBe(0);
  });
});
