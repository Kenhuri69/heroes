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
const FILL_OBSTACLE = 0x4a4038;
const STROKE_OBSTACLE = 0x9a8f80;
const ALPHA_OBSTACLE = 0.7; // décor STATIQUE (pas une surbrillance transitoire) : bien lisible
// Rocher dessiné sur les hexes-obstacles (retour de jeu 2026-07 : leur présence
// n'était pas indiquée). Teintes pierre déterministes, second canal non chromatique
// (A5) assuré par la forme même du rocher, distincte des pips/bords d'état.
const ROCK_BODY = 0x7c7266;
const ROCK_LIGHT = 0xa89e8f;
const ROCK_DARK = 0x4d453c;
const FILL_MOAT = 0x1f3a52; // fossé bleu-nuit : franchissable mais ralentissant
const STROKE_MOAT = 0x4a86b8;
// C-SPELLUI.3 : zone d'effet d'un sort — teinte violette distincte des états
// atteignable(vert)/attaquable(rouge)/douve(bleu), + losange marqueur (A5).
const FILL_ZONE = 0x6a3a8a;
const STROKE_ZONE = 0xd6a8ff;
const ALPHA_STATE = 0.34; // états : assez opaques pour se lire, décor encore perçu
const MARKER = 0xe8e2d0;
const STROKE_SELECTED = 0xf1c40f;

/**
 * Dessine un rocher lisible sur un hex-obstacle (centre `x,y`, rayon d'hex `r`).
 * Purement géométrique et déterministe (aucun RNG) : ombre au sol + corps de
 * pierre + facette éclairée en haut-gauche, pour signaler clairement « bloqué ».
 */
function drawBoulder(g: Graphics, x: number, y: number, r: number): void {
  const s = r * 0.62;
  // Ombre portée au sol (galette sombre translucide).
  g.ellipse(x, y + s * 0.55, s * 0.95, s * 0.4).fill({ color: ROCK_DARK, alpha: 0.45 });
  // Corps du rocher — polygone anguleux (silhouette de pierre).
  g.poly([
    x - s * 0.9, y + s * 0.35,
    x - s * 0.7, y - s * 0.35,
    x - s * 0.15, y - s * 0.75,
    x + s * 0.5, y - s * 0.6,
    x + s * 0.9, y - s * 0.05,
    x + s * 0.7, y + s * 0.45,
    x - s * 0.2, y + s * 0.6,
  ])
    .fill({ color: ROCK_BODY, alpha: 1 })
    .stroke({ width: 1.5, color: ROCK_DARK, alpha: 0.9 });
  // Facette éclairée (haut-gauche) — donne du volume, améliore le contraste.
  g.poly([
    x - s * 0.7, y - s * 0.35,
    x - s * 0.15, y - s * 0.75,
    x + s * 0.15, y - s * 0.35,
    x - s * 0.35, y - s * 0.05,
  ]).fill({ color: ROCK_LIGHT, alpha: 0.95 });
}

export interface DrawBoardOptions {
  /** Hexes atteignables par la pile active (déplacement). */
  reachable?: ReadonlySet<string>;
  /** Hexes portant une cible attaquable (mêlée à portée ou tir). */
  attackable?: ReadonlySet<string>;
  /** Hexes bloqués par un obstacle (doc 02 §5.1). */
  obstacles?: ReadonlySet<string>;
  /** Hexes de douve de siège (C-SIEGE2.3) : franchissables mais ralentissants. */
  moat?: ReadonlySet<string>;
  /** C-SPELLUI.3 : hexes touchés par la zone d'effet du sort en cours de ciblage. */
  zone?: ReadonlySet<string>;
  /** Hex/cible sélectionné en attente du 2ᵉ tap — contour doré. */
  selected?: OffsetPos | null;
}

/** Dessine les 150 hexes du plateau avec leurs surbrillances (doc 10 §5.5). */
export function drawBoard(g: Graphics, opts: DrawBoardOptions = {}): void {
  const reachable = opts.reachable ?? new Set<string>();
  const attackable = opts.attackable ?? new Set<string>();
  const obstacles = opts.obstacles ?? new Set<string>();
  const moat = opts.moat ?? new Set<string>();
  const zone = opts.zone ?? new Set<string>();
  const selected = opts.selected ?? null;
  const r = HEX_SIZE - 1;

  for (let row = 0; row < COMBAT_ROWS; row++) {
    for (let col = 0; col < COMBAT_COLS; col++) {
      const pos: OffsetPos = { col, row };
      const key = hexKey(pos);
      const { x, y } = offsetToPixel(pos);

      const isObstacle = obstacles.has(key);
      // C-SPELLUI.3 : la zone de sort est un mode de ciblage exclusif (reachable/
      // attackable vides quand elle est active) — sa propre teinte.
      const isZone = !isObstacle && zone.has(key);
      const isAttackable = !isObstacle && !isZone && attackable.has(key);
      const isReachable = !isObstacle && !isZone && !isAttackable && reachable.has(key);
      // C-SIEGE2.3 : la douve est une teinte de FOND (fossé), recouverte par les
      // surbrillances transitoires (atteignable/attaquable/obstacle) quand actives.
      const isMoat = moat.has(key);

      let fill = isMoat ? FILL_MOAT : FILL_BASE;
      let alpha = isMoat ? ALPHA_STATE : ALPHA_BASE;
      let stroke = isMoat ? STROKE_MOAT : STROKE_BASE;
      let strokeWidth = 1;
      if (isObstacle) {
        fill = FILL_OBSTACLE;
        alpha = ALPHA_OBSTACLE;
        stroke = STROKE_OBSTACLE;
      } else if (isZone) {
        fill = FILL_ZONE;
        alpha = ALPHA_STATE;
        stroke = STROKE_ZONE;
        strokeWidth = 2.5; // bord épais : la zone recouvre des piles ciblées
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
      } else if (isZone) {
        // Losange « touché par la zone » — marqueur non chromatique (A5).
        const d = 5;
        g.poly([x, y - d, x + d, y, x, y + d, x - d, y]).fill({ color: MARKER, alpha: 0.9 });
      } else if (isObstacle) {
        drawBoulder(g, x, y, r); // rocher lisible « case bloquée » (bloque le déplacement)
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
