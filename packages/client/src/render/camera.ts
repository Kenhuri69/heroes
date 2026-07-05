import { Application, Container, FederatedPointerEvent, Point } from 'pixi.js';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;

/** Bornes de zoom personnalisées (par défaut : celles de la carte d'aventure). */
export interface CameraOptions {
  minZoom?: number;
  maxZoom?: number;
}

/**
 * Caméra touch-first (doc 08 §1) : pan à un doigt / drag souris,
 * pinch-zoom à deux doigts, molette. Le monde est un Container transformé ;
 * les scènes ajoutent leur contenu à `world`.
 */
export class Camera {
  readonly world = new Container();
  private readonly pointers = new Map<number, Point>();
  private pinchDist = 0;
  private readonly minZoom: number;
  private readonly maxZoom: number;
  /** Désactivée pendant le combat (remédiation U1) : la caméra de combat prend la main sur `app.stage`. */
  private enabled = true;

  constructor(private readonly app: Application, opts: CameraOptions = {}) {
    this.minZoom = opts.minZoom ?? MIN_ZOOM;
    this.maxZoom = opts.maxZoom ?? MAX_ZOOM;
    const stage = app.stage;
    stage.eventMode = 'static';
    stage.hitArea = app.screen;
    stage.on('pointerdown', this.onDown);
    stage.on('pointermove', this.onMove);
    stage.on('pointerup', this.onUp);
    stage.on('pointerupoutside', this.onUp);
    app.canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  /** Active/désactive les gestes (pan/pinch/molette) — remédiation U1 (bascule aventure ↔ combat). */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Retire les listeners (stage + molette) et détruit le monde — remédiation CL1. */
  destroy(): void {
    const stage = this.app.stage;
    stage.off('pointerdown', this.onDown);
    stage.off('pointermove', this.onMove);
    stage.off('pointerup', this.onUp);
    stage.off('pointerupoutside', this.onUp);
    this.app.canvas.removeEventListener('wheel', this.onWheel);
    this.world.destroy({ children: true });
  }

  private onDown = (e: FederatedPointerEvent): void => {
    if (!this.enabled) return;
    this.pointers.set(e.pointerId, e.global.clone());
    if (this.pointers.size === 2) this.pinchDist = this.pinchDistance();
  };

  private onMove = (e: FederatedPointerEvent): void => {
    if (!this.enabled) return;
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    if (this.pointers.size === 1) {
      this.world.x += e.global.x - prev.x;
      this.world.y += e.global.y - prev.y;
    }
    this.pointers.set(e.pointerId, e.global.clone());
    if (this.pointers.size === 2) {
      const dist = this.pinchDistance();
      if (this.pinchDist > 0) this.zoomAt(this.pinchCenter(), dist / this.pinchDist);
      this.pinchDist = dist;
    }
  };

  private onUp = (e: FederatedPointerEvent): void => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinchDist = 0;
  };

  private onWheel = (e: WheelEvent): void => {
    if (!this.enabled) return;
    e.preventDefault();
    this.zoomAt(new Point(e.offsetX, e.offsetY), e.deltaY < 0 ? 1.1 : 1 / 1.1);
  };

  /** Zoom multiplicatif centré sur un point écran (le point reste sous le geste). */
  private zoomAt(screen: Point, factor: number): void {
    const next = Math.min(this.maxZoom, Math.max(this.minZoom, this.world.scale.x * factor));
    if (next === this.world.scale.x) return;
    const local = this.world.toLocal(screen);
    this.world.scale.set(next);
    const after = this.world.toGlobal(local);
    this.world.x += screen.x - after.x;
    this.world.y += screen.y - after.y;
  }

  private pinchDistance(): number {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return 0;
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  private pinchCenter(): Point {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return new Point();
    return new Point((a.x + b.x) / 2, (a.y + b.y) / 2);
  }
}
