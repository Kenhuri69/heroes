import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import type { GameEvent } from '../src/core/events';
import { createEmptyState, emptyResources, type GameState, type HeroState } from '../src/core/state';
import { seedRng } from '../src/core/rng';
import { applyAction } from '../src/combat/actions';
import { advanceTurn } from '../src/combat/turns';
import { estimateDamage } from '../src/combat/damage';
import { collectCasualties, initLedger } from '../src/combat/state-helpers';
import { applyWeeklyGrowth } from '../src/town/economy';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import type { HeroSkillDef } from '../src/hero/types';
import type { SpellDef } from '../src/hero/types';
import { testConfig, testMap } from './fixtures';
import { testTown, testBuildingCatalog, testUnitCatalogWithEconomy } from './town-fixtures';

/**
 * Remédiation de la revue de code — Lot R1 (plan
 * `.claude/plans/code-review-remediation.md`) : correctifs moteur E1–E5 et
 * mineurs associés, chacun avec son test dans le même commit (guideline §7).
 */

// --- Fabriques locales minimales (mêmes conventions que hero-spells.test.ts) ---

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

function combatState(stacks: CombatStack[], over: Partial<CombatState> = {}): CombatState {
  const combat: CombatState = {
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
    attackerHeroId: null,
    defenderHeroId: null,
    heroCastThisRound: [],
    heroAttackUsed: [],
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
    attributes: { attack: 0, defense: 0, power: 3, knowledge: 0 },
    mana: 20,
    manaMax: 20,
    skills: {},
    visitLuck: 0,
    spells: [],
    artifacts: Array.from({ length: 10 }, () => null),
    pendingSkillChoices: [],
    pendingAttributeChoices: [],
    factionId: '',
    houseId: '',
    houseEffects: [],
    name: '',
    specialtyId: '',
    specialtyEffects: [],
    warMachines: [],
    ...over,
  };
}

const SPELLS: Record<string, SpellDef> = {
  bolt: { id: 'bolt', school: 'fire', circle: 1, manaCost: 5, kind: 'damage', base: 10, perPower: 2 },
  heal: { id: 'heal', school: 'water', circle: 1, manaCost: 5, kind: 'heal', base: 10, perPower: 3 },
};

function baseState(catalog: Record<string, CombatUnitDef>): GameState {
  return { ...createEmptyState(), started: true, rng: seedRng(1), config: testConfig(), unitCatalog: catalog };
}

// --- E1 : engager un gardien avec une armée vide ---

describe('R1 · E1 — armée vide contre un gardien', () => {
  function startedGame(): GameState {
    const players: PlayerSetup[] = [{ id: 'p1', startingResources: emptyResources() }];
    const cmd: Command = {
      type: 'StartGame',
      seed: 1,
      players,
      map: testMap(),
      config: testConfig(),
      unitCatalog: testUnitCatalogWithEconomy(),
      buildingCatalog: testBuildingCatalog(),
      towns: [],
    };
    return apply(createEmptyState(), cmd).state;
  }

  function withGuardianAndEmptyArmy(): GameState {
    const state = startedGame();
    const map = state.map;
    if (!map) throw new Error('carte absente');
    return {
      ...state,
      map: {
        ...map,
        objects: [
          ...map.objects,
          { id: 'g1', type: 'guardian', pos: { x: 1, y: 0 }, unitId: 'red-grunt', count: 3 },
        ],
      },
      heroes: state.heroes.map((h) => ({ ...h, army: [] })),
    };
  }

  it('refuse le déplacement au lieu de laisser boucler puis planter le combat', () => {
    const state = withGuardianAndEmptyArmy();
    const heroId = state.heroes[0]?.id ?? '';
    const cmd: Command = { type: 'MoveHero', heroId, path: [{ x: 1, y: 0 }] };
    expect(validate(state, cmd)?.code).toBe('invalidArmy');
    // `apply` lève une EngineError propre — jamais le crash brut de `runAiIfNeeded`.
    expect(() => apply(state, cmd)).toThrowError(/invalidArmy/);
  });

  it('autorise le déplacement dès que l’armée n’est pas vide', () => {
    const base = withGuardianAndEmptyArmy();
    const state: GameState = {
      ...base,
      heroes: base.heroes.map((h) => ({ ...h, army: [{ unitId: 'red-grunt', count: 1 }] })),
    };
    const heroId = state.heroes[0]?.id ?? '';
    expect(validate(state, { type: 'MoveHero', heroId, path: [{ x: 1, y: 0 }] })).toBeNull();
  });
});

