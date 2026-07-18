import type { Graphics } from 'pixi.js';
import { COMBAT_ROWS, type CombatState, type OffsetPos } from '@heroes/engine';
import { HEX_SIZE, offsetToPixel } from './hexgrid';

/**
 * S1 — muraille de siège CONTINUE (audit doc 19 §2.1 ; réf. captures du jeu
 * d'origine). Le rempart est une STRUCTURE cohérente le long de la colonne de
 * murs : **courtine** verticale continue + **tours** aux extrémités de chaque
 * tronçon + **porte** à l'ouverture centrale + **dégâts** (fissures / brèche)
 * mappés aux segments entamés (`siegeWallHp`).
 *
 * `computeWallLayout` calcule la géométrie (pure) ; `CombatScene` place ensuite
 * soit des sprites PEINTS (`siege-curtain`/`siege-tower`/`siege-gate`, s'ils sont
 * fournis), soit le **repli PROCÉDURAL** ci-dessous (dessin vectoriel
 * déterministe, zéro asset — jamais d'image cassée). Le zigzag pair/impair de
 * l'offset hex est LISSÉ (x moyen) ⇒ mur droit.
 */

const STONE_BODY = 0x9a8f7a;
const STONE_LIGHT = 0xc4b89c;
const STONE_DARK = 0x5c5348;
const MORTAR = 0x6b6153;
const MOSS = 0x6e7a3c;
const DARK_HOLE = 0x1a1815;
const RUBBLE = 0x8a8069;
const WOOD = 0x5a4632;
const IRON = 0x3a3630;

const HALF_W = HEX_SIZE * 0.82; // demi-largeur de la courtine (≈ tour ⇒ mur plein)
const TOWER_W = HEX_SIZE * 0.98; // demi-largeur d'une tour (déborde légèrement)
const TOWER_H = HEX_SIZE * 1.5; // hauteur d'une tour
const GATE_H = HEX_SIZE * 2.2; // hauteur de la porte
const CRENEL = HEX_SIZE * 0.32; // hauteur des merlons

export interface WallLayout {
  wallX: number;
  halfW: number;
  towerW: number;
  towerH: number;
  gateH: number;
  /** Tronçons continus de courtine (bornes pixel verticales). */
  runs: { yTop: number; yBot: number }[];
  /** Centres pixel des tours (extrémités de tronçons). */
  towers: number[];
  /** Centre pixel de la porte (ouverture centrale) — null si murée. */
  gateY: number | null;
  /** Segments entamés : position + ratio de PV (1 = intact). */
  damage: { x: number; y: number; ratio: number; seed: number }[];
}

/** Géométrie pure de la muraille (aucun dessin). `null` si aucun mur. */
export function computeWallLayout(combat: CombatState): WallLayout | null {
  const walls = combat.siegeWalls ?? [];
  if (walls.length === 0) return null;
  const hp = combat.siegeWallHp ?? {};
  const maxHp = Object.keys(hp).length ? Math.max(...Object.values(hp)) : 0;
  const wc = walls[0]!.col;

  let sx = 0;
  for (let r = 0; r < COMBAT_ROWS; r++) sx += offsetToPixel({ col: wc, row: r }).x;
  const wallX = sx / COMBAT_ROWS; // x lissé de la colonne (annule le zigzag)
  const yOf = (r: number): number => offsetToPixel({ col: wc, row: r }).y;

  const walled = new Set(walls.map((w) => w.row));
  const runs: { yTop: number; yBot: number }[] = [];
  const towers: number[] = [];
  for (let r = 0; r < COMBAT_ROWS; r++) {
    if (!walled.has(r)) continue;
    const start = r;
    while (r + 1 < COMBAT_ROWS && walled.has(r + 1)) r++;
    const yTop = yOf(start) - HEX_SIZE * 0.9;
    const yBot = yOf(r) + HEX_SIZE * 0.9;
    runs.push({ yTop, yBot });
    towers.push(yTop, yBot);
  }

  const gA = Math.floor(COMBAT_ROWS / 2) - 1;
  const gB = Math.floor(COMBAT_ROWS / 2);
  const gateY = !walled.has(gA) && !walled.has(gB) ? (yOf(gA) + yOf(gB)) / 2 : null;

  const damage: WallLayout['damage'] = [];
  for (const w of walls) {
    const ratio = maxHp > 0 ? (hp[`${w.col},${w.row}`] ?? maxHp) / maxHp : 1;
    if (ratio < 1) damage.push({ x: wallX, y: yOf(w.row), ratio, seed: w.row });
  }

  return { wallX, halfW: HALF_W, towerW: TOWER_W, towerH: TOWER_H, gateH: GATE_H, runs, towers, gateY, damage };
}

