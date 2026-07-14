import { Container, Sprite, type Texture } from 'pixi.js';
import type { AdventureMapDef } from '@heroes/engine';
import { getTexture, terrainPropUrl, terrainPropVariant } from './assets';
import { isoDepth, isoTileCenter, ISO_TILE_H, ISO_TILE_W } from './projection';
import { CHUNK, chunkBounds, type WorldRect } from './tilemap';

/** Terrains dotés d'un prop de relief « billboard » (hauteur au-dessus du sol). */
const PROP_TERRAINS = new Set(['forest', 'mountain']);
/** Débord vertical (px monde) d'un prop au-dessus de sa tuile — marge d'AABB de culling. */
const PROP_OVERHANG = 96;
/**
 * Fraction des tuiles d'un terrain qui reçoivent réellement un prop. La forêt est
 * **éparse** (clairières + lisières → on voit à travers, la ville/le héros ne sont
 * plus enterrés) ; la montagne reste pleine (mur de relief voulu).
 */
const PROP_DENSITY: Record<string, number> = { forest: 0.62, mountain: 1 };
/** Largeur du prop en fraction de la tuile (< 1 : l'arbre ne remplit plus toute la case). */
const PROP_WIDTH = 0.72;
/** Hauteur max du prop en fraction de la largeur de tuile — plafonne les variantes géantes. */
const PROP_MAX_H_FACTOR = 1.4;

