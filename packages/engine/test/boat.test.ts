import { describe, expect, it } from 'vitest';
import { apply, validate } from '../src/core/engine';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { testConfig, testMap } from './fixtures';
import type { AdventureMapDef } from '../src/adventure/map';

// Config où l'eau est navigable (A3.2). La carte de test a de l'eau en (1,7),(2,7).
const navalConfig = {
  ...testConfig(),
  terrains: { ...testConfig().terrains, water: { moveCost: null, navalCost: 100 } },
};

/** Démarre une partie 1 joueur avec un bateau posé sur l'eau (1,7), héros au rivage. */
function startedWithBoat(): GameState {
  const map: AdventureMapDef = {
    ...testMap(),
    objects: [...testMap().objects, { id: 'boat-1', type: 'boat', pos: { x: 1, y: 7 } }],
  };
  const state = apply(createEmptyState(), {
    type: 'StartGame',
    seed: 42,
    players: [{ id: 'p1', startingResources: emptyResources() }],
    map,
    config: navalConfig,
    unitCatalog: {},
    buildingCatalog: {},
    towns: [],
  }).state;
  // Place le héros sur la terre ferme adjacente au bateau, avec des PM pleins.
  return {
    ...state,
    heroes: [{ ...state.heroes[0]!, pos: { x: 0, y: 7 }, movementPoints: 2000 }],
  };
}

describe('embarquement / navigation / débarquement (A3.2)', () => {
  it('BoardBoat : le héros embarque, devient naval, le bateau est consommé', () => {
    const state = startedWithBoat();
    const after = apply(state, { type: 'BoardBoat', heroId: 'hero-p1', boatId: 'boat-1' }).state;
    const hero = after.heroes[0]!;
    expect(hero.naval).toBe(true);
    expect(hero.pos).toEqual({ x: 1, y: 7 });
    expect(hero.movementPoints).toBe(0); // embarquer consomme la journée
    expect(after.map?.objects.some((o) => o.id === 'boat-1')).toBe(false);
  });

  it('BoardBoat : refuse un bateau non adjacent ou un héros déjà naval', () => {
    const state = startedWithBoat();
    const far = { ...state, heroes: [{ ...state.heroes[0]!, pos: { x: 5, y: 0 } }] };
    expect(validate(far, { type: 'BoardBoat', heroId: 'hero-p1', boatId: 'boat-1' })?.code).toBe(
      'boatNotAdjacent',
    );
    const naval = { ...state, heroes: [{ ...state.heroes[0]!, naval: true }] };
    expect(validate(naval, { type: 'BoardBoat', heroId: 'hero-p1', boatId: 'boat-1' })?.code).toBe(
      'alreadyNaval',
    );
    expect(validate(state, { type: 'BoardBoat', heroId: 'hero-p1', boatId: 'nope' })?.code).toBe(
      'unknownBoat',
    );
  });

  it('un héros embarqué navigue l’eau mais pas la terre (domaine)', () => {
    const boarded = apply(startedWithBoat(), {
      type: 'BoardBoat',
      heroId: 'hero-p1',
      boatId: 'boat-1',
    }).state;
    // Recharge les PM pour naviguer (l'embarquement a consommé la journée).
    const sailing = { ...boarded, heroes: [{ ...boarded.heroes[0]!, movementPoints: 2000 }] };
    // (1,7) → (2,7) : eau navigable ⇒ OK.
    const moved = apply(sailing, { type: 'MoveHero', heroId: 'hero-p1', path: [{ x: 2, y: 7 }] }).state;
    expect(moved.heroes[0]!.pos).toEqual({ x: 2, y: 7 });
    // Vers la terre (0,7 herbe) ⇒ chemin refusé (hors domaine naval).
    expect(
      validate(sailing, { type: 'MoveHero', heroId: 'hero-p1', path: [{ x: 0, y: 7 }] })?.code,
    ).toBe('invalidPath');
  });

  it('DisembarkBoat : le héros débarque sur la terre, un bateau reste sur l’eau', () => {
    const boarded = apply(startedWithBoat(), {
      type: 'BoardBoat',
      heroId: 'hero-p1',
      boatId: 'boat-1',
    }).state;
    const ready = { ...boarded, heroes: [{ ...boarded.heroes[0]!, movementPoints: 2000 }] };
    // Le héros est en (1,7) ; débarque sur (0,7) (herbe adjacente).
    const after = apply(ready, {
      type: 'DisembarkBoat',
      heroId: 'hero-p1',
      target: { x: 0, y: 7 },
    }).state;
    const hero = after.heroes[0]!;
    expect(hero.naval).toBe(false);
    expect(hero.pos).toEqual({ x: 0, y: 7 });
    expect(hero.movementPoints).toBe(0);
    // Un bateau réutilisable est reposé sur la tuile d'eau quittée (1,7).
    expect(after.map?.objects.some((o) => o.type === 'boat' && o.pos.x === 1 && o.pos.y === 7)).toBe(
      true,
    );
  });

  it('DisembarkBoat : refuse un héros à pied ou une cible non terrestre', () => {
    const boarded = apply(startedWithBoat(), {
      type: 'BoardBoat',
      heroId: 'hero-p1',
      boatId: 'boat-1',
    }).state;
    const ready = { ...boarded, heroes: [{ ...boarded.heroes[0]!, movementPoints: 2000 }] };
    // Cible = eau (2,7) ⇒ non terrestre.
    expect(
      validate(ready, { type: 'DisembarkBoat', heroId: 'hero-p1', target: { x: 2, y: 7 } })?.code,
    ).toBe('invalidPath');
    // Héros à pied ⇒ notNaval.
    const onFoot = startedWithBoat();
    expect(
      validate(onFoot, { type: 'DisembarkBoat', heroId: 'hero-p1', target: { x: 0, y: 6 } })?.code,
    ).toBe('notNaval');
  });
});
