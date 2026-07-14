import { Application, Assets, Container, Graphics, Point, Sprite } from 'pixi.js';
import {
  areAllies,
  dailyMovementPoints,
  findPath,
  heroVisionRadius,
  isAdjacent,
  samePos,
  stepCost,
  type EngineResult,
  type GameState,
  type GridPos,
  type GuardianObjectDef,
  type HeroState,
} from '@heroes/engine';
import { appStore } from '../../app/store';
import { dispatch } from '../../app/dispatch';
import { panCameraTo, DEFAULT_PAN_MS } from '../../app/camera-control';
import { reduceMotion } from '../../app/motion';
import { humanId, humanHeroes, isHeroVisibleOnMap, resolveSelectedHero } from '../../app/game';
import type { Camera } from '../../render/camera';
import { heroMapUrl } from '../../render/assets';
import { Tilemap, TILE_SIZE } from '../../render/tilemap';
import { TerrainProps } from '../../render/terrainProps';
import { isoAnchor, isoDepth, isoTileCenter, isoWorldToTile } from '../../render/projection';
import { MapObjectsLayer } from '../../render/mapObjects';
import { playerColor } from '../../render/playerColors';
import { TownsLayer } from '../../render/townsLayer';
import { FogOverlay } from '../../render/fog';
import { buildHeroSprite } from '../../render/heroSprite';
import { buildWorldBorder } from '../../render/worldBorder';
import { PathPreview, type PreviewStep } from '../../render/pathPreview';
import { onLongPress, onTap } from '../../input/pointer';
import { t } from '../../app/i18n';

const STEP_ANIMATION_MS = 110;

/**
 * Scène carte d'aventure : rendu depuis l'état moteur, animations depuis les
 * événements (doc 07 §3), interaction tap-tap (doc 08 §2.1) — 1er tap =
 * prévisualisation du chemin avec jours, 2ᵉ tap sur la même tuile = exécution.
 */
export class AdventureScene {
  readonly container = new Container();
  /**
   * Couche d'entités UNIQUE (objets + villes + héros) triée par profondeur iso
   * (`sortableChildren`, `zIndex = x+y` par nœud) — finition A1 : le tri est
   * INTER-couches, un objet de premier plan passe donc devant un héros situé
   * plus haut. `eventMode:'none'` : aucune entité ne capte le pointeur (les taps
   * carte passent au handler de scène). Déclarée avant `objects`/`towns` : les
   * initialiseurs de champs s'exécutent dans l'ordre, la couche existe déjà.
   */
  private readonly entities = new Container();
  private readonly objects = new MapObjectsLayer(this.entities);
  private readonly towns = new TownsLayer(this.entities);
  private readonly fog: FogOverlay;
  private readonly tilemap: Tilemap;
  private readonly terrainProps: TerrainProps;
  private readonly preview = new PathPreview();
  private readonly heroSprites = new Map<string, Container>();
  /**
   * Anneau de sélection (doc 08 §2.1, accessibilité A5 — pas la couleur seule).
   * Ellipse 2:1 : anneau « au sol » cohérent avec la projection iso (Lot A1).
   */
  private readonly selectionRing = new Graphics()
    .ellipse(TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE * 0.55, TILE_SIZE * 0.28)
    .stroke({ width: 3, color: 0xf1c40f });
  private previewTarget: { target: GridPos; path: GridPos[] } | null = null;
  private animatingHeroId: string | null = null;
  /**
   * Dernier joueur humain sur lequel la caméra a été centrée (UX multi-joueurs) :
   * quand le joueur humain actif change (hot-seat, retour d'un relais IA), on
   * recentre la vue sur son héros. `null` avant le 1er centrage (fait par
   * `ensureScenes`/`centerOnHero` à la construction) — évite un double centrage.
   */
  private lastCenteredHumanId: string | null = null;
  private destroyed = false;
  private readonly unsubscribeStore: () => void;
  private readonly unsubscribeTap: () => void;
  private readonly unsubscribeLongPress: () => void;
  /** Bouton DOM « Annuler le déplacement » (doc 08 §3, lot M2) → efface la préviz. */
  private readonly onCancelPath = (): void => this.clearPreview();

