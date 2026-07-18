import { describe, expect, it } from 'vitest';
import { seedRng } from '../src/core/rng';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import { initLedger, isStackSpellImmune } from '../src/combat/state-helpers';
import type { CombatState, CombatStack, CombatUnitDef } from '../src/combat/types';
import type { ArtifactDef, SpellDef } from '../src/hero/types';

/**
 * H-ARTEQUIP.2+ — Sceau de l'intouchable : un artefact `grantsSpellImmune` équipé
 * rend TOUTE l'armée du héros INCIBLABLE par un sort HOSTILE ennemi. Prédicat
 * PARTAGÉ `isStackSpellImmune` (validation + IA + client) — même règle partout.
 * Générique, zéro faction, dérivé de l'équipement.
 */

const BOLT: SpellDef = { id: 'bolt', school: 'neutral', circle: 1, manaCost: 4, kind: 'damage', base: 10, perPower: 0 };

function unit(id: string, abilities: CombatUnitDef['abilities'] = []): CombatUnitDef {
  return { id, groupId: `${id}-g`, nativeTerrain: 'grass', stats: { hp: 100, attack: 5, defense: 5, damage: [4, 4], speed: 5 }, abilities };
}

function hero(id: string, artifacts: (string | null)[]): HeroState {
  return {
    id, playerId: id, pos: { x: 0, y: 0 }, movementPoints: 0, naval: false, army: [], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, mana: 40, manaMax: 40, skills: {}, visitLuck: 0, visitMorale: 0,
    spells: ['bolt'], artifacts, backpack: [], pendingSkillChoices: [], pendingAttributeChoices: [],
    factionId: '', houseId: '', houseEffects: [], name: '', specialtyId: '', specialtyEffects: [], warMachines: [], rosterId: '',
  };
}

function stack(id: string, side: CombatStack['side'], unitId: string): CombatStack {
  return {
    id, side, slot: 0, unitId, count: 1, firstHp: 100, pos: { col: side === 'attacker' ? 0 : 10, row: 2 }, retaliationsLeft: 1,
    waited: false, defending: false, ammo: null, spellCharges: 0, marks: 0, immobilizedRounds: 0, transformed: false,
    symbiosisStacks: 0, acted: false, statuses: [],
  };
}

/** Le héros DÉFENSEUR porte (ou non) le Sceau ; l'unité peut aussi être `spellImmune`. */
function state(defenderHasSeal: boolean, defenderUnitImmune = false): GameState {
  const seal: ArtifactDef = { id: 'seal', bonus: {}, grantsSpellImmune: true };
  const defArts = Array.from({ length: 10 }, () => null) as (string | null)[];
  if (defenderHasSeal) defArts[0] = 'seal';
  const combat: CombatState = {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [],
    stacks: [stack('attacker-0', 'attacker', 'ally'), stack('defender-0', 'defender', 'foe')],
    activeStackId: 'attacker-0', playerSide: 'attacker', heroId: null, guardianObjectId: null, townId: null,
    wallDefenseBonus: 0, attackerHeroId: 'atk', defenderHeroId: 'def', heroCastThisRound: [], heroAttackUsed: [], finished: false, winner: null,
  };
  initLedger(combat);
  return {
    ...createEmptyState(), started: true, rng: seedRng(1),
    unitCatalog: { ally: unit('ally'), foe: unit('foe', defenderUnitImmune ? [{ id: 'spellImmune' }] : []) },
    spellCatalog: { bolt: BOLT }, artifactCatalog: { seal },
    heroes: [hero('atk', Array.from({ length: 10 }, () => null)), hero('def', defArts)], combat,
  };
}

describe('H-ARTEQUIP.2+ — Sceau de l’intouchable (grantsSpellImmune)', () => {
  it('sans le sceau : la pile ennemie est ciblable', () => {
    const s = state(false);
    const foe = s.combat!.stacks.find((st) => st.id === 'defender-0')!;
    expect(isStackSpellImmune(s, s.combat!, foe)).toBe(false);
  });

  it('avec le sceau sur le héros défenseur : toute son armée est inciblable', () => {
    const s = state(true);
    const foe = s.combat!.stacks.find((st) => st.id === 'defender-0')!;
    expect(isStackSpellImmune(s, s.combat!, foe)).toBe(true);
  });

  it('l’immunité d’UNITÉ (spellImmune) reste couverte par le même prédicat', () => {
    const s = state(false, true);
    const foe = s.combat!.stacks.find((st) => st.id === 'defender-0')!;
    expect(isStackSpellImmune(s, s.combat!, foe)).toBe(true);
  });
});
