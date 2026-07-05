import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/combat/actions';
import { computeMultiplier, killsFromDamage } from '../src/combat/damage';
import { seedRng } from '../src/core/rng';
import type { GameEvent } from '../src/core/events';
import { createEmptyState, type GameState } from '../src/core/state';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import { testCombatRules, testConfig } from './fixtures';

/**
 * Cas tabulaires de dégâts (doc 02 §5.3) : damage [n,n] (sans variance) pour
 * isoler la formule des tirages RNG. `computeMultiplier`/`killsFromDamage`
 * sont testées en pur ; `performStrike`/`applyAction` couvrent l'intégration
 * (marque, riposte, doubleAttack, morts-vivants) sans passer par l'IA (on
 * appelle `applyAction` directement dans un `produce()`, comme suggéré pour
 * `beginGuardianCombat`).
 */

const RULES = testCombatRules();

describe('computeMultiplier — formule ±5 %/pt bornée [-70 %, +60 %]', () => {
  it('diff positive : bonus de dégâts', () => {
    const mult = computeMultiplier({
      strikerAttack: 10,
      targetDefense: 5,
      targetDefending: false,
      targetMarks: 0,
      meleePenalized: false,
      rules: RULES,
    });
    expect(mult).toBeCloseTo(1.25);
  });

  it('diff négative : réduction de dégâts', () => {
    const mult = computeMultiplier({
      strikerAttack: 5,
      targetDefense: 10,
      targetDefending: false,
      targetMarks: 0,
      meleePenalized: false,
      rules: RULES,
    });
    expect(mult).toBeCloseTo(0.75);
  });

  it('clamp haut à +60 %', () => {
    const mult = computeMultiplier({
      strikerAttack: 200,
      targetDefense: 0,
      targetDefending: false,
      targetMarks: 0,
      meleePenalized: false,
      rules: RULES,
    });
    expect(mult).toBeCloseTo(1.6);
  });

  it('clamp bas à −70 %', () => {
    const mult = computeMultiplier({
      strikerAttack: 0,
      targetDefense: 200,
      targetDefending: false,
      targetMarks: 0,
      meleePenalized: false,
      rules: RULES,
    });
    expect(mult).toBeCloseTo(0.3);
  });

  it('défendre : défense ×1,3 arrondie bas avant le diff', () => {
    // défense 7 × 1,3 = 9,1 → floor 9 ; diff = 7-9 = -2 ; facteur -0,10
    const mult = computeMultiplier({
      strikerAttack: 7,
      targetDefense: 7,
      targetDefending: true,
      targetMarks: 0,
      meleePenalized: false,
      rules: RULES,
    });
    expect(mult).toBeCloseTo(0.9);
  });

  it('tireur forcé en mêlée : pénalité ×0,5', () => {
    const mult = computeMultiplier({
      strikerAttack: 5,
      targetDefense: 5,
      targetDefending: false,
      targetMarks: 0,
      meleePenalized: true,
      rules: RULES,
    });
    expect(mult).toBeCloseTo(0.5);
  });

  it('marque : +8 %/charge, cumulatif', () => {
    const mult = computeMultiplier({
      strikerAttack: 5,
      targetDefense: 5,
      targetDefending: false,
      targetMarks: 2,
      meleePenalized: false,
      rules: RULES,
    });
    expect(mult).toBeCloseTo(1.16);
  });
});

describe('killsFromDamage — pertes entières + PV entamés', () => {
  it('perte partielle sans mort de pile', () => {
    // pool = (2-1)*5 + 5 = 10 ; dégâts 6 → reste 4 → 1 survivant
    expect(killsFromDamage(10, 5, 2, 6)).toBe(1);
  });

  it('dégâts insuffisants : aucune perte', () => {
    expect(killsFromDamage(10, 5, 2, 3)).toBe(0);
  });

  it('dégâts fatals : pile éradiquée', () => {
    expect(killsFromDamage(10, 5, 2, 999)).toBe(2);
  });
});

