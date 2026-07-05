import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { GameEvent } from '../src/core/events';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { applyAction } from '../src/combat/actions';
import { advanceTurn } from '../src/combat/turns';
import { initLedger, recordLoss } from '../src/combat/state-helpers';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import type { SpellDef } from '../src/hero/types';
import { estimateSpell } from '../src/hero';
import { testConfig } from './fixtures';

/**
 * Sorts en combat (doc 02 §1.4, §5 ; décisions plan phase-3.2 #2/#3) : dégâts,
 * soin, buff/debuff via `CastSpell` — mêmes conventions locales que
 * `combat-damage.test.ts` (unité/pile/état minimaux, sans passer par `StartGame`).
 */

/** Sorts de test, un par nature (doc 02 §1.4). */
const SPELLS: Record<string, SpellDef> = {
  bolt: { id: 'bolt', school: 'fire', circle: 1, manaCost: 5, kind: 'damage', base: 10, perPower: 2 },
  heal: { id: 'heal', school: 'water', circle: 1, manaCost: 5, kind: 'heal', base: 10, perPower: 3 },
  haste: { id: 'haste', school: 'air', circle: 1, manaCost: 4, kind: 'buff', base: 0, perPower: 0, speedMod: 3 },
  markspell: { id: 'markspell', school: 'traque', circle: 1, manaCost: 4, kind: 'applyMarks', base: 0, perPower: 0, marks: 2 },
};

function unit(over: Partial<CombatUnitDef> & { id: string }): CombatUnitDef {
  return {
    groupId: `${over.id}-group`,
    nativeTerrain: 'swamp',
    stats: { hp: 10, attack: 5, defense: 5, damage: [4, 4], speed: 5 },
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
    ammo: null,
    marks: 0,
    immobilizedRounds: 0,
    acted: false,
    statuses: [],
    ...partial,
  };
}

function combatState(stacks: CombatStack[], over: Partial<CombatState> = {}): CombatState {
  const combat: CombatState = {
    terrain: 'grass',
    round: 1,
    obstacles: [],
    stacks,
    activeStackId: stacks[0]?.id ?? null,
    playerSide: 'attacker',
    heroId: null,
    guardianObjectId: null,
    attackerHeroId: null,
    defenderHeroId: null,
    heroCastThisRound: false,
    finished: false,
    winner: null,
    ...over,
  };
  initLedger(combat);
  return combat;
}

function hero(over: Partial<HeroState> = {}): HeroState {
  return {
    id: 'hero-1',
    playerId: 'p1',
    pos: { x: 0, y: 0 },
    movementPoints: 0,
    army: [],
    xp: 0,
    level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 },
    mana: 20,
    manaMax: 20,
    skills: {},
    spells: [],
    artifacts: Array.from({ length: 10 }, () => null),
    pendingSkillChoices: [],
    factionId: '',
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

describe('CastSpell — sort de dégâts', () => {
  const catalog = { def: unit({ id: 'def', stats: { hp: 10, attack: 0, defense: 0, damage: [1, 1], speed: 5 } }) };

  function setup(heroOverrides: Partial<HeroState> = {}): GameState {
    const h = hero({
      spells: ['bolt'],
      attributes: { attack: 0, defense: 0, power: 3, knowledge: 0 },
      ...heroOverrides,
    });
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'def', count: 1, pos: { col: 0, row: 0 } });
    const target = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 5, pos: { col: 1, row: 0 }, firstHp: 10 });
    return {
      ...baseState(catalog),
      spellCatalog: SPELLS,
      heroes: [h],
      combat: combatState([attacker, target], { attackerHeroId: h.id, activeStackId: 'attacker-0' }),
    };
  }

  it('réduit la pile cible du bon nombre (base + perPower×Pouvoir) et débite la mana', () => {
    const state = setup();
    const result = apply(state, { type: 'CastSpell', spellId: 'bolt', targetStackId: 'defender-0' });
    // amount = round(10 + 2×3) = 16 ; pool = 4×10+10 = 50 ; reste 34 ⇒ 4 survivants, firstHp 4, 1 mort.
    const spellCast = result.events.find((e) => e.type === 'SpellCast');
    expect(spellCast).toEqual({ type: 'SpellCast', heroId: 'hero-1', spellId: 'bolt', targetId: 'defender-0', amount: 16, kills: 1 });
    const target = result.state.combat?.stacks.find((s) => s.id === 'defender-0');
    expect(target?.count).toBe(4);
    expect(target?.firstHp).toBe(4);
    const updatedHero = result.state.heroes.find((h) => h.id === 'hero-1');
    expect(updatedHero?.mana).toBe(20 - 5);
  });

  it('heroAlreadyCast : un seul sort par round', () => {
    const state = setup();
    const afterFirst = apply(state, { type: 'CastSpell', spellId: 'bolt', targetStackId: 'defender-0' }).state;
    expect(() =>
      apply(afterFirst, { type: 'CastSpell', spellId: 'bolt', targetStackId: 'defender-0' }),
    ).toThrowError(/heroAlreadyCast/);
  });

  it('notEnoughMana', () => {
    const state = setup({ mana: 2 });
    expect(() => apply(state, { type: 'CastSpell', spellId: 'bolt', targetStackId: 'defender-0' })).toThrowError(
      /notEnoughMana/,
    );
  });

  it('spellNotKnown', () => {
    const state = setup({ spells: [] });
    expect(() => apply(state, { type: 'CastSpell', spellId: 'bolt', targetStackId: 'defender-0' })).toThrowError(
      /spellNotKnown/,
    );
  });

  it('unknownSpell', () => {
    const state = setup();
    expect(() => apply(state, { type: 'CastSpell', spellId: 'ghost-spell', targetStackId: 'defender-0' })).toThrowError(
      /unknownSpell/,
    );
  });

  it('invalidTarget : pile inexistante', () => {
    const state = setup();
    expect(() => apply(state, { type: 'CastSpell', spellId: 'bolt', targetStackId: 'does-not-exist' })).toThrowError(
      /invalidTarget/,
    );
  });

  it('estimateSpell == effet réel quand la chance du héros est nulle (pas de RNG)', () => {
    const state = setup();
    const estimate = estimateSpell(state, 'bolt', 'defender-0');
    const result = apply(state, { type: 'CastSpell', spellId: 'bolt', targetStackId: 'defender-0' });
    const spellCast = result.events.find((e) => e.type === 'SpellCast') as Extract<
      GameEvent,
      { type: 'SpellCast' }
    >;
    expect(estimate).toEqual({ amount: spellCast.amount, kills: spellCast.kills, kind: 'damage' });
  });
});

