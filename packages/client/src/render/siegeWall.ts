import type { Graphics } from 'pixi.js';
import { COMBAT_ROWS, type CombatState, type OffsetPos } from '@heroes/engine';
import { HEX_SIZE, offsetToPixel } from './hexgrid';

/**
 * S1 — muraille de siège CONTINUE (audit doc 19 §2.1 ; réf. captures du jeu
 * d'origine). Au lieu d'un sprite horizontal PAR HEX (blocs épars, gaps), le
 * rempart est dessiné comme UNE structure cohérente le long de la colonne de
 * murs : **courtine** verticale continue + **tours** aux extrémités de chaque
 * tronçon + **porte** à l'ouverture centrale, avec les **dégâts** (fissures /
 * brèche) mappés à la position des segments entamés (`siegeWallHp`).
 *
 * Entièrement PROCÉDURAL et déterministe (aucun RNG, aucun asset) — repli
 * gracieux permanent ; une future courtine/tour peinte pourra s'y substituer.
 * Le zigzag pair/impair de l'offset hex est LISSÉ (x moyen de la colonne) pour
 * que la muraille se lise droite, pas en dents de scie.
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
const TOWER_W = HEX_SIZE * 0.98; // demi-largeur d'une tour (déborde légèrement la courtine)
const CRENEL = HEX_SIZE * 0.32; // hauteur des merlons

export function drawSiegeWall(g: Graphics, combat: CombatState): void {
  const walls = combat.siegeWalls ?? [];
  if (walls.length === 0) return;
  const hp = combat.siegeWallHp ?? {};
  const maxHp = Object.keys(hp).length ? Math.max(...Object.values(hp)) : 0;
  const wc = walls[0]!.col;

  let sx = 0;
  for (let r = 0; r < COMBAT_ROWS; r++) sx += offsetToPixel({ col: wc, row: r }).x;
  const wallX = sx / COMBAT_ROWS; // x lissé de la colonne (annule le zigzag)
  const yOf = (r: number): number => offsetToPixel({ col: wc, row: r }).y;

  const walled = new Set(walls.map((w) => w.row));
  // Tronçons contigus de rangées murées.
  const runs: [number, number][] = [];
  for (let r = 0; r < COMBAT_ROWS; r++) {
    if (!walled.has(r)) continue;
    const start = r;
    while (r + 1 < COMBAT_ROWS && walled.has(r + 1)) r++;
    runs.push([start, r]);
  }

  // 1) Courtines.
  for (const [a, b] of runs) drawCurtain(g, wallX, yOf(a) - HEX_SIZE * 0.9, yOf(b) + HEX_SIZE * 0.9);
  // 2) Tours aux extrémités de chaque tronçon (jonction + coiffe de la muraille).
  for (const [a, b] of runs) {
    drawTower(g, wallX, yOf(a) - HEX_SIZE * 0.9);
    drawTower(g, wallX, yOf(b) + HEX_SIZE * 0.9);
  }
  // 3) Porte à l'ouverture centrale (si les 2 rangées de porte sont ouvertes).
  const gA = Math.floor(COMBAT_ROWS / 2) - 1;
  const gB = Math.floor(COMBAT_ROWS / 2);
  if (!walled.has(gA) && !walled.has(gB)) drawGate(g, wallX, (yOf(gA) + yOf(gB)) / 2);
  // 4) Dégâts : fissures (usure) / brèche (usure forte) au niveau du segment.
  for (const w of walls) {
    const ratio = maxHp > 0 ? (hp[`${w.col},${w.row}`] ?? maxHp) / maxHp : 1;
    if (ratio >= 1) continue;
    if (ratio > 0.4) drawCracks(g, wallX, yOf(w.row), w.row);
    else drawBreach(g, wallX, yOf(w.row));
  }
}

/** Bande de courtine (blocs d'ashlar + merlons + volume) de `yTop` à `yBot`. */
function drawCurtain(g: Graphics, x: number, yTop: number, yBot: number): void {
  const left = x - HALF_W;
  const w = HALF_W * 2;
  // Corps + volume (bord gauche éclairé, bord droit ombré).
  g.rect(left, yTop, w, yBot - yTop).fill({ color: STONE_BODY });
  g.rect(left, yTop, w * 0.22, yBot - yTop).fill({ color: STONE_LIGHT, alpha: 0.35 });
  g.rect(x + HALF_W * 0.45, yTop, w * 0.28, yBot - yTop).fill({ color: STONE_DARK, alpha: 0.3 });
  // Assises horizontales (joints de mortier) + joints verticaux décalés (appareil).
  const course = HEX_SIZE * 0.42;
  let i = 0;
  for (let y = yTop; y <= yBot; y += course, i++) {
    g.moveTo(left, y).lineTo(left + w, y).stroke({ width: 1.5, color: MORTAR, alpha: 0.8 });
    const off = i % 2 === 0 ? 0 : w / 3;
    for (let jx = left + off; jx < left + w; jx += w / 1.5) {
      g.moveTo(jx, y).lineTo(jx, Math.min(y + course, yBot)).stroke({ width: 1, color: MORTAR, alpha: 0.55 });
    }
  }
  // Mousse déterministe au pied (2ᵉ canal de texture, non aléatoire).
  for (let k = 0; k < 5; k++) {
    const mx = left + ((k * 37) % (w - 6)) + 3;
    g.circle(mx, yBot - (k % 2) * 4 - 2, 2.2).fill({ color: MOSS, alpha: 0.5 });
  }
  // Merlons (créneaux) le long de l'arête haute.
  drawMerlons(g, left, w, yTop);
}

