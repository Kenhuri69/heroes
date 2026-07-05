import { Application, FederatedPointerEvent, Point } from 'pixi.js';

// Distinction tap vs drag (doc 10 §5.1) : sous ces seuils, le geste est un tap
// remonté à la scène ; au-delà, c'est un pan consommé par la caméra.
const TAP_MAX_DISTANCE = 8;
const TAP_MAX_MS = 250;

/**
 * Détection de tap touch-first (doc 08 §1) : un seul pointeur, peu de
 * mouvement, relâché vite. Le pan/pinch de la caméra reste indépendant.
 * Retourne une fonction de désabonnement (symétrie `eventBus.on`) — sans elle,
 * chaque scène recréée fuitait ses 3 listeners sur `app.stage` (remédiation CL2).
 */
export function onTap(app: Application, handler: (global: Point) => void): () => void {
  let downId: number | null = null;
  let downAt = 0;
  let downPos = new Point();
  let multiTouch = false;
  let pointers = 0;

  const onDown = (e: FederatedPointerEvent): void => {
    pointers += 1;
    if (pointers > 1) {
      multiTouch = true;
      return;
    }
    multiTouch = false;
    downId = e.pointerId;
    downAt = performance.now();
    downPos = e.global.clone();
  };

  const release = (e: FederatedPointerEvent): void => {
    pointers = Math.max(0, pointers - 1);
    if (e.pointerId !== downId) return;
    downId = null;
    if (multiTouch) return;
    const dist = Math.hypot(e.global.x - downPos.x, e.global.y - downPos.y);
    if (dist <= TAP_MAX_DISTANCE && performance.now() - downAt <= TAP_MAX_MS) {
      handler(e.global.clone());
    }
  };

  app.stage.on('pointerdown', onDown);
  app.stage.on('pointerup', release);
  app.stage.on('pointerupoutside', release);
  return () => {
    app.stage.off('pointerdown', onDown);
    app.stage.off('pointerup', release);
    app.stage.off('pointerupoutside', release);
  };
}
