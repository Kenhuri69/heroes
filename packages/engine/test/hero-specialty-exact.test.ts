import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { beginGuardianCombat } from '../src/combat/setup';
import { checkCombatEnd } from '../src/combat/turns';
import { initLedger, recordLoss } from '../src/combat/state-helpers';
import { seedRng } from '../src/core/rng';
import {
  createEmptyState,
  emptyResources,
  type GameState,
  type HeroState,
} from '../src/core/state';
import type { GameEvent } from '../src/core/events';
import type { Command, PlayerSetup } from '../src/core/commands';
import type { CombatStack, CombatState, CombatUnitDef } from '../src/combat/types';
import type { FactionBonus } from '../src/faction/types';

/**
 * H-COND-EXACT — signatures EXACTES de 3 spécialités, chacune via un point
 * d'extension moteur générique dédié (zéro faction/héros en dur) :
 *  1. `raiseUndeadPctPerLevel` (Mère Corbeau, doc 04 §5) — Nécromancie +% / niveau.
 *  2. `startingSymbiosisStacks` (Faelar, doc 14 §5) — Symbiose de départ.
 *  3. `startingArmyBonus` (Alwin, doc 05 §7) — familier de départ.
 */

function unit(over: Partial<CombatUnitDef> & { id: string }): CombatUnitDef {
  return {
    groupId: `${over.id}-group`,
    nativeTerrain: 'grass',
    stats: { hp: 10, attack: 5, defense: 5, damage: [4, 4], speed: 5 },
    abilities: [],
    ...over,
  };
}

function hero(over: Partial<HeroState> = {}): HeroState {
  return {
    id: 'hero-1',
    playerId: 'p1',
    pos: { x: 0, y: 0 },
    movementPoints: 0, naval: false,
    army: [],
    xp: 0,
    level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 },
    mana: 0,
    manaMax: 0,
    skills: {},
    visitLuck: 0,
    visitMorale: 0,
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
    rosterId: '',
    ...over,
  };
}

function stack(
  p: Pick<CombatStack, 'id' | 'side' | 'slot' | 'unitId' | 'count' | 'pos'> & Partial<CombatStack>,
): CombatStack {
  return {
    firstHp: 10,
    retaliationsLeft: 1,
    waited: false,
    defending: false,
    ammo: null,
    spellCharges: 0,
    marks: 0,
    immobilizedRounds: 0,
    transformed: false,
    symbiosisStacks: 0,
    acted: false,
    statuses: [],
    ...p,
  };
}

// ——— 1. raiseUndeadPctPerLevel (Mère Corbeau) ———

describe('H-COND-EXACT — raiseUndeadPctPerLevel (Nécromancie +%/niveau)', () => {
  const CATALOG: Record<string, CombatUnitDef> = {
    grunt: unit({ id: 'grunt', stats: { hp: 6, attack: 3, defense: 2, damage: [1, 2], speed: 4 } }),
    wolf: unit({ id: 'wolf', stats: { hp: 10, attack: 4, defense: 3, damage: [2, 3], speed: 6 } }),
    skel: unit({
      id: 'skel',
      stats: { hp: 5, attack: 4, defense: 3, damage: [1, 3], speed: 5 },
      abilities: [{ id: 'undead' }],
    }),
  };
  const BONUS: FactionBonus = {
    type: 'raiseUndeadOnVictory',
    unitId: 'skel',
    percentHpRaised: 10, // base 10 %
    capBase: 100,
    capPerExisting: 2,
  };
  const FACTION_CATALOG = { necro: { bonuses: [BONUS] } };

  function combatFor(): CombatState {
    const combat: CombatState = {
      terrain: 'grass',
      phase: 'battle',
      round: 3,
      obstacles: [],
      stacks: [
        stack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'grunt', count: 50, pos: { col: 0, row: 0 } }),
        stack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'wolf', count: 0, pos: { col: 7, row: 0 } }),
      ],
      activeStackId: null,
      playerSide: 'attacker',
      heroId: 'hero-1',
      guardianObjectId: null,
      townId: null,
      wallDefenseBonus: 0,
      attackerHeroId: 'hero-1',
      defenderHeroId: null,
      heroCastThisRound: [],
      heroAttackUsed: [],
      finished: false,
      winner: null,
    };
    initLedger(combat);
    return combat;
  }

  /** Relève des squelettes après avoir tué `hpKilled/10` loups ; retourne le nombre relevé. */
  function raisedAtLevel(level: number, perLevel: number | undefined): number {
    const h = hero({
      factionId: 'necro',
      level,
      specialtyEffects: perLevel === undefined ? [] : [{ raiseUndeadPctPerLevel: perLevel }],
    });
    const combat = combatFor();
    recordLoss(combat, { id: 'defender-0', side: 'defender', unitId: 'wolf' }, 10); // 10 × 10 PV = 100 PV vivants tués
    const state: GameState = {
      ...createEmptyState(),
      started: true,
      config: null,
      unitCatalog: CATALOG,
      factionCatalog: FACTION_CATALOG,
      heroes: [h],
      combat,
    };
    const events: GameEvent[] = [];
    const next = produce(state, (draft) => {
      checkCombatEnd(draft, events);
    });
    return next.heroes[0]?.army.find((s) => s.unitId === 'skel')?.count ?? 0;
  }

  it('sans l’effet : pourcentage de base seul, indépendant du niveau', () => {
    // base 10 % : floor(100 × 10 / 100 / 5) = 2, quel que soit le niveau.
    expect(raisedAtLevel(1, undefined)).toBe(2);
    expect(raisedAtLevel(10, undefined)).toBe(2);
  });

  it('avec +2 %/niveau : relève davantage à haut niveau (base + 2 × niveau)', () => {
    // niveau 1 : (10 + 2×1)=12 % ⇒ floor(100×12/100/5)=2
    expect(raisedAtLevel(1, 2)).toBe(2);
    // niveau 10 : (10 + 2×10)=30 % ⇒ floor(100×30/100/5)=6
    expect(raisedAtLevel(10, 2)).toBe(6);
  });
});

