import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyState, type GameState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { applyAction } from '../src/combat/actions';
import { chooseAction as aiChooseAction } from '../src/combat/ai';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import type { SpellDef } from '../src/hero/types';
import type { GameEvent } from '../src/core/events';
import { testConfig } from './fixtures';

/**
 * Lot A2h — `spellcaster` : une unité lance un sort embarqué ×N charges (Prêtresse
 * soin ×2). Engine-first : l'IA de combat (`chooseAction`) le pilote (auto-combat
 * / tours IA). Cœur d'effet PARTAGÉ avec le sort du héros (`applySpellToTargets`).
 */

const SOIN: SpellDef = { id: 'soin', school: 'water', circle: 1, manaCost: 5, kind: 'heal', base: 10, perPower: 3 };

function unit(over: Partial<CombatUnitDef> & { id: string }): CombatUnitDef {
  return {
    groupId: `${over.id}-g`,
    nativeTerrain: 'swamp',
    stats: { hp: 20, attack: 5, defense: 5, damage: [3, 5], speed: 5 },
    abilities: [],
    ...over,
  };
}

function stack(
  partial: Pick<CombatStack, 'id' | 'side' | 'slot' | 'unitId' | 'count' | 'pos'> & Partial<CombatStack>,
): CombatStack {
  return {
    firstHp: 20, retaliationsLeft: 1, waited: false, defending: false, ammo: null, spellCharges: 0,
    marks: 0, immobilizedRounds: 0, transformed: false, symbiosisStacks: 0, acted: false, statuses: [],
    ...partial,
  };
}

function state(catalog: Record<string, CombatUnitDef>, stacks: CombatStack[]): GameState {
  const combat: CombatState = {
    terrain: 'grass', round: 1, obstacles: [], stacks, activeStackId: 'attacker-0',
    playerSide: 'defender', heroId: null, guardianObjectId: null, townId: null, wallDefenseBonus: 0,
    finished: false, attackerHeroId: null, defenderHeroId: null, heroCastThisRound: false,
    heroAttackUsed: [], winner: null,
  };
  return { ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(), unitCatalog: catalog, combat, spellCatalog: { soin: SOIN } };
}

const catalog: Record<string, CombatUnitDef> = {
  pretresse: unit({ id: 'pretresse', abilities: [{ id: 'spellcaster', params: { spellId: 'soin', charges: 2, power: 3 } }] }),
  grunt: unit({ id: 'grunt' }),
};

// Prêtresse (attacker-0), allié blessé (attacker-1, firstHp 5/20), un ennemi (defender-0).
function scene(pretresseCharges = 2, woundedHp = 5): CombatStack[] {
  return [
    stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'pretresse', count: 1, pos: { col: 2, row: 4 }, spellCharges: pretresseCharges }),
    stack({ id: 'attacker-1', side: 'attacker', slot: 1, unitId: 'grunt', count: 1, pos: { col: 2, row: 5 }, firstHp: woundedHp }),
    stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'grunt', count: 1, pos: { col: 12, row: 5 } }),
  ];
}

describe('A2h — spellcaster', () => {
  it('l’IA choisit de soigner l’allié le plus blessé (charges > 0, blessé présent)', () => {
    const action = aiChooseAction(state(catalog, scene()), 'attacker-0');
    expect(action).toEqual({ type: 'castSpell', targetStackId: 'attacker-1' });
  });

  it('la résolution soigne l’allié et décrémente la charge', () => {
    const events: GameEvent[] = [];
    const next = produce(state(catalog, scene()), (draft) => {
      applyAction(draft, events, 'attacker-0', { type: 'castSpell', targetStackId: 'attacker-1' });
    });
    const healed = next.combat?.stacks.find((s) => s.id === 'attacker-1');
    expect(healed?.firstHp).toBe(20); // 5 + 19 plafonné à 20 PV
    const caster = next.combat?.stacks.find((s) => s.id === 'attacker-0');
    expect(caster?.spellCharges).toBe(1); // 2 → 1
    expect(events.some((e) => e.type === 'UnitSpellCast' && e.casterId === 'attacker-0')).toBe(true);
  });

  it('aucun allié blessé ⇒ ne lance pas (conserve la charge)', () => {
    const action = aiChooseAction(state(catalog, scene(2, 20)), 'attacker-0'); // allié plein
    expect(action).not.toEqual({ type: 'castSpell', targetStackId: 'attacker-1' });
  });

  it('plus de charges ⇒ ne lance pas', () => {
    const action = aiChooseAction(state(catalog, scene(0, 5)), 'attacker-0');
    expect(action.type).not.toBe('castSpell');
  });
});