/** Unité minimale de test, dégâts fixes [n,n] pour éliminer la variance RNG. */
function unit(over: Partial<CombatUnitDef> & { id: string }): CombatUnitDef {
  return {
    groupId: `${over.id}-group`,
    nativeTerrain: 'swamp', // ≠ terrain de combat 'grass' : moral neutre par défaut dans ces tests
    stats: { hp: 10, attack: 5, defense: 5, damage: [4, 4], speed: 5 },
    abilities: [],
    ...over,
  };
}

function baseState(catalog: Record<string, CombatUnitDef>): GameState {
  return {
    ...createEmptyState(),
    started: true,
    rng: seedRng(1),
    config: testConfig(),
    unitCatalog: catalog,
  };
}

function stack(partial: Pick<CombatStack, 'id' | 'side' | 'slot' | 'unitId' | 'count' | 'pos'> & Partial<CombatStack>): CombatStack {
  return {
    firstHp: 10,
    retaliationsLeft: 1,
    waited: false,
    defending: false,
    ammo: null,
    marks: 0,
    acted: false,
    statuses: [],
    ...partial,
  };
}

function combatState(stacks: CombatStack[], terrain = 'grass'): CombatState {
  return {
    terrain,
    round: 1,
    obstacles: [],
    stacks,
    activeStackId: stacks[0]?.id ?? null,
    playerSide: 'attacker',
    heroId: null,
    guardianObjectId: null,
    finished: false,
    attackerHeroId: null,
    defenderHeroId: null,
    heroCastThisRound: false,
    winner: null,
  };
}

