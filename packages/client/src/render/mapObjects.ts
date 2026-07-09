import { Assets, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { CombatUnitDef, MapObjectDef, MineObjectDef } from '@heroes/engine';
import { artifactUrl, getTexture, mapPropUrl, mineUrl, unitSpriteUrl } from './assets';
import { NEUTRAL_COLOR } from './playerColors';
import { TILE_SIZE } from './tilemap';
import { isoAnchor, isoDepth } from './projection';

/** Catalogue d'unités (id → def) — sert à résoudre la faction d'un gardien. */
type UnitCatalog = Record<string, CombatUnitDef>;

/** Couleur de bannière d'un propriétaire (`null` = neutre) — fournie par la scène. */
type OwnerColor = (ownerId: string | null) => number;

/**
 * Empreinte cohérente des **objets ramassables** posés au sol (ressource, coffre,
 * artefact) exprimée en fraction de tuile : ils lisent comme de petits objets,
 * nettement plus petits que le gardien (créature, plein tuile). Corrige le coffre
 * qui, faute d'échelle, occupait toute la tuile (« trop gros »).
 */
const COLLECTIBLE_SCALE = 0.8;

/**
 * Sprite posé au centre de la tuile, ratio d'aspect **préservé** (ajuste la plus
 * grande dimension à `TILE_SIZE * scale`). Empreinte homogène quels que soient
 * les dimensions natives de la texture.
 */
function placeSprite(texture: Texture, scale: number): Sprite {
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5);
  sprite.scale.set((TILE_SIZE * scale) / Math.max(texture.width, texture.height));
  sprite.position.set(TILE_SIZE / 2, TILE_SIZE / 2);
  return sprite;
}

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
  private readonly byId = new Map<string, Container>();
  /** Signature de rendu par objet — un changement (mine recapturée) force la reconstruction. */
  private readonly signatures = new Map<string, string>();

  /**
   * `layer` : couche d'entités PARTAGÉE (objets + villes + héros) triée par
   * profondeur iso (`sortableChildren`). Chaque nœud porte son `zIndex = x+y`,
   * si bien qu'un objet de premier plan passe devant un héros situé plus haut
   * (tri INTER-couches, finition A1). Les objets tracés par `byId` restent
   * gérés ici ; seule leur destination change.
   */
  constructor(private readonly layer: Container) {}

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
      const existing = this.byId.get(obj.id);
      if (existing && this.signatures.get(obj.id) === signature) {
        // Position resynchronisée à chaque passage : les gardiens ERRANTS
        // bougent au changement de jour (doc 02 §2.2) sans changer d'identité.
        const a = isoAnchor(obj.pos.x, obj.pos.y);
        existing.position.set(a.x, a.y);
        existing.zIndex = isoDepth(obj.pos.x, obj.pos.y);
        continue;
      }
      existing?.destroy({ children: true });
      const node = buildObject(obj, catalog, ownerColor);
      const a = isoAnchor(obj.pos.x, obj.pos.y);
      node.position.set(a.x, a.y);
      node.zIndex = isoDepth(obj.pos.x, obj.pos.y);
      this.byId.set(obj.id, node);
      this.signatures.set(obj.id, signature);
      this.layer.addChild(node);
    }
  }
}

/** Vignette de mine si la texture est préchargée, sinon picto procédural (repli). */
function buildObject(obj: MapObjectDef, catalog: UnitCatalog, ownerColor: OwnerColor): Container {
  if (obj.type === 'resource') return buildResourcePile(obj.resource);
  if (obj.type === 'mine') return buildMine(obj, ownerColor(obj.ownerId));
  if (obj.type === 'treasure') return buildTreasure();
  if (obj.type === 'artifact') return buildGroundArtifact(obj.artifactId);
  if (obj.type === 'visitable') return buildVisitable(obj.effect.kind);
  if (obj.type === 'dwelling') return buildDwelling(obj.unitId, catalog);
  return buildGuardian(obj.unitId, catalog);
}

/** Teinte du lieu de bonus par nature d'effet (doc 08 §5 — le glyphe prime, la teinte aide). */
const VISITABLE_COLORS: Record<string, number> = {
  luck: 0x5dade2, // fontaine
  movement: 0xd68910, // écurie
  levelXp: 0x27ae60, // arbre du savoir
  resource: 0xb9770e, // moulin
};

