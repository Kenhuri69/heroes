import { Container, Graphics } from 'pixi.js';

// Tuiles 64 px logiques (doc 02 §2.1) ; damier 32×32 = taille de la carte proto.
export const TILE_SIZE = 64;
export const BOARD_TILES = 32;
export const BOARD_SIZE_PX = TILE_SIZE * BOARD_TILES;

export function buildCheckerboard(): Container {
  const g = new Graphics();
  for (let y = 0; y < BOARD_TILES; y++) {
    for (let x = 0; x < BOARD_TILES; x++) {
      g.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
        .fill((x + y) % 2 === 0 ? 0x2b3a2b : 0x24312a);
    }
  }
  g.rect(0, 0, BOARD_SIZE_PX, BOARD_SIZE_PX).stroke({ width: 2, color: 0x3a3d47 });
  return g;
}