/** Hash entier déterministe (uint32), asymétrique en x/y, décorrélé par `salt`. */
function tileHash(x: number, y: number, salt: number): number {
  let h = Math.imul((x | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((y | 0) ^ 0x7f4a7c15, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2f ^ (salt | 0));
  h ^= h >>> 16;
  return h >>> 0;
}
/** Flottant déterministe [0,1) pour la tuile (tx,ty) et un usage `salt`. Aucun `Math.random`. */
function tileRand(x: number, y: number, salt: number): number {
  return tileHash(x, y, salt) / 0x1_0000_0000;
}

interface PropTile {
  x: number;
  y: number;
  texture: Texture;
}

interface PropChunk {
  bounds: WorldRect;
  tiles: PropTile[];
  /** Sprites vivants tant que le chunk est visible ; `null` sinon. */
  sprites: Sprite[] | null;
}

/**
 * Props de RELIEF (forêt/montagne) rendus **dans la couche d'entités triée par
 * profondeur** (héros/objets/villes) — et non dans le sol — pour que le tri iso
 * inter-couches s'applique : un prop une tuile DEVANT un héros l'occulte, un héros
 * sur la même tuile reste au-dessus de son propre arbre (`zIndex = isoDepth − 0,1`).
 *
 * Perf : les grandes cartes ont des milliers de tuiles forêt/montagne. Les props
 * sont **culés au viewport par chunk** (même grille que `Tilemap`) — les sprites
 * d'un chunk ne sont instanciés qu'à son entrée dans le viewport et détruits à sa
 * sortie ; seuls quelques chunks (donc quelques centaines de sprites) vivent à la
 * fois dans la couche triée.
 */
export class TerrainProps {
  private readonly chunks: PropChunk[] = [];
  /**
   * Pool de sprites réutilisés (F10, revue 2026-07) : à chaque frontière de chunk
   * traversée en pan, détruire/recréer des dizaines de `Sprite` coûtait
   * allocation + GC à la frame. Un sprite libéré retourne au pool (retiré de la
   * couche) et est reconfiguré à la prochaine entrée de chunk.
   */
  private readonly pool: Sprite[] = [];

  constructor(map: AdventureMapDef, private readonly layer: Container) {
    for (let cy = 0; cy < map.height; cy += CHUNK) {
      for (let cx = 0; cx < map.width; cx += CHUNK) {
        const x1 = Math.min(cx + CHUNK - 1, map.width - 1);
        const y1 = Math.min(cy + CHUNK - 1, map.height - 1);
        const tiles: PropTile[] = [];
        for (let ty = cy; ty <= y1; ty++) {
          for (let tx = cx; tx <= x1; tx++) {
            const terrain = map.terrain[ty * map.width + tx] ?? '';
            if (!PROP_TERRAINS.has(terrain)) continue;
            // Placement épars & déterministe : certaines tuiles forêt restent nues
            // (clairières) pour aérer le couvert et laisser voir ville/héros/routes.
            if (tileRand(tx, ty, 0x1) >= (PROP_DENSITY[terrain] ?? 1)) continue;
            const texture = getTexture(terrainPropUrl(terrain, terrainPropVariant(tx, ty)));
            if (texture) tiles.push({ x: tx, y: ty, texture });
          }
        }
        if (tiles.length > 0) {
          this.chunks.push({ bounds: chunkBounds(cx, cy, x1, y1, PROP_OVERHANG), tiles, sprites: null });
        }
      }
    }
  }

  /**
   * Montre les props des chunks intersectant le viewport (coordonnées MONDE),
   * détruit ceux des chunks qui en sortent. Appelée par la scène à chaque frame,
   * avec le même viewport que le culling de la tilemap.
   */
  updateVisibility(view: WorldRect): void {
    for (const c of this.chunks) {
      const visible =
        c.bounds.maxX >= view.minX &&
        c.bounds.minX <= view.maxX &&
        c.bounds.maxY >= view.minY &&
        c.bounds.minY <= view.maxY;
      if (visible && !c.sprites) {
        c.sprites = c.tiles.map((t) => {
          const s = this.pool.pop() ?? new Sprite();
          configureProp(s, t.texture, t.x, t.y);
          // Un poil sous la profondeur entière de la tuile : un héros sur la MÊME
          // tuile (zIndex entier) reste devant son arbre, un prop une tuile DEVANT
          // (isoDepth + 1) occulte quand même le héros.
          s.zIndex = isoDepth(t.x, t.y) - 0.1;
          this.layer.addChild(s);
          return s;
        });
      } else if (!visible && c.sprites) {
        for (const s of c.sprites) {
          this.layer.removeChild(s);
          this.pool.push(s); // F10 : réutilisé à la prochaine entrée de chunk
        }
        c.sprites = null;
      }
    }
  }

  /** Libère tous les sprites (vivants + pool) — retour menu / changement de carte. */
  destroy(): void {
    for (const c of this.chunks) {
      if (c.sprites) for (const s of c.sprites) s.destroy();
      c.sprites = null;
    }
    for (const s of this.pool) s.destroy();
    this.pool.length = 0;
  }
}

/** (Re)configure un billboard de relief posé debout, base au sol, sur la tuile (tx,ty). */
function configureProp(s: Sprite, texture: Texture, tx: number, ty: number): void {
  s.texture = texture;
  s.anchor.set(0.5, 1); // base centrée : le sprite monte vers le haut
  // Largeur sous la tuile + léger jitter d'échelle déterministe ; hauteur dérivée
  // du ratio de la texture PUIS plafonnée (les variantes hautes rétrécissent au
  // lieu de tours de 3 tuiles → fin du « mur d'arbres »).
  let w = ISO_TILE_W * PROP_WIDTH * (0.88 + tileRand(tx, ty, 0x2) * 0.24);
  let h = (w * texture.height) / texture.width;
  const maxH = ISO_TILE_W * PROP_MAX_H_FACTOR;
  if (h > maxH) {
    w *= maxH / h;
    h = maxH;
  }
  s.setSize(w, h);
  const c = isoTileCenter(tx, ty);
  // Jitter de position déterministe : casse l'alignement sur la grille (aspect naturel).
  const dx = (tileRand(tx, ty, 0x3) - 0.5) * ISO_TILE_W * 0.4;
  const dy = (tileRand(tx, ty, 0x4) - 0.5) * ISO_TILE_H * 0.3;
  s.position.set(c.x + dx, c.y + ISO_TILE_H * 0.35 + dy); // base légèrement en avant du centre
}
