import { Container, Graphics, RenderTexture, Sprite, type Renderer, type Texture } from 'pixi.js';
import type { AdventureMapDef } from '@heroes/engine';
import { getTexture, roadUrl, tileUrl, tileVariant } from './assets';

// Tuiles 64 px logiques (doc 02 §2.1).
export const TILE_SIZE = 64;
const CHUNK_TILES = 16;

/** Placeholders teintés (doc 08 §5) : deux nuances par terrain pour un damier discret. */
const TERRAIN_COLORS: Record<string, [number, number]> = {
  grass: [0x2b3a2b, 0x24312a],
  swamp: [0x39422c, 0x323b27],
  water: [0x1f3550, 0x1c304a],
  mountain: [0x4a4340, 0x433d3a],
};
const UNKNOWN_TERRAIN: [number, number] = [0x555555, 0x4c4c4c];
const ROAD_COLOR = 0x8a7a55;

/**
 * Carte statique pré-rendue par chunks de 16×16 tuiles en `RenderTexture`
 * (doc 07 §6). L'API est chunkée d'emblée — structurel, pas de l'optimisation
 * prématurée (doc 10 §2.3) ; le culling caméra arrivera avec les grandes cartes.
 */
export class Tilemap {
  readonly container = new Container();

  constructor(renderer: Renderer, map: AdventureMapDef) {
    for (let cy = 0; cy < map.height; cy += CHUNK_TILES) {
      for (let cx = 0; cx < map.width; cx += CHUNK_TILES) {
        this.container.addChild(buildChunk(renderer, map, cx, cy));
      }
    }
  }
}

function buildChunk(renderer: Renderer, map: AdventureMapDef, cx: number, cy: number): Sprite {
  const w = Math.min(CHUNK_TILES, map.width - cx);
  const h = Math.min(CHUNK_TILES, map.height - cy);
  // Composite : textures de tuiles quand elles sont préchargées, repli sur des
  // aplats teintés sinon (lot intégration — décision « repli gracieux »).
  const chunk = new Container();
  const g = new Graphics(); // aplats de repli (terrain + route sans texture)
  chunk.addChild(g);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tx = cx + x;
      const ty = cy + y;
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;
      const terrain = map.terrain[ty * map.width + tx] ?? '';
      const tileTex = getTexture(tileUrl(terrain, tileVariant(tx, ty)));
      if (tileTex) {
        chunk.addChild(placeTile(tileTex, px, py));
      } else {
        const shades = TERRAIN_COLORS[terrain] ?? UNKNOWN_TERRAIN;
        g.rect(px, py, TILE_SIZE, TILE_SIZE).fill(shades[(tx + ty) % 2] as number);
      }
      if (map.road[ty * map.width + tx]) {
        const roadTex = getTexture(roadUrl());
        if (roadTex) {
          chunk.addChild(placeTile(roadTex, px, py));
        } else {
          // Bande de route centrée — coût ×0,75 rendu visible (doc 02 §1.5).
          g.rect(px, py + TILE_SIZE * 0.35, TILE_SIZE, TILE_SIZE * 0.3).fill(ROAD_COLOR);
        }
      }
    }
  }
  const texture = RenderTexture.create({ width: w * TILE_SIZE, height: h * TILE_SIZE });
  renderer.render({ container: chunk, target: texture });
  chunk.destroy({ children: true });
  const sprite = new Sprite(texture);
  sprite.position.set(cx * TILE_SIZE, cy * TILE_SIZE);
  return sprite;
}

/** Sprite d'une tuile 64² texturée, mise à l'échelle exacte de `TILE_SIZE`. */
function placeTile(texture: Texture, px: number, py: number): Sprite {
  const s = new Sprite(texture);
  s.position.set(px, py);
  s.setSize(TILE_SIZE, TILE_SIZE);
  return s;
}
