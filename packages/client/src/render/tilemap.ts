import { Container, Graphics } from 'pixi.js';
import type { AdventureMapDef } from '@heroes/engine';
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
const TILE_EDGE = 0x11161b; // liseré discret entre losanges (lecture de la grille)

/**
 * Carte statique projetée en **isométrie** (Lot A1, doc 02 §2.1). Chaque tuile
 * est un losange 2:1 teinté (repli gouache — les assets de tuiles iso sont un lot
 * d'assets ultérieur). Un seul `Graphics` retenu : géométrie construite une fois,
 * re-rendue en mesh à chaque frame (coût GPU négligeable ; pas de fill plein
 * écran, garde-fou anti-gel ×4 respecté, cf. `worldBorder.ts`).
 */
export class Tilemap {
  readonly container = new Container();

  constructor(map: AdventureMapDef) {
    const g = new Graphics();
    // Dessin par profondeur (haut-gauche → bas-droite) : les liserés se
    // recouvrent proprement, l'ordre iso est respecté même dans un seul Graphics.
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        const terrain = map.terrain[ty * map.width + tx] ?? '';
        const shades = TERRAIN_COLORS[terrain] ?? UNKNOWN_TERRAIN;
        const diamond = isoDiamond(tx, ty);
        g.poly(diamond).fill(shades[(tx + ty) % 2] as number).stroke({ width: 1, color: TILE_EDGE });
        if (map.road[ty * map.width + tx]) {
          // Ruban de route : losange inscrit (coût ×0,75 rendu visible, doc 02 §1.5).
          g.poly(insetDiamond(tx, ty, 0.55)).fill(ROAD_COLOR);
        }
      }
    }
    this.container.addChild(g);
  }
}

/** Losange concentrique réduit d'un facteur `k` (0..1) — ruban de route inscrit. */
function insetDiamond(tx: number, ty: number, k: number): number[] {
  const c = isoTileCenter(tx, ty);
  const hw = (ISO_TILE_W / 2) * k;
  const hh = (ISO_TILE_H / 2) * k;
  return [c.x, c.y - hh, c.x + hw, c.y, c.x, c.y + hh, c.x - hw, c.y];
}