describe('CastSpell — soin', () => {
  const catalog = { def: unit({ id: 'def', stats: { hp: 6, attack: 0, defense: 0, damage: [1, 1], speed: 5 } }) };

  it('restaure PV/créatures, plafonné à l’effectif courant + pertes déjà enregistrées', () => {
    const h = hero({ spells: ['heal'] });
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'def', count: 1, pos: { col: 0, row: 0 } });
    const ally = stack({ id: 'attacker-1', side: 'attacker', slot: 1, unitId: 'def', count: 3, pos: { col: 0, row: 1 }, firstHp: 6 });
    // Une pile adverse vivante est nécessaire : sans elle, `checkCombatEnd`
    // considère le combat déjà gagné et nullifie `combat` avant l'assertion.
    const enemy = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 5, row: 5 } });
    const combat = combatState([attacker, ally, enemy], { attackerHeroId: h.id, activeStackId: 'attacker-0' });
    recordLoss(combat, 'attacker', 'def', 2); // 2 pertes déjà enregistrées pour cette unité/ce camp (plafond documenté, hero/index.ts)
    const state: GameState = { ...baseState(catalog), spellCatalog: SPELLS, heroes: [h], combat };
    const result = apply(state, { type: 'CastSpell', spellId: 'heal', targetStackId: 'attacker-1' });
    // amount = round(10+0) = 10 ; pool courant 18, plafond (3+2)×6=30 ⇒ 28 ⇒ 5 créatures, firstHp 4.
    const spellCast = result.events.find((e) => e.type === 'SpellCast');
    expect(spellCast).toEqual({ type: 'SpellCast', heroId: 'hero-1', spellId: 'heal', targetId: 'attacker-1', amount: 10, kills: 0 });
    const target = result.state.combat?.stacks.find((s) => s.id === 'attacker-1');
    expect(target?.count).toBe(5);
    expect(target?.firstHp).toBe(4);
  });
});

describe('CastSpell — applyMarks (école Traque, doc 05 §6)', () => {
  const catalog = { def: unit({ id: 'def', stats: { hp: 10, attack: 5, defense: 5, damage: [4, 4], speed: 5 } }) };

  it('pose des charges de Marque sur la cible (event MarkApplied)', () => {
    const h = hero({ spells: ['markspell'] });
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'def', count: 1, pos: { col: 0, row: 0 } });
    const enemy = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 5, row: 5 } });
    const combat = combatState([attacker, enemy], { attackerHeroId: h.id, activeStackId: 'attacker-0' });
    const state: GameState = { ...baseState(catalog), spellCatalog: SPELLS, heroes: [h], combat };
    const result = apply(state, { type: 'CastSpell', spellId: 'markspell', targetStackId: 'defender-0' });
    expect(result.state.combat?.stacks.find((s) => s.id === 'defender-0')?.marks).toBe(2);
    expect(result.events).toContainEqual({ type: 'MarkApplied', targetId: 'defender-0', marks: 2 });
  });

  it('plafonne au maximum de charges (marksMax)', () => {
    const h = hero({ spells: ['markspell'] });
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'def', count: 1, pos: { col: 0, row: 0 } });
    const enemy = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 5, row: 5 }, marks: 2 });
    const combat = combatState([attacker, enemy], { attackerHeroId: h.id, activeStackId: 'attacker-0' });
    const state: GameState = { ...baseState(catalog), spellCatalog: SPELLS, heroes: [h], combat };
    const result = apply(state, { type: 'CastSpell', spellId: 'markspell', targetStackId: 'defender-0' });
    expect(result.state.combat?.stacks.find((s) => s.id === 'defender-0')?.marks).toBe(3); // plafond marksMax
  });
});

