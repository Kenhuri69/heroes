import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyState, type GameState, type HeroState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { advanceTurn } from '../src/combat/turns';
import { estimateDamage } from '../src/combat';
import { castHeroSpell, estimateSpell, spellAffectedStacks } from '../src/hero';
import { spellAtMastery } from '../src/hero/spells';
import { heroManaMax } from '../src/hero/artifacts';
import { initLedger } from '../src/combat/state-helpers';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import type { GameEvent } from '../src/core/events';
import type { HeroSkillDef, SpellDef } from '../src/hero/types';
import { testConfig } from './fixtures';

/**
 * LE4/F3 (doc 02 §1.3) — sept compétences, toutes branchées : Sorcellerie,
 * Intelligence, Résistance (sorts), Artillerie, Premiers soins, Balistique
 * (machines de guerre) ; Mysticisme est couvert avec la mana persistante (C2).
 * Unités et compétences synthétiques : seul le champ d'effet fait foi.
 */

const SKILLS: Record<string, HeroSkillDef> = {
  sorcery: { id: 'sorcery', ranks: [{ spellDamagePct: 10 }, { spellDamagePct: 20 }, { spellDamagePct: 50 }] },
  intelligence: { id: 'intelligence', ranks: [{ manaMaxPct: 25 }, { manaMaxPct: 50 }, { manaMaxPct: 100 }] },
  resistance: { id: 'resistance', ranks: [{ magicResistancePct: 20 }, { magicResistancePct: 30 }, { magicResistancePct: 40 }] },
  artillery: { id: 'artillery', ranks: [{ warMachineDamagePct: 100 }, { warMachineDamagePct: 100 }, { warMachineDamagePct: 100 }] },
  'first-aid': { id: 'first-aid', ranks: [{ firstAidHealPct: 100 }, { firstAidHealPct: 100 }, { firstAidHealPct: 100 }] },
  ballistics: { id: 'ballistics', ranks: [{ siegeDamagePct: 100 }, { siegeDamagePct: 100 }, { siegeDamagePct: 100 }] },
};

const NUKE: SpellDef = { id: 'nuke', school: 'fire', circle: 3, manaCost: 10, kind: 'damage', base: 100, perPower: 0 };

function unit(id: string, over: Partial<CombatUnitDef> = {}): CombatUnitDef {
  return { id, groupId: `${id}-g`, nativeTerrain: 'swamp', stats: { hp: 1000, attack: 5, defense: 5, damage: [10, 10], speed: 5 }, abilities: [], ...over };
}

function hero(id: string, skills: Record<string, number>, knowledge = 0): HeroState {
  return {
    id, playerId: id, pos: { x: 0, y: 0 }, movementPoints: 0, naval: false, army: [], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge }, mana: 40, manaMax: 40, skills, visitLuck: 0, visitMorale: 0,
    spells: ['nuke'], artifacts: Array.from({ length: 10 }, () => null), backpack: [], pendingSkillChoices: [], pendingAttributeChoices: [],
    factionId: '', houseId: '', houseEffects: [], name: '', specialtyId: '', specialtyEffects: [], warMachines: [], rosterId: '',
  };
}

function stack(id: string, side: CombatStack['side'], unitId: string, over: Partial<CombatStack> = {}): CombatStack {
  return {
    id, side, slot: 0, unitId, count: 1, firstHp: 1000, pos: { col: side === 'attacker' ? 0 : 10, row: 2 }, retaliationsLeft: 1,
    waited: false, defending: false, ammo: null, spellCharges: 0, marks: 0, immobilizedRounds: 0, transformed: false,
    symbiosisStacks: 0, acted: false, statuses: [], ...over,
  };
}

function state(
  atkSkills: Record<string, number>,
  defSkills: Record<string, number>,
  catalog: Record<string, CombatUnitDef>,
  stacks: CombatStack[],
  extra: Partial<CombatState> = {},
): GameState {
  const combat: CombatState = {
    terrain: 'grass', phase: 'battle', round: 1, obstacles: [], stacks, activeStackId: stacks[0]!.id,
    playerSide: 'attacker', heroId: null, guardianObjectId: null, townId: null, wallDefenseBonus: 0,
    attackerHeroId: 'atk', defenderHeroId: 'def', heroCastThisRound: [], heroAttackUsed: [], finished: false, winner: null,
    ...extra,
  };
  initLedger(combat);
  return {
    ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(), unitCatalog: catalog,
    spellCatalog: { nuke: NUKE }, skillCatalog: SKILLS, heroes: [hero('atk', atkSkills), hero('def', defSkills)], combat,
  };
}

