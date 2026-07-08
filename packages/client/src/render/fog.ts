import { Graphics } from 'pixi.js';
import type { AdventureMapDef, GridPos } from '@heroes/engine';
import { isoDiamond } from './projection';

const UNEXPLORED = 0x0a0b10; // noir opaque
const DIM = 0x0a0b10; // grisé hors vision (même teinte, alpha réduit)
const DIM_ALPHA = 0.55;

/**
 * Brouillard 2 états projeté en **isométrie** (Lot A1, doc 02 §2.1) : chaque tuile
 * hors vision est un losange assombri (opaque = inexploré, semi = exploré hors
 * vision) ; les tuiles en vision restent transparentes. Redessiné à chaque
 * resync (changement d'état, pas par frame) — `Graphics` retenu, coût négligeable.
 */
export class FogOverlay {
  readonly graphics = new Graphics();

  constructor(private readonly map: AdventureMapDef) {}

  /**
   * `sightings` : une entrée par héros du joueur + son rayon de vision EFFECTIF
   * (config.visionRadius + bonus Recherche) — le « hors vision » doit matcher la
   * révélation moteur, qui est PAR héros (C4).
   */
  update(explored: readonly number[], sightings: readonly { pos: GridPos; radius: number }[]): void {
    const { width, height } = this.map;
    this.graphics.clear();
    for (let i = 0; i < width * height; i++) {
      const x = i % width;
      const y = Math.floor(i / width);
      const inVision = sightings.some(
        (s) => Math.max(Math.abs(s.pos.x - x), Math.abs(s.pos.y - y)) <= s.radius,
      );
      if (inVision) continue;
      const diamond = isoDiamond(x, y);
      if (explored[i]) this.graphics.poly(diamond).fill({ color: DIM, alpha: DIM_ALPHA });
      else this.graphics.poly(diamond).fill(UNEXPLORED);
    }
  }
}