describe('CastSpell — buff/debuff', () => {
  const catalog = { def: unit({ id: 'def', stats: { hp: 10, attack: 5, defense: 5, damage: [4, 4], speed: 5 } }) };

  it('applique un statut {attackMod,defenseMod,speedMod,roundsLeft=max(1,Pouvoir)}', () => {
    const h = hero({ spells: ['haste'], attributes: { attack: 0, defense: 0, power: 2, knowledge: 0 } });
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'def', count: 1, pos: { col: 0, row: 0 } });
    const ally = stack({ id: 'attacker-1', side: 'attacker', slot: 1, unitId: 'def', count: 1, pos: { col: 0, row: 1 } });
    // Pile adverse vivante requise (cf. commentaire du test « soin » ci-dessus).
    const enemy = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 5, row: 5 } });
    const combat = combatState([attacker, ally, enemy], { attackerHeroId: h.id, activeStackId: 'attacker-0' });
    const state: GameState = { ...baseState(catalog), spellCatalog: SPELLS, heroes: [h], combat };
    const result = apply(state, { type: 'CastSpell', spellId: 'haste', targetStackId: 'attacker-1' });
    const target = result.state.combat?.stacks.find((s) => s.id === 'attacker-1');
    expect(target?.statuses).toEqual([{ spellId: 'haste', attackMod: 0, defenseMod: 0, speedMod: 3, roundsLeft: 2 }]);
    const spellCast = result.events.find((e) => e.type === 'SpellCast');
    expect(spellCast).toEqual({ type: 'SpellCast', heroId: 'hero-1', spellId: 'haste', targetId: 'attacker-1', amount: 0, kills: 0 });
  });

  it('damage.ts reflète le statut : attackMod/defenseMod entrent dans computeMultiplier', () => {
    const dmgCatalog = {
      atk: unit({ id: 'atk', stats: { hp: 10, attack: 10, defense: 0, damage: [4, 4], speed: 5 } }),
      def: unit({ id: 'def', stats: { hp: 100, attack: 0, defense: 0, damage: [1, 1], speed: 1 } }),
    };
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'atk', count: 1, pos: { col: 0, row: 0 } });
    const defender = stack({
      id: 'defender-0',
      side: 'defender',
      slot: 0,
      unitId: 'def',
      count: 1,
      pos: { col: 1, row: 0 },
      firstHp: 100,
      statuses: [{ spellId: 'bouclier-de-pierre', attackMod: 0, defenseMod: 10, speedMod: 0, roundsLeft: 2 }],
    });
    const state = { ...baseState(dmgCatalog), combat: combatState([attacker, defender]) };
    const events: GameEvent[] = [];
    produce(state, (draft) => {
      applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
    });
    // diff = 10 - (0+10) = 0 → mult 1 → dégâts round(4)=4 (au lieu de 6 sans le statut de +10 défense).
    const strike = events.find((e) => e.type === 'StackAttacked') as Extract<GameEvent, { type: 'StackAttacked' }>;
    expect(strike.damage).toBe(4);
  });

  it('le statut expire après `roundsLeft` rounds (décrément à chaque transition de round)', () => {
    const statusCatalog = { def: unit({ id: 'def' }) };
    const a = stack({
      id: 'attacker-0',
      side: 'attacker',
      slot: 0,
      unitId: 'def',
      count: 1,
      pos: { col: 0, row: 0 },
      statuses: [{ spellId: 'x', attackMod: 1, defenseMod: 0, speedMod: 0, roundsLeft: 2 }],
    });
    const b = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 1, row: 0 } });
    const state = { ...baseState(statusCatalog), combat: combatState([a, b]) };
    const events: GameEvent[] = [];
    const afterRound1 = produce(state, (draft) => {
      for (const s of draft.combat!.stacks) s.acted = true;
      advanceTurn(draft, events);
    });
    expect(afterRound1.combat?.stacks.find((s) => s.id === 'attacker-0')?.statuses[0]?.roundsLeft).toBe(1);
    const afterRound2 = produce(afterRound1, (draft) => {
      for (const s of draft.combat!.stacks) s.acted = true;
      advanceTurn(draft, events);
    });
    expect(afterRound2.combat?.stacks.find((s) => s.id === 'attacker-0')?.statuses).toEqual([]);
  });
});