describe('performStrike / applyAction — intégration dégâts', () => {
  it('kills/firstHp exacts après une frappe', () => {
    const catalog = {
      atk: unit({ id: 'atk', stats: { hp: 10, attack: 10, defense: 0, damage: [4, 4], speed: 5 } }),
      def: unit({ id: 'def', stats: { hp: 5, attack: 0, defense: 0, damage: [1, 1], speed: 1 } }),
    };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 5, row: 5 }, firstHp: 10 });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 2, pos: { col: 6, row: 5 }, firstHp: 5 });
    const state = { ...baseState(catalog), combat: combatState([attacker, defender]) };
    const events: GameEvent[] = [];
    const next = produce(state, (draft) => {
      applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
    });
    const strike = events.find((e) => e.type === 'StackAttacked') as Extract<GameEvent, { type: 'StackAttacked' }>;
    // diff=10-0=10 → mult 1,5 (clamp 0,6) ; base=4 → dégâts round(6)=6
    expect(strike.damage).toBe(6);
    expect(strike.kills).toBe(1);
    const survivor = next.combat?.stacks.find((s) => s.id === 'defender-0');
    expect(survivor?.count).toBe(1);
    expect(survivor?.firstHp).toBe(4);
  });

  it('défendre : réduit les dégâts subis (×1,3 arrondi bas)', () => {
    const catalog = {
      atk: unit({ id: 'atk', stats: { hp: 10, attack: 7, defense: 0, damage: [4, 4], speed: 5 } }),
      def: unit({ id: 'def', stats: { hp: 100, attack: 0, defense: 7, damage: [1, 1], speed: 1 } }),
    };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 }, firstHp: 10 });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 }, firstHp: 100, defending: true });
    const state = { ...baseState(catalog), combat: combatState([attacker, defender]) };
    const events: GameEvent[] = [];
    produce(state, (draft) => {
      applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
    });
    const strike = events.find((e) => e.type === 'StackAttacked') as Extract<GameEvent, { type: 'StackAttacked' }>;
    // défense effective floor(7*1,3)=9 ; diff=7-9=-2 ; facteur -0,10 ; dégâts round(4*0,9)=4 (arrondi de 3,6)
    expect(strike.damage).toBe(4);
  });

  it('marque : +1 charge par frappe (plafond 3), +8 %/charge sur les dégâts suivants', () => {
    const catalog = {
      atk: unit({ id: 'atk', stats: { hp: 10, attack: 5, defense: 0, damage: [4, 4], speed: 5 }, abilities: [{ id: 'mark' }] }),
      def: unit({ id: 'def', stats: { hp: 1000, attack: 0, defense: 5, damage: [1, 1], speed: 1 } }),
    };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 }, firstHp: 10 });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 }, firstHp: 1000, marks: 2 });
    const state = { ...baseState(catalog), combat: combatState([attacker, defender]) };
    const events: GameEvent[] = [];
    const next = produce(state, (draft) => {
      applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
    });
    // diff=0 → mult 1 ; marque AVANT frappe = 2 → ×1,16 → dégâts round(4*1,16)=5 (4,64)
    const strike = events.find((e) => e.type === 'StackAttacked') as Extract<GameEvent, { type: 'StackAttacked' }>;
    expect(strike.damage).toBe(5);
    expect(next.combat?.stacks.find((s) => s.id === 'defender-0')?.marks).toBe(3);
    const marked = events.find((e) => e.type === 'MarkApplied');
    expect(marked).toEqual({ type: 'MarkApplied', targetId: 'defender-0', marks: 3 });
  });

  it('marque déjà au plafond : aucun MarkApplied supplémentaire', () => {
    const catalog = {
      atk: unit({ id: 'atk', abilities: [{ id: 'mark' }] }),
      def: unit({ id: 'def', stats: { hp: 1000, attack: 0, defense: 5, damage: [1, 1], speed: 1 } }),
    };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 }, firstHp: 10 });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 }, firstHp: 1000, marks: 3 });
    const state = { ...baseState(catalog), combat: combatState([attacker, defender]) };
    const events: GameEvent[] = [];
    produce(state, (draft) => {
      applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
    });
    expect(events.some((e) => e.type === 'MarkApplied')).toBe(false);
  });

  it('consumeMarks : consomme les charges au seuil et applique le burst de dégâts', () => {
    // atk attaque 5 = def défense 5 → diff 0 (mult de base 1) pour isoler les
    // facteurs Marque. base 10. marks 3 → ×1,24 (0,08×3). burst consumeMarks
    // ×1,4. dégâts round(10 × 1,24 × 1,4) = round(17,36) = 17. charges → 0.
    const catalog = {
      atk: unit({
        id: 'atk',
        stats: { hp: 10, attack: 5, defense: 0, damage: [10, 10], speed: 5 },
        abilities: [{ id: 'consumeMarks', params: { cost: 3, damageBonus: 0.4 } }],
      }),
      def: unit({ id: 'def', stats: { hp: 1000, attack: 0, defense: 5, damage: [1, 1], speed: 1 } }),
    };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 }, firstHp: 10 });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 }, firstHp: 1000, marks: 3 });
    const state = { ...baseState(catalog), combat: combatState([attacker, defender]) };
    const events: GameEvent[] = [];
    const next = produce(state, (draft) => {
      applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
    });
    const strike = events.find((e) => e.type === 'StackAttacked') as Extract<GameEvent, { type: 'StackAttacked' }>;
    expect(strike.damage).toBe(17);
    expect(next.combat?.stacks.find((s) => s.id === 'defender-0')?.marks).toBe(0);
    expect(events).toContainEqual({
      type: 'MarksConsumed',
      strikerId: 'attacker-0',
      targetId: 'defender-0',
      consumed: 3,
    });
  });

  it('consumeMarks : sous le seuil, aucune consommation ni burst', () => {
    // marks 2 < cost 3 → pas de burst : dégâts round(10 × 1,16) = 12, charges intactes.
    const catalog = {
      atk: unit({
        id: 'atk',
        stats: { hp: 10, attack: 5, defense: 0, damage: [10, 10], speed: 5 },
        abilities: [{ id: 'consumeMarks', params: { cost: 3, damageBonus: 0.4 } }],
      }),
      def: unit({ id: 'def', stats: { hp: 1000, attack: 0, defense: 5, damage: [1, 1], speed: 1 } }),
    };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 }, firstHp: 10 });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 }, firstHp: 1000, marks: 2 });
    const state = { ...baseState(catalog), combat: combatState([attacker, defender]) };
    const events: GameEvent[] = [];
    const next = produce(state, (draft) => {
      applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
    });
    const strike = events.find((e) => e.type === 'StackAttacked') as Extract<GameEvent, { type: 'StackAttacked' }>;
    expect(strike.damage).toBe(12);
    expect(next.combat?.stacks.find((s) => s.id === 'defender-0')?.marks).toBe(2);
    expect(events.some((e) => e.type === 'MarksConsumed')).toBe(false);
  });

  it('consumeMarks/expose : cible marquée ⇒ 1 charge consommée, pas de riposte', () => {
    const catalog = {
      atk: unit({
        id: 'atk',
        stats: { hp: 10, attack: 5, defense: 5, damage: [3, 3], speed: 8 },
        abilities: [{ id: 'consumeMarks', params: { cost: 1, suppressRetaliation: true } }],
      }),
      // Défenseur costaud (survit) et dangereux (riposterait fort si pouvait).
      def: unit({ id: 'def', stats: { hp: 1000, attack: 20, defense: 5, damage: [10, 10], speed: 4 } }),
    };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 }, firstHp: 10 });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 }, firstHp: 1000, marks: 1 });
    const state = { ...baseState(catalog), combat: combatState([attacker, defender]) };
    const events: GameEvent[] = [];
    const next = produce(state, (draft) => {
      applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
    });
    // 1 seule frappe (celle de l'attaquant), aucune riposte.
    const strikes = events.filter((e) => e.type === 'StackAttacked');
    expect(strikes).toHaveLength(1);
    const defenderAfter = next.combat?.stacks.find((s) => s.id === 'defender-0');
    expect(defenderAfter?.marks).toBe(0); // charge consommée
    expect(defenderAfter?.retaliationsLeft).toBe(0);
    expect(events).toContainEqual({ type: 'MarksConsumed', strikerId: 'attacker-0', targetId: 'defender-0', consumed: 1 });
  });

  it('consumeMarks/expose : cible non marquée ⇒ riposte normale', () => {
    const catalog = {
      atk: unit({
        id: 'atk',
        stats: { hp: 100, attack: 5, defense: 5, damage: [3, 3], speed: 8 },
        abilities: [{ id: 'consumeMarks', params: { cost: 1, suppressRetaliation: true } }],
      }),
      def: unit({ id: 'def', stats: { hp: 1000, attack: 20, defense: 5, damage: [10, 10], speed: 4 } }),
    };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 }, firstHp: 100 });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 }, firstHp: 1000, marks: 0 });
    const state = { ...baseState(catalog), combat: combatState([attacker, defender]) };
    const events: GameEvent[] = [];
    produce(state, (draft) => {
      applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
    });
    // 2 frappes : attaque + riposte (aucune charge à consommer).
    expect(events.filter((e) => e.type === 'StackAttacked')).toHaveLength(2);
    expect(events.some((e) => e.type === 'MarksConsumed')).toBe(false);
  });

  it('doubleAttack : 2 frappes, riposte intercalée une seule fois', () => {
    const catalog = {
      atk: unit({ id: 'atk', stats: { hp: 20, attack: 10, defense: 0, damage: [3, 3], speed: 5 }, abilities: [{ id: 'doubleAttack' }] }),
      def: unit({ id: 'def', stats: { hp: 100, attack: 5, defense: 0, damage: [2, 2], speed: 1 } }),
    };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 }, firstHp: 20 });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 }, firstHp: 100 });
    const state = { ...baseState(catalog), combat: combatState([attacker, defender]) };
    const events: GameEvent[] = [];
    const next = produce(state, (draft) => {
      applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
    });
    const strikes = events.filter((e) => e.type === 'StackAttacked') as Extract<GameEvent, { type: 'StackAttacked' }>[];
    expect(strikes.map((s) => [s.attackerId, s.retaliation])).toEqual([
      ['attacker-0', false],
      ['defender-0', true],
      ['attacker-0', false],
    ]);
    // dégâts attaquant : diff 10 → mult 1,5 → round(3*1,5)=5 (×2 = 10 sur le défenseur)
    expect(strikes[0]?.damage).toBe(5);
    expect(strikes[2]?.damage).toBe(5);
    // riposte : diff 5 → mult 1,25 → round(2*1,25)=3
    expect(strikes[1]?.damage).toBe(3);
    expect(next.combat?.stacks.find((s) => s.id === 'defender-0')?.firstHp).toBe(90);
    expect(next.combat?.stacks.find((s) => s.id === 'attacker-0')?.firstHp).toBe(17);
    expect(next.combat?.stacks.find((s) => s.id === 'defender-0')?.retaliationsLeft).toBe(0);
  });

  it('riposte non déclenchée une 2e fois dans le même round (retaliationsLeft consommé)', () => {
    const catalog = {
      atk: unit({ id: 'atk', stats: { hp: 10, attack: 5, defense: 0, damage: [1, 1], speed: 5 } }),
      def: unit({ id: 'def', stats: { hp: 100, attack: 3, defense: 0, damage: [1, 1], speed: 1 } }),
    };
    const attacker1 = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 }, firstHp: 10 });
    const attacker2 = stack({ id: 'attacker-1', side: 'attacker', slot: 1, unitId: 'atk', count: 1, pos: { col: 2, row: 0 }, firstHp: 10 });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 }, firstHp: 100 });
    const state = { ...baseState(catalog), combat: combatState([attacker1, attacker2, defender]) };
    const events: GameEvent[] = [];
    const afterFirst = produce(state, (draft) => {
      applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
    });
    expect(events.some((e) => e.type === 'StackAttacked' && e.retaliation)).toBe(true);
    const events2: GameEvent[] = [];
    produce(afterFirst, (draft) => {
      applyAction(draft, events2, 'attacker-1', { type: 'attack', targetStackId: 'defender-0' });
    });
    expect(events2.some((e) => e.type === 'StackAttacked' && e.retaliation)).toBe(false);
  });

  it('tireur au contact : pénalité ×0,5 en mêlée forcée', () => {
    const catalog = {
      shooter: unit({
        id: 'shooter',
        stats: { hp: 10, attack: 5, defense: 0, damage: [4, 4], speed: 5 },
        abilities: [{ id: 'shooter', params: { ammo: 3 } }],
      }),
      def: unit({ id: 'def', stats: { hp: 100, attack: 0, defense: 0, damage: [1, 1], speed: 1 } }),
    };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'shooter', count: 1, pos: { col: 0, row: 0 }, firstHp: 10, ammo: 3 });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 }, firstHp: 100 });
    const state = { ...baseState(catalog), combat: combatState([attacker, defender]) };
    const events: GameEvent[] = [];
    const next = produce(state, (draft) => {
      applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
    });
    // adjacent ⇒ canShoot faux ⇒ mêlée forcée : diff 5 → mult 1,25 ×0,5 = 0,625 → round(4*0,625)=3 (2,5)
    const strike = events.find((e) => e.type === 'StackAttacked') as Extract<GameEvent, { type: 'StackAttacked' }>;
    expect(strike.damage).toBe(3);
    expect(next.combat?.stacks.find((s) => s.id === 'attacker-0')?.ammo).toBe(3); // pas de tir : munitions inchangées
  });

  it('tir : aucune pénalité, munitions décrémentées, jamais de riposte', () => {
    const catalog = {
      shooter: unit({
        id: 'shooter',
        stats: { hp: 10, attack: 5, defense: 0, damage: [4, 4], speed: 5 },
        abilities: [{ id: 'shooter', params: { ammo: 3 } }],
      }),
      def: unit({ id: 'def', stats: { hp: 100, attack: 10, defense: 0, damage: [5, 5], speed: 1 } }),
    };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'shooter', count: 1, pos: { col: 0, row: 0 }, firstHp: 10, ammo: 3 });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 5, row: 5 }, firstHp: 100 });
    const state = { ...baseState(catalog), combat: combatState([attacker, defender]) };
    const events: GameEvent[] = [];
    const next = produce(state, (draft) => {
      applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
    });
    const strikes = events.filter((e) => e.type === 'StackAttacked') as Extract<GameEvent, { type: 'StackAttacked' }>[];
    expect(strikes).toHaveLength(1);
    expect(strikes[0]?.retaliation).toBe(false);
    expect(strikes[0]?.damage).toBe(5); // diff 5 → mult 1,25 → round(4*1,25)=5
    expect(next.combat?.stacks.find((s) => s.id === 'attacker-0')?.ammo).toBe(2);
  });
});
