import { Container, Graphics } from 'pixi.js';
import type { AdventureMapDef, GridPos } from '@heroes/engine';
import { isoDiamond } from './projection';
import { CHUNK, chunkBounds, type WorldRect } from './tilemap';

const UNEXPLORED = 0x0a0b10; // noir opaque
const DIM = 0x0a0b10; // grisé hors vision (même teinte, alpha réduit)
const DIM_ALPHA = 0.55;

interface FogChunk {
  gfx: Graphics;
  bounds: WorldRect;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Brouillard 2 états projeté en **isométrie** (Lot A1, doc 02 §2.1) : chaque tuile
 * hors vision est un losange assombri (opaque = inexploré, semi = exploré hors
 * vision) ; les tuiles en vision restent transparentes.
 *
 * Perf (F1, revue 2026-07) — deux garde-fous alignés sur le chunking de `Tilemap` :
 * - **Mémo** : `update` ne redessine que si `explored` (référence — l'état moteur
 *   est immuable) ou `sightings` (contenu) ont changé. Un setState purement UI ne
 *   retessèle plus O(W×H) losanges.
 * - **Chunks culés** : un `Graphics` par chunk de {@link CHUNK}² tuiles ; la scène
 *   appelle {@link updateVisibility} avec le même viewport que la tilemap — le GPU
 *   ne reçoit plus la géométrie plein-carte à chaque frame sur les grandes cartes.
 */
export class FogOverlay {
  readonly graphics = new Container();
  private readonly chunks: FogChunk[] = [];
  private lastExplored: readonly number[] | null = null;
  private lastSightings: { pos: GridPos; radius: number }[] = [];

  constructor(private readonly map: AdventureMapDef) {
    for (let cy = 0; cy < map.height; cy += CHUNK) {
      for (let cx = 0; cx < map.width; cx += CHUNK) {
        const x1 = Math.min(cx + CHUNK - 1, map.width - 1);
        const y1 = Math.min(cy + CHUNK - 1, map.height - 1);
        const gfx = new Graphics();
        this.graphics.addChild(gfx);
        this.chunks.push({ gfx, bounds: chunkBounds(cx, cy, x1, y1), x0: cx, y0: cy, x1, y1 });
      }
    }
  }

  /**
   * `sightings` : une entrée par héros du joueur + son rayon de vision EFFECTIF
   * (config.visionRadius + bonus Recherche) — le « hors vision » doit matcher la
   * révélation moteur, qui est PAR héros (C4).
   */
  update(explored: readonly number[], sightings: readonly { pos: GridPos; radius: number }[]): void {
    if (explored === this.lastExplored && sameSightings(this.lastSightings, sightings)) return;
    this.lastExplored = explored;
    this.lastSightings = sightings.map((s) => ({ pos: { ...s.pos }, radius: s.radius }));
    const { width } = this.map;
    for (const chunk of this.chunks) {
      chunk.gfx.clear();
      for (let y = chunk.y0; y <= chunk.y1; y++) {
        for (let x = chunk.x0; x <= chunk.x1; x++) {
          const inVision = sightings.some(
            (s) => Math.max(Math.abs(s.pos.x - x), Math.abs(s.pos.y - y)) <= s.radius,
          );
          if (inVision) continue;
          const diamond = isoDiamond(x, y);
          if (explored[y * width + x]) chunk.gfx.poly(diamond).fill({ color: DIM, alpha: DIM_ALPHA });
          else chunk.gfx.poly(diamond).fill(UNEXPLORED);
        }
      }
    }
  }

  /** Masque les chunks de brouillard hors viewport (même AABB que la tilemap). */
  updateVisibility(view: WorldRect): void {
    for (const c of this.chunks) {
      c.gfx.visible =
        c.bounds.maxX >= view.minX &&
        c.bounds.minX <= view.maxX &&
        c.bounds.maxY >= view.minY &&
        c.bounds.minY <= view.maxY;
    }
  }
}

function sameSightings(
  a: readonly { pos: GridPos; radius: number }[],
  b: readonly { pos: GridPos; radius: number }[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.pos.x !== y.pos.x || x.pos.y !== y.pos.y || x.radius !== y.radius) return false;
  }
  return true;
}
