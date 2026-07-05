import { Application, Container, Graphics, Point } from 'pixi.js';
import {
  hexDistance,
  hexNeighbors,
  inCombatBounds,
  sameHex,
  canShoot,
  estimateDamage,
  reachableHexes,
  type CombatActionInput,
  type CombatSideId,
  type CombatStack,
  type CombatState,
  type GameState,
  type OffsetPos,
} from '@heroes/engine';
import { appStore } from '../../app/store';
import { dispatch } from '../../app/dispatch';
import { eventBus, type AppEvent } from '../../app/events';
import { onTap } from '../../input/pointer';
import { HEX_SIZE, computeBoardBounds, drawBoard, hexKey, offsetToPixel, pixelToOffset } from '../../render/hexgrid';
import { combatPreview } from './preview';

const ATTACKER_COLOR = 0xc0392b;
const DEFENDER_COLOR = 0x2e6da4;
const TOKEN_RADIUS = HEX_SIZE * 0.62;
const ACTIVE_RING_COLOR = 0xf1c40f;

// Durées de base (ms) à vitesse ×1 — divisées par `combatSpeed` (doc 08 §2.4).
const MOVE_MS_PER_HEX = 140;
const ATTACK_LUNGE_MS = 220;
const DEATH_FADE_MS = 260;

const MARGIN_TOP = 96; // bandeau armées + round (doc 08 §2.4)
const MARGIN_BOTTOM = 96; // barre d'actions
const MARGIN_SIDE = 16;
const MAX_SCALE = 1.5;

/** Sélection tap-tap en attente de confirmation. */
type Selection =
  | { kind: 'move'; to: OffsetPos }
  | { kind: 'attack'; targetStackId: string; from?: OffsetPos };

/**
 * Scène de combat hex (doc 08 §2.4, doc 10 §5.5) : rend l'état
 * `appStore.getState().game.combat`, anime depuis `eventBus`, gère
 * l'interaction tap-tap de la pile active du camp joueur. Les appels au
 * moteur (estimateDamage/reachableHexes/canShoot) sont encapsulés en
 * try/catch : le lot A (règles) livre son implémentation en parallèle, les
 * stubs actuels lèvent — ça ne doit jamais faire planter la scène.
 */
export class CombatScene {
  readonly container = new Container();
  private readonly boardLayer = new Container();
  private readonly boardGfx = new Graphics();
  private readonly stacksLayer = new Container();
  private readonly activeRing: Graphics;
  private readonly stackTokens = new Map<string, Graphics>();
  private readonly animatingIds = new Set<string>();

  private selection: Selection | null = null;
  private queue: Promise<void> = Promise.resolve();
  private destroyed = false;

  private readonly resizeObserver: ResizeObserver;
  private readonly unsubscribeStore: () => void;
  private readonly unsubscribeEvents: () => void;
  private readonly unsubscribeTap: () => void;

  constructor(private readonly app: Application) {
    this.boardLayer.addChild(this.boardGfx, this.stacksLayer);
    this.container.addChild(this.boardLayer);

    this.activeRing = new Graphics()
      .circle(0, 0, TOKEN_RADIUS + 6)
      .stroke({ width: 3, color: ACTIVE_RING_COLOR });
    this.activeRing.visible = false;
    this.stacksLayer.addChild(this.activeRing);

    this.resizeObserver = new ResizeObserver(() => this.layout());
    this.resizeObserver.observe(app.canvas);

    this.unsubscribeStore = appStore.subscribe(() => this.sync());
    this.unsubscribeEvents = eventBus.on((event) => this.onEvent(event));
    this.unsubscribeTap = onTap(app, (global) => void this.handleTap(global));

    this.layout();
    this.sync();
  }

  destroy(): void {
    this.destroyed = true;
    this.unsubscribeStore();
    this.unsubscribeEvents();
    this.unsubscribeTap(); // remédiation CL2 : les 3 listeners de tap ne fuient plus
    this.resizeObserver.disconnect();
    this.container.destroy({ children: true });
  }