/**
 * Objet de carte PEINT (UXD-3B) : superpose au `fallback` procédural le sprite
 * `assets/map/<propId>` (chargé async, hors bundle). Repli gracieux si le sprite
 * est absent/en cours. Garde `node.destroyed` : la scène peut être détruite
 * avant la fin du chargement.
 */
function withMapProp(propId: string, fallback: Container, scale = 1.0): Container {
  const node = new Container();
  node.addChild(fallback);
  const url = mapPropUrl(propId);
  if (url) {
    void Assets.load(url).then((texture) => {
      if (node.destroyed) return;
      node.removeChild(fallback);
      fallback.destroy({ children: true });
      node.addChild(placeSprite(texture, scale));
    });
  }
  return node;
}

/** Prop peint associé à la nature du lieu de bonus (autel mystique vs panneau). */
const VISITABLE_PROP: Record<string, string> = {
  luck: 'shrine',
  levelXp: 'shrine',
  movement: 'signpost',
  resource: 'signpost',
};

/** Lieu de bonus : panneau/autel peint (UXD-3B), repli kiosque procédural teinté. */
function buildVisitable(kind: string): Container {
  return withMapProp(VISITABLE_PROP[kind] ?? 'signpost', buildVisitableFallback(kind));
}

function buildVisitableFallback(kind: string): Container {
  const node = new Container();
  const c = TILE_SIZE / 2;
  const color = VISITABLE_COLORS[kind] ?? 0x8a8f98;
  node.addChild(
    new Graphics()
      .poly([c, c - 18, c + 18, c - 2, c - 18, c - 2])
      .fill(color)
      .stroke({ width: 2, color: 0x1a1c22 })
      .rect(c - 12, c - 2, 24, 16)
      .fill(0xe8e2d0)
      .stroke({ width: 2, color: 0x1a1c22 })
      .circle(c, c + 6, 3)
      .fill(color),
  );
  return node;
}

/**
 * Habitation hors ville : **camp peint** (UXD-3B, repli tente procédurale) +
 * sprite de l'unité recrutable en médaillon (chargement async gardé comme le
 * gardien).
 */
function buildDwelling(unitId: string, catalog: UnitCatalog): Container {
  const node = withMapProp('camp', buildTentFallback());
  const url = unitSpriteUrl(unitId, catalog[unitId]?.groupId);
  if (url) {
    void Assets.load(url).then((texture) => {
      if (node.destroyed) return;
      const sprite = new Sprite(texture);
      sprite.setSize(TILE_SIZE * 0.45, TILE_SIZE * 0.45);
      sprite.position.set(TILE_SIZE * 0.5, TILE_SIZE * 0.05);
      node.addChild(sprite); // médaillon au-dessus du camp
    });
  }
  return node;
}

function buildTentFallback(): Container {
  const node = new Container();
  const c = TILE_SIZE / 2;
  const tent = new Graphics()
    .poly([c - 20, c + 16, c, c - 14, c + 20, c + 16])
    .fill(0x9a6b3f)
    .stroke({ width: 2, color: 0x1a1c22 });
  tent.poly([c - 5, c + 16, c, c + 6, c + 5, c + 16]).fill(0x1a1c22);
  node.addChild(tent);
  return node;
}

/** Tas de ressource ramassable : sprite `mines/mine-<res>` ou losange teinté (doc 08 §5). */
function buildResourcePile(resource: string): Container {
  const tex = getTexture(mineUrl(resource));
  if (tex) return placeSprite(tex, COLLECTIBLE_SCALE);
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

/** Coffre au trésor **peint** (UXD-3B, doc 02 §2.2) — repli coffre procédural. */
function buildTreasure(): Container {
  return withMapProp('chest', buildTreasureFallback(), COLLECTIBLE_SCALE);
}

function buildTreasureFallback(): Container {
  const node = new Container();
  const c = TILE_SIZE / 2;
  node.addChild(
    new Graphics()
      .roundRect(c - 16, c - 8, 32, 20, 4)
      .fill(0xb9770e)
      .stroke({ width: 2, color: 0x1a1c22 })
      .rect(c - 16, c - 2, 32, 4)
      .fill(0x7e5109)
      .circle(c, c + 1, 3.5)
      .fill(0xf1c40f),
  );
  return node;
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
      node.addChild(placeSprite(texture, COLLECTIBLE_SCALE));
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
