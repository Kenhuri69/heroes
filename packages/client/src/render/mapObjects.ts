import { Assets, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { CombatUnitDef, MapObjectDef, MineObjectDef } from '@heroes/engine';
import {
  artifactUrl,
  getTexture,
  mapPropUrl,
  mineUrl,
  resourcePileUrl,
  unitSpriteUrl,
} from './assets';
import { NEUTRAL_COLOR } from './playerColors';
import { TILE_SIZE } from './tilemap';
import { ISO_TILE_H, ISO_TILE_W, isoAnchor, isoDepth, isoGroundSeatY } from './projection';

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
 * Sprite d'un objet de carte qui EMBARQUE son propre socle isométrique (mine,
 * coffre, fontaine, écurie, camp…). Ancré par son bord bas `anchor(0.5, 1)`,
 * posé par {@link isoGroundSeatY} pour que le socle peint recouvre exactement le
 * losange de la case au lieu de flotter au-dessus (captures « asset pas centré
 * sur la case »). Ratio d'aspect préservé (la plus grande dimension est ajustée
 * à `TILE_SIZE * scale`).
 */
function placeSprite(texture: Texture, scale: number): Sprite {
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5, 1);
  sprite.scale.set((TILE_SIZE * scale) / Math.max(texture.width, texture.height));
  sprite.position.set(TILE_SIZE / 2, isoGroundSeatY(sprite.height));
  return sprite;
}

/**
 * Losange de sol sous un objet interactif : matérialise LA case exacte à viser
 * (aide au picking tactile — l'asset debout peut déborder de son losange).
 * Discret : liseré sombre semi-transparent, sous le visuel.
 */
function groundDiamond(): Graphics {
  const c = TILE_SIZE / 2;
  const hw = ISO_TILE_W / 2 - 2;
  const hh = ISO_TILE_H / 2 - 1;
  return new Graphics()
    .poly([c, c - hh, c + hw, c, c, c + hh, c - hw, c])
    .fill({ color: 0x1a1c22, alpha: 0.12 })
    .stroke({ width: 1.5, color: 0x1a1c22, alpha: 0.4 });
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
      // Mine ET habitation (M-DWELLOWN) : la couleur du propriétaire fait partie
      // de la signature ⇒ une (re)capture force la reconstruction du drapeau.
      const signature =
        obj.type === 'mine' || obj.type === 'dwelling' ? `${obj.type}:${obj.ownerId ?? ''}` : obj.type;
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
  const node = ((): Container => {
    if (obj.type === 'resource') return buildResourcePile(obj.resource);
    if (obj.type === 'mine') return buildMine(obj, ownerColor(obj.ownerId));
    if (obj.type === 'treasure') return buildTreasure();
    if (obj.type === 'artifact') return buildGroundArtifact(obj.artifactId);
    if (obj.type === 'visitable') return buildVisitable(obj.effect.kind);
    if (obj.type === 'dwelling') return buildDwelling(obj.unitId, catalog, ownerColor(obj.ownerId));
    if (obj.type === 'monolith') return buildMonolith();
    return buildGuardian(obj.unitId, catalog);
  })();
  // Sous le visuel : la case exacte à viser (les sprites debout débordent du losange).
  node.addChildAt(groundDiamond(), 0);
  return node;
}

/** Monolithe / téléporteur (M-NAV a) : portail de pierres dressées à lueur arcane. */
function buildMonolith(): Container {
  const node = new Container();
  const c = TILE_SIZE / 2;
  const stone = 0x6c7a89;
  const ink = 0x1a1c22;
  const glow = 0x8e44ad;
  const g = new Graphics();
  // Deux montants + un linteau (trilithe), avec un vide lumineux au centre.
  g.rect(c - 16, c - 18, 8, 34).fill(stone).stroke({ width: 2, color: ink })
    .rect(c + 8, c - 18, 8, 34).fill(stone).stroke({ width: 2, color: ink })
    .rect(c - 18, c - 24, 36, 8).fill(stone).stroke({ width: 2, color: ink })
    .roundRect(c - 8, c - 15, 16, 30, 5).fill(glow).stroke({ width: 1.5, color: 0xd2b4de })
    .circle(c, c - 1, 3).fill(0xf4ecf7);
  node.addChild(g);
  return node;
}

