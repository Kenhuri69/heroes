/**
 * Maths hexagonales du combat — pointy-top, plateau 12×10 (doc 02 §5.1).
 * Convention doc 10 §5.5 : STOCKAGE en coordonnées « offset » (col, row),
 * maths en axiales (odd-r : q = col − (row >> 1)). Zéro dépendance rendu ;
 * le client réutilise ces fonctions pour ses conversions pixel.
 */

export const COMBAT_COLS = 12;
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