  constructor(
    private readonly app: Application,
    private readonly camera: Camera,
  ) {
    const { map } = appStore.getState().game;
    if (!map) throw new Error('AdventureScene requiert une partie démarrée');

    const tilemap = new Tilemap(map);
    this.tilemap = tilemap;
    // Props de relief dans la couche d'entités triée (occlusion héros ↔ forêt/montagne).
    this.terrainProps = new TerrainProps(map, this.entities);
    this.fog = new FogOverlay(map);
    this.selectionRing.visible = false;
    this.entities.sortableChildren = true; // tri de profondeur iso INTER-couches
    this.entities.eventMode = 'none'; // aucune entité ne capte le pointeur
    this.container.addChild(
      buildWorldBorder(map), // UXD-3A : mer + rivage sous la tuile (plus de letterbox noir)
      tilemap.container,
      this.preview.container,
      this.selectionRing, // marqueur au sol, sous les entités
      this.entities,
      this.fog.graphics,
    );

    this.unsubscribeStore = appStore.subscribe(() => this.sync());
    this.unsubscribeTap = onTap(app, (global) => void this.handleTap(global));
    this.unsubscribeLongPress = onLongPress(app, (global) => this.handleLongPress(global));
    window.addEventListener('heroes:cancel-path', this.onCancelPath);
    // Culling des chunks de tuiles au viewport (grandes cartes 64²→256²) : suit la
    // caméra à chaque frame (no-op sur les petites cartes aplaties en une texture).
    app.ticker.add(this.onTick);
    this.sync();
    this.cullTilemap();
  }

  /** Recalcule les chunks visibles à chaque frame (suit pan/zoom de la caméra). */
  private readonly onTick = (): void => this.cullTilemap();

  /** Viewport écran → rectangle MONDE (avec marge) puis masque les chunks hors champ. */
  private cullTilemap(): void {
    if (this.destroyed) return;
    const { x: wx, y: wy, scale } = this.camera.world;
    const s = scale.x || 1;
    const margin = 256; // px écran : anticipe le pan, évite le « pop » de chunks
    const view = {
      minX: (-margin - wx) / s,
      minY: (-margin - wy) / s,
      maxX: (this.app.screen.width + margin - wx) / s,
      maxY: (this.app.screen.height + margin - wy) / s,
    };
    this.tilemap.updateVisibility(view);
    this.terrainProps.updateVisibility(view);
  }

  /**
   * Détruit la scène (remédiation CL1) : coupe l'abonnement au store et le
   * listener de tap, puis libère le scène-graphe et ses textures (chunks de
   * `Tilemap`, texture de brouillard). À appeler au retour menu / changement de
   * carte, sinon la scène capture la carte du premier lancement et fuit.
   */
  destroy(): void {
    this.destroyed = true;
    this.app.ticker.remove(this.onTick);
    this.terrainProps.destroy();
    this.unsubscribeStore();
    this.unsubscribeTap();
    this.unsubscribeLongPress();
    window.removeEventListener('heroes:cancel-path', this.onCancelPath);
    this.container.destroy({ children: true, texture: true });
  }

