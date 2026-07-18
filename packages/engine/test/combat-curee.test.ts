import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { applyAction } from '../src/combat/actions';
import { seedRng } from '../src/core/rng';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import type { SpellDef } from '../src/hero/types';
import type { GameEvent } from '../src/core/events';
import type { CombatState, CombatStack, CombatUnitDef } from '../src/combat/types';
import { testConfig } from './fixtures';

/**
 * Lot F-SCHOOLS.6 — Heure de la Curée (`SpellKind 'rally'` +
 * `CombatState.markedNoRetaliation`, doc 05 §6) : les attaques du camp du lanceur
 * contre une pile MARQUÉE n'essuient aucune riposte. IDs génériques.
 */

function unit(over: Partial<CombatUnitDef> & { id: string }): CombatUnitDef {
  return {
    groupId: `${over.id}-g`, nativeTerrain: 'swamp',
    stats: { hp: 100, attack: 5, defense: 5, damage: [4, 4], speed: 6 }, abilities: [], ...over,
  };
}

function stack(over: Pick<CombatStack, 'id' | 'side' | 'unitId'> & Partial<CombatStack>): CombatStack {
  return {
    slot: 0, count: 1, firstHp: 100, pos: { col: 0, row: 0 }, retaliationsLeft: 1, waited: false,
    defending: false, ammo: null, spellCharges: 0, marks: 0, immobilizedRounds: 0, transformed: false,
    symbiosisStacks: 0, acted: false, statuses: [], ...over,
  };
}

const CATALOG: Record<string, CombatUnitDef> = { melee: unit({ id: 'melee' }) };
const RALLY: SpellDef = { id: 'curee', school: 'traque', circle: 5, manaCost: 5, kind: 'rally', base: 1, perPower: 0 };

function hero(): HeroState {
  return {
    id: 'hero-a', playerId: 'p1', pos: { x: 0, y: 0 }, movementPoints: 0, naval: false, army: [], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, mana: 30, manaMax: 30, skills: {},
    visitLuck: 0, spells: ['curee'], artifacts: Array.from({ length: 10 }, () => null), pendingSkillChoices: [],
    visitMorale: 0,
    pendingAttributeChoices: [], factionId: '', houseId: '', houseEffects: [], name: '', specialtyId: '',
    specialtyEffects: [], warMachines: [], rosterId: '',
  };
}

/** Attaquant en (0,0) adjacent à un défenseur en (1,0) marqué. */
function stateWith(over: Partial<CombatState> = {}, targetMarks = 1): GameState {
  const combat: CombatState = {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [],
    stacks: [
      stack({ id: 'attacker-0', side: 'attacker', unitId: 'melee', pos: { col: 0, row: 0 } }),
      stack({ id: 'defender-0', side: 'defender', unitId: 'melee', pos: { col: 1, row: 0 }, marks: targetMarks }),
    ],
    activeStackId: 'attacker-0', playerSide: 'attacker', heroId: 'hero-a', guardianObjectId: null,
    townId: null, wallDefenseBonus: 0, attackerHeroId: 'hero-a', defenderHeroId: null,
    heroCastThisRound: [], heroAttackUsed: [], finished: false, winner: null, ...over,
  };
  return {
    ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(), unitCatalog: CATALOG,
    spellCatalog: { curee: RALLY }, heroes: [hero()], combat,
  };
}

const strikes = (events: GameEvent[]) =>
  events.filter((e) => e.type === 'StackAttacked') as Extract<GameEvent, { type: 'StackAttacked' }>[];

function attack(state: GameState) {
  const events: GameEvent[] = [];
  produce(state, (draft) => applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0', from: { col: 0, row: 0 } }));
  return events;
}

describe('F-SCHOOLS.6 — Heure de la Curée', () => {
  it('le sort estampille markedNoRetaliation pour le camp du lanceur', () => {
    const { state: next } = apply(stateWith(), { type: 'CastSpell', spellId: 'curee', targetStackId: 'attacker-0' });
    expect(next.combat!.markedNoRetaliation).toEqual({ side: 'attacker', roundsLeft: 1 });
  });

  it('sans Curée : la cible marquée riposte normalement', () => {
    expect(strikes(attack(stateWith())).some((s) => s.retaliation)).toBe(true);
  });

  it('avec Curée du bon camp + cible marquée : aucune riposte', () => {
    const s = stateWith({ markedNoRetaliation: { side: 'attacker', roundsLeft: 1 } });
    expect(strikes(attack(s)).some((st) => st.retaliation)).toBe(false);
  });

  it('Curée du bon camp mais cible NON marquée : riposte conservée', () => {
    const s = stateWith({ markedNoRetaliation: { side: 'attacker', roundsLeft: 1 } }, 0);
    expect(strikes(attack(s)).some((st) => st.retaliation)).toBe(true);
  });

  it('Curée de l’AUTRE camp : ne protège pas l’attaquant', () => {
    const s = stateWith({ markedNoRetaliation: { side: 'defender', roundsLeft: 1 } });
    expect(strikes(attack(s)).some((st) => st.retaliation)).toBe(true);
  });

  it('l’effet expire au passage de round', () => {
    const events: GameEvent[] = [];
    const after = produce(stateWith({ markedNoRetaliation: { side: 'attacker', roundsLeft: 1 } }), (draft) => {
      const combat = draft.combat as CombatState;
      for (const st of combat.stacks) { st.acted = true; st.waited = false; }
      applyAction(draft, events, 'attacker-0', { type: 'defend' });
    });
    expect(after.combat!.markedNoRetaliation).toBeUndefined();
  });
});
