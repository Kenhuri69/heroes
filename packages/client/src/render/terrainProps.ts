import { Container, Sprite, type Texture } from 'pixi.js';
import type { AdventureMapDef } from '@heroes/engine';
import { getTexture, terrainPropUrl, terrainPropVariant } from './assets';
import { isoDepth, isoTileCenter, ISO_TILE_H, ISO_TILE_W } from './projection';
import { CHUNK, chunkBounds, type WorldRect } from './tilemap';

/** Terrains dotés d'un prop de relief « billboard » (hauteur au-dessus du sol). */
const PROP_TERRAINS = new Set(['forest', 'mountain']);
/** Débord vertical (px monde) d'un prop au-dessus de sa tuile — marge d'AABB de culling. */
const PROP_OVERHANG = 96;

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
          const s = placeProp(t.texture, t.x, t.y);
          // Un poil sous la profondeur entière de la tuile : un héros sur la MÊME
          // tuile (zIndex entier) reste devant son arbre, un prop une tuile DEVANT
          // (isoDepth + 1) occulte quand même le héros.
          s.zIndex = isoDepth(t.x, t.y) - 0.1;
          this.layer.addChild(s);
          return s;
        });
      } else if (!visible && c.sprites) {
        for (const s of c.sprites) s.destroy();
        c.sprites = null;
      }
    }
  }

  /** Libère tous les sprites vivants (retour menu / changement de carte). */
  destroy(): void {
    for (const c of this.chunks) {
      if (c.sprites) for (const s of c.sprites) s.destroy();
      c.sprites = null;
    }
  }
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
