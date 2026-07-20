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

/**
 * B2 — vue ISOMÉTRIQUE du plateau de combat (comme Heroes III) : la grille est
 * APLATIE verticalement (`ISO_SQUASH`) ⇒ hexes larges façon champ de bataille vu
 * de biais. Les jetons d'unité restent des sprites DEBOUT (billboards), triés par
 * profondeur (`zIndex = y`) pour que le plus proche masque le plus lointain. La
 * grille MOTEUR (offset carré 15×10) est INCHANGÉE : seule la projection de rendu
 * et le picking (`pixelToHex`) portent l'aplatissement — comme la carte
 * d'aventure (doc 02 §2.1, `render/projection.ts`).
 */
export const ISO_SQUASH = 0.68;

/** Centre pixel d'un hex en coordonnées axiales (doc 10 §5.5) — Y aplati (iso). */
export function hexToPixel(q: number, r: number): { x: number; y: number } {
  return {
    x: HEX_SIZE * Math.sqrt(3) * (q + r / 2),
    y: HEX_SIZE * 1.5 * r * ISO_SQUASH,
  };
}

/** Hex axial (arrondi) le plus proche d'un point pixel (picking iso — Y désaplati). */
export function pixelToHex(x: number, y: number): { q: number; r: number } {
  const yy = y / ISO_SQUASH; // désaplatit avant l'inversion axiale
  const q = ((Math.sqrt(3) / 3) * x - yy / 3) / HEX_SIZE;
  const r = ((2 / 3) * yy) / HEX_SIZE;
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
const ALPHA_BASE = 0.08; // très transparent : le décor peint domine
const STROKE_BASE = 0x3a3d47;
// Refonte siège (R3) : la grille ne doit plus CRIER — les états transitoires
// larges (portée de déplacement ≈ 60 hexes) sont des teintes DISCRÈTES posées
// sur le décor peint, pas des aplats de surligneur. Le second canal non
// chromatique (A5) reste : pip + liseré teinté, simplement atténués. Les états
// RARES et critiques (attaquable, zone de sort, sélection) gardent leur force.
const ALPHA_REACHABLE = 0.13; // aplat de portée : discret, le décor transparaît
const ALPHA_STROKE_QUIET = 0.55; // liserés de base/portée : présents sans dominer
const PIP_RADIUS = 2.5; // pip « on peut venir ici » (A5) — réduit (était 4)
const PIP_ALPHA = 0.55;
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
const MOAT_WAVE = 0x7fbfe0; // crête de vaguelette (lisible sous surbrillance)
// S3 : la douve est un DÉCOR (fossé texturé) sous les surbrillances — assez
// opaque pour rester visible même quand un pip vert « atteignable » la recouvre.
const ALPHA_MOAT_DECOR = 0.6;
const ALPHA_MOAT_OVERLAY = 0.28; // surbrillance posée SUR la douve : translucide, la douve transparaît
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

/**
 * S3 — vaguelettes de douve sur un hex-fossé (centre `x,y`, rayon d'hex `r`).
 * Marqueur non chromatique (A5) : trois crêtes ondulées dessinées, lisibles même
 * quand une surbrillance translucide (atteignable/attaquable) recouvre la douve.
 * Purement géométrique et déterministe (aucun RNG).
 */
function drawWavelets(g: Graphics, x: number, y: number, r: number, alpha = 0.85): void {
  const w = r * 0.62; // demi-largeur des crêtes
  const amp = r * 0.1;
  for (let i = 0; i < 3; i++) {
    const cy = y + (i - 1) * r * 0.34;
    g.moveTo(x - w, cy)
      .quadraticCurveTo(x - w / 2, cy - amp, x, cy)
      .quadraticCurveTo(x + w / 2, cy + amp, x + w, cy)
      .stroke({ width: 1.5, color: MOAT_WAVE, alpha });
  }
}

export interface DrawBoardOptions {
  /** Hexes atteignables par la pile active (déplacement). */
  reachable?: ReadonlySet<string>;
  /** Hexes portant une cible attaquable (mêlée à portée ou tir). */
  attackable?: ReadonlySet<string>;
  /** Hexes bloqués par un obstacle (doc 02 §5.1). */
  obstacles?: ReadonlySet<string>;
  /**
   * Item 4a : hexes-obstacles portant un SPRITE de rocher peint (posé par
   * `CombatScene`). Pour ceux-là, on saute le rocher vectoriel `drawBoulder` et
   * l'aplat « obstacle » fort (le sprite peint suffit) — repli sur le vectoriel
   * pour tout obstacle absent de ce set (aucun asset).
   */
  paintedObstacles?: ReadonlySet<string>;
  /** Hexes de douve de siège (C-SIEGE2.3) : franchissables mais ralentissants. */
  moat?: ReadonlySet<string>;
  /**
   * Refonte siège : `false` quand la SCÈNE peinte fournit déjà l'eau de la douve
   * — l'hex garde alors une grille fine + le marqueur vaguelettes (A5) discret,
   * sans aplat opaque qui recouvrirait le décor. Défaut `true` (décor dessiné).
   */
  moatDecor?: boolean;
  /** C-SPELLUI.3 : hexes touchés par la zone d'effet du sort en cours de ciblage. */
  zone?: ReadonlySet<string>;
  /** Hex/cible sélectionné en attente du 2ᵉ tap — contour doré. */
  selected?: OffsetPos | null;
}

/**
 * Sommets d'un hexagone POINTY-TOP APLATI (iso) autour de (x,y), rayon `r`.
 * Les hexes du plateau iso sont larges (Y × `ISO_SQUASH`) façon Heroes III.
 */
function flatHexPoints(x: number, y: number, r: number): number[] {
  const pts: number[] = [];
  for (let k = 0; k < 6; k++) {
    const a = ((-90 + k * 60) * Math.PI) / 180; // pointy-top : sommet en haut
    pts.push(x + r * Math.cos(a), y + r * Math.sin(a) * ISO_SQUASH);
  }
  return pts;
}

/** Dessine les 150 hexes du plateau avec leurs surbrillances (doc 10 §5.5). */
export function drawBoard(g: Graphics, opts: DrawBoardOptions = {}): void {
  const reachable = opts.reachable ?? new Set<string>();
  const attackable = opts.attackable ?? new Set<string>();
  const obstacles = opts.obstacles ?? new Set<string>();
  const paintedObstacles = opts.paintedObstacles ?? new Set<string>();
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
      // S3 : la douve est un DÉCOR de fond (fossé + vaguelettes) qui reste TOUJOURS
      // visible — la surbrillance (atteignable/attaquable) est CUMULÉE en calque
      // translucide par-dessus, jamais substituée (audit doc 19 §2.3).
      const isMoat = moat.has(key);

      // Teinte/marqueur de la surbrillance transitoire éventuelle (état actif).
      // Item 4a : un obstacle avec sprite peint garde une case NEUTRE (le rocher
      // porte l'info) ; sans sprite, l'aplat + rocher vectoriel historique.
      const paintedRock = isObstacle && paintedObstacles.has(key);
      let stateFill: number | null = null;
      let stateStroke = STROKE_BASE;
      let strokeWidth = 1;
      if (isObstacle && !paintedRock) {
        stateFill = FILL_OBSTACLE;
        stateStroke = STROKE_OBSTACLE;
      } else if (isZone) {
        stateFill = FILL_ZONE;
        stateStroke = STROKE_ZONE;
        strokeWidth = 2.5; // bord épais : la zone recouvre des piles ciblées
      } else if (isAttackable) {
        stateFill = FILL_ATTACKABLE;
        stateStroke = STROKE_ATTACKABLE;
        strokeWidth = 2.5; // bord épais = 2ᵉ canal (la cible occupe l'hex)
      } else if (isReachable) {
        stateFill = FILL_REACHABLE;
        stateStroke = STROKE_REACHABLE;
      }

      const isSelected = selected != null && selected.col === col && selected.row === row;

      // Hexagone POINTY-TOP (pointe en haut/bas), aligné sur le layout pointy-top
      // de `hexToPixel`. PixiJS applique un décalage intégré de −π/2 à `regularPoly`
      // (`startAngle = -π/2 + rotation`) : rotation 0 ⇒ pointy-top, π/6 ⇒ flat-top.
      // On passe donc 0 ici — un flat-top sur un lattice pointy-top ne pave pas et
      // produit un treillis en losanges au lieu d'un nid d'abeille.
      if (isMoat) {
        const decor = opts.moatDecor ?? true;
        if (decor) {
          // 1) Décor de douve (fossé opaque + vaguelettes) — repli sans scène peinte.
          g.poly(flatHexPoints(x, y, r))
            .fill({ color: FILL_MOAT, alpha: ALPHA_MOAT_DECOR })
            .stroke({ width: 1, color: STROKE_MOAT });
          drawWavelets(g, x, y, r);
        } else {
          // Scène peinte : l'eau est déjà dans le décor — grille fine + marqueur
          // vaguelettes (A5) discret, jamais d'aplat qui recouvre la peinture.
          g.poly(flatHexPoints(x, y, r))
            .fill({ color: FILL_BASE, alpha: ALPHA_BASE })
            .stroke({ width: 1, color: STROKE_MOAT, alpha: ALPHA_STROKE_QUIET });
          drawWavelets(g, x, y, r, 0.5);
        }
        // 2) Surbrillance CUMULÉE (translucide) : la douve transparaît dessous.
        if (stateFill != null) {
          g.poly(flatHexPoints(x, y, r))
            .fill({ color: stateFill, alpha: ALPHA_MOAT_OVERLAY })
            .stroke({ width: strokeWidth, color: stateStroke });
        }
        if (isSelected) {
          g.poly(flatHexPoints(x, y, r)).stroke({ width: 3, color: STROKE_SELECTED });
        }
      } else {
        // Chemin non-douve : une seule couche teinte état/base. R3 : les états
        // LARGES (base, portée) sont discrets ; les états rares restent forts.
        const fill = stateFill ?? FILL_BASE;
        const alpha =
          stateFill != null
            ? isObstacle
              ? ALPHA_OBSTACLE
              : isReachable
                ? ALPHA_REACHABLE
                : ALPHA_STATE
            : ALPHA_BASE;
        const stroke = isSelected ? STROKE_SELECTED : stateFill != null ? stateStroke : STROKE_BASE;
        const sw = isSelected ? 3 : strokeWidth;
        const strokeAlpha =
          isSelected || isAttackable || isZone || (isObstacle && !paintedRock) ? 1 : ALPHA_STROKE_QUIET;
        g.poly(flatHexPoints(x, y, r))
          .fill({ color: fill, alpha })
          .stroke({ width: sw, color: stroke, alpha: strokeAlpha });
      }

      // Marqueurs non chromatiques (A5) : lisibles même sans distinction de teinte.
      if (isReachable) {
        g.circle(x, y, PIP_RADIUS).fill({ color: MARKER, alpha: PIP_ALPHA }); // pip « on peut venir ici »
      } else if (isZone) {
        // Losange « touché par la zone » — marqueur non chromatique (A5).
        const d = 5;
        g.poly([x, y - d, x + d, y, x, y + d, x - d, y]).fill({ color: MARKER, alpha: 0.9 });
      } else if (isObstacle && !paintedRock) {
        drawBoulder(g, x, y, r); // rocher VECTORIEL (repli) — sinon sprite peint (item 4a)
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
      // Iso : les jetons/tours sont DEBOUT et dépassent vers le haut de leur hex ;
      // marge haute élargie pour ne pas les rogner. Hex aplati en bas (× SQUASH).
      minY = Math.min(minY, y - HEX_SIZE * 2);
      maxY = Math.max(maxY, y + HEX_SIZE * ISO_SQUASH);
    }
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}
