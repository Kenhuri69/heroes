import { Graphics } from 'pixi.js';
import { TILE_SIZE } from './tilemap';

export interface PreviewStep {
  x: number;
  y: number;
  /** true = atteignable aujourd'hui (point vert), false = jours suivants. */
  today: boolean;
  /** Jour (1-indexé) où ce pas sera franchi, selon l'allocation de PM quotidienne. */
  day: number;
}

const TODAY_COLOR = 0x5fbf5f;
// Jour 2, 3, 4+ : jaune → orange → rouge, pour LIRE le nombre de jours (doc 02 §1.5).
const LATER_COLORS = [0xd9c34a, 0xe08a3c, 0xcf5b4e] as const;

function dayColor(day: number): number {
  if (day <= 1) return TODAY_COLOR;
  return LATER_COLORS[Math.min(day - 2, LATER_COLORS.length - 1)] as number;
}

/** Points colorés par jour, dernier pas en anneau (doc 02 §1.5, 08 §2.1). */
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