// ——— 2. startingSymbiosisStacks (Faelar) ———

describe('H-COND-EXACT — startingSymbiosisStacks (Symbiose de départ)', () => {
  const SYMB = [{ id: 'symbiosis', params: { attackPerRound: 2, defensePerRound: 2, maxStacks: 4 } }];
  const CATALOG: Record<string, CombatUnitDef> = {
    // Unité symbiotique RAPIDE ⇒ agit en premier ⇒ le combat s'arrête au tour joueur
    // (playerSide=attacker) avant toute action qui réinitialiserait la Symbiose.
    treant: unit({ id: 'treant', stats: { hp: 30, attack: 6, defense: 8, damage: [5, 8], speed: 20 }, abilities: SYMB }),
    guard: unit({ id: 'guard', stats: { hp: 6, attack: 3, defense: 2, damage: [1, 2], speed: 1 } }),
    plain: unit({ id: 'plain', stats: { hp: 10, attack: 5, defense: 5, damage: [3, 4], speed: 2 } }),
  };

  function guardianState(specialtyEffects: HeroState['specialtyEffects'], armyUnit = 'treant'): GameState {
    return {
      ...createEmptyState(),
      started: true,
      rng: seedRng(1),
      config: {
        movement: { base: 1500, perSpeed: 50, roadMultiplier: 0.75, diagonalMultiplier: 1.41 },
        visionRadius: 5,
        terrains: { grass: { moveCost: 100 } },
        combat: {
          attackDefenseStep: 0.05,
          heroDefenseStep: 0.025,
          damageBonusMax: 0.6,
          damageReductionMax: 0.7,
          defendDefenseMultiplier: 1.3,
          rangedMeleePenalty: 0.5,
          moraleChancePerPoint: 0.04,
          luckChancePerPoint: 0.04,
          markBonusPerStack: 0.08,
          marksMax: 3,
          obstaclesMin: 0,
          obstaclesMax: 0,
        },
        hero: { xpPerHpKilled: 1, levelCurve: { base: 1000, exponent: 1.9 }, maxLevel: 30, attributeWeights: { attack: 30, defense: 30, power: 20, knowledge: 20 } },
      },
      map: {
        id: 'm',
        width: 3,
        height: 1,
        terrain: ['grass', 'grass', 'grass'],
        road: [false, false, false],
        objects: [{ id: 'g1', type: 'guardian', pos: { x: 1, y: 0 }, unitId: 'guard', count: 1 }],
        triggers: [],
        startPositions: [{ x: 0, y: 0 }],
      },
      unitCatalog: CATALOG,
      heroes: [hero({ id: 'h1', pos: { x: 0, y: 0 }, army: [{ unitId: armyUnit, count: 3 }], specialtyEffects })],
      players: [
        { id: 'p1', resources: emptyResources(), factionResources: {}, explored: [], controller: 'human', eliminated: false, townlessDays: 0, huntContract: null, team: 0 },
      ],
    } as unknown as GameState;
  }

  it('les piles symbiotiques du héros démarrent à 1 palier', () => {
    const events: GameEvent[] = [];
    const next = produce(guardianState([{ startingSymbiosisStacks: 1 }]), (draft) => {
      beginGuardianCombat(draft, 'h1', 'g1', events);
    });
    const treantStack = next.combat?.stacks.find((s) => s.side === 'attacker' && s.unitId === 'treant');
    expect(treantStack?.symbiosisStacks).toBe(1);
  });

  it('sans l’effet : les piles démarrent à 0 (comportement historique)', () => {
    const events: GameEvent[] = [];
    const next = produce(guardianState([]), (draft) => {
      beginGuardianCombat(draft, 'h1', 'g1', events);
    });
    const treantStack = next.combat?.stacks.find((s) => s.side === 'attacker' && s.unitId === 'treant');
    expect(treantStack?.symbiosisStacks).toBe(0);
  });

  it('n’affecte que les piles réellement dotées de la capacité symbiosis', () => {
    const events: GameEvent[] = [];
    const next = produce(guardianState([{ startingSymbiosisStacks: 1 }], 'plain'), (draft) => {
      beginGuardianCombat(draft, 'h1', 'g1', events);
    });
    const plainStack = next.combat?.stacks.find((s) => s.side === 'attacker' && s.unitId === 'plain');
    expect(plainStack?.symbiosisStacks).toBe(0); // 'plain' n'a pas la capacité symbiosis
  });
});

