import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState, type HeroState } from '../src/core/state';
import type { HeroProgressionConfig } from '../src/adventure/config';
import type { AdventureMapDef } from '../src/adventure/map';
import type { GameEvent } from '../src/core/events';
import { seedRng } from '../src/core/rng';
import { grantXp, xpForLevel } from '../src/adventure/experience';
import { testCatalog, testConfig, testMap } from './fixtures';

/**
 * Progression du héros (doc 02 §1.2, plan phase-2.5 lot E) : courbe d'XP,
 * montées de niveau au RNG de l'état, câblage à la fin de combat d'aventure.
 */

const REAL_CURVE: HeroProgressionConfig = {
  xpPerHpKilled: 1,
  levelCurve: { base: 268, exponent: 1.9 },
  maxLevel: 30,
  attributeWeights: { attack: 30, defense: 30, power: 20, knowledge: 20 },
};

/** Courbe linéaire (base=10, exponent=1) : seuils lisibles pour les tests de montée. */
function simpleConfig(overrides: Partial<HeroProgressionConfig> = {}): HeroProgressionConfig {
  return {
    xpPerHpKilled: 1,
    levelCurve: { base: 10, exponent: 1 },
    maxLevel: 30,
    attributeWeights: { attack: 30, defense: 30, power: 20, knowledge: 20 },
    ...overrides,
  };
}

function baseHero(overrides: Partial<HeroState> = {}): HeroState {
  return {
    id: 'hero-1',
    playerId: 'p1',
    pos: { x: 0, y: 0 },
    movementPoints: 0,
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
    ...overrides,
  };
}

/** État minimal exploitable par `grantXp` (config + héros + rng), non passé par `produce`. */
function stateWithHero(config: HeroProgressionConfig, hero: HeroState, seed = 1): GameState {
  const state = createEmptyState();
  state.config = { ...testConfig(), hero: config };
  state.rng = seedRng(seed);
  state.heroes = [hero];
  return state;
}

function sumAttributes(a: HeroState['attributes']): number {
  return a.attack + a.defense + a.power + a.knowledge;
}

describe('xpForLevel', () => {
  it('niveau 1 = 0 (niveau de départ)', () => {
    expect(xpForLevel(REAL_CURVE, 1)).toBe(0);
  });

  it('valeurs exactes de la courbe 268 × n^1.9 (premier palier ≈ 1000 XP)', () => {
    expect(xpForLevel(REAL_CURVE, 2)).toBe(1000);
    expect(xpForLevel(REAL_CURVE, 3)).toBe(2161);
    expect(xpForLevel(REAL_CURVE, 10)).toBe(21288);
  });

  it('valeur au cap (niveau 30)', () => {
    expect(xpForLevel(REAL_CURVE, 30)).toBe(171658);
  });
});

