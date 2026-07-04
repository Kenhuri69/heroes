import { Graphics } from 'pixi.js';
import { TILE_SIZE } from './tilemap';

/** Placeholder héros : écusson teinté à la couleur du joueur, ancré sur sa tuile. */
export function buildHeroSprite(color: number): Graphics {
  const g = new Graphics();
  const c = TILE_SIZE / 2;
  g.poly([c - 16, c - 20, c + 16, c - 20, c + 16, c + 6, c, c + 22, c - 16, c + 6])
    .fill(color)
    .stroke({ width: 3, color: 0xe8e2d0 });
  g.circle(c, c - 4, 7).fill(0xe8e2d0);
  return g;
}