// --- E2 : les créatures tuées par un sort alimentent le bilan de pertes ---

describe('R1 · E2 — pertes par sort dans le bilan de combat', () => {
  const catalog = { def: unit({ id: 'def', stats: { hp: 10, attack: 0, defense: 0, damage: [1, 1], speed: 5 } }) };

  it('un sort de dégâts qui tue est compté dans les casualties (XP / Nécromancie)', () => {
    const h = hero({ spells: ['bolt'], attributes: { attack: 0, defense: 0, power: 3, knowledge: 0 } });
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'def', count: 1, pos: { col: 0, row: 0 } });
    const target = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 5, pos: { col: 2, row: 0 } });
    // Deuxième pile adverse : le combat ne se termine pas, `combat` survit à l’assertion.
    const other = stack({ id: 'defender-1', side: 'defender', slot: 1, unitId: 'def', count: 2, pos: { col: 3, row: 0 } });
    const state: GameState = {
      ...baseState(catalog),
      spellCatalog: SPELLS,
      heroes: [h],
      combat: combatState([attacker, target, other], { attackerHeroId: h.id, activeStackId: 'attacker-0' }),
    };
    const result = apply(state, { type: 'CastSpell', spellId: 'bolt', targetStackId: 'defender-0' });
    // amount = round(10 + 2×3) = 16 ; pool 5×10 = 50 ⇒ 1 mort.
    const combat = result.state.combat;
    expect(combat).not.toBeNull();
    const losses = collectCasualties(combat as CombatState);
    expect(losses).toContainEqual({ side: 'defender', unitId: 'def', lost: 1 });
  });
});

// --- Mineur : contrainte de camp des sorts ---

describe('R1 · mineur — contrainte de camp des sorts', () => {
  const catalog = { def: unit({ id: 'def', stats: { hp: 10, attack: 0, defense: 0, damage: [1, 1], speed: 5 } }) };

  function setup(): GameState {
    const h = hero({ spells: ['bolt', 'heal'] });
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'def', count: 3, pos: { col: 0, row: 0 } });
    const target = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 5, pos: { col: 2, row: 0 } });
    return {
      ...baseState(catalog),
      spellCatalog: SPELLS,
      heroes: [h],
      combat: combatState([attacker, target], { attackerHeroId: h.id, activeStackId: 'attacker-0' }),
    };
  }

  it('refuse un sort de dégâts lancé sur son propre camp', () => {
    const state = setup();
    expect(() => apply(state, { type: 'CastSpell', spellId: 'bolt', targetStackId: 'attacker-0' })).toThrowError(
      /invalidTarget/,
    );
  });

  it('refuse un soin lancé sur l’ennemi', () => {
    const state = setup();
    expect(() => apply(state, { type: 'CastSpell', spellId: 'heal', targetStackId: 'defender-0' })).toThrowError(
      /invalidTarget/,
    );
  });
});

// --- E5 : le critère « tir » de la résolution == celui de la prévisualisation ---

