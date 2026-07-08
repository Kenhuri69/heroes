import { Assets, Container, Graphics, Sprite } from 'pixi.js';
import type { TownState } from '@heroes/engine';
import { TILE_SIZE } from './tilemap';
import { isoAnchor, isoDepth } from './projection';
import { townMapUrl } from './assets';

/** Résout la couleur de bannière d'un propriétaire (id joueur ou null = neutre). */
type OwnerColor = (ownerId: string | null) => number;

/**
 * Couche des villes sur la carte d'aventure (Alpha 4.13) : chaque ville est un
 * donjon procédural, coloré selon le propriétaire, avec un liseré doré sur les
 * villes **assiégeables** (non possédées par le joueur humain) — repère visuel
 * de la cible de capture. Resynchronisée sur l'état après chaque commande.
 */
export class TownsLayer {
  readonly container = new Container();
  private readonly byId = new Map<string, { node: Container; owner: string | null }>();

  constructor() {
    // Couche décorative : ne jamais capter le pointeur — sinon un tap sur la
    // tuile d'une ville n'atteindrait plus le handler de la scène (le siège se
    // déclenche par déplacement sur la ville, pas par un clic sur son donjon).
    this.container.eventMode = 'none';
    this.container.sortableChildren = true; // tri de profondeur iso
  }

  sync(towns: readonly TownState[], humanId: string, ownerColor: OwnerColor): void {
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
      if (existing && existing.owner === town.ownerPlayerId) continue;
      if (existing) {
        existing.node.destroy({ children: true });
        this.byId.delete(town.id);
      }
      const node = buildKeep(town.factionId, town.ownerPlayerId === humanId, ownerColor(town.ownerPlayerId));
      const a = isoAnchor(town.pos.x, town.pos.y);
      node.position.set(a.x, a.y);
      node.zIndex = isoDepth(town.pos.x, town.pos.y);
      this.byId.set(town.id, { node, owner: town.ownerPlayerId });
      this.container.addChild(node);
    }
  }
}

/**
 * Ville sur la carte (UXD-3B) : **château peint** par faction
 * (`assets/map/town-<faction>`, chargé async, hors bundle), avec un **donjon
 * procédural** de repli si le sprite est absent/en cours. Le liseré doré
 * d'« assiégeable » (2ᵉ canal A5) est posé PAR-DESSUS dans les deux cas.
 */
function buildKeep(factionId: string, owned: boolean, ownerColor: number): Container {
  const node = new Container();
  const fallback = buildKeepFallback(ownerColor);
  node.addChild(fallback);
  const url = townMapUrl(factionId);
  if (url) {
    void Assets.load(url).then((texture) => {
      if (node.destroyed) return;
      node.removeChild(fallback);
      fallback.destroy({ children: true });
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      const scale = (TILE_SIZE * 1.35) / Math.max(texture.width, texture.height);
      sprite.scale.set(scale);
      sprite.position.set(TILE_SIZE / 2, TILE_SIZE / 2);
      node.addChildAt(sprite, 0); // sous le liseré de siège
    });
  }
  if (!owned) {
    // Liseré doré : cette ville peut être assiégée (doc 08 §5, 2ᵉ canal A5).
    const c = TILE_SIZE / 2;
    node.addChild(
      new Graphics().rect(c - 24, c - 24, 48, 48).stroke({ width: 2, color: 0xf1c40f }),
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
