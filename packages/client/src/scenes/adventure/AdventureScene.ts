import { Application, Assets, Container, Graphics, Point, Sprite } from 'pixi.js';
import {
  dailyMovementPoints,
  findPath,
  heroVisionBonus,
  isAdjacent,
  samePos,
  stepCost,
  type EngineResult,
  type GridPos,
  type GuardianObjectDef,
  type HeroState,
} from '@heroes/engine';
import { appStore } from '../../app/store';
import { dispatch } from '../../app/dispatch';
import { humanId, humanHeroes, resolveSelectedHero } from '../../app/game';
import type { Camera } from '../../render/camera';
import { heroMapUrl } from '../../render/assets';
import { Tilemap, TILE_SIZE } from '../../render/tilemap';
import { MapObjectsLayer } from '../../render/mapObjects';
import { playerColor } from '../../render/playerColors';
import { TownsLayer } from '../../render/townsLayer';
import { FogOverlay } from '../../render/fog';
import { buildHeroSprite } from '../../render/heroSprite';
import { buildWorldBorder } from '../../render/worldBorder';
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
  private readonly towns = new TownsLayer();
  private readonly fog: FogOverlay;
  private readonly preview = new PathPreview();
  private readonly heroesLayer = new Container();
  private readonly heroSprites = new Map<string, Container>();
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
      buildWorldBorder(map), // UXD-3A : mer + rivage sous la tuile (plus de letterbox noir)
      tilemap.container,
      this.objects.container,
      this.towns.container,
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
    this.objects.sync(map.objects, game.unitCatalog, (ownerId) =>
      playerColor(game.players, ownerId),
    );
    this.towns.sync(game.towns, humanId(game), (ownerId) => playerColor(game.players, ownerId));
    const heroes = humanHeroes(game);
    // C4 : rayon de vision EFFECTIF par héros (base + bonus Recherche), aligné sur
    // la révélation moteur (`revealAround` : visionRadius + heroVisionBonus).
    const sightings = heroes.map((h) => ({
      pos: h.pos,
      radius: config.visionRadius + heroVisionBonus(h, game.skillCatalog),
    }));
    this.fog.update(player.explored, sightings);

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
        sprite = this.buildHeroToken(hero);
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

  /**
   * Jeton d'un héros sur la carte (doc 08 §5, UXD-3B) : écusson procédural de
   * repli + **sprite de héros monté** par faction (`assets/map/hero-<faction>`,
   * chargé async, hors bundle) — lit bien mieux qu'un portrait à la taille d'une
   * tuile (le portrait reste dans le tiroir héros). Repli gracieux si le sprite
   * est absent/en cours. Garde `destroyed`/`token.destroyed` : la scène peut
   * être détruite avant la fin du chargement.
   */
  private buildHeroToken(hero: HeroState): Container {
    const token = new Container();
    const fallback = buildHeroSprite(PLAYER_COLOR);
    token.addChild(fallback);
    const url = heroMapUrl(hero.factionId);
    if (url) {
      void Assets.load(url).then((texture) => {
        if (this.destroyed || token.destroyed) return;
        token.removeChild(fallback);
        fallback.destroy();
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5);
        // Ajuste la plus grande dimension à ~1,25 tuile (jeton lisible, le héros
        // « occupe » sa case et déborde un peu comme dans HoMM).
        const scale = (TILE_SIZE * 1.25) / Math.max(texture.width, texture.height);
        sprite.scale.set(scale);
        sprite.position.set(TILE_SIZE / 2, TILE_SIZE / 2);
        token.addChild(sprite);
      });
    }
    return token;
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
      // Ville adverse/neutre atteinte (Alpha 4.13) : capturer ⇒ combat de siège
      // si elle est défendue, capture immédiate sinon. Le combat prend la main
      // via le routeur (`game.combat`), comme une interception de gardien.
      await this.tryCaptureTownAt(tile);
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
    // Préviz du COMPTE DE JOURS (doc 02 §1.5/:76, C5) : on consomme les PM du jour,
    // et quand un pas ne rentre plus dans le budget on passe au jour suivant en
    // rechargeant l'allocation quotidienne (`dailyMovementPoints`). Couleur par jour.
    const dailyPM = dailyMovementPoints(config, hero.army, game.unitCatalog);
    const steps: PreviewStep[] = [];
    let day = 1;
    let remaining = hero.movementPoints;
    let prev = hero.pos;
    for (const step of path) {
      const cost = stepCost(config, map, prev, step);
      if (remaining < cost && dailyPM > 0) {
        day += 1;
        remaining = dailyPM;
      }
      remaining -= cost;
      steps.push({ x: step.x, y: step.y, day });
      prev = step;
    }
    this.previewTarget = { target: tile, path };
    this.preview.show(steps);
  }

  /**
   * Si `tile` porte une ville non possédée par le joueur et que le héros
   * sélectionné vient de l'atteindre (dessus ou adjacent), déclenche `CaptureTown`
   * (Alpha 4.13) : capture immédiate d'une ville sans garnison, sinon combat de
   * siège. No-op si la ville est déjà à nous, hors de portée, ou inexistante.
   */
  private async tryCaptureTownAt(tile: GridPos): Promise<void> {
    if (this.destroyed) return;
    const { game } = appStore.getState();
    const human = humanId(game);
    const town = game.towns.find((tw) => tw.ownerPlayerId !== human && samePos(tw.pos, tile));
    if (!town) return;
    const hero = resolveSelectedHero(game, appStore.getState().selectedHeroId);
    if (!hero || (!samePos(hero.pos, town.pos) && !isAdjacent(hero.pos, town.pos))) return;
    await dispatch({ type: 'CaptureTown', townId: town.id, playerId: human });
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

  private tweenTo(sprite: Container, from: GridPos, to: GridPos): Promise<void> {
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
