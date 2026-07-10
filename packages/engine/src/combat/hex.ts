/**
 * Maths hexagonales du combat — pointy-top, plateau 15×10 (doc 02 §5.1).
 * Convention doc 10 §5.5 : STOCKAGE en coordonnées « offset » (col, row),
 * maths en axiales (odd-r : q = col − (row >> 1)). Zéro dépendance rendu ;
 * le client réutilise ces fonctions pour ses conversions pixel.
 */

export const COMBAT_COLS = 15;
export const COMBAT_ROWS = 10;

export interface OffsetPos {
  col: number;
  row: number;
}

export interface AxialPos {
  q: number;
  r: number;
}

export function offsetToAxial(p: OffsetPos): AxialPos {
  return { q: p.col - (p.row >> 1), r: p.row };
}

export function axialToOffset(p: AxialPos): OffsetPos {
  return { col: p.q + (p.r >> 1), row: p.r };
}

export function inCombatBounds(p: OffsetPos): boolean {
  return p.col >= 0 && p.col < COMBAT_COLS && p.row >= 0 && p.row < COMBAT_ROWS;
}

export function sameHex(a: OffsetPos, b: OffsetPos): boolean {
  return a.col === b.col && a.row === b.row;
}

/** Distance hex (cube) entre deux positions offset. */
export function hexDistance(a: OffsetPos, b: OffsetPos): number {
  const aa = offsetToAxial(a);
  const bb = offsetToAxial(b);
  const dq = aa.q - bb.q;
  const dr = aa.r - bb.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

const AXIAL_DIRECTIONS: readonly AxialPos[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

/** Les 6 voisins dans le plateau (hors-limites filtrés), ordre fixe — déterminisme. */
export function hexNeighbors(p: OffsetPos): OffsetPos[] {
  const a = offsetToAxial(p);
  const out: OffsetPos[] = [];
  for (const d of AXIAL_DIRECTIONS) {
    const n = axialToOffset({ q: a.q + d.q, r: a.r + d.r });
    if (inCombatBounds(n)) out.push(n);
  }
  return out;
}

/**
 * Ligne d'hexes entre `a` et `b` inclus (linedraw cubique, doc 02 §5.4 LoS) :
 * échantillonne `hexDistance` + 1 points le long du segment axial et arrondit
 * chacun. Un léger décalage (`EPS`) écarte les cas d'égalité pile entre deux
 * hexes de façon DÉTERMINISTE (même résultat sur toute machine, IEEE 754) —
 * indispensable pour un replay stable. Consommé par `hasLineOfSight`.
 */
const LINE_EPS = 1e-6;
export function hexLine(a: OffsetPos, b: OffsetPos): OffsetPos[] {
  const n = hexDistance(a, b);
  if (n === 0) return [a];
  const aa = offsetToAxial(a);
  const bb = offsetToAxial(b);
  const out: OffsetPos[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const q = aa.q + LINE_EPS + (bb.q - aa.q) * t;
    const r = aa.r + LINE_EPS + (bb.r - aa.r) * t;
    out.push(axialToOffset(hexRound(q, r)));
  }
  return out;
}

/** Arrondi cubique standard (fractionnaire → hex) — utilisé par pixelToHex côté client. */
export function hexRound(q: number, r: number): AxialPos {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq, r: rr };
}
