import { Container, Graphics, Text } from 'pixi.js';
import { isoTileCenter } from './projection';

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

/**
 * Points colorés par jour du chemin prévisualisé, dernier pas en anneau
 * (doc 02 §1.5, 08 §2.1). Lot M2 (A5) : sur un chemin de plusieurs jours, le
 * dernier pas de CHAQUE journée porte une étiquette numérique (« J2 »…) — la
 * couleur n'est plus le seul canal. Le libellé est fourni par la scène
 * (`dayLabel`) : le module de rendu ne dépend pas d'i18n.
 */
export class PathPreview {
  readonly container = new Container();
  private readonly graphics = new Graphics();
  private readonly labels = new Container();

  constructor() {
    this.container.addChild(this.graphics, this.labels);
  }

  show(steps: readonly PreviewStep[], dayLabel: (day: number) => string): void {
    this.clear();
    const multiDay = (steps[steps.length - 1]?.day ?? 1) > 1;
    for (const [i, step] of steps.entries()) {
      const { x: px, y: py } = isoTileCenter(step.x, step.y);
      const color = dayColor(step.day);
      const last = i === steps.length - 1;
      // Ellipses (2:1) : marqueurs « au sol » cohérents avec la projection iso.
      if (last) {
        this.graphics.ellipse(px, py, 14, 7).stroke({ width: 5, color });
      } else {
        this.graphics.ellipse(px, py, 7, 3.5).fill(color);
      }
      // Point d'arrêt de la journée (dernier pas du jour N) : étiquette chiffrée.
      const dayEnd = last || steps[i + 1]?.day !== step.day;
      if (multiDay && dayEnd) {
        const text = new Text({
          text: dayLabel(step.day),
          style: {
            fontFamily: 'system-ui, sans-serif',
            fontSize: 13,
            fontWeight: '700',
            fill: 0xffffff,
            stroke: { color: 0x101218, width: 3 },
          },
        });
        text.anchor.set(0.5, 1);
        text.position.set(px, py - 6);
        this.labels.addChild(text);
      }
    }
  }

  clear(): void {
    this.graphics.clear();
    // `destroy` des textes : libère leurs textures (pas seulement le détachement).
    for (const child of [...this.labels.children]) child.destroy();
  }
}
