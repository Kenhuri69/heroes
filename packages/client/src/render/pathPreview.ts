import { Graphics } from 'pixi.js';
import { TILE_SIZE } from './tilemap';

export interface PreviewStep {
  x: number;
  y: number;
  /** Jour d'arrivée sur ce pas : 1 = aujourd'hui, 2 = demain, … (doc 02 §1.5, C5). */
  day: number;
}

// Vert (jour 1) → jaune (jour 2) → orange (jour 3+) : le « compte de jours » du
// chemin (doc 02:76) est lisible à la couleur des points.
const DAY_COLORS = [0x5fbf5f, 0xd9c34a, 0xe08a3c] as const;
function dayColor(day: number): number {
  return DAY_COLORS[Math.min(Math.max(day, 1) - 1, DAY_COLORS.length - 1)] as number;
}

/** Points colorés par jour du chemin prévisualisé, dernier pas en anneau (doc 02 §1.5, 08 §2.1). */
export class PathPreview {
  readonly graphics = new Graphics();

  show(steps: readonly PreviewStep[]): void {
    this.graphics.clear();
    for (const [i, step] of steps.entries()) {
      const px = step.x * TILE_SIZE + TILE_SIZE / 2;
      const py = step.y * TILE_SIZE + TILE_SIZE / 2;
      const color = dayColor(step.day);
      if (i === steps.length - 1) {
        this.graphics.circle(px, py, 14).stroke({ width: 5, color });
      } else {
        this.graphics.circle(px, py, 7).fill(color);
      }
    }
  }

  clear(): void {
    this.graphics.clear();
  }
}
