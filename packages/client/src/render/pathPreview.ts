import { Graphics } from 'pixi.js';
import { TILE_SIZE } from './tilemap';

export interface PreviewStep {
  x: number;
  y: number;
  /** true = atteignable aujourd'hui (point vert), false = jours suivants (jaune). */
  today: boolean;
}

const TODAY_COLOR = 0x5fbf5f;
const LATER_COLOR = 0xd9c34a;

/** Points verts/jaunes du chemin prévisualisé, dernier pas en anneau (doc 02 §1.5, 08 §2.1). */
export class PathPreview {
  readonly graphics = new Graphics();

  show(steps: readonly PreviewStep[]): void {
    this.graphics.clear();
    for (const [i, step] of steps.entries()) {
      const px = step.x * TILE_SIZE + TILE_SIZE / 2;
      const py = step.y * TILE_SIZE + TILE_SIZE / 2;
      const color = step.today ? TODAY_COLOR : LATER_COLOR;
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
