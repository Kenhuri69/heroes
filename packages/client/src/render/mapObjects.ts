import { Assets, Container, Graphics, Sprite } from 'pixi.js';
import type { CombatUnitDef, MapObjectDef, MineObjectDef } from '@heroes/engine';
import { artifactUrl, getTexture, mineUrl, unitSpriteUrl } from './assets';
import { NEUTRAL_COLOR } from './playerColors';
import { TILE_SIZE } from './tilemap';

/** Catalogue d'unités (id → def) — sert à résoudre la faction d'un gardien. */
type UnitCatalog = Record<string, CombatUnitDef>;

/** Couleur de bannière d'un propriétaire (`null` = neutre) — fournie par la scène. */
type OwnerColor = (ownerId: string | null) => number;

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
  /** Signature de rendu par objet — un changement (mine recapturée) force la reconstruction. */
  private readonly signatures = new Map<string, string>();

  sync(
    objects: readonly MapObjectDef[],
    catalog: UnitCatalog,
    ownerColor: OwnerColor = () => NEUTRAL_COLOR,
  ): void {
    const alive = new Set(objects.map((o) => o.id));
    for (const [id, node] of this.byId) {
      if (!alive.has(id)) {
        node.destroy({ children: true });
        this.byId.delete(id);
        this.signatures.delete(id);
      }
    }
    for (const obj of objects) {
      const signature = obj.type === 'mine' ? `mine:${obj.ownerId ?? ''}` : obj.type;
      if (this.byId.has(obj.id) && this.signatures.get(obj.id) === signature) continue;
      this.byId.get(obj.id)?.destroy({ children: true });
      const node = buildObject(obj, catalog, ownerColor);
      node.position.set(obj.pos.x * TILE_SIZE, obj.pos.y * TILE_SIZE);
      this.byId.set(obj.id, node);
      this.signatures.set(obj.id, signature);
      this.container.addChild(node);
    }
  }
}

/** Vignette de mine si la texture est préchargée, sinon picto procédural (repli). */
function buildObject(obj: MapObjectDef, catalog: UnitCatalog, ownerColor: OwnerColor): Container {
  if (obj.type === 'resource') return buildResourcePile(obj.resource);
  if (obj.type === 'mine') return buildMine(obj, ownerColor(obj.ownerId));
  if (obj.type === 'treasure') return buildTreasure();
  if (obj.type === 'artifact') return buildGroundArtifact(obj.artifactId);
  return buildGuardian(obj.unitId, catalog);
}

/** Tas de ressource ramassable : sprite `mines/mine-<res>` ou losange teinté (doc 08 §5). */
function buildResourcePile(resource: string): Container {
  const tex = getTexture(mineUrl(resource));
  if (tex) {
    const sprite = new Sprite(tex);
    sprite.setSize(TILE_SIZE, TILE_SIZE);
    return sprite;
  }
  // Repli : petit tas losange teinté, lisible à 64 px (doc 08 §5).
  const c = TILE_SIZE / 2;
  const color = RESOURCE_COLORS[resource] ?? 0xffffff;
  return new Graphics()
    .poly([c, c - 14, c + 16, c, c, c + 14, c - 16, c])
    .fill(color)
    .stroke({ width: 2, color: 0x1a1c22 });
}

/**
 * Mine capturable (doc 02 §2.2) : même visuel de base que le tas, mais avec un
 * **drapeau** TOUJOURS présent — gris quand neutre, couleur du joueur
 * propriétaire sinon (doc 08 §5 ; jamais la couleur seule : la présence du
 * drapeau elle-même distingue la mine du tas ramassable).
 */
function buildMine(obj: MineObjectDef, color: number): Container {
  const node = new Container();
  node.addChild(buildResourcePile(obj.resource));
  const s = TILE_SIZE;
  const flag = new Graphics()
    // Hampe en haut à droite de la tuile.
    .rect(s - 14, 2, 3, 20)
    .fill(0x1a1c22)
    // Fanion triangulaire teinté couleur du propriétaire (gris = neutre).
    .poly([s - 11, 3, s - 1, 8, s - 11, 13])
    .fill(color)
    .stroke({ width: 1.5, color: 0x1a1c22 });
  node.addChild(flag);
  return node;
}

/** Coffre au trésor procédural (doc 02 §2.2) — lisible à 64 px. */
function buildTreasure(): Container {
  const c = TILE_SIZE / 2;
  return new Graphics()
    .roundRect(c - 16, c - 8, 32, 20, 4)
    .fill(0xb9770e)
    .stroke({ width: 2, color: 0x1a1c22 })
    .rect(c - 16, c - 2, 32, 4)
    .fill(0x7e5109)
    .circle(c, c + 1, 3.5)
    .fill(0xf1c40f);
}

/**
 * Artefact au sol : icône `artifacts/<id>` chargée en async (hors préchargement
 * PixiJS), repli losange violet. Même garde `destroyed` que le gardien.
 */
function buildGroundArtifact(artifactId: string): Container {
  const node = new Container();
  const c = TILE_SIZE / 2;
  const fallback = new Graphics()
    .poly([c, c - 16, c + 12, c, c, c + 16, c - 12, c])
    .fill(0x9b59b6)
    .stroke({ width: 2, color: 0x1a1c22 });
  fallback.circle(c, c, 4).fill(0xf4ecf7);
  node.addChild(fallback);

  const url = artifactUrl(artifactId);
  if (url) {
    void Assets.load(url).then((texture) => {
      if (node.destroyed) return;
      node.removeChild(fallback);
      fallback.destroy();
      const sprite = new Sprite(texture);
      sprite.setSize(TILE_SIZE * 0.8, TILE_SIZE * 0.8);
      sprite.position.set(TILE_SIZE * 0.1, TILE_SIZE * 0.1);
      node.addChild(sprite);
    });
  }
  return node;
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