// ——— 3. startingArmyBonus (Alwin) ———

describe('H-COND-EXACT — startingArmyBonus (familier de départ)', () => {
  const CATALOG: Record<string, CombatUnitDef> = {
    owl: unit({ id: 'owl', stats: { hp: 8, attack: 4, defense: 3, damage: [2, 3], speed: 5 } }),
    grunt: unit({ id: 'grunt', stats: { hp: 6, attack: 3, defense: 2, damage: [1, 2], speed: 4 } }),
  };
  const MAP = {
    id: 'm',
    width: 2,
    height: 1,
    terrain: ['grass', 'grass'],
    road: [false, false],
    objects: [],
    triggers: [],
    startPositions: [{ x: 0, y: 0 }],
  };
  const CONFIG = {
    movement: { base: 1500, perSpeed: 50, roadMultiplier: 0.75, diagonalMultiplier: 1.41 },
    visionRadius: 5,
    terrains: { grass: { moveCost: 100 } },
    combat: {
      attackDefenseStep: 0.05, heroDefenseStep: 0.025, damageBonusMax: 0.6, damageReductionMax: 0.7,
      defendDefenseMultiplier: 1.3, rangedMeleePenalty: 0.5, moraleChancePerPoint: 0.04, luckChancePerPoint: 0.04,
      markBonusPerStack: 0.08, marksMax: 3, obstaclesMin: 0, obstaclesMax: 0,
    },
    hero: { xpPerHpKilled: 1, levelCurve: { base: 1000, exponent: 1.9 }, maxLevel: 30, attributeWeights: { attack: 30, defense: 30, power: 20, knowledge: 20 } },
  };

  function startWith(startingArmy: { unitId: string; count: number }[]): GameState {
    const players: PlayerSetup[] = [
      { id: 'p1', startingResources: emptyResources(), startingArmy, startingHeroId: 'doyen' },
    ];
    const cmd: Command = {
      type: 'StartGame',
      seed: 1,
      players,
      map: MAP as never,
      config: CONFIG as never,
      unitCatalog: CATALOG,
      heroRoster: {
        doyen: {
          factionId: 'test',
          name: 'Doyen',
          attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 },
          specialtyId: 'doyen',
          specialtyEffects: [{ startingArmyBonus: { unitId: 'owl', count: 1 } }],
          startingSkills: {},
          startingSpells: [],
        },
      },
    };
    return apply(createEmptyState(), cmd).state;
  }

  it('ajoute une nouvelle pile du familier quand l’unité est absente', () => {
    const h = startWith([]).heroes[0];
    expect(h?.army).toContainEqual({ unitId: 'owl', count: 1 });
  });

  it('empile sur une pile existante du même familier', () => {
    const h = startWith([{ unitId: 'owl', count: 5 }]).heroes[0];
    expect(h?.army.find((s) => s.unitId === 'owl')?.count).toBe(6);
  });

  it('coexiste avec l’armée de départ normale', () => {
    const h = startWith([{ unitId: 'grunt', count: 10 }]).heroes[0];
    expect(h?.army).toEqual(
      expect.arrayContaining([
        { unitId: 'grunt', count: 10 },
        { unitId: 'owl', count: 1 },
      ]),
    );
  });
});
