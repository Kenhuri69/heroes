import { Sprite, Texture } from 'pixi.js';
import type { AdventureMapDef, GridPos } from '@heroes/engine';
import { TILE_SIZE } from './tilemap';

const UNEXPLORED = [10, 11, 16, 255] as const; // noir opaque
const EXPLORED_DIM = [10, 11, 16, 115] as const; // grisé hors vision

/**
 * Brouillard 2 états (doc 02 §2.1) : texture 1 px/tuile étirée en NEAREST,
 * mise à jour incrémentale (doc 07 §6). Le « hors vision » est dérivé des
 * positions courantes des héros du joueur — l'exploré vient de l'état moteur.
 */
export class FogOverlay {
  readonly sprite: Sprite;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly texture: Texture;

  constructor(private readonly map: AdventureMapDef) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = map.width;
    this.canvas.height = map.height;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d indisponible');
    this.ctx = ctx;
    this.texture = Texture.from(this.canvas);
    this.texture.source.scaleMode = 'nearest';
    this.sprite = new Sprite(this.texture);
    this.sprite.scale.set(TILE_SIZE);
  }

  update(explored: readonly number[], heroPositions: readonly GridPos[], visionRadius: number): void {
    const { width, height } = this.map;
    const image = this.ctx.createImageData(width, height);
    for (let i = 0; i < width * height; i++) {
      const x = i % width;
      const y = Math.floor(i / width);
      const inVision = heroPositions.some(
        (p) => Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) <= visionRadius,
      );
      const rgba = inVision ? null : explored[i] ? EXPLORED_DIM : UNEXPLORED;
      if (rgba) image.data.set(rgba, i * 4);
    }
    this.ctx.putImageData(image, 0, 0);
    this.texture.source.update();
  }
}
