import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { hashState } from '../src/core/serialize';
import { chooseAction } from '../src/combat/ai';
import type { ArmyStack, CombatStack, CombatUnitDef } from '../src/combat/types';
import { testCatalog, testConfig, testMap } from './fixtures';

/**
 * Tests de l'IA de combat (doc 02 §5.6, lot B) : déterminisme, comportements
 * imposés (kite/défense/progression), préférence de cible, et non-régression
 * de la property « un combat se termine toujours » (combat-property.test.ts,
 * inchangée) même dans un cas de kite mutuel entre tireurs.
 */

function startedGame(seed: number, catalog: Record<string, CombatUnitDef> = testCatalog()): GameState {
  const players: PlayerSetup[] = [{ id: 'p1', startingResources: emptyResources() }];
  return apply(createEmptyState(), {
    type: 'StartGame',
    seed,
    players,
    map: testMap(),
    config: testConfig(),
    unitCatalog: catalog,
  }).state;
}

/** Construit un GameState directement en combat (sans passer par StartCombat) — cas construits à la main. */
function makeCombatState(
  catalog: Record<string, CombatUnitDef>,
  stacks: CombatStack[],
  activeStackId: string,
): GameState {
  const base = createEmptyState();
  return {
    ...base,
    started: true,
    config: testConfig(),
    unitCatalog: catalog,
    combat: {
      terrain: 'grass',
      round: 1,
      obstacles: [],
      stacks,
      activeStackId,
      playerSide: 'attacker',
      heroId: null,
      guardianObjectId: null,
      finished: false,
      winner: null,
    },
  };
}

function makeStack(overrides: Partial<CombatStack> & Pick<CombatStack, 'id' | 'side' | 'slot' | 'unitId' | 'count' | 'pos'>): CombatStack {
  return {
    firstHp: 999,
    retaliationsLeft: 1,
    waited: false,
    defending: false,
    ammo: null,
    marks: 0,
    acted: false,
    ...overrides,
  };
}

describe('IA de combat — déterminisme (doc 02 §5.6)', () => {
  it('même seed + AutoCombat ⇒ hashState identique, répété 1000 fois', () => {
    const attacker: ArmyStack[] = [
      { unitId: 'red-grunt', count: 8 },
      { unitId: 'red-archer', count: 5 },
    ];
    const defender: ArmyStack[] = [{ unitId: 'blue-wolf', count: 6 }];
    const run = (): GameState => {
      const startCmd: Command = { type: 'StartCombat', attacker, defender, terrain: 'grass' };
      let state = apply(startedGame(42), startCmd).state;
      if (state.combat) state = apply(state, { type: 'AutoCombat' }).state;
      return state;
    };
    const reference = hashState(run());
    for (let i = 0; i < 1000; i++) {
      expect(hashState(run())).toBe(reference);
    }
  });
});

