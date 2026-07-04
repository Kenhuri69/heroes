import { Container, Graphics } from 'pixi.js';
import type { MapObjectDef } from '@heroes/engine';
import { TILE_SIZE } from './tilemap';

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
  private readonly byId = new Map<string, Graphics>();

  sync(objects: readonly MapObjectDef[]): void {
    const alive = new Set(objects.map((o) => o.id));
    for (const [id, g] of this.byId) {
      if (!alive.has(id)) {
        g.destroy();
        this.byId.delete(id);
      }
    }
    for (const obj of objects) {
      if (this.byId.has(obj.id)) continue;
      if (obj.type !== 'resource') continue; // gardiens : rendu au lot D (phase 2.4)
      const g = new Graphics();
      const color = RESOURCE_COLORS[obj.resource] ?? 0xffffff;
      // Petit tas : losange teinté, lisible à 64 px (doc 08 §5).
      const c = TILE_SIZE / 2;
      g.poly([c, c - 14, c + 16, c, c, c + 14, c - 16, c])
        .fill(color)
        .stroke({ width: 2, color: 0x1a1c22 });
      g.position.set(obj.pos.x * TILE_SIZE, obj.pos.y * TILE_SIZE);
      this.byId.set(obj.id, g);
      this.container.addChild(g);
    }
  }
}
