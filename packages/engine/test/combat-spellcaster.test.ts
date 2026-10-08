import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyState, type GameState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { applyAction } from '../src/combat/actions';
import { chooseAction as aiChooseAction } from '../src/combat/ai';
import { estimateUnitSpell } from '../src/hero';
import { initLedger, recordLoss } from '../src/combat/state-helpers';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import type { SpellDef } from '../src/hero/types';
import type { GameEvent } from '../src/core/events';
import { simulateAutoCombat } from '../src/combat/simulate';
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
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [], stacks, activeStackId: 'attacker-0',
    playerSide: 'defender', heroId: null, guardianObjectId: null, townId: null, wallDefenseBonus: 0,
    finished: false, attackerHeroId: null, defenderHeroId: null, heroCastThisRound: [],
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

  it('CAP-CAST : estimateUnitSpell prévisualise le soin avec le Pouvoir de la capacité', () => {
    // Prêtresse (power 3) soigne l'allié : base 10 + 3×3 = 19 (préviz sans RNG).
    const est = estimateUnitSpell(state(catalog, scene()), 'attacker-0', 'attacker-1');
    expect(est).toEqual({ amount: 19, kills: 0, kind: 'heal' });
  });
});

/**
 * CAP-LIFE.1 — l'Ange (Haven T7) réalise `resurrectAlly(1×/combat)` via le
 * `spellcaster` générique embarquant le sort `resurrection` : le heal ressuscite
 * la pile alliée au-delà de son effectif courant (`maxCount = count + lostSoFar`).
 * Données pures, aucun code moteur propre à l'Ange.
 */
describe('CAP-LIFE.1 — résurrection de l’Ange', () => {
  const RESURRECTION: SpellDef = { id: 'resurrection', school: 'water', circle: 4, manaCost: 22, kind: 'heal', base: 40, perPower: 8, revive: true };
  const angelCatalog: Record<string, CombatUnitDef> = {
    ange: unit({ id: 'ange', abilities: [{ id: 'spellcaster', params: { spellId: 'resurrection', charges: 1, power: 4 } }] }),
    grunt: unit({ id: 'grunt' }),
  };
  function angelState(stacks: CombatStack[]): GameState {
    const combat: CombatState = {
      terrain: 'grass', phase: 'battle', round: 1, obstacles: [], stacks, activeStackId: 'attacker-0',
      playerSide: 'defender', heroId: null, guardianObjectId: null, townId: null, wallDefenseBonus: 0,
      finished: false, attackerHeroId: null, defenderHeroId: null, heroCastThisRound: [],
      heroAttackUsed: [], winner: null,
    };
    initLedger(combat);
    return { ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(), unitCatalog: angelCatalog, combat, spellCatalog: { resurrection: RESURRECTION } };
  }

  it('ressuscite une pile alliée qui a perdu des créatures (l’effectif remonte)', () => {
    // Allié réduit à 2/5 grunts (3 perdus enregistrés au ledger). Résurrection =
    // 40 + 8×4 = 72 PV ⇒ maxCount = 2 + 3 = 5, pool 40 → 100 ⇒ 5 grunts (3 relevés).
    const stacks: CombatStack[] = [
      stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'ange', count: 1, pos: { col: 2, row: 4 }, spellCharges: 1 }),
      stack({ id: 'attacker-1', side: 'attacker', slot: 1, unitId: 'grunt', count: 2, pos: { col: 2, row: 5 }, firstHp: 20 }),
      stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'grunt', count: 1, pos: { col: 12, row: 5 } }),
    ];
    const base = angelState(stacks);
    recordLoss(base.combat!, { id: 'attacker-1', side: 'attacker', unitId: 'grunt' }, 3); // 3 grunts déjà tombés
    const events: GameEvent[] = [];
    const next = produce(base, (draft) => {
      applyAction(draft, events, 'attacker-0', { type: 'castSpell', targetStackId: 'attacker-1' });
    });
    const revived = next.combat?.stacks.find((s) => s.id === 'attacker-1');
    expect(revived?.count).toBe(5); // 2 → 5 : trois créatures relevées
    const angel = next.combat?.stacks.find((s) => s.id === 'attacker-0');
    expect(angel?.spellCharges).toBe(0); // 1×/combat consommée
    expect(events.some((e) => e.type === 'UnitSpellCast' && e.casterId === 'attacker-0')).toBe(true);
  });
});

/**
 * Lot R1 — sort contre frappe : un soin ou des dégâts d'unité ne passent devant la
 * frappe que s'ils valent au moins ses dégâts moyens (morts comprises pour un sort
 * `revive`) ; un débuff ne se relance pas sur une cible qui le porte déjà ; et le
 * simulateur d'équilibrage voit enfin les lanceurs. Ids génériques.
 */