// ——— Repli PROCÉDURAL (dessin vectoriel déterministe) ———

/** Courtine (blocs d'ashlar + merlons + volume) de `yTop` à `yBot`. */
export function drawCurtain(g: Graphics, x: number, yTop: number, yBot: number): void {
  const left = x - HALF_W;
  const w = HALF_W * 2;
  g.rect(left, yTop, w, yBot - yTop).fill({ color: STONE_BODY });
  g.rect(left, yTop, w * 0.22, yBot - yTop).fill({ color: STONE_LIGHT, alpha: 0.35 });
  g.rect(x + HALF_W * 0.45, yTop, w * 0.28, yBot - yTop).fill({ color: STONE_DARK, alpha: 0.3 });
  const course = HEX_SIZE * 0.42;
  let i = 0;
  for (let y = yTop; y <= yBot; y += course, i++) {
    g.moveTo(left, y).lineTo(left + w, y).stroke({ width: 1.5, color: MORTAR, alpha: 0.8 });
    const off = i % 2 === 0 ? 0 : w / 3;
    for (let jx = left + off; jx < left + w; jx += w / 1.5) {
      g.moveTo(jx, y).lineTo(jx, Math.min(y + course, yBot)).stroke({ width: 1, color: MORTAR, alpha: 0.55 });
    }
  }
  for (let k = 0; k < 5; k++) {
    const mx = left + ((k * 37) % (w - 6)) + 3;
    g.circle(mx, yBot - (k % 2) * 4 - 2, 2.2).fill({ color: MOSS, alpha: 0.5 });
  }
  drawMerlons(g, left, w, yTop);
}

function drawMerlons(g: Graphics, left: number, w: number, y: number): void {
  const n = Math.max(3, Math.round(w / (HEX_SIZE * 0.5)));
  const step = w / n;
  for (let k = 0; k < n; k++) {
    if (k % 2 === 1) continue;
    const mx = left + k * step;
    g.rect(mx, y - CRENEL, step * 0.92, CRENEL + 2).fill({ color: STONE_BODY }).stroke({ width: 1, color: STONE_DARK, alpha: 0.6 });
    g.rect(mx, y - CRENEL, step * 0.3, CRENEL).fill({ color: STONE_LIGHT, alpha: 0.4 });
  }
}

/** Tour cylindrique crénelée centrée en (x,y). */
export function drawTower(g: Graphics, x: number, y: number): void {
  const h = TOWER_H;
  const top = y - h / 2;
  g.ellipse(x, y + h / 2, TOWER_W * 1.05, TOWER_W * 0.35).fill({ color: DARK_HOLE, alpha: 0.28 });
  g.roundRect(x - TOWER_W, top, TOWER_W * 2, h, 5).fill({ color: STONE_BODY }).stroke({ width: 1.5, color: STONE_DARK, alpha: 0.7 });
  g.rect(x - TOWER_W, top, TOWER_W * 0.5, h).fill({ color: STONE_LIGHT, alpha: 0.32 });
  g.rect(x + TOWER_W * 0.4, top, TOWER_W * 0.6, h).fill({ color: STONE_DARK, alpha: 0.32 });
  g.rect(x - 2, top + h * 0.3, 4, h * 0.34).fill({ color: DARK_HOLE });
  for (let y2 = top + HEX_SIZE * 0.42; y2 < top + h; y2 += HEX_SIZE * 0.42) {
    g.moveTo(x - TOWER_W, y2).lineTo(x + TOWER_W, y2).stroke({ width: 1, color: MORTAR, alpha: 0.6 });
  }
  drawMerlons(g, x - TOWER_W, TOWER_W * 2, top);
}

