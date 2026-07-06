import { Assets, Container, Graphics, Sprite } from 'pixi.js';
import type { CombatUnitDef, MapObjectDef } from '@heroes/engine';
import { getTexture, mineUrl, unitSpriteUrl } from './assets';
import { TILE_SIZE } from './tilemap';

/** Catalogue d'unités (id → def) — sert à résoudre la faction d'un gardien. */
type UnitCatalog = Record<string, CombatUnitDef>;

/** Teintes placeholder par ressource (doc 08 §5) — cohérentes avec la barre UI. */
export const RESOURCE_COLORS: Record<string, number> = {
  gold: 0xf1c40f,
  wood: 0x9a6b3f,
  ore: 0x95a5a6,
  crystal: 0x9b59b6,
  gems: 0xe05c78,
  sulfur: 0xd8a032,
  mercury: 0x5dade2,
};

/** Couche des objets interactifs — resynchronisée sur l'état après chaque commande. */
export class MapObjectsLayer {
  readonly container = new Container();
  private readonly byId = new Map<string, Container>();

  sync(objects: readonly MapObjectDef[], catalog: UnitCatalog): void {
    const alive = new Set(objects.map((o) => o.id));
    for (const [id, node] of this.byId) {
      if (!alive.has(id)) {
        node.destroy({ children: true });
        this.byId.delete(id);
      }
    }
    for (const obj of objects) {
      if (this.byId.has(obj.id)) continue;
      const node = buildObject(obj, catalog);
      node.position.set(obj.pos.x * TILE_SIZE, obj.pos.y * TILE_SIZE);
      this.byId.set(obj.id, node);
      this.container.addChild(node);
    }
  }
}

/** Vignette de mine si la texture est préchargée, sinon picto procédural (repli). */
function buildObject(obj: MapObjectDef, catalog: UnitCatalog): Container {
  if (obj.type === 'resource') {
    const tex = getTexture(mineUrl(obj.resource));
    if (tex) {
      const sprite = new Sprite(tex);
      sprite.setSize(TILE_SIZE, TILE_SIZE);
      return sprite;
    }
    // Repli : petit tas losange teinté, lisible à 64 px (doc 08 §5).
    const c = TILE_SIZE / 2;
    const color = RESOURCE_COLORS[obj.resource] ?? 0xffffff;
    return new Graphics()
      .poly([c, c - 14, c + 16, c, c, c + 14, c - 16, c])
      .fill(color)
      .stroke({ width: 2, color: 0x1a1c22 });
  }
  return buildGuardian(obj.unitId, catalog);
}

/**
 * Gardien neutre : la créature qui garde la case (HoMM montre l'unité gardienne).
 * Fanion procédural en repli, remplacé par le **sprite de l'unité** dès qu'il est
 * chargé (faction résolue via `catalog[unitId].groupId`, même chemin que le
 * combat). Chargement async gardé (`node.destroyed`) : pas de fuite si le gardien
 * disparaît (combat gagné) avant la fin du chargement.
 */
function buildGuardian(unitId: string, catalog: UnitCatalog): Container {
  const node = new Container();
  const c = TILE_SIZE / 2;
  const fallback = new Graphics()
    .poly([c - 4, c + 18, c - 4, c - 18, c + 16, c - 10, c - 4, c - 2])
    .fill(0x8a8f98)
    .stroke({ width: 2, color: 0x1a1c22 });
  fallback.circle(c - 4, c + 18, 4).fill(0x1a1c22);
  node.addChild(fallback);

  const url = unitSpriteUrl(unitId, catalog[unitId]?.groupId);
  if (url) {
    void Assets.load(url).then((texture) => {
      if (node.destroyed) return;
      node.removeChild(fallback);
      fallback.destroy();
      const sprite = new Sprite(texture);
      sprite.setSize(TILE_SIZE, TILE_SIZE);
      node.addChild(sprite);
    });
  }
  return node;
}
