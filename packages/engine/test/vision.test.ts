import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { testConfig, testMap } from './fixtures';
import { testTown, testUnitCatalogWithEconomy } from './town-fixtures';

/**
 * F1 — vision depuis les structures possédées : une ville/mine possédée révèle
 * `buildingVisionRadius` tuiles autour d'elle (brouillard `explored`), même sans
 * héros à proximité. F2 — tour de guet (`visitable` `vision`).
 */

const WIDTH = 10;
function isExplored(state: GameState, x: number, y: number): boolean {
  return (state.players[0]?.explored[y * WIDTH + x] ?? 0) === 1;
}

function startWith(buildingVisionRadius: number | undefined): GameState {
  const players: PlayerSetup[] = [{ id: 'p1', startingResources: { ...emptyResources() } }];
  // Ville possédée loin du héros (départ 0,0 ; rayon héros 5 ⇒ ne couvre pas 8,8).
  const town = testTown({ id: 'town-far', pos: { x: 8, y: 8 } });
  const cmd: Command = {
    type: 'StartGame',
    seed: 1,
    players,
    map: testMap(),
    config: { ...testConfig(), ...(buildingVisionRadius !== undefined ? { buildingVisionRadius } : {}) },
    unitCatalog: testUnitCatalogWithEconomy(),
    towns: [town],
  };
  return apply(createEmptyState(), cmd).state;
}

describe('F1 — vision des structures possédées', () => {
  it('une ville possédée révèle son voisinage au StartGame (hors vision du héros)', () => {
    const state = startWith(2);
    // (8,6) : à distance 2 de la ville (8,8), hors du rayon héros (dist 8 > 5).
    expect(isExplored(state, 8, 6)).toBe(true);
    expect(isExplored(state, 8, 8)).toBe(true);
    // (5,8) : hors ville (dist 3 > 2) ET hors héros (dist 8 > 5) ⇒ noir.
    expect(isExplored(state, 5, 8)).toBe(false);
  });

  it('sans buildingVisionRadius (absent), aucune révélation depuis la ville', () => {
    const state = startWith(undefined);
    expect(isExplored(state, 8, 6)).toBe(false);
    expect(isExplored(state, 8, 8)).toBe(false);
  });
});

describe('F2 — tour de guet (visitable vision)', () => {
  it('visiter une tour de guet révèle son voisinage', () => {
    const players: PlayerSetup[] = [{ id: 'p1', startingResources: { ...emptyResources() } }];
    const map = testMap();
    // Tour de guet à (1,0), adjacente au départ (0,0) ; révèle un rayon 3.
    map.objects.push({
      id: 'watchtower',
      type: 'visitable',
      pos: { x: 1, y: 0 },
      effect: { kind: 'vision', amount: 3 },
      frequency: 'oncePerHero',
      visits: {},
    });
    // visionRadius héros réduit à 1 pour ISOLER l'effet de la tour (sinon le
    // rayon héros de départ couvrirait déjà la zone testée).
    const start = apply(createEmptyState(), {
      type: 'StartGame',
      seed: 1,
      players,
      map,
      config: { ...testConfig(), visionRadius: 1 },
      unitCatalog: testUnitCatalogWithEconomy(),
      towns: [],
    }).state;
    // Avant la visite : (4,0) est noir (hors rayon héros 1 depuis (0,0)).
    expect(isExplored(start, 4, 0)).toBe(false);
    const moved = apply(start, { type: 'MoveHero', heroId: 'hero-p1', path: [{ x: 1, y: 0 }] }).state;
    // (4,0) : dist 3 de la tour (1,0), dist 3 du héros (1,0) > rayon 1 ⇒ révélée
    // uniquement par la visite de la tour.
    expect(isExplored(moved, 4, 0)).toBe(true);
  });
});
