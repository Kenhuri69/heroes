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
/** Roche mère : le vide au-delà d'une couche SOUTERRAINE (L10 — pas un océan). */
export const WORLD_BEDROCK_CSS = '#0d0c11';

const OCEAN_SHALLOW = 0x1f3550; // bas-fonds (= tuile water-1), frange de rivage
const COAST = 0x3a4a63; // liseré de côte (rocher/écume sourde)
/** Frange souterraine : masse rocheuse (= tuile cave-wall) puis arête plus claire. */
const BEDROCK_BAND_COLOR = 0x24222a;
const BEDROCK_EDGE = 0x4a4653;
const SHALLOW_BAND = 48;

/**
 * Fond DOM du vide au-delà de la carte, par couche : océan en surface, roche
 * mère au souterrain. Posé en CSS (coût par-frame nul, cf. UXD-3A) ; appelé au
 * démarrage de la scène puis à chaque bascule de couche.
 */
export function applyWorldBackdrop(root: HTMLElement | null, level: number): void {
  if (root) root.style.backgroundColor = level > 0 ? WORLD_BEDROCK_CSS : WORLD_OCEAN_CSS;
}

/**
 * Rivage statique (losange iso) à placer DERRIÈRE la tuile (1er enfant de la
 * scène). Ne rend qu'une frange bornée au périmètre (pas de remplissage plein
 * écran) ; ne capte jamais le pointeur ; se détruit avec la scène.
 */
export function buildWorldBorder(map: AdventureMapDef, level = 0): Container {
  // Sommets du losange jouable : coins extérieurs des tuiles de bord.
  const top = isoTileCenter(-0.5, -0.5);
  const right = isoTileCenter(map.width - 0.5, -0.5);
  const bottom = isoTileCenter(map.width - 0.5, map.height - 0.5);
  const left = isoTileCenter(-0.5, map.height - 0.5);
  const poly = [top.x, top.y, right.x, right.y, bottom.x, bottom.y, left.x, left.y];

  // Souterrain (L10) : la caverne est creusée DANS la roche — la même frange,
  // mais en masse rocheuse. Une carte souterraine bordée d'écume donnait l'image
  // absurde d'une grotte flottant sur la mer.
  const underground = level > 0;
  const g = new Graphics();
  // Frange : bas-fonds en surface, roche mère dessous (stroke = anneau borné).
  g.poly(poly).stroke({
    width: SHALLOW_BAND,
    color: underground ? BEDROCK_BAND_COLOR : OCEAN_SHALLOW,
    alignment: 1,
  });
  // Liseré : côte en surface, arête de roche dessous.
  g.poly(poly).stroke({ width: 4, color: underground ? BEDROCK_EDGE : COAST, alignment: 1 });

  const container = new Container();
  container.eventMode = 'none';
  container.addChild(g);
  return container;
}
