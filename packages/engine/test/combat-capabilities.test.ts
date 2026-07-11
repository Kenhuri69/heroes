import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyState, type GameState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { applyAction } from '../src/combat/actions';
import { estimateDamage, magicResistanceOf } from '../src/combat/damage';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import type { GameEvent } from '../src/core/events';
import { testConfig } from './fixtures';

/**
 * Lot A2a — capacités de combat déterministes (shieldWall, unlimitedRetaliation,
 * charge, magicResistance autonome, lifeDrain). Damage [n,n] (sans variance) ⇒
 * dégâts déterministes ; on appelle `applyAction` dans un `produce()`.
 */

function unit(over: Partial<CombatUnitDef> & { id: string }): CombatUnitDef {
  return {
    groupId: `${over.id}-g`,
    nativeTerrain: 'swamp',
    stats: { hp: 10, attack: 5, defense: 5, damage: [4, 4], speed: 6 },
    abilities: [],
    ...over,
  };
}

function stack(
  partial: Pick<CombatStack, 'id' | 'side' | 'slot' | 'unitId' | 'count' | 'pos'> & Partial<CombatStack>,
): CombatStack {
  return {
    firstHp: 10,
    retaliationsLeft: 1,
    waited: false,
    defending: false,
    ammo: null, spellCharges: 0,
    marks: 0,
    immobilizedRounds: 0,
    transformed: false,
    symbiosisStacks: 0,
    acted: false,
    statuses: [],
    ...partial,
  };
}

function baseState(catalog: Record<string, CombatUnitDef>): GameState {
  return { ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(), unitCatalog: catalog };
}

function combatState(stacks: CombatStack[]): CombatState {
  return {
    terrain: 'grass',
    phase: 'battle',
    round: 1,
    obstacles: [],
    stacks,
    activeStackId: stacks[0]?.id ?? null,
    playerSide: 'attacker',
    heroId: null,
    guardianObjectId: null,
    townId: null,
    wallDefenseBonus: 0,
    finished: false,
    attackerHeroId: null,
    defenderHeroId: null,
    heroCastThisRound: [],
    heroAttackUsed: [],
    winner: null,
  };
}

function runAttack(state: GameState, from?: { col: number; row: number }): { events: GameEvent[]; next: GameState } {
  const events: GameEvent[] = [];
  const next = produce(state, (draft) => {
    applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0', ...(from ? { from } : {}) });
  });
  return { events, next };
}

const strikes = (events: GameEvent[]) =>
  events.filter((e) => e.type === 'StackAttacked') as Extract<GameEvent, { type: 'StackAttacked' }>[];

describe('A2a — shieldWall', () => {
  it('Défendre avec shieldWall(1,5) réduit plus les dégâts que le ×1,3 commun', () => {
    const catalog = {
      atk: unit({ id: 'atk', stats: { hp: 10, attack: 7, defense: 0, damage: [4, 4], speed: 6 } }),
      def: unit({
        id: 'def',
        stats: { hp: 100, attack: 0, defense: 7, damage: [1, 1], speed: 1 },
        abilities: [{ id: 'shieldWall', params: { defendMultiplier: 1.5 } }],
      }),
    };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 } });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 }, firstHp: 100, defending: true });
    const state = { ...baseState(catalog), combat: combatState([attacker, defender]) };
    const strike = strikes(runAttack(state).events)[0];
    // défense effective floor(7×1,5)=10 ; diff 7-10=-3 ; facteur -0,15 ; round(4×0,85)=3
    expect(strike?.damage).toBe(3);
  });
});

describe('A2a — unlimitedRetaliation', () => {
  it('la pile riposte une 2ᵉ fois dans le même round (retaliationsLeft déjà à 0)', () => {
    const catalog = {
      atk: unit({ id: 'atk', stats: { hp: 100, attack: 5, defense: 0, damage: [1, 1], speed: 6 } }),
      def: unit({ id: 'def', stats: { hp: 100, attack: 5, defense: 0, damage: [2, 2], speed: 1 }, abilities: [{ id: 'unlimitedRetaliation' }] }),
    };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 }, firstHp: 100 });
    // Le défenseur a déjà riposté ce round (retaliationsLeft 0) — normalement plus de riposte.
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 }, firstHp: 100, retaliationsLeft: 0 });
    const state = { ...baseState(catalog), combat: combatState([attacker, defender]) };
    const list = strikes(runAttack(state).events);
    expect(list.some((s) => s.retaliation)).toBe(true);
  });
});

