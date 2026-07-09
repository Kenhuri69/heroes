import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { AdventureMapDef } from '@heroes/engine';
import {
  getTexture,
  isoRoadUrl,
  isoTileUrl,
  terrainPropUrl,
  terrainPropVariant,
  tileVariant,
} from './assets';
import { isoDiamond, isoTileCenter, ISO_TILE_H, ISO_TILE_W } from './projection';

// Taille logique de la BOÎTE DE CONTENU d'une tuile (sprites/vignettes) — 64 px
// (doc 02 §2.1). Distincte de la projection iso du SOL (`projection.ts`) : les
// couches continuent de dessiner leur contenu dans une boîte 64², la projection
// ne fait que placer ce contenu en losange.
export const TILE_SIZE = 64;

/** Placeholders teintés (doc 08 §5) : deux nuances par terrain pour un damier discret. */
const TERRAIN_COLORS: Record<string, [number, number]> = {
  grass: [0x2b3a2b, 0x24312a],
  dirt: [0x5f4a32, 0x54412c],
  sand: [0xc2ac78, 0xb8a270],
  forest: [0x263e22, 0x20361b],
  rough: [0x6a6144, 0x5f573c],
  snow: [0xd6dce6, 0xccd2de],
  swamp: [0x39422c, 0x323b27],
  river: [0x336288, 0x2e587c],
  water: [0x1f3550, 0x1c304a],
  mountain: [0x4a4340, 0x433d3a],
  rocks: [0x6a6660, 0x5f5b56],
};
const UNKNOWN_TERRAIN: [number, number] = [0x555555, 0x4c4c4c];
const ROAD_COLOR = 0x8a7a55;

/** Terrains dotés d'un prop de relief « billboard » (hauteur au-dessus du sol). */
const PROP_TERRAINS = new Set(['forest', 'mountain']);
/** Débord vertical (px monde) d'un prop au-dessus du losange — marge d'AABB de culling. */
const PROP_OVERHANG = 96;

/** Côté d'un chunk en tuiles — compromis nombre de chunks / granularité du culling. */
const CHUNK = 16;

/** Rectangle en coordonnées MONDE (px, avant transform caméra). */
export interface WorldRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface Chunk {
  node: Container;
  bounds: WorldRect;
}

/**
 * Carte statique projetée en **isométrie** (Lot A1, doc 02 §2.1). Chaque tuile
 * est un **losange texturé** (`assets/tiles/iso/`, préchargé au bootstrap) posé
 * sur un **repli gouache** (losange teinté) qui sert de fond ET bouche les
 * coutures d'anti-aliasing entre losanges. Repli seul si une texture manque
 * (chargement partiel / asset absent) — dégradation gracieuse, jamais de trou noir.
 *
 * **Chunking + culling** (extension carte) : la grille est découpée en chunks de
 * {@link CHUNK}² tuiles. Une **petite** carte (extent iso sous la taille de texture
 * max) est aplatie en une seule texture (`cacheAsTexture`) — 1 draw call/frame,
 * comme avant. Une **grande** carte (64²→256²) garde les chunks en sprites batchés
 * et n'affiche que ceux qui **intersectent le viewport** ({@link updateVisibility},
 * appelée par la scène à chaque frame) — coût borné (pas de bake géant en mémoire,
 * pas de dessin des tuiles hors écran).
 */
export class Tilemap {
  readonly container = new Container();
  private readonly chunks: Chunk[] = [];
  /** Culling actif uniquement quand la carte n'est PAS aplatie en une texture. */
  private readonly culled: boolean;

  constructor(map: AdventureMapDef) {
    for (let cy = 0; cy < map.height; cy += CHUNK) {
      for (let cx = 0; cx < map.width; cx += CHUNK) {
        const x1 = Math.min(cx + CHUNK - 1, map.width - 1);
        const y1 = Math.min(cy + CHUNK - 1, map.height - 1);
        const node = buildChunk(map, cx, cy, x1, y1);
        this.container.addChild(node);
        this.chunks.push({ node, bounds: chunkBounds(cx, cy, x1, y1) });
      }
    }

    // Carte statique assez petite → une seule texture (1 draw call/frame) : rend
    // les ~1000 losanges gratuits par frame (marge anti-gel ×4, doc 01 §5). Garde
    // sur les grandes cartes : l'extent iso ≈ (W+H)·32 px doit rester < taille max
    // de texture ; au-delà on reste en chunks culés (mémoire bornée) plutôt qu'une
    // texture tronquée ou géante.
    if ((map.width + map.height) * (ISO_TILE_W / 2) < 3968) {
      this.container.cacheAsTexture(true);
      this.culled = false;
    } else {
      this.culled = true;
    }
  }