function nextRound(cur: GameState): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const next = produce(cur, (draft) => {
    for (const s of draft.combat!.stacks) { s.acted = true; s.waited = false; }
    advanceTurn(draft, events);
  });
  return { state: next, events };
}

const duel = { ally: unit('ally'), foe: unit('foe') };
const duelStacks = () => [stack('attacker-0', 'attacker', 'ally'), stack('defender-0', 'defender', 'foe')];

describe('LE4/F3 — compétences de magie', () => {
  it('Sorcellerie : +% de dégâts des sorts du héros (préviz = résolution, même canal)', () => {
    expect(estimateSpell(state({}, {}, duel, duelStacks()), 'nuke', 'defender-0')).toMatchObject({ amount: 100 });
    expect(estimateSpell(state({ sorcery: 3 }, {}, duel, duelStacks()), 'nuke', 'defender-0')).toMatchObject({ amount: 150 });
  });

  it('Résistance : l’armée du héros encaisse moins de dégâts de sort', () => {
    expect(estimateSpell(state({}, { resistance: 1 }, duel, duelStacks()), 'nuke', 'defender-0')).toMatchObject({ amount: 80 });
  });

  it('Intelligence : +% de mana maximale', () => {
    expect(heroManaMax(hero('h', {}, 4), {}, SKILLS)).toBe(40);
    expect(heroManaMax(hero('h', { intelligence: 2 }, 4), {}, SKILLS)).toBe(60);
    // Sans catalogue de compétences (anciens appelants) : inchangé.
    expect(heroManaMax(hero('h', { intelligence: 2 }, 4), {})).toBe(40);
  });
});

describe('LE4/F3 — compétences de machines de guerre', () => {
  const machines = {
    ...duel,
    ballista: unit('ballista', { stats: { hp: 250, attack: 5, defense: 5, damage: [10, 10], speed: 1 },
      abilities: [{ id: 'shooter', params: { ammo: 24 } }, { id: 'warMachine' }] }),
    archer: unit('archer', { abilities: [{ id: 'shooter', params: { ammo: 24 } }] }),
    tent: unit('tent', { stats: { hp: 75, attack: 0, defense: 10, damage: [1, 1], speed: 1 },
      abilities: [{ id: 'warMachine' }, { id: 'immobile' }, { id: 'healPerRound', params: { amount: 30 } }] }),
    grunt: unit('grunt', { stats: { hp: 100, attack: 5, defense: 5, damage: [10, 10], speed: 6 } }),
    catapult: unit('catapult', { stats: { hp: 300, attack: 8, defense: 10, damage: [10, 10], speed: 1 },
      abilities: [{ id: 'warMachine' }, { id: 'siegeBreaker' }] }),
  };

  it('Artillerie : double les dégâts d’une machine de guerre, pas ceux d’un tireur ordinaire', () => {
    const shots = (skills: Record<string, number>, shooter: string) =>
      estimateDamage(state(skills, {}, machines, [stack('attacker-0', 'attacker', shooter, { ammo: 24 }), stack('defender-0', 'defender', 'foe')]), 'attacker-0', 'defender-0');
    expect(shots({ artillery: 1 }, 'ballista').damageMin).toBeGreaterThan(1.9 * shots({}, 'ballista').damageMin);
    expect(shots({ artillery: 1 }, 'archer').damageMin).toBe(shots({}, 'archer').damageMin);
  });

  it('Premiers soins : la tente du camp soigne deux fois plus', () => {
    const run = (skills: Record<string, number>) => {
      const s = state(skills, {}, machines, [
        stack('attacker-0', 'attacker', 'tent', { firstHp: 75 }),
        stack('attacker-1', 'attacker', 'grunt', { count: 3, firstHp: 10, pos: { col: 1, row: 2 } }),
        stack('defender-0', 'defender', 'foe', { pos: { col: 14, row: 5 } }),
      ]);
      return nextRound(s).events.filter((e) => e.type === 'StackHealed');
    };
    expect(run({})).toEqual([{ type: 'StackHealed', stackId: 'attacker-1', amount: 30 }]);
    expect(run({ 'first-aid': 1 })).toEqual([{ type: 'StackHealed', stackId: 'attacker-1', amount: 60 }]);
  });

  it('Balistique : la catapulte du héros assaillant ronge deux fois plus le rempart', () => {
    const run = (skills: Record<string, number>) => {
      const s = state(skills, {}, machines, [
        stack('attacker-0', 'attacker', 'catapult'),
        stack('defender-0', 'defender', 'foe', { pos: { col: 14, row: 5 } }),
      ], { siegeWalls: [{ col: 10, row: 2 }], siegeWallHp: { '10,2': 100 } });
      return nextRound(s).state.combat!.siegeWallHp!['10,2'];
    };
    expect(run({})).toBe(90);
    expect(run({ ballistics: 1 })).toBe(80);
  });
});