describe('A2a — charge', () => {
  it('bonus de dégâts = perHex × hexes parcourus avant la frappe', () => {
    const catalog = {
      atk: unit({ id: 'atk', stats: { hp: 100, attack: 5, defense: 5, damage: [10, 10], speed: 6 }, abilities: [{ id: 'charge', params: { perHex: 0.05 } }] }),
      def: unit({ id: 'def', stats: { hp: 1000, attack: 0, defense: 5, damage: [1, 1], speed: 1 } }),
    };
    // Attaquant en (0,0), cible en (4,0) ; frappe depuis (3,0) ⇒ 3 hexes parcourus.
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 }, firstHp: 100 });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 4, row: 0 }, firstHp: 1000 });
    const state = { ...baseState(catalog), combat: combatState([attacker, defender]) };
    const strike = strikes(runAttack(state, { col: 3, row: 0 }).events)[0];
    // diff 0 → mult 1 ; charge 3×0,05=0,15 → round(10×1,15)=12 (11,5)
    expect(strike?.damage).toBe(12);
  });

  it('frappe sur place (déjà adjacent, pas de from) : aucune charge', () => {
    const catalog = {
      atk: unit({ id: 'atk', stats: { hp: 100, attack: 5, defense: 5, damage: [10, 10], speed: 6 }, abilities: [{ id: 'charge', params: { perHex: 0.05 } }] }),
      def: unit({ id: 'def', stats: { hp: 1000, attack: 0, defense: 5, damage: [1, 1], speed: 1 } }),
    };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 }, firstHp: 100 });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 }, firstHp: 1000 });
    const state = { ...baseState(catalog), combat: combatState([attacker, defender]) };
    const strike = strikes(runAttack(state).events)[0];
    expect(strike?.damage).toBe(10); // diff 0, pas de charge
  });
});

describe('A2a — magicResistance autonome', () => {
  it('magicResistanceOf lit la capacité indépendante', () => {
    const def = unit({ id: 'x', abilities: [{ id: 'magicResistance', params: { value: 0.3 } }] });
    expect(magicResistanceOf(def, false)).toBeCloseTo(0.3);
    expect(magicResistanceOf(def, true)).toBeCloseTo(0.3); // autonome : indépendant de la transformation
  });
});

describe('A2a — lifeDrain', () => {
  it('la pile se soigne d’une fraction des dégâts infligés (relève ses pertes)', () => {
    const catalog = {
      atk: unit({
        id: 'atk',
        stats: { hp: 10, attack: 5, defense: 5, damage: [10, 10], speed: 6 },
        abilities: [{ id: 'lifeDrain', params: { pct: 0.5 } }],
      }),
      // Dégâts de riposte nuls : isole la relève du vampire (pas de contre-dégâts).
      def: unit({ id: 'def', stats: { hp: 1000, attack: 0, defense: 5, damage: [0, 0], speed: 1 } }),
    };
    // Vampire à 3/5 créatures (2 pertes déjà enregistrées via un état entamé).
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 3, pos: { col: 0, row: 0 }, firstHp: 2 });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 }, firstHp: 1000 });
    // Enregistre 2 pertes du vampire pour ouvrir le plafond de relève.
    const combat = combatState([attacker, defender]) as CombatState & { _losses?: Record<string, number> };
    combat._losses = { 'attacker:atk': 2 };
    const state = { ...baseState(catalog), combat };
    const { events, next } = runAttack(state);
    // 3 créatures × dmg 10 = base 30 ; diff 0 → dégâts 30. drain = floor(30×0,5)=15.
    // pool avant = (3-1)×10 + 2 = 22 ; +15 = 37, plafond (3+2)×10=50 ⇒ 37 ; count ceil(37/10)=4, firstHp 7.
    const healed = events.find((e) => e.type === 'StackHealed') as Extract<GameEvent, { type: 'StackHealed' }>;
    expect(healed?.amount).toBe(15);
    const striker = next.combat?.stacks.find((s) => s.id === 'attacker-0');
    expect(striker?.count).toBe(4);
    expect(striker?.firstHp).toBe(7);
  });

  it('aucune relève au tir (drain de mêlée uniquement)', () => {
    const catalog = {
      atk: unit({
        id: 'atk',
        stats: { hp: 10, attack: 5, defense: 5, damage: [10, 10], speed: 6 },
        abilities: [{ id: 'shooter', params: { ammo: 3 } }, { id: 'lifeDrain', params: { pct: 0.5 } }],
      }),
      def: unit({ id: 'def', stats: { hp: 1000, attack: 0, defense: 5, damage: [1, 1], speed: 1 } }),
    };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 2, pos: { col: 0, row: 0 }, ammo: 3, firstHp: 10 });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 8, row: 5 }, firstHp: 1000 });
    const state = { ...baseState(catalog), combat: combatState([attacker, defender]) };
    const { events } = runAttack(state);
    expect(events.some((e) => e.type === 'StackHealed')).toBe(false);
  });
});

describe('A2a — estimateDamage reflète shieldWall & unlimitedRetaliation', () => {
  it('préviz : riposte présente contre un défenseur à retaliationsLeft 0 mais unlimitedRetaliation', () => {
    const catalog = {
      atk: unit({ id: 'atk', stats: { hp: 100, attack: 5, defense: 5, damage: [4, 4], speed: 6 } }),
      def: unit({ id: 'def', stats: { hp: 100, attack: 5, defense: 5, damage: [4, 4], speed: 1 }, abilities: [{ id: 'unlimitedRetaliation' }] }),
    };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 3, pos: { col: 0, row: 0 }, firstHp: 100 });
    const defender = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 3, pos: { col: 1, row: 0 }, firstHp: 100, retaliationsLeft: 0 });
    const state = { ...baseState(catalog), combat: combatState([attacker, defender]) };
    expect(estimateDamage(state, 'attacker-0', 'defender-0').retaliation).not.toBeNull();
  });
});
