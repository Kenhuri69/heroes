import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import { emptyResources, createEmptyState, type GameState } from '../src/core/state';
import { findPath, stepCost } from '../src/adventure/path';
import { dailyMovementPoints } from '../src/adventure/config';
import type { GridPos } from '../src/adventure/map';
import { testConfig, testMap } from './fixtures';

const config = testConfig();
const map = testMap();

function started(playerIds: string[] = ['p1']): GameState {
  return apply(createEmptyState(), {
    type: 'StartGame',
    seed: 42,
    players: playerIds.map((id) => ({ id, startingResources: emptyResources() })),
    map: testMap(),
    config: testConfig(),
    unitCatalog: {},
    buildingCatalog: {},
    towns: [],
  }).state;
}

describe('stepCost', () => {
  it('applique terrain, route et diagonale (doc 02 §1.5)', () => {
    // herbe droite : 100 ; herbe diagonale : 141 ; marais : 150 ; route : 75
    expect(stepCost(config, map, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(100);
    expect(stepCost(config, map, { x: 0, y: 0 }, { x: 1, y: 1 })).toBe(141);
    expect(stepCost(config, map, { x: 2, y: 3 }, { x: 2, y: 4 })).toBe(150);
    expect(stepCost(config, map, { x: 0, y: 8 }, { x: 1, y: 8 })).toBe(75);
    // route + diagonale : round(100 × 0,75 × 1,41) = 106
    expect(stepCost(config, map, { x: 0, y: 7 }, { x: 1, y: 8 })).toBe(106);
  });
});

describe('findPath (A* 8 directions)', () => {
  it('va en ligne droite sur terrain uniforme', () => {
    const path = findPath(config, map, { x: 0, y: 0 }, { x: 3, y: 0 });
    expect(path).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
  });

  it('contourne les obstacles infranchissables', () => {
    // colonne de montagnes x=5, y=1..5 : passage par le haut (y=0) ou le bas
    const path = findPath(config, map, { x: 4, y: 3 }, { x: 6, y: 3 });
    expect(path).not.toBeNull();
    for (const step of path ?? []) {
      expect(map.terrain[step.y * map.width + step.x]).not.toBe('mountain');
    }
    const cost = pathCost({ x: 4, y: 3 }, path ?? []);
    expect(cost).toBeGreaterThan(2 * 100); // plus long que la ligne directe bloquée
  });

  it('préfère la route au marais à coût égal en distance', () => {
    // de (1,6) à (4,8) : traverser le marais coûte plus cher que descendre sur la route
    const path = findPath(config, map, { x: 0, y: 6 }, { x: 4, y: 8 });
    expect(path).not.toBeNull();
    expect(path?.some((p) => p.y === 8)).toBe(true);
  });

  it('retourne null si aucune issue ou cible invalide', () => {
    expect(findPath(config, map, { x: 0, y: 0 }, { x: 5, y: 3 })).toBeNull(); // montagne
    expect(findPath(config, map, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeNull(); // sur place
    expect(findPath(config, map, { x: 0, y: 0 }, { x: 42, y: 0 })).toBeNull(); // hors carte
  });

  it('évite les tuiles occupées par un autre héros', () => {
    const blocked: GridPos[] = [{ x: 1, y: 0 }];
    const path = findPath(config, map, { x: 0, y: 0 }, { x: 2, y: 0 }, blocked);
    expect(path).not.toBeNull();
    expect(path?.some((p) => p.x === 1 && p.y === 0)).toBe(false);
  });

  it('est déterministe', () => {
    const a = findPath(config, map, { x: 0, y: 0 }, { x: 9, y: 9 });
    const b = findPath(config, map, { x: 0, y: 0 }, { x: 9, y: 9 });
    expect(a).toEqual(b);
  });
});

describe('StartGame (aventure)', () => {
  it('crée un héros par joueur à sa position de départ, points de mouvement pleins', () => {
    const state = started(['p1', 'p2']);
    expect(state.heroes).toHaveLength(2);
    expect(state.heroes[0]).toMatchObject({
      id: 'hero-p1',
      playerId: 'p1',
      pos: { x: 0, y: 0 },
      movementPoints: dailyMovementPoints(config),
    });
    expect(state.heroes[1]?.pos).toEqual({ x: 9, y: 9 });
  });

  it('révèle le brouillard autour du départ (rayon de vision), le reste inexploré', () => {
    const state = started(['p1']);
    const explored = state.players[0]?.explored ?? [];
    expect(explored[0]).toBe(1); // (0,0)
    expect(explored[5 * 10 + 5]).toBe(1); // (5,5) à distance 5
    expect(explored[9 * 10 + 9]).toBe(0); // coin opposé
  });

  it('rejette une carte incohérente', () => {
    const badTerrain = { ...testMap(), terrain: testMap().terrain.map(() => 'lava') };
    expect(
      validate(createEmptyState(), {
        type: 'StartGame',
        seed: 1,
        players: [{ id: 'p1', startingResources: emptyResources() }],
        map: badTerrain,
        config: testConfig(),
        unitCatalog: {},
        buildingCatalog: {},
        towns: [],
      })?.code,
    ).toBe('invalidMap');

    const badObject = testMap();
    badObject.objects = [
      { id: 'x', type: 'resource', pos: { x: 1, y: 1 }, resource: 'mana', amount: 5 },
    ];
    expect(
      validate(createEmptyState(), {
        type: 'StartGame',
        seed: 1,
        players: [{ id: 'p1', startingResources: emptyResources() }],
        map: badObject,
        config: testConfig(),
        unitCatalog: {},
        buildingCatalog: {},
        towns: [],
      })?.code,
    ).toBe('invalidMap');
  });
});

describe('MoveHero', () => {
  it('consomme les points de mouvement pas à pas et émet MoveStepped', () => {
    const state = started();
    const { state: next, events } = apply(state, {
      type: 'MoveHero',
      heroId: 'hero-p1',
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 1 },
      ],
    });
    expect(next.heroes[0]?.pos).toEqual({ x: 2, y: 1 });
    expect(next.heroes[0]?.movementPoints).toBe(1500 - 100 - 141);
    const steps = events.filter((e) => e.type === 'MoveStepped');
    expect(steps).toHaveLength(2);
    expect(steps[1]).toMatchObject({ to: { x: 2, y: 1 }, movementPointsLeft: 1259 });
  });

  it("s'arrête quand les points du jour ne suffisent plus (chemin multi-jours)", () => {
    const base = started();
    // 250 pts pour 3 pas droits à 100 : les 2 premiers passent, le 3ᵉ non
    const state = {
      ...base,
      heroes: base.heroes.map((h) => ({ ...h, movementPoints: 250 })),
    };
    const { state: next, events } = apply(state, {
      type: 'MoveHero',
      heroId: 'hero-p1',
      path: [
        { x: 0, y: 1 },
        { x: 0, y: 2 },
        { x: 0, y: 3 },
      ],
    });
    expect(next.heroes[0]?.pos).toEqual({ x: 0, y: 2 });
    expect(next.heroes[0]?.movementPoints).toBe(50);
    expect(events.filter((e) => e.type === 'MoveStepped')).toHaveLength(2);
  });

  it("ramasse une ressource et s'arrête dessus (interception, doc 08 §2.1)", () => {
    const state = started();
    const { state: next, events } = apply(state, {
      type: 'MoveHero',
      heroId: 'hero-p1',
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 4, y: 0 },
      ],
    });
    expect(next.heroes[0]?.pos).toEqual({ x: 3, y: 0 }); // arrêt sur le tas d'or
    expect(next.players[0]?.resources.gold).toBe(500);
    expect(next.map?.objects).toHaveLength(0);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'ResourcePicked', resource: 'gold', amount: 500 }),
    );
  });

  it('révèle le brouillard le long du chemin', () => {
    const state = started();
    const { state: next } = apply(state, {
      type: 'MoveHero',
      heroId: 'hero-p1',
      path: [
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ],
    });
    // (7,7) à distance de Tchebychev 5 de (2,2)
    expect(next.players[0]?.explored[7 * 10 + 7]).toBe(1);
  });

  it('rejette chemins invalides, héros adverse et points épuisés', () => {
    const state = started(['p1', 'p2']);
    const check = (path: GridPos[], heroId = 'hero-p1'): string | undefined =>
      validate(state, { type: 'MoveHero', heroId, path })?.code;

    expect(check([])).toBe('invalidPath'); // vide
    expect(check([{ x: 5, y: 0 }])).toBe('invalidPath'); // non adjacent
    expect(check([{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 3 }])).toBe('invalidPath'); // saut
    expect(check([{ x: 1, y: 1 }], 'hero-p2')).toBe('notYourHero'); // pas le joueur actif
    expect(check([{ x: 1, y: 1 }], 'nobody')).toBe('unknownHero');
    expect(validate(createEmptyState(), { type: 'MoveHero', heroId: 'x', path: [] })?.code).toBe(
      'gameNotStarted',
    );

    // eau infranchissable en (1,7)
    const nearWater = apply(state, {
      type: 'MoveHero',
      heroId: 'hero-p1',
      path: [
        { x: 0, y: 1 },
        { x: 0, y: 2 },
        { x: 0, y: 3 },
        { x: 0, y: 4 },
        { x: 0, y: 5 },
        { x: 0, y: 6 },
      ],
    }).state;
    expect(validate(nearWater, { type: 'MoveHero', heroId: 'hero-p1', path: [{ x: 1, y: 7 }] })?.code).toBe(
      'invalidPath',
    );

    // points épuisés : premier pas inabordable
    const drained = {
      ...state,
      heroes: state.heroes.map((h) => (h.id === 'hero-p1' ? { ...h, movementPoints: 50 } : h)),
    };
    expect(validate(drained, { type: 'MoveHero', heroId: 'hero-p1', path: [{ x: 1, y: 0 }] })?.code).toBe(
      'noMovementPoints',
    );
  });

  it('refuse de traverser un autre héros', () => {
    const state = started(['p1', 'p2']);
    // hero-p2 est en (9,9) ; p1 tente d'y entrer via un chemin valide jusqu'à (9,9)
    const moved = apply(state, {
      type: 'MoveHero',
      heroId: 'hero-p1',
      path: [
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ],
    }).state;
    const toOccupied = validate(
      {
        ...moved,
        heroes: moved.heroes.map((h) => (h.id === 'hero-p2' ? { ...h, pos: { x: 3, y: 3 } } : h)),
      },
      { type: 'MoveHero', heroId: 'hero-p1', path: [{ x: 3, y: 3 }] },
    );
    expect(toOccupied?.code).toBe('invalidPath');
  });
});

describe('EndTurn (aventure)', () => {
  it('restaure les points de mouvement de tous les héros au jour suivant', () => {
    let state = started(['p1']);
    state = apply(state, {
      type: 'MoveHero',
      heroId: 'hero-p1',
      path: [{ x: 1, y: 0 }],
    }).state;
    expect(state.heroes[0]?.movementPoints).toBe(1400);
    state = apply(state, { type: 'EndTurn', playerId: 'p1' }).state;
    expect(state.calendar.day).toBe(2);
    expect(state.heroes[0]?.movementPoints).toBe(dailyMovementPoints(config));
  });
});

function pathCost(from: GridPos, path: GridPos[]): number {
  let prev = from;
  let total = 0;
  for (const step of path) {
    total += stepCost(config, map, prev, step);
    prev = step;
  }
  return total;
}