/** Porte de ville (arche + vantaux + herse) centrée en (x,yc). */
export function drawGate(g: Graphics, x: number, yc: number): void {
  const h = GATE_H;
  const w = HALF_W * 2;
  const top = yc - h / 2;
  const left = x - HALF_W;
  g.roundRect(left, top, w, h, 4).fill({ color: STONE_BODY }).stroke({ width: 1.5, color: STONE_DARK, alpha: 0.7 });
  g.rect(left, top, w * 0.2, h).fill({ color: STONE_LIGHT, alpha: 0.3 });
  const bw = w * 0.6;
  const bx = x - bw / 2;
  const byTop = top + h * 0.22;
  const byBot = top + h * 0.9;
  g.moveTo(bx, byBot)
    .lineTo(bx, byTop)
    .quadraticCurveTo(x, byTop - h * 0.14, bx + bw, byTop)
    .lineTo(bx + bw, byBot)
    .fill({ color: DARK_HOLE });
  g.rect(bx + 2, byTop + h * 0.06, bw - 4, byBot - byTop - h * 0.06).fill({ color: WOOD });
  g.moveTo(x, byTop + h * 0.06).lineTo(x, byBot).stroke({ width: 2, color: IRON });
  for (let b = 0; b < 3; b++) {
    const by = byTop + h * 0.16 + b * h * 0.22;
    g.rect(bx + 4, by, bw - 8, 3).fill({ color: IRON });
  }
  for (let gx = bx + 6; gx < bx + bw - 4; gx += 8) g.moveTo(gx, byTop).lineTo(gx, byTop + h * 0.12).stroke({ width: 1.5, color: IRON, alpha: 0.8 });
  drawMerlons(g, left, w, top);
}

/** Dégâts d'un segment : fissures (usure) / trou + gravats (brèche). */
export function drawDamage(g: Graphics, x: number, y: number, ratio: number, seed: number): void {
  if (ratio > 0.4) drawCracks(g, x, y, seed);
  else drawBreach(g, x, y);
}

function drawCracks(g: Graphics, x: number, y: number, seed: number): void {
  const arms = 5;
  for (let k = 0; k < arms; k++) {
    const ang = ((k * 73 + seed * 29) % 360) * (Math.PI / 180);
    const len = HEX_SIZE * (0.5 + ((k * 17) % 5) / 10);
    let px = x;
    let py = y;
    g.moveTo(px, py);
    const segs = 3;
    for (let s = 1; s <= segs; s++) {
      const jitter = (((k + s) * 41) % 10 - 5) * 0.8;
      px = x + (Math.cos(ang) * (len * s)) / segs + jitter;
      py = y + (Math.sin(ang) * (len * s)) / segs;
      g.lineTo(px, py);
    }
    g.stroke({ width: 1.6, color: DARK_HOLE, alpha: 0.85 });
  }
}

function drawBreach(g: Graphics, x: number, y: number): void {
  drawCracks(g, x, y, 3);
  g.ellipse(x, y, HEX_SIZE * 0.42, HEX_SIZE * 0.5).fill({ color: DARK_HOLE });
  g.ellipse(x, y, HEX_SIZE * 0.42, HEX_SIZE * 0.5).stroke({ width: 2, color: STONE_DARK, alpha: 0.7 });
  const chunks: OffsetPos[] = [];
  for (let k = 0; k < 6; k++) chunks.push({ col: (k * 23) % 40 - 20, row: (k * 13) % 12 });
  for (const c of chunks) {
    g.rect(x + c.col * 0.7, y + HEX_SIZE * 0.5 + c.row, 6, 5).fill({ color: RUBBLE }).stroke({ width: 0.8, color: STONE_DARK, alpha: 0.6 });
  }
}
