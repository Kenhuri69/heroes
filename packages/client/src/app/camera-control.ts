import type { Application } from 'pixi.js';
import type { Camera } from '../render/camera';
import { TILE_SIZE } from '../render/tilemap';

/**
 * Contrôle programmatique de la caméra d'aventure (doc 13 §6.3, lot N3c.1) —
 * utilisé par les cinématiques pour déplacer la vue sur une tuile. Pure
 * présentation : `requestAnimationFrame`/`performance.now` sont autorisés hors
 * du moteur déterministe (guideline §8.2). Enregistrée par `main.ts` à la
 * création de la scène, retirée à sa destruction (retour menu).
 */
let registered: { camera: Camera; app: Application } | null = null;

/** Durée par défaut d'un déplacement caméra (ms) si le pas n'en précise pas. */
export const DEFAULT_PAN_MS = 900;

export function registerCamera(camera: Camera, app: Application): void {
  registered = { camera, app };
}

export function unregisterCamera(): void {
  registered = null;
}

/** Position monde qui centre la tuile (x,y) à l'écran (même formule que `centerOnHero`). */
function targetFor(x: number, y: number, app: Application, scale: number): { x: number; y: number } {
  return {
    x: app.screen.width / 2 - (x + 0.5) * TILE_SIZE * scale,
    y: app.screen.height / 2 - (y + 0.5) * TILE_SIZE * scale,
  };
}

/**
 * Anime la caméra vers la tuile (x,y) en `ms` millisecondes (easing quad in/out).
 * Résout à la fin ; no-op immédiat sans caméra enregistrée. L'animation s'arrête
 * proprement si la caméra est détruite en cours (retour menu).
 */
export function panCameraTo(x: number, y: number, ms: number): Promise<void> {
  const reg = registered;
  if (!reg) return Promise.resolve();
  const { camera, app } = reg;
  const scale = camera.world.scale.x;
  const from = { x: camera.world.position.x, y: camera.world.position.y };
  const to = targetFor(x, y, app, scale);
  if (ms <= 0) {
    camera.world.position.set(to.x, to.y);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = (now: number): void => {
      if (registered !== reg) return resolve(); // caméra détruite en cours
      const p = Math.min(1, (now - start) / ms);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; // easeInOutQuad
      camera.world.position.set(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e);
      if (p < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}