describe('R1 · E5 — tir/mêlée cohérent entre résolution et prévisualisation', () => {
  const catalog = {
    // Tireur SANS pénalité de mêlée : au contact il frappe en mêlée (canShoot=false),
    // donc c’est le bonus Attaque au corps du héros qui doit s’appliquer.
    sniper: unit({
      id: 'sniper',
      stats: { hp: 10, attack: 5, defense: 0, damage: [4, 4], speed: 5 },
      abilities: [{ id: 'shooter', params: { ammo: 10, noMeleePenalty: true } }],
    }),
    dummy: unit({ id: 'dummy', stats: { hp: 100, attack: 0, defense: 0, damage: [1, 1], speed: 1 } }),
  };
  const skillCatalog: Record<string, HeroSkillDef> = {
    // Bonus de mêlée uniquement (aucun bonus de tir) : révèle un mauvais critère.
    melee: { id: 'melee', ranks: [{ meleeDamagePct: 50 }, { meleeDamagePct: 50 }, { meleeDamagePct: 50 }] },
  };

  it('un tireur noMeleePenalty au contact applique le bonus mêlée (pas tir) à la résolution', () => {
    const h = hero({ skills: { melee: 1 } });
    const attacker = stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'sniper', count: 1, pos: { col: 0, row: 0 }, ammo: 10 });
    const target = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'dummy', count: 1, pos: { col: 1, row: 0 }, firstHp: 100 });
    const state: GameState = {
      ...baseState(catalog),
      skillCatalog,
      heroes: [h],
      combat: combatState([attacker, target], { attackerHeroId: h.id, activeStackId: 'attacker-0' }),
    };
    const estimate = estimateDamage(state, 'attacker-0', 'defender-0');
    const events: GameEvent[] = [];
    produce(state, (draft) => {
      applyAction(draft, events, 'attacker-0', { type: 'attack', targetStackId: 'defender-0' });
    });
    const attack = events.find(
      (e) => e.type === 'StackAttacked' && e.attackerId === 'attacker-0',
    ) as Extract<GameEvent, { type: 'StackAttacked' }>;
    // base 4 × (1 + 0,05×5 diff att/déf) × (1 + 50 % mêlée) = 7,5 → 8. Le bonus
    // MÊLÉE (et non tir, nul ici) est appliqué : sans chance, résolution == prévisualisation.
    expect(estimate.damageMin).toBe(8);
    expect(attack.damage).toBe(estimate.damageMin);
  });
});

// --- Mineur : la posture défensive survit à un tour sauté ---

describe('R1 · mineur — défense conservée quand la pile est sautée', () => {
  const catalog = { def: unit({ id: 'def', stats: { hp: 10, attack: 5, defense: 5, damage: [4, 4], speed: 5 } }) };

  it('une pile défendante immobilisée saute son tour sans perdre sa défense', () => {
    const defender = stack({
      id: 'attacker-0',
      side: 'attacker',
      slot: 0,
      unitId: 'def',
      count: 3,
      pos: { col: 0, row: 0 },
      defending: true,
      immobilizedRounds: 1,
    });
    // La pile immobilisée (même vitesse, camp attaquant) est traitée en premier.
    const enemy = stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'def', count: 1, pos: { col: 5, row: 5 } });
    const combat = combatState([defender, enemy], { activeStackId: null });
    const state: GameState = { ...baseState(catalog), combat };
    const events: GameEvent[] = [];
    const next = produce(state, (draft) => {
      advanceTurn(draft, events);
    });
    const skipped = next.combat?.stacks.find((s) => s.id === 'attacker-0');
    expect(events).toContainEqual({ type: 'StackImmobilized', stackId: 'attacker-0' });
    expect(skipped?.immobilizedRounds).toBe(0);
    expect(skipped?.defending).toBe(true); // la posture n’est pas levée sur un tour sauté
  });
});

// --- Mineur : le plafond de croissance ne réduit jamais un stock pré-seedé ---

describe('R1 · mineur — plafond de croissance non réducteur', () => {
  it('un stock pré-seedé au-dessus du plafond n’est pas réduit par la croissance', () => {
    const town = testTown({ ownerPlayerId: 'p1', stock: { 'red-grunt': 100 } });
    const state: GameState = {
      ...createEmptyState(),
      started: true,
      config: testConfig(),
      unitCatalog: testUnitCatalogWithEconomy(),
      buildingCatalog: testBuildingCatalog(),
      towns: [town],
      players: [
        {
          id: 'p1',
          resources: emptyResources(),
          factionResources: {},
          explored: [],
          controller: 'human',
          eliminated: false,
          townlessDays: 0,
          huntContract: null,
          team: 0,
        },
      ],
    };
    const events: GameEvent[] = [];
    const next = produce(state, (draft) => {
      applyWeeklyGrowth(draft, events);
    });
    // croissance 6, plafond 12 ; stock 100 > 12 ⇒ inchangé (jamais réduit).
    expect(next.towns[0]?.stock['red-grunt']).toBe(100);
  });
});
