import { Assets, Container, Graphics, Sprite } from 'pixi.js';
import type { TownState } from '@heroes/engine';
import { TILE_SIZE } from './tilemap';
import { ISO_TILE_H, ISO_TILE_W, isoAnchor, isoDepth, isoGroundSeatY, isoTokenScale } from './projection';
import { buildingUrl, townMapUrl } from './assets';

/** Résout la couleur de bannière d'un propriétaire (id joueur ou null = neutre). */
type OwnerColor = (ownerId: string | null) => number;

/**
 * Couche des villes sur la carte d'aventure (Alpha 4.13) : chaque ville est un
 * donjon procédural, coloré selon le propriétaire, avec un liseré doré sur les
 * villes **assiégeables** (non possédées par le joueur humain) — repère visuel
 * de la cible de capture. Resynchronisée sur l'état après chaque commande.
 */
export class TownsLayer {
  private readonly byId = new Map<string, { node: Container; owner: string | null }>();

  /**
   * `layer` : couche d'entités PARTAGÉE (objets + villes + héros) triée par
   * profondeur iso — voir `MapObjectsLayer`. Le siège se déclenche par
   * déplacement sur la ville (pas par un clic sur le donjon) : la couche
   * partagée est `eventMode:'none'` côté scène, donc aucune ville ne capte le
   * pointeur.
   */
  constructor(private readonly layer: Container) {}

  sync(
    towns: readonly TownState[],
    humanId: string,
    ownerColor: OwnerColor,
    /** Revue 2026-09 (R5) : tuile explorée ? Le donjon dépasse de 2 rangées — sous le voile, il est CACHÉ. */
    isExplored: (pos: { x: number; y: number }) => boolean = () => true,
  ): void {
    const alive = new Set(towns.map((tw) => tw.id));
    for (const [id, entry] of this.byId) {
      if (!alive.has(id)) {
        entry.node.destroy({ children: true });
        this.byId.delete(id);
      }
    }
    for (const town of towns) {
      const existing = this.byId.get(town.id);
      // Recrée le donjon si le propriétaire a changé (capture) — couleur/liseré à jour.
      if (existing && existing.owner === town.ownerPlayerId) {
        existing.node.visible = isExplored(town.pos);
        continue;
      }
      if (existing) {
        existing.node.destroy({ children: true });
        this.byId.delete(town.id);
      }
      const node = buildKeep(town.factionId, town.ownerPlayerId === humanId, ownerColor(town.ownerPlayerId));
      const a = isoAnchor(town.pos.x, town.pos.y);
      node.position.set(a.x, a.y);
      node.zIndex = isoDepth(town.pos.x, town.pos.y);
      node.visible = isExplored(town.pos);
      this.byId.set(town.id, { node, owner: town.ownerPlayerId });
      this.layer.addChild(node);
    }
  }
}

/**
 * Ville sur la carte (UXD-3B) : **château peint** par faction
 * (`assets/map/town-<faction>`, chargé async, hors bundle), avec un **donjon
 * procédural** de repli si le sprite est absent/en cours. Le liseré doré
 * d'« assiégeable » (2ᵉ canal A5) est posé PAR-DESSUS dans les deux cas.
 */
/** Hauteur du donjon de ville, en RANGÉES de losange (lot R5, U3). */
const TOWN_ROWS = 2;

/**
 * Chaîne de replis PEINTS du marqueur de ville (lot R5, constat U4) : le glyphe
 * procédural détonnait au milieu d'assets peints (coffre, étable, obélisque) dès
 * qu'une faction n'avait pas d'art de carte dédié. Ordre : art de carte de la
 * faction → **vignette d'hôtel de ville** (présente pour toutes les factions via
 * le paquet core) → repli dessiné. Aucun id de faction dans le code : les deux
 * URLs sont résolues par le registre d'assets.
 */
function keepSpriteUrl(factionId: string): string | undefined {
  return townMapUrl(factionId) ?? buildingUrl(TOWN_MARKER_BUILDING, factionId);
}

/** Bâtiment dont la vignette sert de marqueur de repli (commun à toutes les factions). */
const TOWN_MARKER_BUILDING = 'townHall';

function buildKeep(factionId: string, owned: boolean, ownerColor: number): Container {
  const node = new Container();
  const fallback = buildKeepFallback(ownerColor);
  node.addChild(fallback);
  const url = keepSpriteUrl(factionId);
  if (url) {
    void Assets.load(url).then((texture) => {
      if (node.destroyed) return;
      node.removeChild(fallback);
      fallback.destroy({ children: true });
      const sprite = new Sprite(texture);
      // Socle iso peint posé sur le losange de la case (comme les objets de carte) :
      // `anchor(0.5, 1)` + `isoGroundSeatY`, pour que la parcelle du château recouvre
      // sa case au lieu de flotter au-dessus (l'ancien réglage posait le bord bas au
      // centre → tout le château remontait d'un demi-losange).
      sprite.anchor.set(0.5, 1);
      // Lot R5 (U3) : échelle calée sur le LOSANGE — à ×1,35 d'une boîte carrée
      // de 64 px la ville faisait 86 px, soit 2,7 rangées de tuiles. Deux rangées :
      // elle reste le point de repère majeur de la carte sans avaler ses voisines.
      sprite.scale.set(isoTokenScale(texture, TOWN_ROWS));
      sprite.position.set(TILE_SIZE / 2, isoGroundSeatY(sprite.height));
      node.addChildAt(sprite, 0); // sous le liseré de siège
    });
  }
  if (!owned) {
    // Liseré doré : cette ville peut être assiégée (doc 08 §5, 2ᵉ canal A5).
    // Lot R5 (U4) : il épouse le LOSANGE de la case au lieu d'un carré de 48 px —
    // le carré jaune, posé de travers sur une carte iso, était l'autre moitié du
    // « glyphe gris encadré jaune » relevé par la revue.
    const c = TILE_SIZE / 2;
    const hw = ISO_TILE_W / 2 - 2;
    const hh = ISO_TILE_H / 2 - 1;
    node.addChild(
      new Graphics()
        .poly([c, c - hh, c + hw, c, c, c + hh, c - hw, c])
        .stroke({ width: 2, color: 0xf1c40f }),
    );
  }
  return node;
}

/** Donjon procédural de repli (créneaux), coloré à la bannière du propriétaire. */
function buildKeepFallback(color: number): Container {
  const node = new Container();
  const c = TILE_SIZE / 2;
  const g = new Graphics()
    .rect(c - 18, c - 6, 36, 22)
    .fill(color)
    .stroke({ width: 2, color: 0x1a1c22 })
    .rect(c - 18, c - 14, 8, 8)
    .rect(c - 4, c - 14, 8, 8)
    .rect(c + 10, c - 14, 8, 8)
    .fill(color)
    .stroke({ width: 2, color: 0x1a1c22 });
  node.addChild(g);
  return node;
}
