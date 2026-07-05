import { Application, Container, Graphics, Point } from 'pixi.js';
import {
  findPath,
  samePos,
  stepCost,
  type EngineResult,
  type GridPos,
  type GuardianObjectDef,
} from '@heroes/engine';
import { appStore } from '../../app/store';
import { dispatch } from '../../app/dispatch';
import { humanId, humanHeroes, resolveSelectedHero } from '../../app/game';
import type { Camera } from '../../render/camera';
import { Tilemap, TILE_SIZE } from '../../render/tilemap';
import { MapObjectsLayer } from '../../render/mapObjects';
import { FogOverlay } from '../../render/fog';
import { buildHeroSprite } from '../../render/heroSprite';
import { PathPreview, type PreviewStep } from '../../render/pathPreview';
import { onTap } from '../../input/pointer';

const PLAYER_COLOR = 0xc0392b;
const STEP_ANIMATION_MS = 110;

/**
 * Scène carte d'aventure : rendu depuis l'état moteur, animations depuis les
 * événements (doc 07 §3), interaction tap-tap (doc 08 §2.1) — 1er tap =
 * prévisualisation du chemin avec jours, 2ᵉ tap sur la même tuile = exécution.
 */
export class AdventureScene {
  readonly container = new Container();
  private readonly objects = new MapObjectsLayer();
  private readonly fog: FogOverlay;
  private readonly preview = new PathPreview();
  private readonly heroesLayer = new Container();
  private readonly heroSprites = new Map<string, Graphics>();
  /** Anneau de sélection (doc 08 §2.1, accessibilité A5 — pas la couleur seule). */
  private readonly selectionRing = new Graphics()
    .circle(TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE * 0.6)
    .stroke({ width: 3, color: 0xf1c40f });
  private previewTarget: { target: GridPos; path: GridPos[] } | null = null;
  private animatingHeroId: string | null = null;
  private destroyed = false;
  private readonly unsubscribeStore: () => void;
  private readonly unsubscribeTap: () => void;

  constructor(
    app: Application,
    private readonly camera: Camera,
  ) {
    const { map } = appStore.getState().game;
    if (!map) throw new Error('AdventureScene requiert une partie démarrée');

    const tilemap = new Tilemap(app.renderer, map);
    this.fog = new FogOverlay(map);
    this.selectionRing.visible = false;
    this.heroesLayer.addChild(this.selectionRing);
    this.container.addChild(
      tilemap.container,
      this.objects.container,
      this.preview.graphics,
      this.heroesLayer,
      this.fog.sprite,
    );

    this.unsubscribeStore = appStore.subscribe(() => this.sync());
    this.unsubscribeTap = onTap(app, (global) => void this.handleTap(global));
    this.sync();
  }

  /**
   * Détruit la scène (remédiation CL1) : coupe l'abonnement au store et le
   * listener de tap, puis libère le scène-graphe et ses textures (chunks de
   * `Tilemap`, texture de brouillard). À appeler au retour menu / changement de
   * carte, sinon la scène capture la carte du premier lancement et fuit.
   */
  destroy(): void {
    this.destroyed = true;
    this.unsubscribeStore();
    this.unsubscribeTap();
    this.container.destroy({ children: true, texture: true });
  }

  /** Resynchronise le scène-graphe sur l'état (réconciliation simple, doc 10 §2.2). */
  private sync(): void {
    if (this.destroyed) return;
    const { game } = appStore.getState();
    const { map, config } = game;
    const player = game.players.find((p) => p.id === humanId(game));
    if (!map || !config || !player) return;
    this.objects.sync(map.objects);
    const heroes = humanHeroes(game);
    const positions = heroes.map((h) => h.pos);
    this.fog.update(player.explored, positions, config.visionRadius);

    // Réconciliation des sprites de héros : supprime ceux disparus, crée ceux
    // manquants, repositionne tous sauf celui en cours d'animation.
    const heroIds = new Set(heroes.map((h) => h.id));
    for (const [id, sprite] of this.heroSprites) {
      if (!heroIds.has(id)) {
        sprite.destroy();
        this.heroSprites.delete(id);
      }
    }
    for (const hero of heroes) {
      let sprite = this.heroSprites.get(hero.id);
      if (!sprite) {
        sprite = buildHeroSprite(PLAYER_COLOR);
        this.heroesLayer.addChild(sprite);
        this.heroSprites.set(hero.id, sprite);
      }
      if (hero.id !== this.animatingHeroId) {
        sprite.position.set(hero.pos.x * TILE_SIZE, hero.pos.y * TILE_SIZE);
      }
    }

    const selected = resolveSelectedHero(game, appStore.getState().selectedHeroId);
    this.selectionRing.visible = selected !== undefined;
    if (selected) {
      this.selectionRing.position.set(selected.pos.x * TILE_SIZE, selected.pos.y * TILE_SIZE);
    }
  }