/** Teinte du lieu de bonus par nature d'effet (doc 08 §5 — le glyphe prime, la teinte aide). */
const VISITABLE_COLORS: Record<string, number> = {
  luck: 0x5dade2, // fontaine (eau)
  movement: 0xd68910, // écurie
  vision: 0x48c9b0, // tour de guet
  levelXp: 0x27ae60, // sanctuaire / arbre du savoir
  learnSpell: 0x8e44ad, // sanctuaire de sort (magie)
  grantSkill: 0x6c3483, // cabane de la sorcière (compétence)
  grantWarMachine: 0x7f8c8d, // fabrique de machines de guerre (métal)
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

/**
 * Prop peint associé à la nature du lieu de bonus (doc 02 §2.2) : un visuel
 * DISTINCT par effet. `signpost` reste le repli pour une nature inconnue.
 */
const VISITABLE_PROP: Record<string, string> = {
  luck: 'fountain', // fontaine
  movement: 'stable', // écurie
  vision: 'watchtower', // tour de guet
  levelXp: 'shrine', // sanctuaire / arbre du savoir
  learnSpell: 'shrine', // sanctuaire de sort
  resource: 'mill', // moulin
};

/** Lieu de bonus : structure peinte (UXD-3B), repli procédural distinct par nature. */
function buildVisitable(kind: string): Container {
  return withMapProp(VISITABLE_PROP[kind] ?? 'signpost', buildVisitableFallback(kind));
}

/**
 * Repli procédural du lieu de bonus : une silhouette DISTINCTE par nature (le
 * glyphe prime, la teinte aide — doc 08 §5) tant que le PNG peint est absent.
 */
function buildVisitableFallback(kind: string): Container {
  const node = new Container();
  const c = TILE_SIZE / 2;
  const color = VISITABLE_COLORS[kind] ?? 0x8a8f98;
  const ink = 0x1a1c22;
  const g = new Graphics();
  switch (kind) {
    case 'movement': // écurie : grange (toit pentu + porte)
      g.poly([c - 20, c + 2, c, c - 16, c + 20, c + 2]).fill(color).stroke({ width: 2, color: ink })
        .rect(c - 16, c + 2, 32, 16).fill(0x9a6b3f).stroke({ width: 2, color: ink })
        .rect(c - 6, c + 6, 12, 12).fill(ink);
      break;
    case 'vision': // tour de guet : tour élancée + créneaux + lanterne
      g.rect(c - 8, c - 18, 16, 34).fill(color).stroke({ width: 2, color: ink })
        .rect(c - 10, c - 22, 20, 6).fill(color).stroke({ width: 2, color: ink })
        .circle(c, c - 25, 3).fill(0xf1c40f);
      break;
    case 'resource': // moulin : corps + toit + roue
      g.rect(c - 14, c - 6, 20, 22).fill(0xe8e2d0).stroke({ width: 2, color: ink })
        .poly([c - 16, c - 6, c + 8, c - 6, c - 4, c - 18]).fill(color).stroke({ width: 2, color: ink })
        .circle(c + 12, c + 8, 8).fill(color).stroke({ width: 2, color: ink });
      break;
    case 'luck': // fontaine : vasque + jet d'eau
      g.ellipse(c, c + 10, 18, 7).fill(color).stroke({ width: 2, color: ink })
        .rect(c - 2, c - 12, 4, 20).fill(0xcfe8f5)
        .circle(c, c - 13, 4).fill(0xcfe8f5).stroke({ width: 1.5, color });
      break;
    case 'learnSpell': // sanctuaire de sort : grimoire ouvert + étincelle
      g.poly([c - 16, c + 8, c, c + 2, c, c + 12, c - 16, c + 18]).fill(color).stroke({ width: 2, color: ink })
        .poly([c + 16, c + 8, c, c + 2, c, c + 12, c + 16, c + 18]).fill(color).stroke({ width: 2, color: ink })
        .circle(c, c - 8, 3).fill(0xf4ecf7).stroke({ width: 1.5, color: ink });
      break;
    case 'grantSkill': // cabane de la sorcière : hutte (base + toit pentu + étoile)
      g.rect(c - 12, c - 2, 24, 18).fill(color).stroke({ width: 2, color: ink })
        .poly([c - 15, c - 2, c + 15, c - 2, c, c - 18]).fill(color).stroke({ width: 2, color: ink })
        .circle(c, c - 8, 2.5).fill(0xf7dc6f);
      break;
    case 'grantWarMachine': // fabrique : baliste (châssis + roue + fût)
      g.rect(c - 14, c - 2, 28, 10).fill(color).stroke({ width: 2, color: ink })
        .rect(c - 4, c - 14, 22, 4).fill(0x9a6b3f).stroke({ width: 2, color: ink })
        .circle(c - 8, c + 12, 6).fill(0x5d4037).stroke({ width: 2, color: ink })
        .circle(c + 8, c + 12, 6).fill(0x5d4037).stroke({ width: 2, color: ink });
      break;
    default: // sanctuaire / levelXp : obélisque runique
      g.poly([c, c - 20, c + 8, c + 12, c - 8, c + 12]).fill(color).stroke({ width: 2, color: ink })
        .circle(c, c - 2, 3).fill(0xf4ecf7);
  }
  node.addChild(g);
  return node;
}

/**
 * Habitation hors ville : **camp peint** (UXD-3B, repli tente procédurale) +
 * sprite de l'unité recrutable en médaillon (chargement async gardé comme le
 * gardien).
 */
function buildDwelling(unitId: string, catalog: UnitCatalog, color: number): Container {
  // Camp teinté à la faction de la créature recrutable si son art est présent,
  // sinon camp générique (puis repli tente procédurale) — doc 02 §2.2.
  const faction = catalog[unitId]?.groupId;
  const propId =
    [faction ? `camp-${faction}` : '', 'camp'].find((id) => id && mapPropUrl(id)) ?? 'camp';
  const node = withMapProp(propId, buildTentFallback());
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
  node.addChild(ownerFlag(color)); // M-DWELLOWN : drapeau du propriétaire (gris = neutre)
  return node;
}

/** Fanion de propriété (mine/habitation) en haut à droite de la tuile, teinté propriétaire. */
function ownerFlag(color: number): Graphics {
  const s = TILE_SIZE;
  return new Graphics()
    .rect(s - 14, 2, 3, 20)
    .fill(0x1a1c22)
    .poly([s - 11, 3, s - 1, 8, s - 11, 13])
    .fill(color)
    .stroke({ width: 1.5, color: 0x1a1c22 });
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

/**
 * Tas de ressource RAMASSABLE : sprite `resources/pile-<res>` (famille dédiée),
 * sinon losange teinté (doc 08 §5). Ne réutilise PLUS le visuel de mine : une
 * mine est un bâtiment permanent à capturer, un tas est consommé au passage —
 * deux gameplay, deux assets (plan map-design-issues P3).
 */
function buildResourcePile(resource: string): Container {
  const tex = getTexture(resourcePileUrl(resource));
  if (tex) {
    const node = new Container();
    node.addChild(placeSprite(tex, COLLECTIBLE_SCALE));
    return node;
  }
  // Repli : petit tas losange teinté, lisible à 64 px (doc 08 §5).
  const c = TILE_SIZE / 2;
  const color = RESOURCE_COLORS[resource] ?? 0xffffff;
  const node = new Container();
  node.addChild(
    new Graphics()
      .poly([c, c - 14, c + 16, c, c, c + 14, c - 16, c])
      .fill(color)
      .stroke({ width: 2, color: 0x1a1c22 }),
  );
  return node;
}

/**
 * Mine capturable (doc 02 §2.2) : visuel de mine `mines/mine-<res>` (exclusif
 * aux mines), avec un **drapeau** TOUJOURS présent — gris quand neutre, couleur
 * du joueur propriétaire sinon (doc 08 §5 ; jamais la couleur seule : la
 * présence du drapeau elle-même distingue la mine du tas ramassable).
 */
function buildMine(obj: MineObjectDef, color: number): Container {
  const node = new Container();
  const tex = getTexture(mineUrl(obj.resource));
  if (tex) {
    node.addChild(placeSprite(tex, COLLECTIBLE_SCALE));
  } else {
    // Repli : bâtiment trapu teinté à la ressource (distinct du tas losange).
    const c = TILE_SIZE / 2;
    const color2 = RESOURCE_COLORS[obj.resource] ?? 0xffffff;
    node.addChild(
      new Graphics()
        .poly([c - 16, c + 10, c - 16, c - 4, c, c - 14, c + 16, c - 4, c + 16, c + 10])
        .fill(0x6c7a89)
        .stroke({ width: 2, color: 0x1a1c22 })
        .circle(c, c + 2, 5)
        .fill(color2)
        .stroke({ width: 1.5, color: 0x1a1c22 }),
    );
  }
  node.addChild(ownerFlag(color)); // fanion propriétaire (gris = neutre)
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
  // Repli : silhouette de créature (ombre + torse + tête griffue) — doit se lire
  // « un monstre garde cette case », jamais comme un drapeau de ville/mine
  // (l'ancien fanion gris était pris pour une ville neutre — plan
  // map-design-issues P1).
  const ink = 0x1a1c22;
  const body = 0x5d6470;
  const fallback = new Graphics()
    .ellipse(c, c + 16, 15, 5)
    .fill({ color: ink, alpha: 0.35 })
    .roundRect(c - 11, c - 4, 22, 20, 7)
    .fill(body)
    .stroke({ width: 2, color: ink })
    .poly([c - 8, c - 14, c - 4, c - 20, c, c - 14, c + 4, c - 20, c + 8, c - 14]) // crête cornue
    .fill(body)
    .stroke({ width: 2, color: ink })
    .circle(c, c - 8, 8)
    .fill(body)
    .stroke({ width: 2, color: ink });
  fallback.circle(c - 3, c - 9, 1.8).fill(0xf1c40f).circle(c + 3, c - 9, 1.8).fill(0xf1c40f);
  node.addChild(fallback);

  const url = unitSpriteUrl(unitId, catalog[unitId]?.groupId);
  if (url) {
    void Assets.load(url).then((texture) => {
      if (node.destroyed) return;
      node.removeChild(fallback);
      fallback.destroy();
      const sprite = new Sprite(texture);
      sprite.setSize(TILE_SIZE, TILE_SIZE);
      // Base CENTRÉE (comme le héros et les props de relief) : la créature se DRESSE
      // depuis le sol de sa case au lieu d'être centrée dessus — ancré au centre, elle
      // débordait de part et d'autre du losange et paraissait « entre quatre cases ».
      sprite.anchor.set(0.5, 1);
      sprite.position.set(TILE_SIZE / 2, TILE_SIZE / 2);
      node.addChild(sprite);
    });
  }
  return node;
}
