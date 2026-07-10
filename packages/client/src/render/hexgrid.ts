import type { Graphics } from 'pixi.js';
import {
  axialToOffset,
  hexRound,
  offsetToAxial,
  COMBAT_COLS,
  COMBAT_ROWS,
  type OffsetPos,
} from '@heroes/engine';

/**
 * Rendu de la grille hex de combat (doc 10 §5.5) — pointy-top, 15×10.
 * Les maths hexagonales (offset↔axial, arrondi) viennent de `@heroes/engine`
 * (`combat/hex.ts`) : ce module ne fait QUE la conversion pixel et le dessin.
 */
export const HEX_SIZE = 36; // rayon ; ≥ 44 px de cible tactile au zoom 1

/** Centre pixel d'un hex en coordonnées axiales (doc 10 §5.5). */
export function hexToPixel(q: number, r: number): { x: number; y: number } {
  return {
    x: HEX_SIZE * Math.sqrt(3) * (q + r / 2),
    y: HEX_SIZE * 1.5 * r,
  };
}

/** Hex axial (arrondi) le plus proche d'un point pixel. */
export function pixelToHex(x: number, y: number): { q: number; r: number } {
  const q = ((Math.sqrt(3) / 3) * x - y / 3) / HEX_SIZE;
  const r = ((2 / 3) * y) / HEX_SIZE;
  return hexRound(q, r);
}

/** Composition offset → pixel (stockage plateau en offset, doc 10 §5.5). */
export function offsetToPixel(pos: OffsetPos): { x: number; y: number } {
  const { q, r } = offsetToAxial(pos);
  return hexToPixel(q, r);
}

/** Composition pixel → offset. */
export function pixelToOffset(x: number, y: number): OffsetPos {
  const { q, r } = pixelToHex(x, y);
  return axialToOffset({ q, r });
}

/** Clé stable pour les ensembles de surbrillance (`Set<string>` par hex). */
export function hexKey(pos: OffsetPos): string {
  return `${pos.col},${pos.row}`;
}

// UXD-4 : hexes translucides pour laisser transparaître la toile de combat
// peinte (posée en DOM sous le canvas, U5-E). Chaque état porte un SECOND CANAL
// non chromatique (A5, doc 08 §4) en plus de sa teinte : couleur de contour
// distincte + un marqueur (pip / bord épais / hachures) dessiné par-dessus.
const FILL_BASE = 0x1a1c22;
const ALPHA_BASE = 0.16; // très transparent : le décor peint domine
const STROKE_BASE = 0x3a3d47;
const FILL_REACHABLE = 0x3a7a3a;
const STROKE_REACHABLE = 0x8fe08f;
const FILL_ATTACKABLE = 0x9a2a2a;
const STROKE_ATTACKABLE = 0xff8f7a;
const FILL_OBSTACLE = 0x5a4f45;
const STROKE_OBSTACLE = 0x9a8f80;
const ALPHA_STATE = 0.34; // états : assez opaques pour se lire, décor encore perçu
const MARKER = 0xe8e2d0;
const STROKE_SELECTED = 0xf1c40f;

export interface DrawBoardOptions {
  /** Hexes atteignables par la pile active (déplacement). */
  reachable?: ReadonlySet<string>;
  /** Hexes portant une cible attaquable (mêlée à portée ou tir). */
  attackable?: ReadonlySet<string>;
  /** Hexes bloqués par un obstacle (doc 02 §5.1). */
  obstacles?: ReadonlySet<string>;
  /** Hex/cible sélectionné en attente du 2ᵉ tap — contour doré. */
  selected?: OffsetPos | null;
}

/** Dessine les 150 hexes du plateau avec leurs surbrillances (doc 10 §5.5). */
export function drawBoard(g: Graphics, opts: DrawBoardOptions = {}): void {
  const reachable = opts.reachable ?? new Set<string>();
  const attackable = opts.attackable ?? new Set<string>();
  const obstacles = opts.obstacles ?? new Set<string>();
  const selected = opts.selected ?? null;
  const r = HEX_SIZE - 1;

  for (let row = 0; row < COMBAT_ROWS; row++) {
    for (let col = 0; col < COMBAT_COLS; col++) {
      const pos: OffsetPos = { col, row };
      const key = hexKey(pos);
      const { x, y } = offsetToPixel(pos);

      const isObstacle = obstacles.has(key);
      const isAttackable = !isObstacle && attackable.has(key);
      const isReachable = !isObstacle && !isAttackable && reachable.has(key);

      let fill = FILL_BASE;
      let alpha = ALPHA_BASE;
      let stroke = STROKE_BASE;
      let strokeWidth = 1;
      if (isObstacle) {
        fill = FILL_OBSTACLE;
        alpha = ALPHA_STATE;
        stroke = STROKE_OBSTACLE;
      } else if (isAttackable) {
        fill = FILL_ATTACKABLE;
        alpha = ALPHA_STATE;
        stroke = STROKE_ATTACKABLE;
        strokeWidth = 2.5; // bord épais = 2ᵉ canal (la cible occupe l'hex)
      } else if (isReachable) {
        fill = FILL_REACHABLE;
        alpha = ALPHA_STATE;
        stroke = STROKE_REACHABLE;
      }

      const isSelected = selected != null && selected.col === col && selected.row === row;
      if (isSelected) {
        stroke = STROKE_SELECTED;
        strokeWidth = 3;
      }

      g.regularPoly(x, y, r, 6, Math.PI / 6)
        .fill({ color: fill, alpha })
        .stroke({ width: strokeWidth, color: stroke });

      // Marqueurs non chromatiques (A5) : lisibles même sans distinction de teinte.
      if (isReachable) {
        g.circle(x, y, 4).fill({ color: MARKER, alpha: 0.9 }); // pip « on peut venir ici »
      } else if (isObstacle) {
        const h = r * 0.5; // hachures diagonales « case bloquée »
        g.moveTo(x - h, y).lineTo(x, y - h).moveTo(x, y + h).lineTo(x + h, y)
          .stroke({ width: 2, color: MARKER, alpha: 0.5 });
      }
    }
  }
}

export interface BoardBounds {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

/** Boîte englobante pixel du plateau (pour centrer/mettre à l'échelle la scène). */
export function computeBoardBounds(): BoardBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let row = 0; row < COMBAT_ROWS; row++) {
    for (let col = 0; col < COMBAT_COLS; col++) {
      const { x, y } = offsetToPixel({ col, row });
      minX = Math.min(minX, x - HEX_SIZE);
      maxX = Math.max(maxX, x + HEX_SIZE);
      minY = Math.min(minY, y - HEX_SIZE);
      maxY = Math.max(maxY, y + HEX_SIZE);
    }
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}
