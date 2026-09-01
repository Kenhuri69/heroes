import { describe, expect, it } from 'vitest';
import {
  atLevel,
  inBounds,
  isAdjacent,
  levelOf,
  mapLevels,
  samePos,
  terrainAt,
  tileIndex,
  type AdventureMapDef,
} from '../src/adventure/map';
import { createFog, revealAround } from '../src/adventure/fog';
import { findPath, isPassable, minStepCost, octileLowerBound } from '../src/adventure/path';
import { testConfig, testMap } from './fixtures';

/**
 * L10.1 — la position gagne une COUCHE (`GridPos.level`) : surface (0) et
 * souterrain (1). Deux couches ne se touchent jamais ; on n'en change que par
 * un escalier (L10.2). Champ optionnel ⇒ une carte plate se comporte
 * exactement comme avant le lot (le reste de la suite, golden compris, le
 * prouve à chaque exécution).
 */

/** Carte 4×4 à deux couches : surface toute en herbe, souterrain en terre — sauf un mur. */
function twoLevelMap(): AdventureMapDef {
  const w = 4;
  const h = 4;
  const surface = Array.from({ length: w * h }, () => 'grass');
  const under = Array.from({ length: w * h }, () => 'swamp');
  // Un mur de montagne coupe la SURFACE en deux (colonne x = 2)…
  for (let y = 0; y < h; y++) surface[y * w + 2] = 'mountain';
  return {
    id: 'two-level',
    width: w,
    height: h,
    levels: 2,
    terrain: [...surface, ...under],
    road: new Array<boolean>(w * h * 2).fill(false),
    objects: [],
    triggers: [],
    startPositions: [{ x: 0, y: 0 }],
  };
}

describe('couches de carte — indexation', () => {
  it('la même case sur deux couches porte deux terrains', () => {
    const map = twoLevelMap();
    expect(mapLevels(map)).toBe(2);
    expect(terrainAt(map, { x: 0, y: 0 })).toBe('grass');
    expect(terrainAt(map, { x: 0, y: 0, level: 1 })).toBe('swamp');
    expect(tileIndex(map, { x: 0, y: 0, level: 1 })).toBe(map.width * map.height);
  });

  it('une carte sans `levels` reste plate et indexée comme avant', () => {
    const flat = testMap();
    expect(mapLevels(flat)).toBe(1);
    expect(tileIndex(flat, { x: 3, y: 2 })).toBe(2 * flat.width + 3);
    expect(levelOf({ x: 0, y: 0 })).toBe(0);
    expect(inBounds(flat, { x: 0, y: 0, level: 1 })).toBe(false);
  });

  it('deux cases superposées ne sont ni la même case, ni adjacentes', () => {
    const a = { x: 1, y: 1 };
    const b = { x: 1, y: 1, level: 1 };
    expect(samePos(a, b)).toBe(false);
    expect(isAdjacent(a, b)).toBe(false);
    expect(isAdjacent(a, { x: 1, y: 2 })).toBe(true);
    expect(isAdjacent(b, { x: 1, y: 2, level: 1 })).toBe(true);
    expect(atLevel(a, 1)).toEqual(b);
    expect(atLevel(b, 0)).toEqual(a);
  });
});

describe('couches de carte — brouillard', () => {
  it('le souterrain a son propre brouillard, révélé séparément', () => {
    const map = twoLevelMap();
    const fog = createFog(map);
    expect(fog).toHaveLength(map.width * map.height * 2);

    revealAround(fog, map, { x: 0, y: 0 }, 1);
    expect(fog[tileIndex(map, { x: 0, y: 0 })]).toBe(1);
    // Voir le sol ne révèle pas la grotte sous ses pieds.
    expect(fog[tileIndex(map, { x: 0, y: 0, level: 1 })]).toBe(0);

    revealAround(fog, map, { x: 0, y: 0, level: 1 }, 1);
    expect(fog[tileIndex(map, { x: 0, y: 0, level: 1 })]).toBe(1);
  });
});

describe('couches de carte — déplacement', () => {
  const config = testConfig();

  it('un chemin vit sur une seule couche', () => {
    const map = twoLevelMap();
    const under = findPath(config, map, { x: 0, y: 0, level: 1 }, { x: 3, y: 0, level: 1 });
    expect(under).not.toBeNull();
    for (const step of under ?? []) expect(levelOf(step)).toBe(1);
  });

  it('aucun pas ne relie deux couches', () => {
    const map = twoLevelMap();
    expect(findPath(config, map, { x: 0, y: 0 }, { x: 0, y: 0, level: 1 })).toBeNull();
    expect(findPath(config, map, { x: 0, y: 0 }, { x: 3, y: 3, level: 1 })).toBeNull();
    // Le pré-filtre O(1) des pickers écarte la cible sans lancer d'A*.
    expect(octileLowerBound(minStepCost(config), { x: 0, y: 0 }, { x: 1, y: 0, level: 1 })).toBe(Infinity);
  });

  it('les couches sont indépendantes : le mur de la surface n’existe pas dessous', () => {
    const map = twoLevelMap();
    // En surface, la colonne de montagne coupe la carte en deux.
    expect(isPassable(config, map, { x: 2, y: 0 })).toBe(false);
    expect(findPath(config, map, { x: 0, y: 0 }, { x: 3, y: 0 })).toBeNull();
    // Sous terre, le même trajet passe.
    expect(findPath(config, map, { x: 0, y: 0, level: 1 }, { x: 3, y: 0, level: 1 })).not.toBeNull();
  });
});