describe('IA de combat — comportements imposés', () => {
  it('un tireur menacé par un ennemi lent kite (s’éloigne) au lieu de tirer', () => {
    const catalog = testCatalog();
    // Archer (tireur, vitesse effective 6 en herbe : 5+1 natif) à (5,5) ;
    // grunt lent (vitesse effective 5 : 4+1 natif) à distance 2 — peut
    // atteindre l'adjacence au tour prochain (distance−1=1 ≤ 5) : menace.
    const archer = makeStack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'red-archer', count: 5, pos: { col: 5, row: 5 }, ammo: 10 });
    const grunt = makeStack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'red-grunt', count: 20, pos: { col: 7, row: 5 } });
    const state = makeCombatState(catalog, [archer, grunt], 'attacker-0');
    const action = chooseAction(state, 'attacker-0');
    expect(action.type).toBe('move');
    if (action.type === 'move') {
      // La distance à l'ennemi doit augmenter (repli), jamais se réduire.
      expect(action.to).not.toEqual(archer.pos);
    }
  });

  it('une pile lente sans cible atteignable défend, la plus rapide du camp avance', () => {
    const catalog = testCatalog();
    // Loup rapide (vitesse 6, pas de bonus terrain natif ici — nativeTerrain swamp) et
    // grunt plus lent (vitesse effective 5 en herbe) côté attaquant ; défenseur
    // hors de portée de déplacement des deux (distance ≫ vitesse) ce tour-ci.
    const wolf = makeStack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'blue-wolf', count: 10, pos: { col: 0, row: 0 } });
    const grunt = makeStack({ id: 'attacker-1', side: 'attacker', slot: 1, unitId: 'red-grunt', count: 10, pos: { col: 0, row: 2 } });
    const enemy = makeStack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'red-grunt', count: 10, pos: { col: 11, row: 9 } });
    const state = makeCombatState(catalog, [wolf, grunt, enemy], 'attacker-1');

    const slowAction = chooseAction(state, 'attacker-1');
    expect(slowAction.type).toBe('defend');

    const fastAction = chooseAction(state, 'attacker-0');
    expect(fastAction.type).toBe('move');
  });

  it('préfère achever une cible qui subit des pertes plutôt qu’une cible blindée increvable', () => {
    const catalog: Record<string, CombatUnitDef> = {
      ...testCatalog(),
      striker: {
        id: 'striker',
        groupId: 'x',
        nativeTerrain: 'grass',
        stats: { hp: 20, attack: 10, defense: 5, damage: [5, 7], speed: 5 },
        abilities: [],
      },
      'weak-target': {
        id: 'weak-target',
        groupId: 'y',
        nativeTerrain: 'grass',
        stats: { hp: 10, attack: 2, defense: 2, speed: 4, damage: [1, 2] },
        abilities: [],
      },
      'armored-target': {
        id: 'armored-target',
        groupId: 'y',
        // Défense assez haute pour saturer le clamp de réduction (-70 %) sans
        // gonfler artificiellement sa "valeur" de cible (attaque+défense+vitesse).
        nativeTerrain: 'grass',
        stats: { hp: 30, attack: 2, defense: 24, speed: 4, damage: [1, 2] },
        abilities: [],
      },
    };
    const attacker = makeStack({ id: 'attacker-0', side: 'attacker', slot: 0, unitId: 'striker', count: 5, pos: { col: 5, row: 5 }, firstHp: 20 });
    const weak = makeStack({ id: 'defender-0', side: 'defender', slot: 0, unitId: 'weak-target', count: 1, pos: { col: 6, row: 5 }, firstHp: 10, retaliationsLeft: 0 });
    const armored = makeStack({ id: 'defender-1', side: 'defender', slot: 1, unitId: 'armored-target', count: 1, pos: { col: 4, row: 5 }, firstHp: 30, retaliationsLeft: 0 });
    const state = makeCombatState(catalog, [attacker, weak, armored], 'attacker-0');

    const action = chooseAction(state, 'attacker-0');
    expect(action.type).toBe('attack');
    if (action.type === 'attack') expect(action.targetStackId).toBe('defender-0');
  });
});

describe('IA de combat — terminaison', () => {
  it('AutoCombat se termine même avec des tireurs des deux camps (kite mutuel)', () => {
    const catalog: Record<string, CombatUnitDef> = {
      ...testCatalog(),
      'blue-archer': {
        id: 'blue-archer',
        groupId: 'blue-pack',
        nativeTerrain: 'swamp',
        stats: { hp: 8, attack: 5, defense: 2, damage: [2, 4], speed: 5 },
        abilities: [{ id: 'shooter', params: { ammo: 10 } }],
      },
    };
    const attacker: ArmyStack[] = [{ unitId: 'red-archer', count: 10 }];
    const defender: ArmyStack[] = [{ unitId: 'blue-archer', count: 10 }];
    const startCmd: Command = { type: 'StartCombat', attacker, defender, terrain: 'grass' };
    let state = apply(startedGame(7, catalog), startCmd).state;
    if (state.combat) state = apply(state, { type: 'AutoCombat' }).state;
    expect(state.combat).toBeNull();
  });
});