  /** Ids des héros ayant un jeton rendu sur la carte (surface de test smoke —
   * couvre la visibilité des héros adverses en vision). */
  renderedHeroIds(): string[] {
    return [...this.heroSprites.keys()];
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
    // C4 : rayon de vision EFFECTIF par héros (base + bonus Recherche + longue-vue),
    // aligné sur la révélation moteur via le helper partagé `heroVisionRadius`.
    const sightings = heroes.map((h) => ({
      pos: h.pos,
      radius: heroVisionRadius(h, config.visionRadius, game.skillCatalog, game.artifactCatalog),
    }));
    // F1 : les villes et mines possédées sont des sources de vision vivante —
    // halo clair permanent autour d'elles, aligné sur la révélation moteur.
    const buildingRadius = config.buildingVisionRadius ?? 0;
    if (buildingRadius > 0) {
      const hid = humanId(game);
      for (const town of game.towns) {
        if (town.ownerPlayerId === hid) sightings.push({ pos: town.pos, radius: buildingRadius });
      }
      for (const obj of map.objects) {
        if (obj.type === 'mine' && obj.ownerId === hid)
          sightings.push({ pos: obj.pos, radius: buildingRadius });
      }
    }
    this.fog.update(player.explored, sightings);

    // Héros À DESSINER : ceux du joueur humain (toujours) + les héros adverses
    // actuellement en vision (sinon on ne pourrait jamais voir un ennemi pour
    // lancer un combat héros-vs-héros). La liste `heroes` ci-dessus reste la
    // source de VISION (brouillard) ; ne pas confondre les deux.
    const myId = humanId(game);
    const renderedHeroes = game.heroes.filter((h) => isHeroVisibleOnMap(h, myId, sightings));

    // Réconciliation des sprites de héros : supprime ceux disparus, crée ceux
    // manquants, repositionne tous sauf celui en cours d'animation.
    const heroIds = new Set(renderedHeroes.map((h) => h.id));
    for (const [id, sprite] of this.heroSprites) {
      if (!heroIds.has(id)) {
        sprite.destroy();
        this.heroSprites.delete(id);
      }
    }
    for (const hero of renderedHeroes) {
      let sprite = this.heroSprites.get(hero.id);
      if (!sprite) {
        sprite = this.buildHeroToken(hero, playerColor(game.players, hero.playerId));
        this.entities.addChild(sprite);
        this.heroSprites.set(hero.id, sprite);
      }
      sprite.zIndex = isoDepth(hero.pos.x, hero.pos.y);
      if (hero.id !== this.animatingHeroId) {
        const a = isoAnchor(hero.pos.x, hero.pos.y);
        sprite.position.set(a.x, a.y);
      }
    }

    const selected = resolveSelectedHero(game, appStore.getState().selectedHeroId);
    this.selectionRing.visible = selected !== undefined;
    if (selected) {
      const a = isoAnchor(selected.pos.x, selected.pos.y);
      this.selectionRing.position.set(a.x, a.y);
    }

    this.recenterOnActivePlayerChange(game);
  }

  /**
   * Recentre la caméra sur le héros du joueur humain actif quand celui-ci change
   * (UX multi-joueurs : hot-seat, ou retour à l'humain après un relais IA). En
   * hot-seat on attend la validation du passage d'appareil (`turnAck`) pour ne
   * pas dévoiler/centrer avant que le bon joueur soit devant l'écran. Le tout
   * premier centrage est celui de `ensureScenes` (drapeau `null`), pour éviter un
   * double recentrage au démarrage.
   */
  private recenterOnActivePlayerChange(game: GameState): void {
    const active = game.players[game.currentPlayer];
    const humans = game.players.filter((p) => p.controller === 'human');
    const handoffPending =
      humans.length >= 2 &&
      active?.controller === 'human' &&
      appStore.getState().turnAck !== active.id;
    if (handoffPending) return; // le passage d'appareil n'est pas encore validé
    const id = humanId(game);
    if (id === this.lastCenteredHumanId) return;
    const first = this.lastCenteredHumanId === null;
    this.lastCenteredHumanId = id;
    if (first) return; // centrage initial déjà assuré par `centerOnHero`
    const hero = resolveSelectedHero(game, appStore.getState().selectedHeroId);
    if (!hero) return;
    void panCameraTo(hero.pos.x, hero.pos.y, reduceMotion() ? 0 : DEFAULT_PAN_MS);
  }

