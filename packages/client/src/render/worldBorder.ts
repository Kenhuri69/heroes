import { Container, Graphics } from 'pixi.js';
import type { AdventureMapDef } from '@heroes/engine';
import { isoTileCenter } from './projection';

// UXD-3A / Lot A1 : bord de monde en projection ISO. Au-delà du losange jouable,
// le canvas est transparent et laisse voir le fond sombre uni (mer profonde posée
// en fond DOM de `#canvas-root`, coût par-frame nul — un aplat plein écran DANS le
// canvas tanke la fill-rate en rendu logiciel, plancher anti-gel ×4 cassé). Ce
// module ne rend QUE le rivage : un liseré de côte + une frange de bas-fonds sur
// le périmètre du losange — la carte « repose dans un océan » sans coût de
// remplissage plein écran.

/** Mer profonde posée en fond DOM de `#canvas-root` pendant l'aventure. */
export const WORLD_OCEAN_CSS = '#14243a';

const OCEAN_SHALLOW = 0x1f3550; // bas-fonds (= tuile water-1), frange de rivage
const COAST = 0x3a4a63; // liseré de côte (rocher/écume sourde)
const SHALLOW_BAND = 48;

/**
 * Rivage statique (losange iso) à placer DERRIÈRE la tuile (1er enfant de la
 * scène). Ne rend qu'une frange bornée au périmètre (pas de remplissage plein
 * écran) ; ne capte jamais le pointeur ; se détruit avec la scène.
 */
export function buildWorldBorder(map: AdventureMapDef): Container {
  // Sommets du losange jouable : coins extérieurs des tuiles de bord.
  const top = isoTileCenter(-0.5, -0.5);
  const right = isoTileCenter(map.width - 0.5, -0.5);
  const bottom = isoTileCenter(map.width - 0.5, map.height - 0.5);
  const left = isoTileCenter(-0.5, map.height - 0.5);
  const poly = [top.x, top.y, right.x, right.y, bottom.x, bottom.y, left.x, left.y];

  const g = new Graphics();
  // Bas-fonds : frange claire straddlant le rivage (stroke = anneau borné).
  g.poly(poly).stroke({ width: SHALLOW_BAND, color: OCEAN_SHALLOW, alignment: 1 });
  // Liseré de côte : trait net sur le périmètre jouable.
  g.poly(poly).stroke({ width: 4, color: COAST, alignment: 1 });

  const container = new Container();
  container.eventMode = 'none';
  container.addChild(g);
  return container;
}