  // ——— Layout ———

  private layout(): void {
    const bounds = computeBoardBounds();
    const availW = Math.max(1, this.app.screen.width - MARGIN_SIDE * 2);
    const availH = Math.max(1, this.app.screen.height - MARGIN_TOP - MARGIN_BOTTOM);
    const scale = Math.min(availW / bounds.width, availH / bounds.height, MAX_SCALE);
    this.boardLayer.scale.set(scale);
    this.boardLayer.position.set(
      MARGIN_SIDE + (availW - bounds.width * scale) / 2 - bounds.minX * scale,
      MARGIN_TOP + (availH - bounds.height * scale) / 2 - bounds.minY * scale,
    );
  }

  // ——— Resync depuis le store (réconciliation simple, doc 10 §2.2) ———

  private sync(): void {
    if (this.destroyed) return;
    const combat = appStore.getState().game.combat;
    if (!combat) {
      this.selection = null;
      combatPreview.set(null);
      this.boardGfx.clear();
      for (const [id, token] of this.stackTokens) {
        if (this.animatingIds.has(id)) continue;
        token.destroy();
        this.stackTokens.delete(id);
      }
      this.activeRing.visible = false;
      return;
    }
    this.syncStacks(combat);
    this.redrawBoard();
  }

  private syncStacks(combat: CombatState): void {
    const alive = new Set(combat.stacks.map((s) => s.id));
    for (const [id, token] of this.stackTokens) {
      if (alive.has(id) || this.animatingIds.has(id)) continue;
      token.destroy();
      this.stackTokens.delete(id);
    }
    for (const stack of combat.stacks) {
      let token = this.stackTokens.get(stack.id);
      if (!token) {
        token = buildStackToken(stack.side);
        this.stacksLayer.addChild(token);
        this.stackTokens.set(stack.id, token);
      }
      if (!this.animatingIds.has(stack.id)) {
        const { x, y } = offsetToPixel(stack.pos);
        token.position.set(x, y);
      }
    }
    this.highlightActive(combat);
  }

  private highlightActive(combat: CombatState): void {
    const token = combat.activeStackId ? this.stackTokens.get(combat.activeStackId) : undefined;
    if (token) {
      this.activeRing.visible = true;
      this.activeRing.position.copyFrom(token.position);
      this.stacksLayer.addChild(this.activeRing); // reste au-dessus
    } else {
      this.activeRing.visible = false;
    }
  }

  private redrawBoard(): void {
    const game = appStore.getState().game;
    const combat = game.combat;
    this.boardGfx.clear();
    if (!combat) return;

    const active = combat.stacks.find((s) => s.id === combat.activeStackId);
    const isPlayerTurn = !!active && active.side === combat.playerSide && !combat.finished;

    let reachable: OffsetPos[] = [];
    const attackableIds = new Set<string>();
    if (isPlayerTurn && active) {
      try {
        reachable = reachableHexes(game, active.id);
      } catch {
        reachable = [];
      }
      let ranged = false;
      try {
        ranged = canShoot(game, active.id);
      } catch {
        ranged = false;
      }
      const reachSet = new Set(reachable.map(hexKey));
      for (const s of combat.stacks) {
        if (s.side === active.side) continue;
        const adjacent =
          hexDistance(active.pos, s.pos) === 1 ||
          hexNeighbors(s.pos).some((p) => reachSet.has(hexKey(p)));
        if (ranged || adjacent) attackableIds.add(s.id);
      }
    }
    const attackableHexes = new Set(
      combat.stacks.filter((s) => attackableIds.has(s.id)).map((s) => hexKey(s.pos)),
    );

    drawBoard(this.boardGfx, {
      reachable: new Set(reachable.map(hexKey)),
      attackable: attackableHexes,
      obstacles: new Set(combat.obstacles.map(hexKey)),
      selected: this.selectionHex(combat),
    });
  }

