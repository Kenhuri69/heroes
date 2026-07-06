import { Container, Graphics } from 'pixi.js';
import type { TownState } from '@heroes/engine';
import { TILE_SIZE } from './tilemap';

/** Couleur du donjon selon le propriétaire (doc 08 §5, accessibilité A5 : forme + couleur). */
const OWNED_COLOR = 0xc0392b; // héros humain — même teinte que son jeton
const ENEMY_COLOR = 0x34495e; // ville adverse / neutre (assiégeable)

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
  }

  sync(towns: readonly TownState[], humanId: string): void {
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
      const node = buildKeep(town.ownerPlayerId === humanId);
      node.position.set(town.pos.x * TILE_SIZE, town.pos.y * TILE_SIZE);
      this.byId.set(town.id, { node, owner: town.ownerPlayerId });
      this.container.addChild(node);
    }
  }
}

/** Donjon procédural (créneaux + bannière), liseré doré si assiégeable. */
function buildKeep(owned: boolean): Container {
  const node = new Container();
  const color = owned ? OWNED_COLOR : ENEMY_COLOR;
  const c = TILE_SIZE / 2;
  const g = new Graphics()
    // Corps du donjon.
    .rect(c - 18, c - 6, 36, 22)
    .fill(color)
    .stroke({ width: 2, color: 0x1a1c22 })
    // Créneaux.
    .rect(c - 18, c - 14, 8, 8)
    .rect(c - 4, c - 14, 8, 8)
    .rect(c + 10, c - 14, 8, 8)
    .fill(color)
    .stroke({ width: 2, color: 0x1a1c22 });
  node.addChild(g);
  if (!owned) {
    // Liseré doré : cette ville peut être assiégée (doc 08 §5).
    node.addChild(
      new Graphics().rect(c - 21, c - 17, 42, 36).stroke({ width: 2, color: 0xf1c40f }),
    );
  }
  return node;
}
