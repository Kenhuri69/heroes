import { levelOf, mapLevels, tileIndex, type AdventureMapDef, type GridPos } from './map';

/**
 * Brouillard 2 états (doc 02 §2.1) : 0 = inexploré, 1 = exploré. Le « grisé
 * hors vision » est dérivé côté rendu des positions courantes des héros —
 * seul l'exploré, irréversible, appartient aux règles. Le tableau couvre
 * TOUTES les couches (L10.1) : le souterrain a son propre brouillard.
 */
export function createFog(map: AdventureMapDef): number[] {
  return new Array<number>(map.width * map.height * mapLevels(map)).fill(0);
}

/**
 * Révèle le carré de rayon `radius` (distance de Tchebychev) autour de `pos`,
 * **sur la couche de `pos` uniquement** : voir le sol ne révèle pas la grotte.
 */
export function revealAround(
  explored: number[],
  map: AdventureMapDef,
  pos: GridPos,
  radius: number,
): void {
  const level = levelOf(pos);
  const x0 = Math.max(0, pos.x - radius);
  const x1 = Math.min(map.width - 1, pos.x + radius);
  const y0 = Math.max(0, pos.y - radius);
  const y1 = Math.min(map.height - 1, pos.y + radius);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) explored[tileIndex(map, { x, y, level })] = 1;
  }
}