  private selectionHex(combat: CombatState): OffsetPos | null {
    const selection = this.selection;
    if (!selection) return null;
    if (selection.kind === 'move') return selection.to;
    const target = combat.stacks.find((s) => s.id === selection.targetStackId);
    return target?.pos ?? null;
  }

  // ——— Interaction tap-tap (doc 08 §1, §2.4) ———

  private async handleTap(global: Point): Promise<void> {
    if (this.destroyed) return;
    const game = appStore.getState().game;
    const combat = game.combat;
    if (!combat || combat.finished) return;
    const active = combat.stacks.find((s) => s.id === combat.activeStackId);
    if (!active || active.side !== combat.playerSide) return; // pas le tour du joueur

    const local = this.boardLayer.toLocal(global);
    const hex = pixelToOffset(local.x, local.y);
    if (!inCombatBounds(hex)) {
      this.clearSelection();
      return;
    }

    const targetStack = combat.stacks.find((s) => sameHex(s.pos, hex) && s.side !== active.side);
    if (targetStack) {
      await this.handleAttackTap(game, active, targetStack);
      return;
    }

    let reachable: OffsetPos[] = [];
    try {
      reachable = reachableHexes(game, active.id);
    } catch {
      reachable = [];
    }
    if (!reachable.some((p) => sameHex(p, hex))) {
      this.clearSelection();
      return;
    }

    if (this.selection?.kind === 'move' && sameHex(this.selection.to, hex)) {
      this.clearSelection();
      try {
        await dispatch({ type: 'CombatAction', action: { type: 'move', to: hex } });
      } catch {
        /* moteur non implémenté (lot A en cours) : pas de crash côté scène */
      }
      return;
    }

    this.selection = { kind: 'move', to: hex };
    combatPreview.set(null);
    this.redrawBoard();
  }

  private async handleAttackTap(
    game: GameState,
    active: CombatStack,
    target: CombatStack,
  ): Promise<void> {
    if (this.selection?.kind === 'attack' && this.selection.targetStackId === target.id) {
      const from = this.selection.from;
      this.clearSelection();
      const action: CombatActionInput = from
        ? { type: 'attack', targetStackId: target.id, from }
        : { type: 'attack', targetStackId: target.id };
      try {
        await dispatch({ type: 'CombatAction', action });
      } catch {
        /* moteur non implémenté (lot A en cours) : pas de crash côté scène */
      }
      return;
    }

    let ranged = false;
    try {
      ranged = canShoot(game, active.id);
    } catch {
      ranged = false;
    }
    const from = ranged ? undefined : this.resolveMeleeFrom(game, active, target);
    this.selection = from
      ? { kind: 'attack', targetStackId: target.id, from }
      : { kind: 'attack', targetStackId: target.id };

    try {
      const estimate = estimateDamage(game, active.id, target.id);
      combatPreview.set({ attackerId: active.id, targetId: target.id, ...estimate });
    } catch {
      combatPreview.set(null); // pas de préview possible (lot A en cours) — pas de crash
    }
    this.redrawBoard();
  }

  /** Hex atteignable adjacent à la cible le plus proche de la pile active (mêlée). */
  private resolveMeleeFrom(
    game: GameState,
    active: CombatStack,
    target: CombatStack,
  ): OffsetPos | undefined {
    if (hexDistance(active.pos, target.pos) === 1) return active.pos;
    let reachable: OffsetPos[] = [];
    try {
      reachable = reachableHexes(game, active.id);
    } catch {
      reachable = [];
    }
    const reachSet = new Set(reachable.map(hexKey));
    const candidates = hexNeighbors(target.pos).filter((p) => reachSet.has(hexKey(p)));
    if (candidates.length === 0) return undefined;
    return candidates.reduce((best, c) =>
      hexDistance(active.pos, c) < hexDistance(active.pos, best) ? c : best,
    );
  }

  private clearSelection(): void {
    this.selection = null;
    combatPreview.set(null);
    this.redrawBoard();
  }

  // ——— Animations depuis les événements moteur (doc 07 §3) ———