describe('LE4/F2 — la maîtrise d’école change l’effet du sort', () => {
  const BOLT: SpellDef = {
    id: 'bolt', school: 'fire', circle: 1, manaCost: 5, kind: 'damage', base: 10, perPower: 0,
    mastery: [{ rank: 2, base: 20 }, { rank: 3, base: 30 }],
  };
  const SLOW: SpellDef = {
    id: 'slow', school: 'fire', circle: 1, manaCost: 5, kind: 'debuff', base: 0, perPower: 0, speedMod: -2,
    mastery: [{ rank: 3, area: 'all' }],
  };
  const FIRE: Record<string, HeroSkillDef> = {
    ...SKILLS,
    'magic-fire': { id: 'magic-fire', school: 'fire', ranks: [{ manaCostReductionPct: 5 }, { manaCostReductionPct: 10 }, { manaCostReductionPct: 20 }] },
  };
  const three = () => [
    stack('attacker-0', 'attacker', 'ally'),
    stack('defender-0', 'defender', 'foe'),
    stack('defender-1', 'defender', 'foe', { pos: { col: 10, row: 6 } }),
  ];
  const withFire = (rank: number): GameState => {
    const s = state(rank > 0 ? { 'magic-fire': rank } : {}, {}, duel, three());
    return { ...s, skillCatalog: FIRE, spellCatalog: { bolt: BOLT, slow: SLOW } };
  };

  it('spellAtMastery : le plus haut palier atteint l’emporte, sans palier = le sort même', () => {
    expect(spellAtMastery(BOLT, 0)).toBe(BOLT);
    expect(spellAtMastery(BOLT, 1).base).toBe(10);
    expect(spellAtMastery(BOLT, 2).base).toBe(20);
    expect(spellAtMastery(BOLT, 3).base).toBe(30);
  });

  it('préviz : la puissance suit le rang du héros dans l’école', () => {
    expect(estimateSpell(withFire(0), 'bolt', 'defender-0')).toMatchObject({ amount: 10 });
    expect(estimateSpell(withFire(2), 'bolt', 'defender-0')).toMatchObject({ amount: 20 });
    expect(estimateSpell(withFire(3), 'bolt', 'defender-0')).toMatchObject({ amount: 30 });
  });

  it('au rang 3, Lenteur devient de masse — zone prévisualisée ET résolue', () => {
    expect(spellAffectedStacks(withFire(2), 'slow', 'defender-0').map((s) => s.id)).toEqual(['defender-0']);
    expect(spellAffectedStacks(withFire(3), 'slow', 'defender-0').map((s) => s.id)).toEqual(['defender-0', 'defender-1']);
    const cast = produce(withFire(3), (d) => {
      castHeroSpell(d, 'attacker', 'atk', 'slow', 'defender-0', []);
    });
    const slowed = cast.combat!.stacks.filter((s) => s.statuses.some((st) => st.spellId === 'slow')).map((s) => s.id);
    expect(slowed).toEqual(['defender-0', 'defender-1']);
  });
});
