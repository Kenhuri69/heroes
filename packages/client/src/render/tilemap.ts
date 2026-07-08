import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { AdventureMapDef } from '@heroes/engine';
import { getTexture, isoRoadUrl, isoTileUrl, tileVariant } from './assets';
import { isoDiamond, isoTileCenter, ISO_TILE_H, ISO_TILE_W } from './projection';

// Taille logique de la BOÎTE DE CONTENU d'une tuile (sprites/vignettes) — 64 px
// (doc 02 §2.1). Distincte de la projection iso du SOL (`projection.ts`) : les
// couches continuent de dessiner leur contenu dans une boîte 64², la projection
// ne fait que placer ce contenu en losange.
export const TILE_SIZE = 64;

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
 * Carte statique projetée en **isométrie** (Lot A1, doc 02 §2.1). Chaque tuile
 * est un **losange texturé** (`assets/tiles/iso/`, préchargé au bootstrap) posé
 * sur un **repli gouache** (losange teinté) qui sert de fond ET bouche les
 * coutures d'anti-aliasing entre losanges. Repli seul si une texture manque
 * (chargement partiel / asset absent) — dégradation gracieuse, jamais de trou noir.
 *
 * Base gouache = un seul `Graphics` (géométrie construite une fois) ; les tuiles
 * texturées = sprites batchés par PixiJS (peu de textures ⇒ peu de draw calls).
 */
export class Tilemap {
  readonly container = new Container();

  constructor(map: AdventureMapDef) {
    const base = new Graphics(); // repli gouache + fond anti-couture
    this.container.addChild(base);
    // Dessin par profondeur (haut-gauche → bas-droite) : arêtes propres, ordre iso.
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        const terrain = map.terrain[ty * map.width + tx] ?? '';
        const shades = TERRAIN_COLORS[terrain] ?? UNKNOWN_TERRAIN;
        base.poly(isoDiamond(tx, ty)).fill(shades[(tx + ty) % 2] as number);

        const tex = getTexture(isoTileUrl(terrain, tileVariant(tx, ty)));
        if (tex) this.container.addChild(placeDiamond(tex, tx, ty));

        if (map.road[ty * map.width + tx]) {
          const roadTex = getTexture(isoRoadUrl());
          if (roadTex) this.container.addChild(placeDiamond(roadTex, tx, ty));
          else base.poly(insetDiamond(tx, ty, 0.55)).fill(ROAD_COLOR);
        }
      }
    }

    // Carte statique → une seule texture (1 draw call/frame) : rend les ~1000
    // losanges gratuits par frame (marge anti-gel ×4, doc 01 §5 critère 3). Garde
    // sur les cartes géantes : l'extent iso ≈ (W+H)·32 px doit rester < taille max
    // de texture ; au-delà on garde les sprites (batchés) plutôt qu'une texture
    // tronquée. Léger flou au zoom max assumé (tuiles gouache basse fréquence,
    // même compromis que l'ancien bake par chunks).
    if ((map.width + map.height) * (ISO_TILE_W / 2) < 3968) {
      this.container.cacheAsTexture(true);
    }
  }
}

/** Sprite losange 64×32 centré sur le centre iso de la tuile (tx,ty). */
function placeDiamond(texture: Texture, tx: number, ty: number): Sprite {
  const s = new Sprite(texture);
  s.anchor.set(0.5);
  s.setSize(ISO_TILE_W, ISO_TILE_H);
  const c = isoTileCenter(tx, ty);
  s.position.set(c.x, c.y);
  return s;
}

/** Losange concentrique réduit d'un facteur `k` (0..1) — ruban de route de repli. */
function insetDiamond(tx: number, ty: number, k: number): number[] {
  const c = isoTileCenter(tx, ty);
  const hw = (ISO_TILE_W / 2) * k;
  const hh = (ISO_TILE_H / 2) * k;
  return [c.x, c.y - hh, c.x + hw, c.y, c.x, c.y + hh, c.x - hw, c.y];
}
