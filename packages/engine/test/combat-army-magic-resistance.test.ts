import { describe, expect, it } from 'vitest';
import { estimateSpell } from '../src/hero';
import { seedRng } from '../src/core/rng';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import { initLedger } from '../src/combat/state-helpers';
import type { CombatState, CombatStack, CombatUnitDef } from '../src/combat/types';
import type { ArtifactDef, SpellDef } from '../src/hero/types';
import { testConfig } from './fixtures';

/**
 * H-ARTEQUIP.2+ — Cape du refus : un artefact `armyMagicResistance` équipé par le
 * héros d'un camp réduit les dégâts des sorts ENNEMIS sur toute son armée (cœur de
 * dégâts partagé résolution + préviz). Générique, zéro faction, dérivé de l'équipement.
 */

const NUKE: SpellDef = { id: 'nuke', school: 'fire', circle: 3, manaCost: 10, kind: 'damage', base: 100, perPower: 0 };

function unit(id: string): CombatUnitDef {
  return { id, groupId: `${id}-g`, nativeTerrain: 'swamp', stats: { hp: 1000, attack: 5, defense: 5, damage: [4, 4], speed: 5 }, abilities: [] };
}

function hero(id: string, artifacts: (string | null)[]): HeroState {
  return {
    id, playerId: id, pos: { x: 0, y: 0 }, movementPoints: 0, army: [], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, mana: 40, manaMax: 40, skills: {}, visitLuck: 0, visitMorale: 0,
    spells: ['nuke'], artifacts, backpack: [], pendingSkillChoices: [], pendingAttributeChoices: [],
    factionId: '', houseId: '', houseEffects: [], name: '', specialtyId: '', specialtyEffects: [], warMachines: [], rosterId: '',
  };
}

function stack(id: string, side: CombatStack['side'], unitId: string): CombatStack {
  return {
    id, side, slot: 0, unitId, count: 1, firstHp: 1000, pos: { col: side === 'attacker' ? 0 : 10, row: 2 }, retaliationsLeft: 1,
    waited: false, defending: false, ammo: null, spellCharges: 0, marks: 0, immobilizedRounds: 0, transformed: false,
    symbiosisStacks: 0, acted: false, statuses: [],
  };
}

/** Le héros défenseur porte (ou non) la Cape du refus (résistance d'armée 0,25). */
function state(defenderHasCape: boolean): GameState {
  const cape: ArtifactDef = { id: 'cape', bonus: {}, armyMagicResistance: 0.25 };
  const defArts = Array.from({ length: 10 }, () => null) as (string | null)[];
  if (defenderHasCape) defArts[0] = 'cape';
  const combat: CombatState = {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [],
    stacks: [stack('attacker-0', 'attacker', 'ally'), stack('defender-0', 'defender', 'foe')],
    activeStackId: 'attacker-0', playerSide: 'attacker', heroId: null, guardianObjectId: null, townId: null,
    wallDefenseBonus: 0, attackerHeroId: 'atk', defenderHeroId: 'def', heroCastThisRound: [], heroAttackUsed: [], finished: false, winner: null,
  };
  initLedger(combat);
  return {
    ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(),
    unitCatalog: { ally: unit('ally'), foe: unit('foe') }, spellCatalog: { nuke: NUKE },
    artifactCatalog: { cape }, heroes: [hero('atk', Array.from({ length: 10 }, () => null)), hero('def', defArts)], combat,
  };
}

describe('H-ARTEQUIP.2+ — Cape du refus (armyMagicResistance)', () => {
  it('sans la cape : le sort ennemi inflige ses dégâts pleins', () => {
    expect(estimateSpell(state(false), 'nuke', 'defender-0')).toMatchObject({ kind: 'damage', amount: 100 });
  });

  it('avec la cape sur le héros défenseur : dégâts réduits de la résistance d’armée', () => {
    // 100 × (1 − 0,25) = 75.
    expect(estimateSpell(state(true), 'nuke', 'defender-0')).toMatchObject({ kind: 'damage', amount: 75 });
  });
});
