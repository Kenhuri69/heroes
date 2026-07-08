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

const LONG_PRESS_MS = 450;

/**
 * Détection d'appui long (doc 08 §2.1 « appui long = fiche », lot M2) : un seul
 * pointeur maintenu ~450 ms sans bouger — annulé par un déplacement (pan), un
 * second doigt (pinch) ou une relâche anticipée (qui redevient un tap normal).
 * Souris ET tactile (parité doc 08 §1.1). Même symétrie de désabonnement
 * qu'`onTap`.
 */
export function onLongPress(app: Application, handler: (global: Point) => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let downId: number | null = null;
  let downPos = new Point();

  const cancel = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    downId = null;
  };

  const onDown = (e: FederatedPointerEvent): void => {
    if (downId !== null) {
      cancel(); // second pointeur : pinch, pas un appui long
      return;
    }
    downId = e.pointerId;
    downPos = e.global.clone();
    timer = setTimeout(() => {
      timer = null;
      downId = null;
      handler(downPos.clone());
    }, LONG_PRESS_MS);
  };

  const onMove = (e: FederatedPointerEvent): void => {
    if (e.pointerId !== downId) return;
    const dist = Math.hypot(e.global.x - downPos.x, e.global.y - downPos.y);
    if (dist > TAP_MAX_DISTANCE) cancel();
  };

  const release = (e: FederatedPointerEvent): void => {
    if (e.pointerId === downId) cancel();
  };

  app.stage.on('pointerdown', onDown);
  app.stage.on('pointermove', onMove);
  app.stage.on('pointerup', release);
  app.stage.on('pointerupoutside', release);
  return () => {
    cancel();
    app.stage.off('pointerdown', onDown);
    app.stage.off('pointermove', onMove);
    app.stage.off('pointerup', release);
    app.stage.off('pointerupoutside', release);
  };
}