  private async handleTap(global: Point): Promise<void> {
    if (this.destroyed || this.animatingHeroId !== null) return;
    const { game } = appStore.getState();
    // En combat, la scène de combat a la main — la carte ignore les taps.
    if (game.combat) return;
    const { map, config } = game;
    const hero = resolveSelectedHero(game, appStore.getState().selectedHeroId);
    if (!map || !config || !hero) return;

    const local = this.container.toLocal(global);
    const tile: GridPos = { x: Math.floor(local.x / TILE_SIZE), y: Math.floor(local.y / TILE_SIZE) };
    if (tile.x < 0 || tile.y < 0 || tile.x >= map.width || tile.y >= map.height) {
      this.clearPreview();
      return;
    }

    if (samePos(tile, hero.pos)) {
      this.clearPreview();
      return;
    }

    // 2ᵉ tap sur la même destination = confirmation (doc 08 §2.1).
    if (this.previewTarget && samePos(this.previewTarget.target, tile)) {
      const path = this.previewTarget.path;
      this.clearPreview();
      const result = await dispatch({ type: 'MoveHero', heroId: hero.id, path });
      await this.animateMove(result);
      return;
    }

    // Tuiles occupées : héros et gardiens bloquent ; un gardien est ciblable
    // en DESTINATION (attaque ⇒ interception, doc 02 §5 — force en fourchette §2.2).
    const guardian = map.objects.find(
      (o): o is GuardianObjectDef => o.type === 'guardian' && samePos(o.pos, tile),
    );
    const blocked = [
      ...game.heroes.filter((h) => h.id !== hero.id).map((h) => h.pos),
      ...map.objects.filter((o) => o.type === 'guardian').map((o) => o.pos),
    ];
    const path = findPath(config, map, hero.pos, tile, blocked, guardian !== undefined);
    appStore.setState({
      guardianHint: guardian && path ? { count: guardian.count } : null,
    });
    if (!path) {
      this.clearPreview();
      return;
    }
    // Points verts = atteignable aujourd'hui, jaunes = jours suivants (doc 02 §1.5).
    const steps: PreviewStep[] = [];
    let remaining = hero.movementPoints;
    let prev = hero.pos;
    for (const step of path) {
      remaining -= stepCost(config, map, prev, step);
      steps.push({ x: step.x, y: step.y, today: remaining >= 0 });
      prev = step;
    }
    this.previewTarget = { target: tile, path };
    this.preview.show(steps);
  }

  private clearPreview(): void {
    this.previewTarget = null;
    this.preview.clear();
    if (appStore.getState().guardianHint) appStore.setState({ guardianHint: null });
  }

  /** Anime les `MoveStepped` tuile par tuile — l'état a déjà « sauté » (doc 07 §3). */
  private async animateMove(result: EngineResult): Promise<void> {
    const steps = result.events.filter((e) => e.type === 'MoveStepped');
    const [first] = steps;
    if (!first) return;
    const heroId = first.heroId;
    const sprite = this.heroSprites.get(heroId);
    if (!sprite) return;
    this.animatingHeroId = heroId;
    try {
      for (const step of steps) {
        await this.tweenTo(sprite, step.from, step.to);
      }
    } finally {
      this.animatingHeroId = null;
      this.sync();
    }
  }

  private tweenTo(sprite: Graphics, from: GridPos, to: GridPos): Promise<void> {
    return new Promise((resolve) => {
      const start = performance.now();
      const animate = (): void => {
        if (this.destroyed) return resolve(); // scène détruite en cours d'animation
        const t = Math.min(1, (performance.now() - start) / STEP_ANIMATION_MS);
        sprite.position.set(
          (from.x + (to.x - from.x) * t) * TILE_SIZE,
          (from.y + (to.y - from.y) * t) * TILE_SIZE,
        );
        if (t < 1) requestAnimationFrame(animate);
        else resolve();
      };
      animate();
    });
  }

  /** Centre la caméra sur le héros sélectionné (appelé au démarrage). */
  centerOnHero(app: Application): void {
    const { game } = appStore.getState();
    const hero = resolveSelectedHero(game, appStore.getState().selectedHeroId);
    if (!hero) return;
    const scale = this.camera.world.scale.x;
    this.camera.world.position.set(
      app.screen.width / 2 - (hero.pos.x + 0.5) * TILE_SIZE * scale,
      app.screen.height / 2 - (hero.pos.y + 0.5) * TILE_SIZE * scale,
    );
  }
}