  private onEvent(event: AppEvent): void {
    this.queue = this.queue.then(() => this.animateEvent(event));
  }

  private async animateEvent(event: AppEvent): Promise<void> {
    if (this.destroyed) return;
    const speed = appStore.getState().combatSpeed;
    switch (event.type) {
      case 'CombatRoundStarted':
      case 'CombatTurnStarted': {
        const combat = appStore.getState().game.combat;
        if (combat) this.highlightActive(combat);
        return;
      }
      case 'StackMoved':
        await this.animateMove(event.stackId, event.from, event.to, speed);
        return;
      case 'StackAttacked':
        await this.animateAttack(event.attackerId, event.targetId, speed);
        return;
      case 'StackDied':
        await this.animateDeath(event.stackId, speed);
        return;
      default:
        return;
    }
  }

  private async animateMove(
    stackId: string,
    from: OffsetPos,
    to: OffsetPos,
    speed: number,
  ): Promise<void> {
    const token = this.stackTokens.get(stackId);
    if (!token) return;
    const start = offsetToPixel(from);
    const end = offsetToPixel(to);
    const duration = (MOVE_MS_PER_HEX * Math.max(1, hexDistance(from, to))) / speed;
    this.animatingIds.add(stackId);
    await tween(duration, (t) => {
      token.position.set(start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t);
    });
    this.animatingIds.delete(stackId);
  }

  private async animateAttack(attackerId: string, targetId: string, speed: number): Promise<void> {
    const attacker = this.stackTokens.get(attackerId);
    if (!attacker) return;
    const target = this.stackTokens.get(targetId);
    const origin = new Point(attacker.position.x, attacker.position.y);
    const dest = target ? target.position : origin;
    const mid = new Point(
      origin.x + (dest.x - origin.x) * 0.35,
      origin.y + (dest.y - origin.y) * 0.35,
    );
    const half = ATTACK_LUNGE_MS / 2 / speed;
    this.animatingIds.add(attackerId);
    await tween(half, (t) => {
      attacker.position.set(origin.x + (mid.x - origin.x) * t, origin.y + (mid.y - origin.y) * t);
    });
    if (target) target.tint = 0xff6666;
    await tween(half, (t) => {
      attacker.position.set(mid.x + (origin.x - mid.x) * t, mid.y + (origin.y - mid.y) * t);
    });
    attacker.position.set(origin.x, origin.y);
    if (target) target.tint = 0xffffff;
    this.animatingIds.delete(attackerId);
  }

  private async animateDeath(stackId: string, speed: number): Promise<void> {
    const token = this.stackTokens.get(stackId);
    if (!token) return;
    this.animatingIds.add(stackId);
    await tween(DEATH_FADE_MS / speed, (t) => {
      token.alpha = 1 - t;
    });
    this.animatingIds.delete(stackId);
    token.destroy();
    this.stackTokens.delete(stackId);
  }
}

/** Vignette placeholder par pile — forme distincte par camp, jamais de texte (doc 08 §5). */
function buildStackToken(side: CombatSideId): Graphics {
  const g = new Graphics();
  if (side === 'attacker') {
    g.poly([
      TOKEN_RADIUS,
      0,
      -TOKEN_RADIUS * 0.7,
      -TOKEN_RADIUS * 0.8,
      -TOKEN_RADIUS * 0.7,
      TOKEN_RADIUS * 0.8,
    ])
      .fill(ATTACKER_COLOR)
      .stroke({ width: 2, color: 0x1a1c22 });
  } else {
    g.regularPoly(0, 0, TOKEN_RADIUS, 4, Math.PI / 4)
      .fill(DEFENDER_COLOR)
      .stroke({ width: 2, color: 0x1a1c22 });
  }
  return g;
}

function tween(durationMs: number, onProgress: (t: number) => void): Promise<void> {
  if (durationMs <= 0) {
    onProgress(1);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (): void => {
      const t = Math.min(1, (performance.now() - start) / durationMs);
      onProgress(t);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    step();
  });
}
