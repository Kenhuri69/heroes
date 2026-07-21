import { Application, Assets, Container, Graphics, Point, Sprite } from 'pixi.js';
import {
  areAllies,
  dailyMovementPoints,
  findPath,
  grailRevealedTo,
  isAdjacent,
  isPassable,
  samePos,
  stepCost,
  type BoatObjectDef,
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
import { humanId, isHeroVisibleOnMap, resolveSelectedHero, visionSightings } from '../../app/game';
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
import { buildWaterSheen, waterSheenAlpha, waterSheenStats } from '../../render/waterSheen';
import { PathPreview, type PreviewStep } from '../../render/pathPreview';
import { onLongPress, onTap } from '../../input/pointer';
import { commandErrorMessage, resolveHeroName, t } from '../../app/i18n';
import { requestCoopInvite } from '../../app/coop-invite';
import { pushToast } from '../../ui/toasts';

const STEP_ANIMATION_MS = 110;

/**
 * Zoom initial de la carte d'aventure (retour de jeu) : > 1 pour que le terrain
 * remplisse la vue au démarrage plutôt que de flotter dans le brouillard. Borné
 * par le zoom max de la caméra (2×) ; le joueur reste libre de dézoomer.
 */
const INITIAL_ADVENTURE_ZOOM = 1.6;

/**
 * Marqueur « fouiller ici » du Graal (T-GRAIL lot 2) : croix rayonnante dorée
 * sur socle losange, posée sur la tuile révélée. Procédural (déterministe),
 * couleurs Pixi hors périmètre du garde-fou couleur (ui/*.css seulement).
 */
function buildGrailMarker(): Container {
  const node = new Container();
  const c = TILE_SIZE / 2;
  const gold = 0xf2c14e;
  const glow = 0xfff2c4;
  const ink = 0x3a2e12;
  const g = new Graphics();
  // Halo losange + croix de fouille dorée.
  g.poly([c, c - 14, c + 16, c, c, c + 14, c - 16, c]).fill({ color: gold, alpha: 0.18 }).stroke({ width: 1.5, color: gold, alpha: 0.5 })
    .rect(c - 2, c - 12, 4, 24).fill(gold).stroke({ width: 1, color: ink })
    .rect(c - 12, c - 2, 24, 4).fill(gold).stroke({ width: 1, color: ink })
    .circle(c, c, 3).fill(glow).stroke({ width: 1, color: ink });
  node.addChild(g);
  return node;
}

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
  /** Marqueur « fouiller ici » posé sur la tuile du Graal une fois révélée (T-GRAIL lot 2). */
  private grailMarker: Container | null = null;
  private readonly towns = new TownsLayer(this.entities);
  private readonly fog: FogOverlay;
  private readonly tilemap: Tilemap;
  /** Voile de miroitement d'eau (I12) — présent seulement sur une carte aplatie. */
  private readonly waterSheen: Container | null;
  private readonly terrainProps: TerrainProps;
  private readonly preview = new PathPreview();
  private readonly heroSprites = new Map<string, Container>();
  /** Dernier état d'embarquement rendu par héros (A3.5b) : reconstruit le jeton au changement. */
  private readonly heroNaval = new Map<string, boolean>();
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
    // I12 : miroitement d'eau — seulement sur une carte APLATIE (petite/moyenne).
    // Sur une grande carte culée, la mer périmétrique suffit (anti-gel ×4 protégé).
    this.waterSheen = tilemap.flattened ? buildWaterSheen(map) : null;
    // Props de relief dans la couche d'entités triée (occlusion héros ↔ forêt/montagne).
    this.terrainProps = new TerrainProps(map, this.entities);
    this.fog = new FogOverlay(map);
    this.selectionRing.visible = false;
    this.entities.sortableChildren = true; // tri de profondeur iso INTER-couches
    this.entities.eventMode = 'none'; // aucune entité ne capte le pointeur
    this.container.addChild(
      buildWorldBorder(map), // UXD-3A : mer + rivage sous la tuile (plus de letterbox noir)
      tilemap.container,
      ...(this.waterSheen ? [this.waterSheen] : []), // miroitement au-dessus de la tuile d'eau
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

  /**
   * Dernière empreinte caméra/viewport traitée par `cullTilemap` (S1.3). La
   * visibilité des chunks ne dépend QUE du viewport (position/zoom caméra + taille
   * écran) : inutile de la recalculer tant que rien de tout ça n'a bougé.
   * `NaN` force le 1er passage.
   */
  private lastCull = { x: NaN, y: NaN, s: NaN, w: 0, h: 0 };

  /** Recalcule les chunks visibles à chaque frame (suit pan/zoom de la caméra) + anime l'eau. */
  private readonly onTick = (): void => {
    // Pendant le combat la carte est masquée (`camera.world.visible=false`, posé
    // par `main.ts`) : ni culling ni miroitement — c'était du travail par-frame
    // invisible (trouvaille S1.2). Reprend dès le retour à l'aventure.
    if (!this.camera.world.visible) return;
    this.cullTilemap();
    // I12 : respiration de l'eau — n'ajuste qu'un `alpha` (aucune re-tesselation).
    if (this.waterSheen && !this.waterSheen.destroyed) {
      const alpha = waterSheenAlpha(performance.now() / 1000, reduceMotion());
      this.waterSheen.alpha = alpha;
      waterSheenStats.alpha = alpha;
    }
  };

  /**
   * Viewport écran → rectangle MONDE (avec marge) puis masque les chunks hors
   * champ. **Throttlé** (S1.3) : sort tôt tant que la caméra (x/y/zoom) ET la
   * taille écran n'ont pas bougé au-delà d'un seuil — sur une grande carte (256²)
   * cela supprime des centaines de tests d'intersection AABB par frame quand la
   * vue est immobile, sans jamais laisser un chunk périmé (toute cause de
   * changement de viewport rouvre le recalcul, y compris le resize).
   */
  private cullTilemap(): void {
    if (this.destroyed) return;
    const { x: wx, y: wy, scale } = this.camera.world;
    const s = scale.x || 1;
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;
    const last = this.lastCull;
    if (
      Math.abs(wx - last.x) < 8 &&
      Math.abs(wy - last.y) < 8 &&
      s === last.s &&
      sw === last.w &&
      sh === last.h
    )
      return;
    this.lastCull = { x: wx, y: wy, s, w: sw, h: sh };
    const margin = 256; // px écran : anticipe le pan, évite le « pop » de chunks
    const view = {
      minX: (-margin - wx) / s,
      minY: (-margin - wy) / s,
      maxX: (sw + margin - wx) / s,
      maxY: (sh + margin - wy) / s,
    };
    this.tilemap.updateVisibility(view);
    this.terrainProps.updateVisibility(view);
    this.fog.updateVisibility(view); // F1 : brouillard chunké, culé au même viewport
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
    waterSheenStats.alpha = 0; // I12 : le hook ne garde pas une valeur périmée hors aventure
    this.terrainProps.destroy();
    this.unsubscribeStore();
    this.unsubscribeTap();
    this.unsubscribeLongPress();
    window.removeEventListener('heroes:cancel-path', this.onCancelPath);
    // B45 (revue 2026-07) : PAS de `texture: true` — les Sprites de la scène
    // (tuiles iso, objets de carte, jetons de héros, villes…) partagent les
    // textures du cache `Assets` : les détruire ici servait des textures
    // invalides à la partie suivante (`CombatScene` fait déjà correct). Les
    // textures réellement POSSÉDÉES par la scène sont libérées sans l'option :
    // les `Text` de `PathPreview` sont ref-comptés par le système de texte
    // canvas de Pixi 8 et rendus à leur destroy (couvert par `children: true`) ;
    // le bake `cacheAsTexture` de `Tilemap` (petites cartes) est rendu au
    // `TexturePool` par `Container.destroy` → `renderGroup.destroy()` →
    // `disableCacheAsTexture()` (vérifié dans les sources 8.19).
    this.container.destroy({ children: true });
  }

  /** Ids des héros ayant un jeton rendu sur la carte (surface de test smoke —
   * couvre la visibilité des héros adverses en vision). */
  renderedHeroIds(): string[] {
    return [...this.heroSprites.keys()];
  }

  /** Nombre d'enfants du nœud d'un objet de carte (surface de test — gradation A1). */
  objectChildCount(id: string): number {
    return this.objects.childCountOf(id);
  }

  /** Empreinte de culling du tilemap (surface de test perf S1.3 — chunks totaux/construits/visibles). */
  tilemapStats(): { total: number; built: number; visible: number } {
    return this.tilemap.stats();
  }

  /** Références du dernier sync — dirty-check F1 (revue 2026-07). */
  private lastSync: { game: unknown; selectedHeroId: unknown; turnAck: unknown } | null = null;

  /** Resynchronise le scène-graphe sur l'état (réconciliation simple, doc 10 §2.2). */
  private sync(): void {
    if (this.destroyed) return;
    // F1 (revue 2026-07) : l'abonnement store se déclenche à CHAQUE setState —
    // toast, ligne de journal, tick aiTurn… Sans dirty-check, chaque mutation
    // purement UI reconstruisait brouillard (O(W×H)) + objets + villes. On ne
    // resynchronise que si les entrées RÉELLES du sync ont changé de référence
    // (l'état moteur est immuable : même référence ⇒ même contenu).
    const s = appStore.getState();
    const last = this.lastSync;
    if (last && last.game === s.game && last.selectedHeroId === s.selectedHeroId && last.turnAck === s.turnAck)
      return;
    this.lastSync = { game: s.game, selectedHeroId: s.selectedHeroId, turnAck: s.turnAck };
    const { game } = s;
    const { map, config } = game;
    const player = game.players.find((p) => p.id === humanId(game));
    if (!map || !config || !player) return;
    this.objects.sync(
      map.objects,
      game.unitCatalog,
      (ownerId) => playerColor(game.players, ownerId),
      appStore.getState().strengthBands,
    );
    this.towns.sync(game.towns, humanId(game), (ownerId) => playerColor(game.players, ownerId));
    // Marqueur du Graal (T-GRAIL lot 2) : posé sur `grailPos` une fois révélé au
    // joueur (tous obélisques visités) et tant que non obtenu — guide vers la
    // tuile à fouiller (`Dig`).
    const gp = map.grailPos;
    const showGrail = !!gp && !player.hasGrail && grailRevealedTo(map, player.obelisksVisited);
    if (showGrail && gp) {
      if (!this.grailMarker) {
        this.grailMarker = buildGrailMarker();
        this.entities.addChild(this.grailMarker);
      }
      const a = isoAnchor(gp.x, gp.y);
      this.grailMarker.position.set(a.x, a.y);
      this.grailMarker.zIndex = isoDepth(gp.x, gp.y);
      this.grailMarker.visible = true;
    } else if (this.grailMarker) {
      this.grailMarker.visible = false;
    }
    // Sources de vision vivante (héros + villes/mines possédées) : helper
    // PARTAGÉ avec la mini-carte (B11 — une seule implémentation, leçon CL9).
    const sightings = visionSightings(game);
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
        this.heroNaval.delete(id);
      }
    }
    for (const hero of renderedHeroes) {
      let sprite = this.heroSprites.get(hero.id);
      // Embarquement/débarquement (A3.5b) : l'état naval a changé ⇒ reconstruire
      // le jeton pour (dé)poser la coque. Jamais pendant une animation de pas.
      if (
        sprite &&
        hero.id !== this.animatingHeroId &&
        this.heroNaval.get(hero.id) !== hero.naval
      ) {
        sprite.destroy();
        this.heroSprites.delete(hero.id);
        sprite = undefined;
      }
      if (!sprite) {
        sprite = this.buildHeroToken(hero, playerColor(game.players, hero.playerId));
        this.entities.addChild(sprite);
        this.heroSprites.set(hero.id, sprite);
      }
      this.heroNaval.set(hero.id, hero.naval);
      // Position ET profondeur pilotées par le tween pendant l'animation (B44).
      if (hero.id !== this.animatingHeroId) {
        sprite.zIndex = isoDepth(hero.pos.x, hero.pos.y);
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
    // Héros EMBARQUÉ (A3.5b) : coque de bateau sous le jeton (repère non
    // chromatique de l'état naval — le héros se dresse dessus, pieds au sol).
    if (hero.naval) {
      const c = TILE_SIZE / 2;
      const hull = new Graphics()
        .poly([c - 15, c + 8, c + 15, c + 8, c + 10, c + 17, c - 10, c + 17])
        .fill(0x7a4a25)
        .stroke({ width: 2, color: 0x2a1a0e });
      token.addChild(hull);
    }
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

  /**
   * Coop (E4.5) : si `path` (cible `target`) engage un GARDIEN et qu'un héros
   * ALLIÉ (autre joueur, `areAllies`) à l'armée non vide est adjacent à la tuile
   * d'ENGAGEMENT (avant-dernière du chemin — là où le héros s'arrête pour frapper
   * le gardien), le retourne pour proposer une invite. Sinon `undefined`. Miroir
   * client de `resolveCoopAlly` moteur (qui revalide au dispatch).
   */
  private coopAllyForGuardianMove(hero: HeroState, path: GridPos[], target: GridPos): HeroState | undefined {
    const game = appStore.getState().game;
    const map = game.map;
    if (!map || !map.objects.some((o) => o.type === 'guardian' && samePos(o.pos, target))) return undefined;
    const engageTile = path.length >= 2 ? path[path.length - 2]! : hero.pos;
    const player = game.players.find((p) => p.id === hero.playerId);
    if (!player) return undefined;
    return game.heroes.find((h) => {
      if (h.id === hero.id || h.army.length === 0) return false;
      const hp = game.players.find((p) => p.id === h.playerId);
      return !!hp && areAllies(player, hp) && isAdjacent(engageTile, h.pos);
    });
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

    // Navigation (A3.5b) : action immédiate au tap sur une tuile ADJACENTE.
    // Embarquer (héros à pied → bateau adjacent) / débarquer (héros naval →
    // terre adjacente libre). Placé AVANT la préviz de chemin : l'eau/la terre
    // hors-domaine n'est de toute façon jamais une cible de `findPath`.
    if (isAdjacent(hero.pos, tile)) {
      const boat = map.objects.find(
        (o): o is BoatObjectDef => o.type === 'boat' && samePos(o.pos, tile),
      );
      const occupied = game.heroes.some((h) => h.id !== hero.id && samePos(h.pos, tile));
      if (!hero.naval && boat) {
        this.clearPreview();
        try {
          await dispatch({ type: 'BoardBoat', heroId: hero.id, boatId: boat.id });
        } catch (err) {
          pushToast(commandErrorMessage(err), 'error');
        }
        return;
      }
      if (hero.naval && !boat && !occupied && isPassable(config, map, tile, false)) {
        this.clearPreview();
        try {
          await dispatch({ type: 'DisembarkBoat', heroId: hero.id, target: tile });
        } catch (err) {
          pushToast(commandErrorMessage(err), 'error');
        }
        return;
      }
    }

    // 2ᵉ tap sur la même destination = confirmation (doc 08 §2.1).
    if (this.previewTarget && samePos(this.previewTarget.target, tile)) {
      const path = this.previewTarget.path;
      // Coop (E4.5) : si ce déplacement engage un GARDIEN et qu'un héros allié est
      // adjacent à la tuile d'engagement (avant-dernière du chemin), proposer de
      // l'inviter avant de dispatcher (`MoveHero.allyHeroId`). Sinon, flux normal.
      const ally = this.coopAllyForGuardianMove(hero, path, tile);
      if (ally) {
        this.clearPreview();
        requestCoopInvite(hero.id, ally.id, resolveHeroName(ally.name), path);
        return;
      }
      this.clearPreview();
      try {
        const result = await dispatch({ type: 'MoveHero', heroId: hero.id, path });
        await this.animateMove(result);
        // Ville adverse/neutre atteinte (Alpha 4.13) : capturer ⇒ combat de siège
        // si elle est défendue, capture immédiate sinon. Le combat prend la main
        // via le routeur (`game.combat`), comme une interception de gardien.
        await this.tryCaptureTownAt(tile);
      } catch (err) {
        // Commande rejetée (B36, patron CombatScene) : surfacée en toast au lieu
        // d'un unhandled rejection muet (`void this.handleTap(...)`).
        pushToast(commandErrorMessage(err), 'error');
      }
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
    // `hero.naval` sélectionne le domaine (mer/terre) pour la préviz — cohérent
    // avec le coût réellement appliqué par le moteur (`advanceHeroAlongPath`).
    const path = findPath(
      config,
      map,
      hero.pos,
      tile,
      blocked,
      guardian !== undefined || enemyHero !== undefined,
      Infinity,
      hero.naval,
    );
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
      const cost = stepCost(config, map, prev, step, hero.naval);
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
   * siège. No-op si la ville est déjà à nous, à un ALLIÉ (on ne s'assiège pas
   * entre alliés — même règle que `validateCaptureTown`, doc 02 §6 ; B36),
   * hors de portée, ou inexistante.
   */
  private async tryCaptureTownAt(tile: GridPos): Promise<void> {
    if (this.destroyed) return;
    const { game } = appStore.getState();
    const human = humanId(game);
    const humanPlayer = game.players.find((p) => p.id === human);
    const town = game.towns.find((tw) => {
      if (tw.ownerPlayerId === human || !samePos(tw.pos, tile)) return false;
      const owner = game.players.find((p) => p.id === tw.ownerPlayerId);
      return !(owner && humanPlayer && areAllies(owner, humanPlayer));
    });
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
        const ix = from.x + (to.x - from.x) * t;
        const iy = from.y + (to.y - from.y) * t;
        const a = isoAnchor(ix, iy);
        sprite.position.set(a.x, a.y);
        // B44 : profondeur suivie PENDANT le tween (le sync l'avait figée sur la
        // case d'arrivée) — le héros passe devant/derrière les props de son
        // chemin. zIndex flottant accepté : la couche `entities` trie par valeur.
        sprite.zIndex = isoDepth(ix, iy);
        if (t < 1) requestAnimationFrame(animate);
        else resolve();
      };
      animate();
    });
  }

  /**
   * Centre la caméra sur le héros sélectionné (appelé au démarrage). Applique un
   * **zoom initial rapproché** (retour de jeu) : au zoom 1, en début de partie
   * (grande part de brouillard, petite carte proto), la zone explorée flottait au
   * milieu du noir — premier écran peu engageant. On démarre plus près pour que le
   * terrain remplisse la vue ; le joueur dézoome librement (le zoom reste borné).
   */
  centerOnHero(app: Application): void {
    const { game } = appStore.getState();
    const hero = resolveSelectedHero(game, appStore.getState().selectedHeroId);
    if (!hero) return;
    this.camera.world.scale.set(INITIAL_ADVENTURE_ZOOM);
    const scale = this.camera.world.scale.x;
    const c = isoTileCenter(hero.pos.x, hero.pos.y);
    this.camera.world.position.set(
      app.screen.width / 2 - c.x * scale,
      app.screen.height / 2 - c.y * scale,
    );
  }
}