describe('grantXp', () => {
  it('gain simple sans franchir de palier : xp cumulée, pas de montée', () => {
    const config = simpleConfig();
    const hero = baseHero({ xp: 5 });
    const state = stateWithHero(config, hero);
    const events: GameEvent[] = [];
    grantXp(state, events, 'hero-1', 8);
    expect(state.heroes[0]?.xp).toBe(13);
    expect(state.heroes[0]?.level).toBe(1);
    expect(events).toEqual([{ type: 'XpGained', heroId: 'hero-1', amount: 8, xp: 13 }]);
  });

  it('montée simple : +1 niveau, +1 attribut, événements XpGained puis HeroLevelUp', () => {
    const config = simpleConfig(); // xpForLevel(2) = 20
    const hero = baseHero({ xp: 15 });
    const state = stateWithHero(config, hero);
    const events: GameEvent[] = [];
    grantXp(state, events, 'hero-1', 10); // xp 15 -> 25, franchit le niveau 2
    const updated = state.heroes[0];
    expect(updated?.level).toBe(2);
    expect(updated?.xp).toBe(25);
    expect(sumAttributes(updated!.attributes)).toBe(1);
    expect(events[0]).toEqual({ type: 'XpGained', heroId: 'hero-1', amount: 10, xp: 25 });
    expect(events[1]).toMatchObject({ type: 'HeroLevelUp', heroId: 'hero-1', level: 2 });
    expect(events).toHaveLength(2);
  });

  it('montée multiple en chaîne : un HeroLevelUp par niveau franchi', () => {
    const config = simpleConfig(); // seuils 20/30/40/50/60...
    const hero = baseHero({ xp: 0 });
    const state = stateWithHero(config, hero);
    const events: GameEvent[] = [];
    grantXp(state, events, 'hero-1', 55); // -> niveau 5 (seuil 60 non atteint)
    const updated = state.heroes[0];
    expect(updated?.level).toBe(5);
    expect(updated?.xp).toBe(55);
    expect(sumAttributes(updated!.attributes)).toBe(4);
    const levelUps = events.filter((e) => e.type === 'HeroLevelUp');
    expect(levelUps.map((e) => (e as { level: number }).level)).toEqual([2, 3, 4, 5]);
    expect(events[0]?.type).toBe('XpGained');
  });

  it('cap maxLevel : xp continue de s’accumuler, plus de montée', () => {
    const config = simpleConfig({ maxLevel: 5 });
    const hero = baseHero({ xp: 50, level: 5 });
    const state = stateWithHero(config, hero);
    const events: GameEvent[] = [];
    grantXp(state, events, 'hero-1', 1000);
    const updated = state.heroes[0];
    expect(updated?.level).toBe(5);
    expect(updated?.xp).toBe(1050);
    expect(events.some((e) => e.type === 'HeroLevelUp')).toBe(false);
    expect(events).toEqual([{ type: 'XpGained', heroId: 'hero-1', amount: 1000, xp: 1050 }]);
  });

  it('déterminisme : même état ⇒ même attribut tiré', () => {
    const config = simpleConfig();
    const runOnce = () => {
      const state = stateWithHero(config, baseHero({ xp: 15 }), 42);
      const events: GameEvent[] = [];
      grantXp(state, events, 'hero-1', 10);
      return { attribute: (events[1] as { attribute: string }).attribute, rng: state.rng };
    };
    const a = runOnce();
    const b = runOnce();
    expect(a.attribute).toBe(b.attribute);
    expect(a.rng).toEqual(b.rng);
  });

  it('pondérations : poids concentrés sur attack ⇒ toujours attack, quel que soit le RNG', () => {
    const config = simpleConfig({
      attributeWeights: { attack: 1, defense: 0, power: 0, knowledge: 0 },
    });
    for (const seed of [1, 7, 99, 12345]) {
      const state = stateWithHero(config, baseHero({ xp: 15 }), seed);
      const events: GameEvent[] = [];
      grantXp(state, events, 'hero-1', 10);
      const levelUp = events.find((e) => e.type === 'HeroLevelUp');
      expect(levelUp).toMatchObject({ attribute: 'attack' });
    }
  });
});

describe('intégration combat (via apply)', () => {
  function mapWithGuardian(): AdventureMapDef {
    const base = testMap();
    return {
      ...base,
      objects: [
        ...base.objects,
        { id: 'guardian-1', type: 'guardian', pos: { x: 1, y: 0 }, unitId: 'blue-wolf', count: 5 },
      ],
    };
  }

  function startedGame(): GameState {
    const players: PlayerSetup[] = [
      {
        id: 'p1',
        startingResources: emptyResources(),
        startingArmy: [{ unitId: 'red-grunt', count: 100 }],
      },
    ];
    return apply(createEmptyState(), {
      type: 'StartGame',
      seed: 20260704,
      players,
      map: mapWithGuardian(),
      config: testConfig(),
      unitCatalog: testCatalog(),
      buildingCatalog: {},
      towns: [],
    }).state;
  }

  it('victoire d’interception : XpGained cohérent avec les pertes du défenseur, xp/level mis à jour', () => {
    let state = startedGame();
    let result = apply(state, { type: 'MoveHero', heroId: 'hero-p1', path: [{ x: 1, y: 0 }] });
    state = result.state;
    result = apply(state, { type: 'AutoCombat' });
    state = result.state;
    const combatEnded = result.events.find((e) => e.type === 'CombatEnded');
    expect(combatEnded).toMatchObject({ winner: 'attacker' });
    // Gardien de 5 loups (hp 10) anéanti ⇒ 5 × 10 × xpPerHpKilled(1) = 50 XP.
    const xpGained = result.events.find((e) => e.type === 'XpGained');
    expect(xpGained).toEqual({ type: 'XpGained', heroId: 'hero-p1', amount: 50, xp: 50 });
    const hero = state.heroes.find((h) => h.id === 'hero-p1');
    expect(hero?.xp).toBe(50);
    expect(hero?.level).toBe(1); // 50 < xpForLevel(2) = 3732 (courbe fixture base 1000)
  });

  it('arène (StartCombat, heroId null) : aucun XP accordé', () => {
    let state = startedGame();
    const result = apply(state, {
      type: 'StartCombat',
      attacker: [{ unitId: 'red-grunt', count: 100 }],
      defender: [{ unitId: 'blue-wolf', count: 5 }],
      terrain: 'grass',
    });
    state = result.state;
    const autoResult = apply(state, { type: 'AutoCombat' });
    expect(autoResult.events.some((e) => e.type === 'XpGained')).toBe(false);
    expect(autoResult.events.some((e) => e.type === 'HeroLevelUp')).toBe(false);
  });
});