  /**
   * Masque les chunks hors du viewport (coordonnées MONDE). No-op quand la carte
   * est aplatie en une texture (rien à culer). Appelée par la scène à chaque frame
   * — quelques centaines de tests d'intersection AABB, négligeable.
   */
  updateVisibility(view: WorldRect): void {
    if (!this.culled) return;
    for (const c of this.chunks) {
      c.node.visible =
        c.bounds.maxX >= view.minX &&
        c.bounds.minX <= view.maxX &&
        c.bounds.maxY >= view.minY &&
        c.bounds.minY <= view.maxY;
    }
  }
}

/** Construit le Container d'un chunk (tuiles cx..x1 × cy..y1, bornes incluses). */
function buildChunk(map: AdventureMapDef, cx: number, cy: number, x1: number, y1: number): Container {
  const node = new Container();
  const base = new Graphics(); // repli gouache + fond anti-couture du chunk
  node.addChild(base);
  // Dessin par profondeur (haut-gauche → bas-droite) : arêtes propres, ordre iso.
  for (let ty = cy; ty <= y1; ty++) {
    for (let tx = cx; tx <= x1; tx++) {
      const terrain = map.terrain[ty * map.width + tx] ?? '';
      const shades = TERRAIN_COLORS[terrain] ?? UNKNOWN_TERRAIN;
      base.poly(isoDiamond(tx, ty)).fill(shades[(tx + ty) % 2] as number);

      const tex = getTexture(isoTileUrl(terrain, tileVariant(tx, ty)));
      if (tex) node.addChild(placeDiamond(tex, tx, ty));

      if (map.road[ty * map.width + tx]) {
        const roadTex = getTexture(isoRoadUrl());
        if (roadTex) node.addChild(placeDiamond(roadTex, tx, ty));
        else base.poly(insetDiamond(tx, ty, 0.55)).fill(ROAD_COLOR);
      }

      // Prop de relief (forêt/montagne) : billboard debout au-dessus du sol.
      // Dessiné après le sol, dans l'ordre de profondeur du chunk ⇒ un prop de
      // premier plan recouvre celui d'arrière-plan. Repli silencieux si absent.
      if (PROP_TERRAINS.has(terrain)) {
        const propTex = getTexture(terrainPropUrl(terrain, terrainPropVariant(tx, ty)));
        if (propTex) node.addChild(placeProp(propTex, tx, ty));
      }
    }
  }
  return node;
}

/** Billboard de relief posé debout, base au sol, centré sur la tuile (tx,ty). */
function placeProp(texture: Texture, tx: number, ty: number): Sprite {
  const s = new Sprite(texture);
  s.anchor.set(0.5, 1); // base centrée : le sprite monte vers le haut
  const w = ISO_TILE_W;
  s.setSize(w, (w * texture.height) / texture.width);
  const c = isoTileCenter(tx, ty);
  s.position.set(c.x, c.y + ISO_TILE_H * 0.35); // base légèrement en avant du centre
  return s;
}

/** AABB monde d'un chunk de tuiles [cx..x1]×[cy..y1] (losanges inclus, ±demi-tuile). */
function chunkBounds(cx: number, cy: number, x1: number, y1: number): WorldRect {
  const hw = ISO_TILE_W / 2;
  const hh = ISO_TILE_H / 2;
  return {
    minX: (cx - y1) * hw - hw,
    maxX: (x1 - cy) * hw + hw,
    minY: (cx + cy) * hh - hh - PROP_OVERHANG, // props débordent vers le haut
    maxY: (x1 + y1) * hh + hh,
  };
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
