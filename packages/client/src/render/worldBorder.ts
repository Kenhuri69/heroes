import { Container, Graphics } from 'pixi.js';
import type { AdventureMapDef } from '@heroes/engine';
import { TILE_SIZE } from './tilemap';

// UXD-3A : bord de monde. Au-delà des tuiles (0,0)→(W·64, H·64) le canvas est
// transparent et laisse voir le fond sombre uni (letterbox, audit §1.5). La MER
// PROFONDE est posée en **fond DOM de `#canvas-root`** (`WORLD_OCEAN_CSS`, coût
// par-frame nul — même approche que la toile de combat U5-E ; un aplat plein
// écran DANS le canvas tanke la fill-rate en rendu logiciel, plancher anti-gel
// ×4 cassé). Ce module ne rend QUE le **rivage** en Pixi : un liseré de côte +
// une frange de bas-fonds sur le périmètre jouable (fill borné à la bordure,
// négligeable) — la carte « repose dans un océan » au lieu de flotter dans le
// vide, sans coût de remplissage plein écran.

/** Mer profonde posée en fond DOM de `#canvas-root` pendant l'aventure. */
export const WORLD_OCEAN_CSS = '#14243a';

const OCEAN_SHALLOW = 0x1f3550; // bas-fonds (= tuile water-1), frange de rivage
const COAST = 0x3a4a63; // liseré de côte (rocher/écume sourde)
const SHALLOW_BAND = TILE_SIZE * 1.5;

/**
 * Rivage statique à placer DERRIÈRE la tuile (1er enfant de la scène). Ne rend
 * qu'une frange bornée au périmètre (pas de remplissage plein écran) ; ne capte
 * jamais le pointeur ; se détruit avec la scène.
 */
export function buildWorldBorder(map: AdventureMapDef): Container {
  const w = map.width * TILE_SIZE;
  const h = map.height * TILE_SIZE;
  const g = new Graphics();

  // Bas-fonds : frange plus claire straddlant le rivage (dégradé « profondeur »
  // vers la mer DOM). Stroke = anneau borné au périmètre, pas un aplat plein.
  g.rect(0, 0, w, h).stroke({ width: SHALLOW_BAND, color: OCEAN_SHALLOW, alignment: 1 });
  // Liseré de côte : trait net sur le périmètre jouable (lecture « rivage »).
  g.rect(0, 0, w, h).stroke({ width: 4, color: COAST, alignment: 1 });

  const container = new Container();
  container.eventMode = 'none';
  container.addChild(g);
  return container;
}
