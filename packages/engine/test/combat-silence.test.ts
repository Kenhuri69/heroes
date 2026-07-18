import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { validateCombatAction, applyAction } from '../src/combat/actions';
import { chooseAction } from '../src/combat/ai';
import { seedRng } from '../src/core/rng';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import type { SpellDef, SpellStatus } from '../src/hero/types';
import type { GameEvent } from '../src/core/events';
import type { CombatState, CombatStack, CombatUnitDef } from '../src/combat/types';
import { testConfig } from './fixtures';

/**
 * Lot F-SCHOOLS.4 — Silence Scellé (`SpellKind 'silence'` + `SpellStatus.silenced`,
 * doc 05 §6) : une pile silenciée ne peut plus lancer son sort d'unité
 * (`spellcaster`). IDs génériques (`caster`/`foe`) — aucune faction moteur.
 */

function unit(over: Partial<CombatUnitDef> & { id: string }): CombatUnitDef {
  return {
    groupId: `${over.id}-g`, nativeTerrain: 'swamp',
    stats: { hp: 20, attack: 5, defense: 5, damage: [4, 4], speed: 6 }, abilities: [], ...over,
  };
}

function stack(over: Pick<CombatStack, 'id' | 'side' | 'unitId'> & Partial<CombatStack>): CombatStack {
  return {
    slot: 0, count: 5, firstHp: 20, pos: { col: 0, row: 0 }, retaliationsLeft: 1, waited: false,
    defending: false, ammo: null, spellCharges: 0, marks: 0, immobilizedRounds: 0, transformed: false,
    symbiosisStacks: 0, acted: false, statuses: [], ...over,
  };
}

const silenceStatus = (roundsLeft = 2): SpellStatus => ({
  spellId: 'sil', attackMod: 0, defenseMod: 0, speedMod: 0, damageDealtMod: 0, damagePerRound: 0,
  silenced: true, roundsLeft,
});

const CASTER = unit({ id: 'caster', abilities: [{ id: 'spellcaster', params: { spellId: 'zap', charges: 2, power: 0 } }] });
const ZAP: SpellDef = { id: 'zap', school: 'neutral', circle: 1, manaCost: 0, kind: 'damage', base: 10, perPower: 0 };
const SILENCE: SpellDef = { id: 'sil', school: 'traque', circle: 2, manaCost: 5, kind: 'silence', base: 0, perPower: 0 };
const CATALOG: Record<string, CombatUnitDef> = { caster: CASTER, foe: unit({ id: 'foe' }) };

function hero(): HeroState {
  return {
    id: 'hero-a', playerId: 'p1', pos: { x: 0, y: 0 }, movementPoints: 0, naval: false, army: [], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, mana: 30, manaMax: 30, skills: {},
    visitLuck: 0, spells: ['sil'], artifacts: Array.from({ length: 10 }, () => null), pendingSkillChoices: [],
    visitMorale: 0,
    pendingAttributeChoices: [], factionId: '', houseId: '', houseEffects: [], name: '', specialtyId: '',
    specialtyEffects: [], warMachines: [], rosterId: '',
  };
}

/** Le lanceur (`caster`) est la pile active du camp `attacker` (= joueur). */
function stateWith(casterStatuses: SpellStatus[] = []): GameState {
  const combat: CombatState = {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [],
    stacks: [
      stack({ id: 'attacker-0', side: 'attacker', unitId: 'caster', spellCharges: 2, pos: { col: 4, row: 3 }, statuses: casterStatuses }),
      stack({ id: 'defender-0', side: 'defender', unitId: 'foe', pos: { col: 5, row: 3 } }),
    ],
    activeStackId: 'attacker-0', playerSide: 'attacker', heroId: 'hero-a', guardianObjectId: null,
    townId: null, wallDefenseBonus: 0, attackerHeroId: 'hero-a', defenderHeroId: null,
    heroCastThisRound: [], heroAttackUsed: [], finished: false, winner: null,
  };
  return {
    ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(), unitCatalog: CATALOG,
    spellCatalog: { zap: ZAP, sil: SILENCE }, heroes: [hero()], combat,
  };
}

describe('F-SCHOOLS.4 — Silence Scellé', () => {
  it('le sort de silence pose un statut `silenced` actif sur la cible ennemie', () => {
    // Le héros (attacker) lance `sil` sur la pile ennemie (defender-0).
    const { state: next } = apply(stateWith(), { type: 'CastSpell', spellId: 'sil', targetStackId: 'defender-0' });
    const foe = next.combat!.stacks.find((s) => s.id === 'defender-0')!;
    expect(foe.statuses.some((st) => st.silenced)).toBe(true);
  });

  it('une pile lanceuse peut caster ; silenciée, la validation la refuse', () => {
    const cast = { action: { type: 'castSpell', targetStackId: 'defender-0' } as const };
    expect(validateCombatAction(stateWith(), cast)).toBeNull();
    expect(validateCombatAction(stateWith([silenceStatus()]), cast)?.code).toBe('invalidAction');
  });

  it('l’IA choisit un sort pour un lanceur libre, mais pas pour un lanceur silencié', () => {
    expect(chooseAction(stateWith(), 'attacker-0').type).toBe('castSpell');
    expect(chooseAction(stateWith([silenceStatus()]), 'attacker-0').type).not.toBe('castSpell');
  });

  it('le statut de silence expire au fil des rounds (décrément à la transition)', () => {
    const events: GameEvent[] = [];
    const after = produce(stateWith([silenceStatus(1)]), (draft) => {
      const combat = draft.combat as CombatState;
      // Marque toutes les piles comme ayant agi ⇒ l'action suivante boucle le round.
      for (const st of combat.stacks) { st.acted = true; st.waited = false; }
      applyAction(draft, events, 'attacker-0', { type: 'defend' });
    });
    const caster = after.combat!.stacks.find((x) => x.id === 'attacker-0')!;
    expect(caster.statuses.some((st) => st.silenced)).toBe(false);
  });
});
