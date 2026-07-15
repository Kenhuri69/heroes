import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { seedRng } from '../src/core/rng';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import { applySpellToTargets } from '../src/combat/spell-effect';
import { initLedger } from '../src/combat/state-helpers';
import type { CombatState, CombatStack, CombatUnitDef } from '../src/combat/types';
import type { ArtifactDef, SpellDef } from '../src/hero/types';
import type { GameEvent } from '../src/core/events';
import { testConfig } from './fixtures';

/**
 * H-ARTEQUIP.2+ — Talisman de constance : un artefact `grantsStatusImmune` équipé
 * par le héros d'un camp empêche les statuts NÉFASTES de sort (debuff/silence
 * ennemis) de se poser sur son armée, tandis que les buffs alliés restent
 * appliqués. Miroir statut de `armyMagicResistance`. Générique, zéro faction.
 */

const CURSE: SpellDef = { id: 'curse', school: 'earth', circle: 2, manaCost: 8, kind: 'debuff', base: 0, perPower: 0, attackMod: -3 };
const BLESS: SpellDef = { id: 'bless', school: 'water', circle: 2, manaCost: 8, kind: 'buff', base: 0, perPower: 0, attackMod: 3 };

function unit(id: string): CombatUnitDef {
  return { id, groupId: `${id}-g`, nativeTerrain: 'swamp', stats: { hp: 1000, attack: 5, defense: 5, damage: [4, 4], speed: 5 }, abilities: [] };
}

function hero(id: string, artifacts: (string | null)[]): HeroState {
  return {
    id, playerId: id, pos: { x: 0, y: 0 }, movementPoints: 0, army: [], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, mana: 40, manaMax: 40, skills: {}, visitLuck: 0, visitMorale: 0,
    spells: [], artifacts, backpack: [], pendingSkillChoices: [], pendingAttributeChoices: [],
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

/** Le héros défenseur porte (ou non) le Talisman de constance (immunité aux statuts). */
function state(defenderHasTalisman: boolean): GameState {
  const talisman: ArtifactDef = { id: 'talisman', bonus: {}, grantsStatusImmune: true };
  const defArts = Array.from({ length: 10 }, () => null) as (string | null)[];
  if (defenderHasTalisman) defArts[0] = 'talisman';
  const combat: CombatState = {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [],
    stacks: [stack('attacker-0', 'attacker', 'ally'), stack('defender-0', 'defender', 'foe')],
    activeStackId: 'attacker-0', playerSide: 'attacker', heroId: null, guardianObjectId: null, townId: null,
    wallDefenseBonus: 0, attackerHeroId: 'atk', defenderHeroId: 'def', heroCastThisRound: [], heroAttackUsed: [], finished: false, winner: null,
  };
  initLedger(combat);
  return {
    ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(),
    unitCatalog: { ally: unit('ally'), foe: unit('foe') }, spellCatalog: { curse: CURSE, bless: BLESS },
    artifactCatalog: { talisman }, heroes: [hero('atk', Array.from({ length: 10 }, () => null)), hero('def', defArts)], combat,
  };
}

/** Résout un sort de statut sur `centerId` et retourne l'état d'après. */
function cast(s: GameState, spellId: string, centerId: string): GameState {
  return produce(s, (draft) => {
    const combat = draft.combat!;
    const spell = draft.spellCatalog[spellId]!;
    const center = combat.stacks.find((st) => st.id === centerId)!;
    applySpellToTargets(draft, combat, spell, center, 1, 0, [] as GameEvent[]);
  });
}

const statusesOf = (s: GameState, id: string) => s.combat!.stacks.find((st) => st.id === id)!.statuses;

describe('H-ARTEQUIP.2+ — Talisman de constance (grantsStatusImmune)', () => {
  it('sans le talisman : le debuff ennemi se pose', () => {
    expect(statusesOf(cast(state(false), 'curse', 'defender-0'), 'defender-0')).toHaveLength(1);
  });

  it('avec le talisman sur le héros défenseur : le debuff ennemi ne se pose pas', () => {
    expect(statusesOf(cast(state(true), 'curse', 'defender-0'), 'defender-0')).toHaveLength(0);
  });

  it('le talisman ne bloque PAS un buff allié (statut bénéfique)', () => {
    // Buff sur la propre pile du défenseur (spellTargetsEnemy = false) ⇒ appliqué.
    expect(statusesOf(cast(state(true), 'bless', 'defender-0'), 'defender-0')).toHaveLength(1);
  });
});