describe('R1 — sort contre frappe', () => {
  const RESURRECTION: SpellDef = { id: 'resurrection', school: 'water', circle: 4, manaCost: 22, kind: 'heal', base: 40, perPower: 8, revive: true };
  const WEAKEN: SpellDef = { id: 'weaken', school: 'earth', circle: 2, manaCost: 8, kind: 'debuff', base: 0, perPower: 0, defenseMod: -3 };
  const cat: Record<string, CombatUnitDef> = {
    ange: unit({ id: 'ange', abilities: [{ id: 'spellcaster', params: { spellId: 'resurrection', charges: 1, power: 4 } }] }),
    hexer: unit({ id: 'hexer', abilities: [{ id: 'spellcaster', params: { spellId: 'weaken', charges: 2, power: 3 } }] }),
    grunt: unit({ id: 'grunt' }),
  };
  function r1State(stacks: CombatStack[]): GameState {
    const combat: CombatState = {
      terrain: 'grass', phase: 'battle', round: 1, obstacles: [], stacks, activeStackId: 'attacker-0',
      playerSide: 'defender', heroId: null, guardianObjectId: null, townId: null, wallDefenseBonus: 0,
      finished: false, attackerHeroId: null, defenderHeroId: null, heroCastThisRound: [],
      heroAttackUsed: [], winner: null,
    };
    initLedger(combat);
    return {
      ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(), unitCatalog: cat, combat,
      spellCatalog: { resurrection: RESURRECTION, weaken: WEAKEN },
    };
  }
  // 3 Anges au contact d'un ennemi (frappe moyenne ≈ 12 PV) ; allié `attacker-1` entamé de `scratch` PV.
  function angelScene(scratch: number): CombatStack[] {
    return [
      stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'ange', count: 3, pos: { col: 2, row: 4 }, spellCharges: 1 }),
      stack({ id: 'attacker-1', side: 'attacker', slot: 1, unitId: 'grunt', count: 2, pos: { col: 1, row: 6 }, firstHp: 20 - scratch }),
      stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'grunt', count: 5, pos: { col: 3, row: 4 } }),
    ];
  }

  it('l’Ange ne ressuscite pas une égratignure : il frappe', () => {
    expect(aiChooseAction(r1State(angelScene(2)), 'attacker-0').type).toBe('attack');
  });

  it('les créatures mortes comptent : l’Ange relève la pile décimée plutôt que de frapper', () => {
    const base = r1State(angelScene(2));
    recordLoss(base.combat!, { id: 'attacker-1', side: 'attacker', unitId: 'grunt' }, 3); // 60 PV à relever
    expect(aiChooseAction(base, 'attacker-0')).toEqual({ type: 'castSpell', targetStackId: 'attacker-1' });
  });

  it('un débuff ne se relance pas sur une cible qui le porte déjà', () => {
    const weakened = { spellId: 'weaken', attackMod: 0, defenseMod: -3, speedMod: 0, damageDealtMod: 0, damagePerRound: 0, silenced: false, roundsLeft: 2 };
    const scene = (statuses: CombatStack['statuses']): CombatStack[] => [
      stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'hexer', count: 1, pos: { col: 2, row: 4 }, spellCharges: 2 }),
      stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'grunt', count: 1, pos: { col: 12, row: 4 }, statuses }),
    ];
    expect(aiChooseAction(r1State(scene([])), 'attacker-0')).toEqual({ type: 'castSpell', targetStackId: 'defender-0' });
    expect(aiChooseAction(r1State(scene([weakened])), 'attacker-0').type).not.toBe('castSpell');
  });

  it('simulateAutoCombat voit le sort d’un lanceur quand on lui passe le catalogue', () => {
    // Un mage fragile mais rapide, dont le sort tue d'un coup ; sans catalogue, il frappe pour 1 et perd.
    const ZAP: SpellDef = { id: 'zap', school: 'fire', circle: 1, manaCost: 0, kind: 'damage', base: 500, perPower: 0 };
    const simCat: Record<string, CombatUnitDef> = {
      mage: unit({ id: 'mage', stats: { hp: 10, attack: 1, defense: 1, damage: [1, 1], speed: 12 }, abilities: [{ id: 'spellcaster', params: { spellId: 'zap', charges: 1, power: 0 } }] }),
      brute: unit({ id: 'brute', stats: { hp: 100, attack: 10, defense: 10, damage: [50, 50], speed: 3 } }),
    };
    const att = [{ unitId: 'mage', count: 1 }];
    const def = [{ unitId: 'brute', count: 1 }];
    expect(simulateAutoCombat(simCat, testConfig(), att, def, 'grass', 1)).toBe('defender');
    expect(simulateAutoCombat(simCat, testConfig(), att, def, 'grass', 1, { zap: ZAP })).toBe('attacker');
  });
});