  /**
   * Jeton d'un héros sur la carte (doc 08 §5, UXD-3B) : écusson procédural de
   * repli + **sprite de héros monté** par faction (`assets/map/hero-<faction>`,
   * chargé async, hors bundle) — lit bien mieux qu'un portrait à la taille d'une
   * tuile (le portrait reste dans le tiroir héros). Repli gracieux si le sprite
   * est absent/en cours. Garde `destroyed`/`token.destroyed` : la scène peut
   * être détruite avant la fin du chargement.
   */
  private buildHeroToken(hero: HeroState, color: number): Container {
    const token = new Container();
    const fallback = buildHeroSprite(color);
    token.addChild(fallback);
    const url = heroMapUrl(hero.factionId);
    if (url) {
      void Assets.load(url).then((texture) => {
        if (this.destroyed || token.destroyed) return;
        token.removeChild(fallback);
        fallback.destroy();
        const sprite = new Sprite(texture);
        // Base CENTRÉE (comme les props de relief) : le héros se DRESSE depuis le
        // sol de sa case au lieu d'être centré dessus. Ancré au centre, un sprite
        // haut débordait de part et d'autre du losange (±16 px) → il paraissait
        // « entre quatre cases » et son bas empiétait sur la tuile avant (occlusion
        // = problème d'ordre perçu). Pieds au centre-sol de la tuile.
        sprite.anchor.set(0.5, 1);
        // Ajuste la plus grande dimension à ~1,25 tuile (jeton lisible, le héros
        // « occupe » sa case et déborde un peu vers le haut comme dans HoMM).
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
    // Tour d'un adversaire (IA) en cours : les actions du héros humain sont
    // ignorées (le moteur les rejetterait). La caméra (pan/zoom) reste libre —
    // le joueur peut observer la carte pendant que l'IA joue.
    if (game.players[game.currentPlayer]?.controller !== 'human') return;
    const { map, config } = game;
    const hero = resolveSelectedHero(game, appStore.getState().selectedHeroId);
    if (!map || !config || !hero) return;

    const local = this.container.toLocal(global);
    const tile: GridPos = isoWorldToTile(local.x, local.y);
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

    // Tuiles occupées : héros et gardiens bloquent ; un gardien — ou un héros
    // ENNEMI (H-VS-H, doc 02 §1.5/§5) — est ciblable en DESTINATION (attaque ⇒
    // interception ; force en fourchette §2.2).
    const guardian = map.objects.find(
      (o): o is GuardianObjectDef => o.type === 'guardian' && samePos(o.pos, tile),
    );
    const moverPlayer = game.players.find((p) => p.id === hero.playerId);
    const enemyHero = game.heroes.find((h) => {
      if (h.id === hero.id || !samePos(h.pos, tile)) return false;
      const occPlayer = game.players.find((p) => p.id === h.playerId);
      return h.playerId !== hero.playerId && !(moverPlayer && occPlayer && areAllies(moverPlayer, occPlayer));
    });
    const blocked = [
      ...game.heroes.filter((h) => h.id !== hero.id).map((h) => h.pos),
      ...map.objects.filter((o) => o.type === 'guardian').map((o) => o.pos),
    ];
    const path = findPath(config, map, hero.pos, tile, blocked, guardian !== undefined || enemyHero !== undefined);
    // Fourchette de force affichée (comme un gardien) : effectif total du héros ennemi.
    const enemyCount = enemyHero ? enemyHero.army.reduce((n, s) => n + s.count, 0) : 0;
    appStore.setState({
      guardianHint: path && (guardian || enemyHero) ? { count: guardian ? guardian.count : enemyCount } : null,
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
    this.preview.show(steps, (day) => t('adventure.pathDay', { day }));
    appStore.setState({ pathPreviewActive: true });
  }

  /**
   * Appui long sur une tuile EXPLORÉE portant un objet ⇒ fiche (doc 08 §2.1,
   * lot M2 C6). Le brouillard reste opaque : pas de fiche sous une tuile non
   * explorée (aucune fuite d'information).
   */
  private handleLongPress(global: Point): void {
    if (this.destroyed) return;
    const { game } = appStore.getState();
    if (game.combat) return;
    const { map } = game;
    const player = game.players.find((p) => p.id === humanId(game));
    if (!map || !player) return;
    const local = this.container.toLocal(global);
    const tile: GridPos = isoWorldToTile(local.x, local.y);
    if (tile.x < 0 || tile.y < 0 || tile.x >= map.width || tile.y >= map.height) return;
    if (!player.explored[tile.y * map.width + tile.x]) return;
    const object = map.objects.find((o) => samePos(o.pos, tile));
    if (object) appStore.setState({ mapCard: object });
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
    if (appStore.getState().pathPreviewActive) appStore.setState({ pathPreviewActive: false });
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
        const a = isoAnchor(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
        sprite.position.set(a.x, a.y);
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
    const c = isoTileCenter(hero.pos.x, hero.pos.y);
    this.camera.world.position.set(
      app.screen.width / 2 - c.x * scale,
      app.screen.height / 2 - c.y * scale,
    );
  }
}