/** Créneaux (merlons + embrasures) sur l'arête haute d'une bande, largeur `w`. */
function drawMerlons(g: Graphics, left: number, w: number, y: number): void {
  const n = Math.max(3, Math.round(w / (HEX_SIZE * 0.5)));
  const step = w / n;
  for (let k = 0; k < n; k++) {
    if (k % 2 === 1) continue; // 1 merlon sur 2 (l'autre = embrasure)
    const mx = left + k * step;
    g.rect(mx, y - CRENEL, step * 0.92, CRENEL + 2).fill({ color: STONE_BODY }).stroke({ width: 1, color: STONE_DARK, alpha: 0.6 });
    g.rect(mx, y - CRENEL, step * 0.3, CRENEL).fill({ color: STONE_LIGHT, alpha: 0.4 });
  }
}

/** Tour cylindrique crénelée centrée en (x,y), coiffe une extrémité de courtine. */
function drawTower(g: Graphics, x: number, y: number): void {
  const h = HEX_SIZE * 1.5;
  const top = y - h / 2;
  // Ombre au sol.
  g.ellipse(x, y + h / 2, TOWER_W * 1.05, TOWER_W * 0.35).fill({ color: DARK_HOLE, alpha: 0.28 });
  // Fût.
  g.roundRect(x - TOWER_W, top, TOWER_W * 2, h, 5).fill({ color: STONE_BODY }).stroke({ width: 1.5, color: STONE_DARK, alpha: 0.7 });
  g.rect(x - TOWER_W, top, TOWER_W * 0.5, h).fill({ color: STONE_LIGHT, alpha: 0.32 }); // face éclairée
  g.rect(x + TOWER_W * 0.4, top, TOWER_W * 0.6, h).fill({ color: STONE_DARK, alpha: 0.32 }); // face ombrée
  // Meurtrière.
  g.rect(x - 2, top + h * 0.3, 4, h * 0.34).fill({ color: DARK_HOLE });
  // Assises.
  for (let y2 = top + HEX_SIZE * 0.42; y2 < top + h; y2 += HEX_SIZE * 0.42) {
    g.moveTo(x - TOWER_W, y2).lineTo(x + TOWER_W, y2).stroke({ width: 1, color: MORTAR, alpha: 0.6 });
  }
  // Couronne crénelée.
  drawMerlons(g, x - TOWER_W, TOWER_W * 2, top);
}

/** Porte de ville à l'ouverture centrale (arche + vantaux de bois + herse). */
function drawGate(g: Graphics, x: number, yc: number): void {
  const h = HEX_SIZE * 2.2;
  const w = HALF_W * 2;
  const top = yc - h / 2;
  const left = x - HALF_W;
  // Piédroit de pierre.
  g.roundRect(left, top, w, h, 4).fill({ color: STONE_BODY }).stroke({ width: 1.5, color: STONE_DARK, alpha: 0.7 });
  g.rect(left, top, w * 0.2, h).fill({ color: STONE_LIGHT, alpha: 0.3 });
  // Baie en arc brisé (sombre).
  const bw = w * 0.6;
  const bx = x - bw / 2;
  const byTop = top + h * 0.22;
  const byBot = top + h * 0.9;
  g.moveTo(bx, byBot)
    .lineTo(bx, byTop)
    .quadraticCurveTo(x, byTop - h * 0.14, bx + bw, byTop)
    .lineTo(bx + bw, byBot)
    .fill({ color: DARK_HOLE });
  // Vantaux de bois cloutés.
  g.rect(bx + 2, byTop + h * 0.06, bw - 4, byBot - byTop - h * 0.06).fill({ color: WOOD });
  g.moveTo(x, byTop + h * 0.06).lineTo(x, byBot).stroke({ width: 2, color: IRON });
  for (let b = 0; b < 3; b++) {
    const by = byTop + h * 0.16 + b * h * 0.22;
    g.rect(bx + 4, by, bw - 8, 3).fill({ color: IRON });
  }
  // Herse (grille) en haut de la baie.
  for (let gx = bx + 6; gx < bx + bw - 4; gx += 8) g.moveTo(gx, byTop).lineTo(gx, byTop + h * 0.12).stroke({ width: 1.5, color: IRON, alpha: 0.8 });
  // Merlons de la guérite.
  drawMerlons(g, left, w, top);
}

/** Fissures rayonnantes (segment entamé) au niveau d'un hex mur. */
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
      px = x + Math.cos(ang) * (len * s) / segs + jitter;
      py = y + Math.sin(ang) * (len * s) / segs;
      g.lineTo(px, py);
    }
    g.stroke({ width: 1.6, color: DARK_HOLE, alpha: 0.85 });
  }
}

/** Brèche (segment presque détruit) : trou sombre + gravats au pied. */
function drawBreach(g: Graphics, x: number, y: number): void {
  drawCracks(g, x, y, 3);
  g.ellipse(x, y, HEX_SIZE * 0.42, HEX_SIZE * 0.5).fill({ color: DARK_HOLE });
  g.ellipse(x, y, HEX_SIZE * 0.42, HEX_SIZE * 0.5).stroke({ width: 2, color: STONE_DARK, alpha: 0.7 });
  // Gravats déterministes.
  const chunks: OffsetPos[] = [];
  for (let k = 0; k < 6; k++) chunks.push({ col: (k * 23) % 40 - 20, row: (k * 13) % 12 });
  for (const c of chunks) {
    g.rect(x + c.col * 0.7, y + HEX_SIZE * 0.5 + c.row, 6, 5).fill({ color: RUBBLE }).stroke({ width: 0.8, color: STONE_DARK, alpha: 0.6 });
  }
}
