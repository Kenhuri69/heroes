import { Application, Assets, Container, Graphics, Point, Sprite, Text, TilingSprite } from 'pixi.js';
import {
  hexDistance,
  inCombatBounds,
  sameHex,
  attackableTargets,
  canShootTarget,
  combatTacticsColumns,
  COMBAT_COLS,
  COMBAT_ROWS,
  estimateDamage,
  meleeOriginsFor,
  reachableHexes,
  spellAffectedStacks,
  teleportDestinations,
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
import { commandErrorMessage } from '../../app/i18n';
import { pushToast } from '../../ui/toasts';
import { onLongPress, onTap } from '../../input/pointer';
import { Camera } from '../../render/camera';
import { playerColor } from '../../render/playerColors';
import {
  heroAvatarUrl,
  unitSpriteUrl,
  statusIconUrl,
  siegeCurtainUrl,
  siegeTowerUrl,
  siegeGateUrl,
  siegeSceneUrl,
  siegeSceneLayout,
  siegeMoatStripUrl,
  siegeWallPieceUrl,
  siegeCourtTileUrl,
  siegeSceneTowerUrl,
  siegeGatePieceUrl,
} from '../../render/assets';
import { computeWallLayout, drawCurtain, drawTower, drawGate, drawDamage } from '../../render/siegeWall';
import { heroArchetype } from '../../app/game';
import { HEX_SIZE, ISO_SQUASH, computeBoardBounds, drawBoard, hexKey, offsetToPixel, pixelToOffset } from '../../render/hexgrid';
import { isContentPointVisible, type Rect } from '../../render/cameraClamp';
import { combatPreview } from './preview';
import { spawnProjectile, spawnSpellImpact, spawnRubbleImpact, combatIdleStats, combatShakeStats } from '../../render/combatFx';
import { reduceMotion } from '../../app/motion';

const ATTACKER_COLOR = 0xc0392b;
const DEFENDER_COLOR = 0x2e6da4;
const TOKEN_RADIUS = HEX_SIZE * 0.62;
const ACTIVE_RING_COLOR = 0xf1c40f;

// Badges d'effet posés sur les jetons (famille S, gen_spell_assets.py). Ordre
// d'affichage stable + couleur de repli procédural (disque) si l'asset manque —
// aligné sur STATUS_COLORS du générateur.
const STATUS_BADGE_ORDER = ['buff', 'debuff', 'mark', 'immobilized', 'silence', 'poison', 'stealth'] as const;
type StatusBadge = (typeof STATUS_BADGE_ORDER)[number];
const STATUS_BADGE_COLOR: Record<StatusBadge, number> = {
  buff: 0x56b060,
  debuff: 0x9650b0,
  mark: 0xc4463c,
  immobilized: 0x96783c,
  silence: 0x787882,
  poison: 0x6ea03c,
  stealth: 0x506e96,
};
const STATUS_BADGE_RADIUS = HEX_SIZE * 0.16;

// Durées de base (ms) à vitesse ×1 — divisées par `combatSpeed` (doc 08 §2.4).
const MOVE_MS_PER_HEX = 140;
const ATTACK_LUNGE_MS = 220;
const DEATH_FADE_MS = 260;

// C-HEROSPRITE (doc 08 §2.4) : jeton du héros au flanc de la grille.
const HERO_TOKEN_RADIUS = HEX_SIZE * 0.85;
const HERO_FLANK_OFFSET = HEX_SIZE * 1.3; // du bord du plateau au centre du jeton
const HERO_LUNGE_MS = 260;
const HERO_LUNGE_PX = HEX_SIZE * 0.6;

// Idle procédural (I2, doc 08) : respiration verticale subtile des jetons entre
// deux actions, désynchronisée par pile ⇒ le plateau « vit » sans nouvel asset.
const IDLE_BOB_PX = 1.5; // amplitude crête (px)
const IDLE_BOB_HZ = 0.5; // ~un demi-cycle/seconde (respiration lente)

// Mort habillée (I4) : bascule du jeton ~90° en plus du fondu. Micro-secousse du
// plateau (I5) sur kill de pile entière — impact ressenti sans nouvel asset.
const DEATH_TIP_RAD = Math.PI / 2; // bascule finale (~90°)
const SHAKE_PX = 4; // amplitude crête de la secousse
const SHAKE_MS = 120;

// HoMM3 : recul en perspective de la muraille de siège. `LEAN` = décalage
// horizontal de l'extrémité LOIN (haut) vers la droite ; `FAR`/`NEAR` = échelle
// de profondeur (loin plus petit, près plus grand). L'extrémité près reste sur
// la colonne (alignée à la douve).
const ISO_WALL_LEAN = HEX_SIZE * 1.5;
const ISO_WALL_FAR = 0.82;
const ISO_WALL_NEAR = 1.12;

const MARGIN_TOP = 96; // bandeau armées + round (doc 08 §2.4)
// S9.4 : marge basse élargie — la barre d'actions peut passer à 2 rangées et le
// badge d'effectif déborde SOUS le jeton ; sans marge, les piles de la rangée 9
// (bas du plateau) étaient rognées au cadrage d'ouverture (audit doc 19 §4).
const MARGIN_BOTTOM = 120; // barre d'actions + dépassement du badge d'effectif
const MARGIN_SIDE = 16;
const MAX_SCALE = 1.5;
// Plancher tactile doc 08 §1 : hexes ≥ 44 px (~0,706 pour HEX_SIZE=36).
const MIN_TAP_PX = 44;
const MIN_COMBAT_SCALE = MIN_TAP_PX / (HEX_SIZE * Math.sqrt(3));

/** Sélection tap-tap en attente de confirmation. */
type Selection =
  | { kind: 'move'; to: OffsetPos }
  | { kind: 'attack'; targetStackId: string; from?: OffsetPos };

/**
 * Scène de combat hex (doc 08 §2.4, doc 10 §5.5) : rend l'état
 * `appStore.getState().game.combat`, anime depuis `eventBus`, gère
 * l'interaction tap-tap de la pile active du camp joueur. Les appels de LECTURE
 * au moteur (estimateDamage/reachableHexes/canShoot) sont encapsulés en
 * try/catch défensif : un échec de calcul d'aperçu/surbrillance dégrade
 * l'affichage sans planter la frame, jamais un toast par image. En revanche un
 * `dispatch` d'ACTION rejeté est surfacé en toast (remédiation CL3).
 */
export class CombatScene {
  readonly container = new Container();
  private readonly camera: Camera;
  private readonly boardLayer = new Container();
  private readonly boardGfx = new Graphics();
  /**
   * S1 : muraille de siège CONTINUE, en 3 sous-couches (du fond vers le dessus) :
   * `wallBase` (repli procédural courtine/tour/porte), `wallSpriteLayer` (pièces
   * PEINTES `siege-curtain`/`-tower`/`-gate` si fournies), `wallDamage` (fissures/
   * brèche, toujours au-dessus). Une pièce peinte recouvre son repli procédural.
   */
  private readonly wallBase = new Graphics();
  private readonly wallSpriteLayer = new Container();
  private readonly wallDamage = new Graphics();
  /** Signature des remparts déjà rendus (hexes + PV) — évite de redessiner à chaque sync. */
  private wallKeys = '';
  /**
   * Refonte siège : SCÈNE peinte plein-cadre (sol champ/fossé/cour/ville) posée
   * DANS le monde sous la grille, ancrée à la géométrie moteur via le layout du
   * générateur. Les remparts deviennent des sprites PAR RANGÉE (intact/fissuré/
   * rasé) placés dans `stacksLayer` (tri de profondeur ⇒ occlusion correcte
   * unités/mur). `sceneActive` gouverne le repli : sans assets, l'habillage
   * procédural historique (wallBase/wallSpriteLayer) reprend la main.
   */
  private readonly sceneLayer = new Container();
  private sceneKey = '';
  private sceneActive = false;
  private readonly wallStructures = new Map<string, Sprite>();
  private readonly stacksLayer = new Container();
  /** UXD-4 : effets éphémères (chiffres de dégâts flottants) au-dessus des piles. */
  private readonly fxLayer = new Container();
  private readonly activeRing: Graphics;
  private readonly stackTokens = new Map<string, Container>();
  private readonly animatingIds = new Set<string>();
  /**
   * B38 : ids de piles référencés par des événements d'animation encore EN FILE
   * (multiset id → nb d'événements). `dispatch` fait son setState AVANT d'émettre
   * les événements : au sync qui suit un coup fatal, les animations de CE coup ne
   * sont pas encore en file — le compteur sert aux syncs SUIVANTS (auto-combat
   * qui enchaîne les dispatchs) et au filet anti-fuite `flushPendingDeaths`.
   */
  private readonly queuedEventIds = new Map<string, number>();
  /** B38 : piles mortes dont le jeton est gardé pour la file d'animations — `animateDeath` le détruit en fin de fondu. */
  private readonly pendingDeathIds = new Set<string>();
  /** C-HEROSPRITE : jeton du héros de chaque camp (absent si camp sans héros). */
  private readonly heroTokens = new Map<CombatSideId, Container>();
  private readonly heroLayer = new Container();

  private selection: Selection | null = null;
  /** C-TACTICS : pile du camp joueur sélectionnée pendant la phase de placement (null sinon). */
  private placementSelectedId: string | null = null;
  private queue: Promise<void> = Promise.resolve();
  private destroyed = false;
  /** UXD-0 R5b : vrai tant qu'un combat est affiché — sert à détecter l'ouverture. */
  private combatShown = false;
  /** E10 : une mise en page initiale (échelle + centrage) a-t-elle eu lieu avec un
   *  combat ? Distingue l'ouverture (centrage) du resize (pan préservé). */
  private laidOut = false;
  /** I5 : verrou anti-cumul de la micro-secousse de plateau (kills en rafale). */
  private boardShaking = false;

  private readonly resizeObserver: ResizeObserver;
  private readonly unsubscribeStore: () => void;
  private readonly unsubscribeEvents: () => void;
  private readonly unsubscribeTap: () => void;
  private readonly unsubscribeLongPress: () => void;

  constructor(private readonly app: Application) {
    this.boardLayer.addChild(
      this.sceneLayer,
      this.boardGfx,
      this.wallBase,
      this.wallSpriteLayer,
      this.wallDamage,
      this.heroLayer,
      this.stacksLayer,
      this.fxLayer,
    );
    // Scène peinte : pur décor sous la grille, ne capte jamais le tap.
    this.sceneLayer.eventMode = 'none';
    this.sceneLayer.sortableChildren = true;
    // Décor de rempart : ne capte jamais le tap.
    this.wallBase.eventMode = 'none';
    this.wallSpriteLayer.eventMode = 'none';
    this.wallDamage.eventMode = 'none';
    this.fxLayer.eventMode = 'none'; // purement décoratif : ne capte jamais le tap
    this.heroLayer.eventMode = 'none'; // jetons de héros décoratifs (C-HEROSPRITE)
    // Le plateau vit dans la caméra de combat (pan/pinch/molette, plancher tactile).
    this.camera = new Camera(app, { minZoom: MIN_COMBAT_SCALE, maxZoom: MAX_SCALE });
    this.camera.world.addChild(this.boardLayer);
    this.container.addChild(this.camera.world);

    // B2 iso : tri par profondeur — un jeton plus BAS à l'écran (plus proche)
    // masque un jeton plus haut (plus lointain). `zIndex = y` posé au sync.
    this.stacksLayer.sortableChildren = true;

    this.activeRing = new Graphics()
      .ellipse(0, TOKEN_RADIUS * 0.7, TOKEN_RADIUS + 6, (TOKEN_RADIUS + 6) * ISO_SQUASH)
      .stroke({ width: 3, color: ACTIVE_RING_COLOR });
    this.activeRing.visible = false;
    this.stacksLayer.addChild(this.activeRing);

    this.resizeObserver = new ResizeObserver(() => this.layout());
    this.resizeObserver.observe(app.canvas);

    this.unsubscribeStore = appStore.subscribe(() => this.sync());
    this.unsubscribeEvents = eventBus.on((event) => this.onEvent(event));
    this.unsubscribeTap = onTap(app, (global) => void this.handleTap(global));
    // Inspection tactile/souris (doc 08 §2.1 « appui long = fiche ») : ouvre la
    // fiche de stats de la pile sous le point pressé, sans consommer le tap
    // d'action (déplacer/attaquer). Même geste que la carte d'aventure.
    this.unsubscribeLongPress = onLongPress(app, (global) => this.handleLongPress(global));

    // I2 : respiration idle des jetons, pilotée par la boucle de rendu Pixi.
    this.app.ticker.add(this.idleTick, this);

    this.layout();
    this.sync();
  }

  destroy(): void {
    this.destroyed = true;
    this.app.ticker.remove(this.idleTick, this);
    combatIdleStats.bob = 0;
    this.unsubscribeStore();
    this.unsubscribeEvents();
    this.unsubscribeTap(); // remédiation CL2 : les 3 listeners de tap ne fuient plus
    this.unsubscribeLongPress();
    this.resizeObserver.disconnect();
    this.container.removeChild(this.camera.world);
    this.camera.destroy(); // retire les listeners + détruit world (plateau, tokens)
    this.container.destroy({ children: true });
  }

  // ——— Layout ———

  /** Aire de jeu à l'écran (hors en-tête armées + barre d'actions). */
  private viewRect(): Rect {
    const availW = Math.max(1, this.app.screen.width - MARGIN_SIDE * 2);
    const availH = Math.max(1, this.app.screen.height - MARGIN_TOP - MARGIN_BOTTOM);
    return { x: MARGIN_SIDE, y: MARGIN_TOP, width: availW, height: availH };
  }

  private layout(): void {
    const bounds = computeBoardBounds();
    const view = this.viewRect();
    // Plancher d'échelle : hexes ≥ 44 px même en portrait (le plateau déborde
    // alors et se déplace au pan/pinch, doc 08 §1/§2.4). Cap à MAX_SCALE.
    const fit = Math.min(view.width / bounds.width, view.height / bounds.height, MAX_SCALE);
    const scale = Math.max(fit, MIN_COMBAT_SCALE);
    const combat = appStore.getState().game.combat;

    if (!combat || !this.laidOut) {
      // Ouverture (ou hors combat) : échelle + centrage géométrique du plateau.
      this.camera.world.scale.set(scale);
      this.camera.world.position.set(
        view.x + (view.width - bounds.width * scale) / 2 - bounds.minX * scale,
        view.y + (view.height - bounds.height * scale) / 2 - bounds.minY * scale,
      );
      this.camera.setClampBounds(bounds, view);
      if (combat) {
        this.centerOnActive(combat);
        this.laidOut = true;
      }
      return;
    }

    // E10 — re-fit conservateur au RESIZE : préserver le cadrage de l'utilisateur
    // (le point de contenu au centre de l'aire y reste au changement d'échelle),
    // borner, puis ne recentrer sur la pile active QUE si le resize l'a rendue
    // invisible (avant : chaque resize réinitialisait le pan).
    const oldScale = this.camera.world.scale.x;
    const cx = view.x + view.width / 2;
    const cy = view.y + view.height / 2;
    const centerContent = {
      x: (cx - this.camera.world.x) / oldScale,
      y: (cy - this.camera.world.y) / oldScale,
    };
    this.camera.world.scale.set(scale);
    this.camera.world.position.set(cx - centerContent.x * scale, cy - centerContent.y * scale);
    this.camera.setClampBounds(bounds, view);
    const active = combat.stacks.find((s) => s.id === combat.activeStackId) ?? combat.stacks[0];
    if (active) {
      const p = offsetToPixel(active.pos);
      const pos = { x: this.camera.world.x, y: this.camera.world.y };
      if (!isContentPointVisible(p, pos, this.camera.world.scale.x, view)) this.centerOnActive(combat);
    }
  }

  /**
   * UXD-0 R5b : à l'OUVERTURE (ou si le resize l'a rendue invisible), si le
   * plateau déborde de l'aire (échelle plancher 44 px en portrait), centre la vue
   * sur l'hex de la pile active — sinon aucune unité n'était visible. Le pan/pinch
   * de l'utilisateur reste maître ensuite (pas de recentrage). Borne toujours.
   */
  private centerOnActive(combat: CombatState): void {
    const bounds = computeBoardBounds();
    const view = this.viewRect();
    const scale = this.camera.world.scale.x;
    if (bounds.width * scale > view.width || bounds.height * scale > view.height) {
      const active = combat.stacks.find((s) => s.id === combat.activeStackId) ?? combat.stacks[0];
      if (active) {
        const { x, y } = offsetToPixel(active.pos);
        this.camera.world.position.set(view.x + view.width / 2 - x * scale, view.y + view.height / 2 - y * scale);
      }
    }
    this.camera.setClampBounds(bounds, view); // (re)borne — centré ou recadré
  }

  // ——— Resync depuis le store (réconciliation simple, doc 10 §2.2) ———

  /** Références du dernier sync — dirty-check F1 (revue 2026-07). */
  private lastSync: { game: unknown; spellTarget: unknown; spellZone: unknown } | null = null;

  private sync(): void {
    if (this.destroyed) return;
    // F1 : ne resynchronise (reachableHexes + attackableTargets + redraw des
    // 150 hexes) que si l'état moteur ou le ciblage de sort ont changé — pas à
    // chaque toast/ligne de journal. Les changements de sélection INTERNES
    // appellent déjà `redrawBoard()` directement.
    const st = appStore.getState();
    const last = this.lastSync;
    if (
      last &&
      last.game === st.game &&
      last.spellTarget === st.combatSpellTarget &&
      last.spellZone === st.combatSpellZone
    )
      return;
    this.lastSync = { game: st.game, spellTarget: st.combatSpellTarget, spellZone: st.combatSpellZone };
    const combat = st.game.combat;
    if (!combat) {
      this.combatShown = false;
      this.laidOut = false; // E10 : le prochain combat repart d'un centrage propre.
      this.selection = null;
      combatPreview.set(null);
      this.boardGfx.clear();
      this.wallBase.clear();
      this.wallDamage.clear();
      this.wallSpriteLayer.removeChildren().forEach((c) => c.destroy());
      this.wallKeys = '';
      this.sceneLayer.removeChildren().forEach((c) => c.destroy());
      this.sceneKey = '';
      this.sceneActive = false;
      for (const s of this.wallStructures.values()) s.destroy();
      this.wallStructures.clear();
      this.fxLayer.removeChildren().forEach((c) => c.destroy()); // purge des chiffres flottants
      for (const [id, token] of this.stackTokens) {
        if (this.animatingIds.has(id)) continue;
        token.destroy();
        this.stackTokens.delete(id);
      }
      // Fin de combat = filet de sécurité B38 : plus de mort différée en attente
      // (les jetons encore animés se détruisent en fin de `animateDeath`).
      this.pendingDeathIds.clear();
      this.activeRing.visible = false;
      for (const token of this.heroTokens.values()) token.destroy({ children: true });
      this.heroTokens.clear();
      return;
    }
    if (!this.combatShown) {
      this.combatShown = true;
      this.centerOnActive(combat);
      this.laidOut = true; // E10 : combat visible ⇒ les resizes suivants préservent le pan.
      this.buildHeroTokens(combat);
    }
    this.syncSiegeScene(combat, st.game);
    this.syncStacks(combat);
    this.syncWalls(combat);
    this.redrawBoard();
  }

  /**
   * Refonte siège : pose la SCÈNE peinte (sol) et la bande d'eau de douve dans
   * le monde, ancrées board-space via le layout du générateur. Décide
   * `sceneActive` (⇒ `syncWalls` bascule en sprites par rangée). Sans asset ni
   * layout : no-op, repli intégral sur l'habillage historique.
   */
  private syncSiegeScene(combat: CombatState, game: GameState): void {
    const layout = siegeSceneLayout();
    const walls = combat.siegeWalls ?? [];
    const town = combat.townId != null ? game.towns.find((t) => t.id === combat.townId) : undefined;
    const url = walls.length > 0 && layout ? siegeSceneUrl(town?.factionId) : undefined;
    this.sceneActive = url != null && siegeWallPieceUrl('intact') != null;
    const hasMoat = (combat.moat ?? []).length > 0;
    const key = this.sceneActive ? `${url}|${hasMoat ? 'wet' : 'dry'}` : '';
    if (key === this.sceneKey) return;
    this.sceneKey = key;
    this.sceneLayer.removeChildren().forEach((c) => c.destroy());
    if (!this.sceneActive || !url || !layout) return;
    const invScale = 1 / layout.scale;
    void Assets.load(url).then((texture) => {
      if (this.destroyed || this.sceneKey !== key) return;
      const sprite = new Sprite(texture);
      sprite.scale.set(invScale);
      sprite.position.set(layout.scene.x0, layout.scene.y0);
      sprite.zIndex = 0;
      this.sceneLayer.addChild(sprite);
    });
    const moatUrl = hasMoat ? siegeMoatStripUrl() : undefined;
    if (moatUrl) {
      void Assets.load(moatUrl).then((texture) => {
        if (this.destroyed || this.sceneKey !== key) return;
        const sprite = new Sprite(texture);
        sprite.scale.set(invScale);
        sprite.position.set(layout.moatStrip.x0, layout.moatStrip.y0);
        sprite.zIndex = 1;
        this.sceneLayer.addChild(sprite);
      });
    }
    // « Effet ville » : pavage hexagonal des cases de COUR (dans l'enceinte,
    // entre le rempart et le bord défenseur) — 3 variantes déterministes.
    const wallCol = walls[0]!.col;
    for (let col = wallCol + 1; col < COMBAT_COLS; col++) {
      for (let row = 0; row < COMBAT_ROWS; row++) {
        const tileUrl = siegeCourtTileUrl(((col * 31 + row * 17) % 3) + 1);
        if (!tileUrl) break;
        const { x, y } = offsetToPixel({ col, row });
        void Assets.load(tileUrl).then((texture) => {
          if (this.destroyed || this.sceneKey !== key) return;
          const sprite = new Sprite(texture);
          sprite.anchor.set(0.5);
          sprite.position.set(x, y);
          sprite.width = layout.courtTile.w;
          sprite.height = layout.courtTile.h;
          sprite.zIndex = 2;
          this.sceneLayer.addChild(sprite);
        });
      }
    }
  }

  /**
   * C-SIEGE2 + S1/S2 : dessine la muraille de siège comme UNE structure continue
   * (`drawSiegeWall` — courtine + tours aux extrémités + porte à l'ouverture +
   * fissures/brèche au niveau des segments entamés), au lieu d'un sprite par hex
   * (blocs épars, gaps ; audit doc 19 §2.1). Procédural, déterministe, redessiné
   * seulement quand la signature (hexes + PV) change — l'érosion de la catapulte
   * (C-SIEGE2.6) ouvre la brèche au redraw ; le FX de bombardement (projectile +
   * éclats) reste joué par `WallBombarded`.
   */
  private syncWalls(combat: CombatState): void {
    if (this.sceneActive) {
      // Mode SCÈNE peinte : le rempart est un jeu de sprites PAR RANGÉE dans
      // `stacksLayer` (profondeur correcte) — l'habillage procédural se tait.
      this.wallBase.clear();
      this.wallDamage.clear();
      this.wallSpriteLayer.removeChildren().forEach((c) => c.destroy());
      this.wallKeys = '';
      this.syncWallStructures(combat);
      return;
    }
    if (this.wallStructures.size > 0) {
      for (const s of this.wallStructures.values()) s.destroy();
      this.wallStructures.clear();
    }
    const walls = combat.siegeWalls ?? [];
    const hp = combat.siegeWallHp ?? {};
    // Signature = hexes + PV : redessine quand la muraille change (segment ouvert
    // par la catapulte, usure d'un segment) mais pas à chaque toast.
    const sig = walls
      .map((w) => `${hexKey(w)}:${hp[hexKey(w)] ?? ''}`)
      .sort()
      .join('|');
    if (sig === this.wallKeys) return;
    this.wallKeys = sig;
    this.wallBase.clear();
    this.wallDamage.clear();
    this.wallSpriteLayer.removeChildren().forEach((c) => c.destroy());

    const layout = computeWallLayout(combat);
    if (!layout) return;
    const curtainUrl = siegeCurtainUrl();
    const towerUrl = siegeTowerUrl();

    // HoMM3 : la muraille FILE EN PERSPECTIVE sur le plateau iso — extrémité HAUTE
    // = LOIN (recule vers le haut-droite, plus petite), extrémité BASSE = PRÈS
    // (reste sur la colonne, alignée à la douve, plus grande). L'extrémité près
    // ancrée à `wallX` ⇒ le mur ne croise jamais la douve (à sa gauche).
    const yTop = Math.min(...layout.runs.map((r) => r.yTop));
    const yBot = Math.max(...layout.runs.map((r) => r.yBot));
    const span = Math.max(1, yBot - yTop);
    const iso = {
      xAt: (y: number) => layout.wallX + ISO_WALL_LEAN * (1 - (y - yTop) / span),
      scaleAt: (y: number) => ISO_WALL_FAR + (ISO_WALL_NEAR - ISO_WALL_FAR) * ((y - yTop) / span),
    };

    // Courtines : sprite peint incliné le long de l'axe iso, sinon procédural droit.
    for (const run of layout.runs) {
      if (curtainUrl) this.placeCurtainIso(curtainUrl, iso, layout.halfW, run.yTop, run.yBot);
      else drawCurtain(this.wallBase, layout.wallX, run.yTop, run.yBot);
    }
    for (const ty of layout.towers) {
      if (towerUrl) this.placeTowerIso(towerUrl, iso.xAt(ty), ty, iso.scaleAt(ty), layout.towerH);
      else drawTower(this.wallBase, layout.wallX, ty);
    }
    if (layout.gateY != null) drawGate(this.wallBase, iso.xAt(layout.gateY), layout.gateY);
    for (const d of layout.damage) drawDamage(this.wallDamage, iso.xAt(d.y), d.y, d.ratio, d.seed, iso.scaleAt(d.y));
  }

  /**
   * Courtine PEINTE tuilée le long de l'axe iso penché [yTop,yBot] (`TilingSprite`
   * pivoté en tête + mis à l'échelle profondeur) ⇒ muraille qui file en perspective.
   */
  private placeCurtainIso(
    url: string,
    iso: { xAt: (y: number) => number; scaleAt: (y: number) => number },
    halfW: number,
    yTop: number,
    yBot: number,
  ): void {
    const topX = iso.xAt(yTop);
    const botX = iso.xAt(yBot);
    const len = Math.hypot(botX - topX, yBot - yTop);
    const w = halfW * 2 * iso.scaleAt((yTop + yBot) / 2);
    const angle = Math.atan2(yBot - yTop, botX - topX) - Math.PI / 2; // local +y (bas) → direction d'axe
    void Assets.load(url).then((texture) => {
      if (this.destroyed || this.wallSpriteLayer.destroyed) return;
      const tile = new TilingSprite({ texture, width: w, height: len });
      tile.tileScale.set(w / texture.width);
      tile.pivot.set(w / 2, 0);
      tile.rotation = angle;
      tile.position.set(topX, yTop);
      this.wallSpriteLayer.addChild(tile);
    });
  }

  /** Tour PEINTE posée en (x,y) sur l'axe, base au point, échelle profondeur. */
  private placeTowerIso(url: string, x: number, y: number, depthScale: number, towerH: number): void {
    void Assets.load(url).then((texture) => {
      if (this.destroyed || this.wallSpriteLayer.destroyed) return;
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5, 0.82);
      sprite.scale.set(((towerH * 1.7) / texture.height) * depthScale);
      sprite.position.set(x, y);
      this.wallSpriteLayer.addChild(sprite);
    });
  }

  /**
   * Mode scène : rempart en sprites PAR RANGÉE (`siege-piece-wall*`), état lu
   * dans `siegeWalls`/`siegeWallHp` (intact / fissuré / rasé — une rangée
   * absente hors porte = brèche rasée), + porte et tours d'extrémité peintes.
   * Les sprites vivent dans `stacksLayer` avec `zIndex = y` de leur base ⇒ une
   * unité au sud passe DEVANT le mur, au nord DERRIÈRE (occlusion réelle).
   * Diff par signature (`label`) — pas de rebuild à chaque sync.
   */
  private syncWallStructures(combat: CombatState): void {
    const layout = siegeSceneLayout();
    const walls = combat.siegeWalls ?? [];
    if (!layout || walls.length === 0) return;
    const wallCol = walls[0]!.col;
    const hp = combat.siegeWallHp ?? {};
    const maxHp = Object.keys(hp).length ? Math.max(...Object.values(hp)) : 0;
    const walled = new Set(walls.map((w) => w.row));
    const gateA = Math.floor(COMBAT_ROWS / 2) - 1;
    const gateB = Math.floor(COMBAT_ROWS / 2);
    const yOf = (row: number): number => offsetToPixel({ col: wallCol, row }).y;
    const pieceH = layout.piece.hAbove + layout.piece.hBelow;

    const ensure = (key: string, sig: string, make: () => Sprite | null): void => {
      const existing = this.wallStructures.get(key);
      if (existing && !existing.destroyed && existing.label === sig) return;
      existing?.destroy();
      this.wallStructures.delete(key);
      const sprite = make();
      if (sprite) {
        sprite.label = sig;
        sprite.eventMode = 'none';
        this.stacksLayer.addChild(sprite);
        this.wallStructures.set(key, sprite);
      }
    };

    for (let row = 0; row < COMBAT_ROWS; row++) {
      if (row === gateA || row === gateB) continue;
      let state: 'intact' | 'cracked' | 'razed' = 'razed';
      if (walled.has(row)) {
        const ratio = maxHp > 0 ? (hp[`${wallCol},${row}`] ?? maxHp) / maxHp : 1;
        state = ratio < 1 ? 'cracked' : 'intact';
      }
      const variant = row % 2 === 0 ? 1 : 2;
      ensure(`piece:${row}`, `${state}:${variant}`, () => {
        const url = siegeWallPieceUrl(state, variant);
        if (!url) return null;
        const sprite = new Sprite();
        sprite.position.set(layout.wallX, yOf(row));
        sprite.zIndex = yOf(row) + layout.piece.hBelow;
        void Assets.load(url).then((texture) => {
          if (sprite.destroyed) return;
          sprite.texture = texture;
          sprite.anchor.set(0.5, layout.piece.hAbove / pieceH);
          sprite.width = layout.piece.w;
          sprite.height = pieceH;
        });
        return sprite;
      });
    }

    // Porte = segment VERTICAL dans l'axe du mur (retour porteur : le
    // gatehouse frontal étalé en travers jurait) ; repli = art frontal.
    ensure('gate', 'gate-piece', () => {
      const url = siegeGatePieceUrl() ?? siegeGateUrl();
      if (!url) return null;
      const sprite = new Sprite();
      sprite.position.set(layout.gate.x, layout.gate.yBottom);
      // Profondeur : entre les 2 rangées d'ouverture — une unité sur la rangée
      // NORD passe derrière le segment (elle entre dans le tunnel), sur la
      // rangée SUD devant (elle en ressort).
      sprite.zIndex = layout.gate.yBottom - 37;
      void Assets.load(url).then((texture) => {
        if (sprite.destroyed) return;
        sprite.texture = texture;
        sprite.anchor.set(0.5, 1);
        sprite.width = layout.gate.w;
        sprite.height = layout.gate.h;
      });
      return sprite;
    });

    layout.towers.forEach((t, i) => {
      ensure(`tower:${i}`, 'tower', () => {
        const url = siegeSceneTowerUrl();
        if (!url) return null;
        const sprite = new Sprite();
        sprite.position.set(t.x, t.y);
        sprite.zIndex = t.y;
        void Assets.load(url).then((texture) => {
          if (sprite.destroyed) return;
          sprite.texture = texture;
          sprite.anchor.set(0.5, 0.96);
          sprite.scale.set(t.h / texture.height);
        });
        return sprite;
      });
    });
  }

  /**
   * C-HEROSPRITE (doc 08 §2.4) : le héros de chaque camp est PRÉSENT sur le
   * canvas — jeton statique au flanc de la grille (attaquant à gauche,
   * défenseur à droite), avatar `heroes/<faction>-<archétype>` chargé en async
   * avec repli disque au liseré du camp. Animé à la ruée sur `SpellCast` /
   * `HeroStruck` (le sort du héros « sortait de nulle part »).
   */
  private buildHeroTokens(combat: CombatState): void {
    for (const token of this.heroTokens.values()) token.destroy({ children: true });
    this.heroTokens.clear();
    const bounds = computeBoardBounds();
    const centerY = bounds.minY + bounds.height / 2;
    const heroes = appStore.getState().game.heroes;
    const sides: { side: CombatSideId; heroId: string | null; x: number }[] = [
      { side: 'attacker', heroId: combat.attackerHeroId, x: bounds.minX - HERO_FLANK_OFFSET },
      { side: 'defender', heroId: combat.defenderHeroId, x: bounds.minX + bounds.width + HERO_FLANK_OFFSET },
    ];
    for (const { side, heroId, x } of sides) {
      const hero = heroId ? heroes.find((h) => h.id === heroId) : undefined;
      if (!hero) continue;
      const token = new Container();
      const color = side === 'attacker' ? ATTACKER_COLOR : DEFENDER_COLOR;
      // S7.3 : repli du médaillon = teinte déterministe (hash faction) + initiale
      // du héros, au lieu du disque noir vide (audit doc 19 §3.2) — même esprit
      // que le `FactionBadge` de l'UI DOM. L'avatar, s'il existe, recouvre.
      token.addChild(
        new Graphics()
          .ellipse(0, HERO_TOKEN_RADIUS * 0.9, HERO_TOKEN_RADIUS * 0.8, HERO_TOKEN_RADIUS * 0.3)
          .fill({ color, alpha: 0.85 })
          .stroke({ width: 2, color: 0x1a1c22 })
          .circle(0, 0, HERO_TOKEN_RADIUS)
          .fill(factionTint(hero.factionId))
          .stroke({ width: 3, color }),
      );
      const initial = (hero.name || hero.factionId || '?').trim().charAt(0).toUpperCase() || '?';
      const initialText = new Text({
        text: initial,
        style: {
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: HERO_TOKEN_RADIUS * 1.1,
          fontWeight: '700',
          fill: 0xf2e6c8,
          stroke: { color: 0x1a1c22, width: 3 },
          align: 'center',
        },
      });
      initialText.anchor.set(0.5);
      token.addChild(initialText);
      const url = heroAvatarUrl(hero.factionId, heroArchetype(hero.attributes), hero.name);
      if (url) {
        void Assets.load(url).then((texture) => {
          if (token.destroyed) return;
          const sprite = new Sprite(texture);
          const scale = (HERO_TOKEN_RADIUS * 2) / Math.max(texture.width, texture.height);
          sprite.anchor.set(0.5);
          sprite.scale.set(scale);
          // Masque circulaire : l'avatar remplit le médaillon sans déborder.
          const mask = new Graphics().circle(0, 0, HERO_TOKEN_RADIUS - 2).fill(0xffffff);
          sprite.mask = mask;
          token.addChild(sprite, mask);
          token.addChild(
            new Graphics().circle(0, 0, HERO_TOKEN_RADIUS).stroke({ width: 3, color }),
          );
        });
      }
      token.position.set(x, centerY);
      this.heroTokens.set(side, token);
      this.heroLayer.addChild(token);
    }
  }

  /** Ruée du jeton de héros vers le plateau puis retour (sort / frappe héroïque). */
  private async lungeHero(side: CombatSideId, speed: number): Promise<void> {
    const token = this.heroTokens.get(side);
    if (!token || token.destroyed || prefersReducedMotion()) return;
    const originX = token.position.x;
    const dir = side === 'attacker' ? 1 : -1;
    const half = HERO_LUNGE_MS / 2 / speed;
    await tween(half, (t) => {
      if (!token.destroyed) token.position.x = originX + dir * HERO_LUNGE_PX * t;
    });
    await tween(half, (t) => {
      if (!token.destroyed) token.position.x = originX + dir * HERO_LUNGE_PX * (1 - t);
    });
    if (!token.destroyed) token.position.x = originX;
  }

  private syncStacks(combat: CombatState): void {
    const alive = new Set(combat.stacks.map((s) => s.id));
    for (const [id, token] of this.stackTokens) {
      if (alive.has(id) || this.animatingIds.has(id)) continue;
      // B38 : mort DIFFÉRÉE. Ce sync est déclenché par le setState du dispatch,
      // AVANT l'émission des événements (`dispatch.ts`) : détruire le jeton ici
      // privait `animateAttack` de sa cible (chiffres de dégâts et « ☠ » posés
      // sur l'ATTAQUANT) et `animateDeath` de son fondu. On marque la pile « en
      // attente de mort » ; `animateDeath` détruira le jeton en fin de fondu.
      if (!this.pendingDeathIds.has(id) || (this.queuedEventIds.get(id) ?? 0) > 0) {
        this.pendingDeathIds.add(id);
        continue;
      }
      // Filet de sécurité (fuite) : marquée à un sync précédent et plus aucun
      // événement en file ne la référence — le fondu n'arrivera jamais, on détruit.
      this.pendingDeathIds.delete(id);
      token.destroy();
      this.stackTokens.delete(id);
    }
    for (const stack of combat.stacks) {
      let token = this.stackTokens.get(stack.id);
      if (!token) {
        token = this.buildStackToken(stack);
        this.stacksLayer.addChild(token);
        this.stackTokens.set(stack.id, token);
      }
      if (!this.animatingIds.has(stack.id)) {
        const { x, y } = offsetToPixel(stack.pos);
        token.position.set(x, y);
        token.zIndex = y; // B2 iso : profondeur = position à l'écran
      }
      this.updateCountBadge(token, stack.count);
      this.updateStatusBadges(token, stack);
    }
    this.highlightActive(combat);
  }

  /**
   * Effets actifs sur une pile → liste ordonnée de badges (famille S). Dérivé de
   * l'état PUR de la pile (aucune règle : lecture seule) : buff/debuff nets des
   * statuts de sorts, silence, poison (`damagePerRound`), Marque, immobilisation,
   * furtivité. Ordre stable pour une rangée sans scintillement.
   */
  private activeStatusBadges(stack: CombatStack): StatusBadge[] {
    const active = new Set<StatusBadge>();
    for (const s of stack.statuses) {
      if (s.silenced) active.add('silence');
      if (s.damagePerRound > 0) active.add('poison');
      const net = s.attackMod + s.defenseMod + s.speedMod + (s.moraleMod ?? 0);
      if (net > 0) active.add('buff');
      else if (net < 0) active.add('debuff');
    }
    if (stack.marks > 0) active.add('mark');
    if (stack.immobilizedRounds > 0) active.add('immobilized');
    if (stack.stealthed) active.add('stealth');
    return STATUS_BADGE_ORDER.filter((b) => active.has(b));
  }

  /**
   * Rangée de badges d'effet au-dessus du jeton. Rebâtie seulement quand la
   * signature d'effets change (évite le scintillement au resync). Chaque badge :
   * disque coloré procédural IMMÉDIAT (repli, jamais d'image cassée) remplacé par
   * l'icône `ui/status-<name>` dès son chargement (patron du sprite d'unité).
   */
  private updateStatusBadges(token: Container, stack: CombatStack): void {
    const badges = this.activeStatusBadges(stack);
    const sig = badges.join(',');
    const existing = token.getChildByLabel('status-badges') as (Container & { _sig?: string }) | null;
    if (existing?._sig === sig) return;
    if (existing) existing.destroy({ children: true });
    if (badges.length === 0) return;

    const row = new Container() as Container & { _sig?: string };
    row.label = 'status-badges';
    row._sig = sig;
    const d = STATUS_BADGE_RADIUS;
    const step = d * 2.2;
    const totalW = step * (badges.length - 1);
    badges.forEach((name, i) => {
      const bx = -totalW / 2 + i * step;
      const cell = new Container();
      cell.position.set(bx, -TOKEN_RADIUS * 1.15);
      const disc = new Graphics()
        .circle(0, 0, d)
        .fill({ color: STATUS_BADGE_COLOR[name] })
        .stroke({ width: 1.5, color: 0x1e1814 });
      cell.addChild(disc);
      const url = statusIconUrl(name);
      if (url) {
        void Assets.load(url).then((texture) => {
          if (this.destroyed || cell.destroyed) return;
          const sprite = new Sprite(texture);
          sprite.anchor.set(0.5);
          sprite.scale.set((d * 2.2) / Math.max(texture.width, texture.height));
          cell.removeChildren().forEach((c) => c.destroy());
          cell.addChild(sprite);
        });
      }
      row.addChild(cell);
    });
    token.addChild(row);
  }

  private highlightActive(combat: CombatState): void {
    const token = combat.activeStackId ? this.stackTokens.get(combat.activeStackId) : undefined;
    if (token) {
      this.activeRing.visible = true;
      this.activeRing.position.copyFrom(token.position);
      this.activeRing.zIndex = token.position.y - 0.5; // juste sous la pile active (iso)
      this.stacksLayer.addChild(this.activeRing);
    } else {
      this.activeRing.visible = false;
    }
  }

  /**
   * Jeton d'une pile (doc 08 §5, lot U5-C) : une base de camp colorée (second
   * canal, avec la position sur le plateau + les bandeaux DOM) + le SPRITE de
   * l'unité (`assets/units/…`, chargé async, hors bundle). Repli gracieux : tant
   * que le sprite n'est pas chargé — ou s'il est absent — un polygone procédural
   * distinct par camp est affiché. Garde `destroyed`/`destroyed` du conteneur :
   * un combat peut finir avant la fin du chargement.
   */
  private buildStackToken(stack: CombatStack): Container {
    const token = new Container();
    const side = stack.side;
    const catalog = appStore.getState().game.unitCatalog;
    const abilities = catalog[stack.unitId]?.abilities ?? [];
    const hasAbility = (id: string): boolean => abilities.some((a) => a.id === id);
    // S6 : une machine de guerre défensive IMMOBILE (tour de tir de siège) est une
    // STRUCTURE de la ville, pas une créature — détection générique par capacités
    // (`warMachine` + `immobile` côté défenseur), zéro id d'unité/faction en dur.
    // Rendu : socle de pierre (pas d'ellipse de camp), sprite figé (hors idle),
    // aucun badge d'effectif (une tour n'est pas « 1 »).
    const isSiegeStructure = side === 'defender' && hasAbility('warMachine') && hasAbility('immobile');

    if (isSiegeStructure) {
      token.addChild(buildStructureBase());
    } else {
      // Base de camp (ellipse au sol) : distingue attaquant/défenseur.
      token.addChild(
        new Graphics()
          .ellipse(0, TOKEN_RADIUS * 0.7, TOKEN_RADIUS * 0.85, TOKEN_RADIUS * 0.35)
          .fill({ color: side === 'attacker' ? ATTACKER_COLOR : DEFENDER_COLOR, alpha: 0.85 })
          .stroke({ width: 2, color: 0x1a1c22 }),
      );
    }
    // Coop (E4.5b, doc 18 E4) : une pile issue d'un héros ALLIÉ invité (owner
    // explicite) porte un liseré de la couleur de son joueur — signal « à qui
    // appartient la pile ». Piles du lead (owner absent) : aucun anneau (rendu
    // mono-héros inchangé).
    if (stack.ownerHeroId) {
      const game = appStore.getState().game;
      const owner = game.heroes.find((h) => h.id === stack.ownerHeroId);
      const color = owner ? playerColor(game.players, owner.playerId) : 0xffffff;
      token.addChild(
        new Graphics()
          .ellipse(0, TOKEN_RADIUS * 0.7, TOKEN_RADIUS * 0.98, TOKEN_RADIUS * 0.48)
          .stroke({ width: 3, color }),
      );
    }
    // I2 : le visuel d'unité (repli polygone puis sprite) vit dans un conteneur
    // `bob` que la boucle idle fait osciller ; l'ellipse de sol et le badge
    // d'effectif (ajoutés hors de `bob`) restent fixes. Une STRUCTURE (S6) ne
    // respire pas : son visuel est hors `bob` (conteneur non labellisé).
    const visual = new Container();
    if (!isSiegeStructure) visual.label = 'bob';
    token.addChild(visual);
    const fallback = isSiegeStructure ? buildStructureGraphic() : buildStackTokenGraphic(side);
    visual.addChild(fallback);

    const url = unitSpriteUrl(stack.unitId, catalog[stack.unitId]?.groupId);
    if (url) {
      void Assets.load(url).then((texture) => {
        if (this.destroyed || token.destroyed) return;
        visual.removeChild(fallback);
        fallback.destroy();
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5, 0.72); // pieds posés sur la base
        const scale = (TOKEN_RADIUS * 2.4) / Math.max(texture.width, texture.height);
        sprite.scale.set(scale);
        visual.addChild(sprite);
      });
    }

    // Badge d'effectif (doc 08 §2.4, fidélité HoMM) : pastille en bas du jeton
    // portant le nombre de soldats. Texte à fort contraste (contour) — jamais
    // porté par la couleur seule (a11y A5). Toujours au-dessus du sprite d'unité,
    // réf gardée sur le conteneur pour mise à jour à chaque `syncStacks`. Omis
    // pour une structure (S6) : « 1 » n'a pas de sens pour une tour.
    if (!isSiegeStructure) token.addChild(this.buildCountBadge(stack.count));
    return token;
  }

  /**
   * Pastille d'effectif d'une pile (badge canvas). Un `Container` unique
   * (fond + libellé) posé au pied du jeton ; nommé pour retrouvaille au resync.
   */
  private buildCountBadge(count: number): Container {
    const badge = new Container();
    badge.label = 'count-badge';
    const label = new Text({
      text: String(count),
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 15,
        fontWeight: '700',
        fill: 0xffffff,
        stroke: { color: 0x1a1c22, width: 4 },
        align: 'center',
      },
    });
    label.label = 'count-text';
    label.anchor.set(0.5);
    const padX = 6;
    const bg = new Graphics()
      .roundRect(-label.width / 2 - padX, -label.height / 2 - 1, label.width + padX * 2, label.height + 2, 6)
      .fill({ color: 0x1a1c22, alpha: 0.85 })
      .stroke({ width: 1, color: 0xf2e6c8, alpha: 0.9 });
    bg.label = 'count-bg';
    badge.addChild(bg, label);
    badge.position.set(0, TOKEN_RADIUS * 1.15);
    return badge;
  }

  /** Met à jour la pastille d'effectif d'un jeton (redimensionne le fond au texte). */
  private updateCountBadge(token: Container, count: number): void {
    const badge = token.getChildByLabel('count-badge') as Container | null;
    if (!badge) return;
    const label = badge.getChildByLabel('count-text') as Text | null;
    const bg = badge.getChildByLabel('count-bg') as Graphics | null;
    if (!label || !bg) return;
    if (label.text === String(count)) return; // pas de rework si inchangé
    label.text = String(count);
    const padX = 6;
    bg.clear()
      .roundRect(-label.width / 2 - padX, -label.height / 2 - 1, label.width + padX * 2, label.height + 2, 6)
      .fill({ color: 0x1a1c22, alpha: 0.85 })
      .stroke({ width: 1, color: 0xf2e6c8, alpha: 0.9 });
  }

  /**
   * C-SIEGE2 : hexes bloqués rendus comme obstacles = obstacles + murs de siège
   * (`combat.siegeWalls`). Le rempart apparaît donc comme bloqueur sur la grille
   * (art de rempart distinct = polish .2) et la surbrillance d'atteignabilité,
   * calculée par le moteur (`reachableHexes`), l'exclut déjà.
   */
  private blockedKeys(combat: CombatState): Set<string> {
    const set = new Set(combat.obstacles.map(hexKey));
    // Mode scène : les sprites de rempart marquent déjà leurs hexes — la teinte
    // « obstacle » + rocher dessinés dessous ne feraient que doubler le mur.
    if (!this.sceneActive) for (const w of combat.siegeWalls ?? []) set.add(hexKey(w));
    return set;
  }

  /** C-SIEGE2.3 : hexes de douve (teinte de fossé, ralentissement) — vide hors siège. */
  private moatKeys(combat: CombatState): Set<string> {
    return new Set((combat.moat ?? []).map(hexKey));
  }

  private redrawBoard(): void {
    const game = appStore.getState().game;
    const combat = game.combat;
    this.boardGfx.clear();
    if (!combat) return;

    // C-TACTICS : pendant le placement, surligne la BANDE autorisée (comme les
    // cases atteignables) et la pile sélectionnée à replacer — le joueur voit où
    // il peut poser au lieu de taper à l'aveugle.
    if (combat.phase === 'placement') {
      const band = this.placementBandHexes(game, combat);
      const selectedStack = this.placementSelectedId
        ? combat.stacks.find((s) => s.id === this.placementSelectedId)
        : undefined;
      drawBoard(this.boardGfx, {
        reachable: new Set(band.map(hexKey)),
        attackable: new Set(),
        obstacles: this.blockedKeys(combat),
        moat: this.moatKeys(combat),
        moatDecor: !this.sceneActive,
        selected: selectedStack?.pos ?? null,
      });
      return;
    }

    // F-SCHOOLS.8 (Pas de Brume) : en mode ciblage de téléportation, surligne les
    // destinations valides (helper moteur partagé) + la pile alliée à déplacer.
    const spellTarget = appStore.getState().combatSpellTarget;
    if (spellTarget) {
      let dests: OffsetPos[] = [];
      try {
        dests = teleportDestinations(game, spellTarget.spellId, spellTarget.targetStackId);
      } catch {
        dests = [];
      }
      const ally = combat.stacks.find((s) => s.id === spellTarget.targetStackId);
      drawBoard(this.boardGfx, {
        reachable: new Set(dests.map(hexKey)),
        attackable: new Set(),
        obstacles: this.blockedKeys(combat),
        moat: this.moatKeys(combat),
        moatDecor: !this.sceneActive,
        selected: ally?.pos ?? null,
      });
      return;
    }

    // C-SPELLUI.3 : pendant le choix de cible dans le grimoire, surligne la ZONE
    // d'effet du sort (cible + splash/all/chaîne) — helper moteur pur, aucune
    // géométrie hex ici. Vue seule : la cible se choisit via les puces texte.
    const spellZone = appStore.getState().combatSpellZone;
    if (spellZone) {
      let zoneHexes: OffsetPos[] = [];
      try {
        zoneHexes = spellAffectedStacks(game, spellZone.spellId, spellZone.targetStackId).map((s) => s.pos);
      } catch {
        zoneHexes = [];
      }
      const center = combat.stacks.find((s) => s.id === spellZone.targetStackId);
      drawBoard(this.boardGfx, {
        zone: new Set(zoneHexes.map(hexKey)),
        obstacles: this.blockedKeys(combat),
        moat: this.moatKeys(combat),
        moatDecor: !this.sceneActive,
        selected: center?.pos ?? null,
      });
      return;
    }

    const active = combat.stacks.find((s) => s.id === combat.activeStackId);
    const isPlayerTurn = !!active && active.side === combat.playerSide && !combat.finished;

    let reachable: OffsetPos[] = [];
    const attackableIds = new Set<string>();
    if (isPlayerTurn && active) {
      try {
        reachable = reachableHexes(game, active.id);
        // Cibles attaquables : helper moteur partagé (remédiation CL9) au lieu
        // d'une réimplémentation de la géométrie hex côté client.
        for (const target of attackableTargets(game, active.id)) attackableIds.add(target.id);
      } catch {
        reachable = [];
      }
    }
    const attackableHexes = new Set(
      combat.stacks.filter((s) => attackableIds.has(s.id)).map((s) => hexKey(s.pos)),
    );

    drawBoard(this.boardGfx, {
      reachable: new Set(reachable.map(hexKey)),
      attackable: attackableHexes,
      obstacles: this.blockedKeys(combat),
      moat: this.moatKeys(combat),
      moatDecor: !this.sceneActive,
      selected: this.selectionHex(combat),
    });
  }

  /** C-TACTICS : cases de la bande de placement du camp joueur (libres, hors obstacle). */
  private placementBandHexes(game: GameState, combat: CombatState): OffsetPos[] {
    let cols = 0;
    try {
      cols = combatTacticsColumns(game, combat);
    } catch {
      cols = 0;
    }
    const band =
      combat.playerSide === 'attacker'
        ? { min: 0, max: cols }
        : { min: COMBAT_COLS - 1 - cols, max: COMBAT_COLS - 1 };
    const obstacles = this.blockedKeys(combat);
    const occupied = new Set(combat.stacks.filter((s) => s.count > 0).map((s) => hexKey(s.pos)));
    const out: OffsetPos[] = [];
    for (let row = 0; row < COMBAT_ROWS; row++) {
      for (let col = band.min; col <= band.max; col++) {
        const key = hexKey({ col, row });
        if (obstacles.has(key) || occupied.has(key)) continue;
        out.push({ col, row });
      }
    }
    return out;
  }

  private selectionHex(combat: CombatState): OffsetPos | null {
    const selection = this.selection;
    if (!selection) return null;
    if (selection.kind === 'move') return selection.to;
    const target = combat.stacks.find((s) => s.id === selection.targetStackId);
    return target?.pos ?? null;
  }

  // ——— Interaction tap-tap (doc 08 §1, §2.4) ———

  /**
   * Appui long / clic maintenu (doc 08 §2.1) : ouvre la fiche de stats de la
   * pile sous le point pressé (n'importe quel camp, y compris pendant le
   * placement ou le tour adverse — c'est une consultation). Purement
   * présentation : pose `combatInspectId`, la couche DOM rend la fiche.
   */
  private handleLongPress(global: Point): void {
    if (this.destroyed) return;
    const combat = appStore.getState().game.combat;
    if (!combat) return;
    const local = this.boardLayer.toLocal(global);
    const hex = pixelToOffset(local.x, local.y);
    if (!inCombatBounds(hex)) return;
    const stack = combat.stacks.find((s) => sameHex(s.pos, hex) && s.count > 0);
    if (stack) appStore.setState({ combatInspectId: stack.id });
  }

  private async handleTap(global: Point): Promise<void> {
    if (this.destroyed) return;
    const game = appStore.getState().game;
    const combat = game.combat;
    if (!combat || combat.finished) return;
    // C-TACTICS : pendant le placement, le tap sélectionne une pile du camp
    // joueur puis la déplace sur une case libre de sa bande (PlaceStack).
    if (combat.phase === 'placement') {
      await this.handlePlacementTap(combat, global);
      return;
    }
    // F-SCHOOLS.8 : ciblage d'hex d'un sort de téléportation en cours — le tap
    // choisit la destination (ou annule si l'hex n'est pas une destination valide).
    if (appStore.getState().combatSpellTarget) {
      await this.handleTeleportTap(game, global);
      return;
    }
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
      } catch (err) {
        pushToast(commandErrorMessage(err), 'error'); // action rejetée (CL3) — surfacée, plus avalée
      }
      return;
    }

    this.selection = { kind: 'move', to: hex };
    // S3.3 : si la destination est un hex de douve, annoncer les dégâts de fossé
    // (lecture de `combat.moatDamage`, aucune règle nouvelle) au lieu de rien.
    const moatDamage = combat.moatDamage ?? 0;
    const intoMoat = moatDamage > 0 && (combat.moat ?? []).some((m) => sameHex(m, hex));
    combatPreview.set(intoMoat ? { kind: 'moat', damage: moatDamage } : null);
    this.redrawBoard();
  }

  /**
   * C-TACTICS : tap de la phase de placement. 1er tap sur une pile du camp
   * joueur = sélection ; tap suivant sur une case libre = `PlaceStack` (le
   * moteur borne à la bande / rejette les cases occupées, surfacé en toast).
   */
  private async handlePlacementTap(combat: CombatState, global: Point): Promise<void> {
    const local = this.boardLayer.toLocal(global);
    const hex = pixelToOffset(local.x, local.y);
    if (!inCombatBounds(hex)) {
      this.placementSelectedId = null;
      this.redrawBoard();
      return;
    }
    const own = combat.stacks.find((s) => sameHex(s.pos, hex) && s.side === combat.playerSide && s.count > 0);
    if (own) {
      this.placementSelectedId = own.id; // (re)sélection d'une pile à replacer
      this.redrawBoard();
      return;
    }
    if (this.placementSelectedId) {
      const stackId = this.placementSelectedId;
      this.placementSelectedId = null;
      try {
        await dispatch({ type: 'PlaceStack', stackId, to: hex });
      } catch (err) {
        pushToast(commandErrorMessage(err), 'error'); // hors bande / occupé — surfacé
      }
      this.redrawBoard();
    }
  }

  /**
   * F-SCHOOLS.8 (Pas de Brume) : tap en mode ciblage de téléportation. Un tap
   * sur une destination valide (`teleportDestinations`) dispatche
   * `CastSpell{…, targetHex}` ; tout autre tap ANNULE le ciblage (le grimoire ne
   * se rouvre pas — le joueur peut relancer). Le mode est purgé dans les deux cas.
   */
  private async handleTeleportTap(game: GameState, global: Point): Promise<void> {
    const target = appStore.getState().combatSpellTarget;
    if (!target) return;
    const local = this.boardLayer.toLocal(global);
    const hex = pixelToOffset(local.x, local.y);
    let dests: OffsetPos[] = [];
    try {
      dests = teleportDestinations(game, target.spellId, target.targetStackId);
    } catch {
      dests = [];
    }
    if (!inCombatBounds(hex) || !dests.some((p) => sameHex(p, hex))) {
      appStore.setState({ combatSpellTarget: null }); // annulation (hex hors zone)
      this.redrawBoard();
      return;
    }
    appStore.setState({ combatSpellTarget: null });
    try {
      await dispatch({ type: 'CastSpell', spellId: target.spellId, targetStackId: target.targetStackId, targetHex: hex });
    } catch (err) {
      pushToast(commandErrorMessage(err), 'error'); // rejeté (CL3) — surfacé
    }
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
      } catch (err) {
        pushToast(commandErrorMessage(err), 'error'); // action rejetée (CL3) — surfacée, plus avalée
      }
      return;
    }

    // C-LOS : le tir dépend de la ligne de vue vers CETTE cible ; une cible
    // masquée par un obstacle bascule en mêlée (origine de mêlée résolue).
    let ranged = false;
    try {
      ranged = canShootTarget(game, active.id, target.id);
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
      combatPreview.set(null); // aperçu de dégâts indisponible — dégradation d'affichage, pas de crash
    }
    this.redrawBoard();
  }

  /** Hex atteignable adjacent à la cible le plus proche de la pile active (mêlée). */
  private resolveMeleeFrom(
    game: GameState,
    active: CombatStack,
    target: CombatStack,
  ): OffsetPos | undefined {
    // Énumération des origines candidates : helper moteur partagé (CL9). La
    // *politique* de choix (le plus proche) reste ici, propre au client.
    let candidates: OffsetPos[] = [];
    try {
      candidates = meleeOriginsFor(game, active.id, target.id);
    } catch {
      candidates = [];
    }
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
    // B38 : recense les piles référencées par l'événement TANT qu'il est en file
    // — `syncStacks` sait ainsi qu'un jeton « en attente de mort » sera utilisé.
    for (const id of eventStackIds(event)) {
      this.queuedEventIds.set(id, (this.queuedEventIds.get(id) ?? 0) + 1);
    }
    this.queue = this.queue.then(async () => {
      try {
        await this.animateEvent(event);
      } finally {
        for (const id of eventStackIds(event)) {
          const left = (this.queuedEventIds.get(id) ?? 1) - 1;
          if (left > 0) this.queuedEventIds.set(id, left);
          else this.queuedEventIds.delete(id);
        }
        this.flushPendingDeaths();
      }
    });
  }

  /**
   * B38 (filet anti-fuite) : détruit les jetons « en attente de mort » que plus
   * aucun événement en file ne référence. Le cas nominal passe par
   * `animateDeath` (fondu puis destruction) ; ce filet couvre une pile retirée
   * de l'état sans `StackDied` animé (l'événement n'arrive jamais).
   */
  private flushPendingDeaths(): void {
    if (this.destroyed) return;
    for (const id of this.pendingDeathIds) {
      if (this.animatingIds.has(id) || (this.queuedEventIds.get(id) ?? 0) > 0) continue;
      const token = this.stackTokens.get(id);
      if (token && !token.destroyed) token.destroy();
      this.stackTokens.delete(id);
      this.pendingDeathIds.delete(id);
    }
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
        await this.animateAttack(event, speed);
        return;
      case 'StackDied':
        await this.animateDeath(event.stackId, speed);
        return;
      case 'StackHealed': {
        // lifeDrain / soin (A2a) : chiffre vert flottant sur la pile soignée.
        const token = this.stackTokens.get(event.stackId);
        if (token) this.spawnHealNumber(new Point(token.position.x, token.position.y), event.amount, token);
        return;
      }
      case 'MoatDamaged': {
        // C-SIEGE2.4 : dégâts de douve — chiffre de dégâts flottant sur la pile.
        const token = this.stackTokens.get(event.stackId);
        if (token && event.damage > 0) {
          this.spawnDamageNumber(new Point(token.position.x, token.position.y), event.damage, event.kills, false, false, token);
        }
        return;
      }
      case 'WallBombarded': {
        // S2.1 : tir de catapulte VISIBLE — boulet en arc balistique depuis le
        // flanc attaquant vers le segment visé, puis impact « éclats de pierre ».
        const target = offsetToPixel({ col: event.col, row: event.row });
        const bounds = computeBoardBounds();
        const origin = new Point(bounds.minX - HERO_FLANK_OFFSET, target.y);
        const to = new Point(target.x, target.y);
        const reduced = prefersReducedMotion();
        await spawnProjectile(this.fxLayer, origin, to, { speed, reduced, shape: 'boulder' });
        await spawnRubbleImpact(this.fxLayer, to, { speed, reduced });
        // C-SIEGE2.6 : quand un segment tombe, l'état a déjà retiré le mur ⇒
        // redessiner le plateau ouvre l'hex (la brèche s'élargit) ; `syncWalls`
        // anime la chute du sprite (S2.3).
        if (event.destroyed) this.redrawBoard();
        return;
      }
      case 'StackCursed': {
        // curseOnHit (A2c) : label « maudit » violet sur la cible affligée.
        const token = this.stackTokens.get(event.targetId);
        if (token) this.spawnFloatingLabel(new Point(token.position.x, token.position.y), 'maudit', 0xb07de0);
        return;
      }
      case 'StackFeared': {
        // fear (Sombral, doc 16 §4) : label « peur » sombre sur la cible effrayée.
        const token = this.stackTokens.get(event.targetId);
        if (token) this.spawnFloatingLabel(new Point(token.position.x, token.position.y), 'peur', 0x9b6bd0);
        return;
      }
      case 'SpellCast': {
        // C-HEROSPRITE : le héros lanceur se rue, la cible reçoit son retour
        // visuel (le sort du héros n'avait AUCUN feedback canvas).
        const combat = appStore.getState().game.combat;
        const side: CombatSideId =
          combat && event.heroId === combat.defenderHeroId ? 'defender' : 'attacker';
        await this.lungeHero(side, speed);
        const target = this.stackTokens.get(event.targetId);
        if (target && !target.destroyed) {
          const at = new Point(target.position.x, target.position.y);
          const kind = appStore.getState().game.spellCatalog[event.spellId]?.kind;
          // B6 : retour visuel du sort DISTINCT de la frappe (onde/étincelles/halo
          // par famille) — même pour un buff/debuff sans nombre flottant.
          if (kind) await spawnSpellImpact(this.fxLayer, at, kind, { speed, reduced: prefersReducedMotion() });
          if (event.amount > 0) {
            if (kind === 'heal') this.spawnHealNumber(at, event.amount, target);
            else this.spawnDamageNumber(at, event.amount, event.kills, false, false, target);
          }
        }
        return;
      }
      case 'UnitSpellCast': {
        // A2h + B6 : une pile lanceuse (`spellcaster`) — FX de sort sur la cible
        // (jusqu'ici AUCUN retour visuel) + nombre de dégâts/soin.
        const target = this.stackTokens.get(event.targetId);
        if (target && !target.destroyed) {
          const at = new Point(target.position.x, target.position.y);
          const kind = appStore.getState().game.spellCatalog[event.spellId]?.kind;
          if (kind) await spawnSpellImpact(this.fxLayer, at, kind, { speed, reduced: prefersReducedMotion() });
          if (event.amount > 0) {
            if (kind === 'heal') this.spawnHealNumber(at, event.amount, target);
            else this.spawnDamageNumber(at, event.amount, event.kills, false, false, target);
          }
        }
        return;
      }
      case 'HeroStruck': {
        // C1 + C-HEROSPRITE : ruée du héros frappeur + dégâts sur la cible.
        await this.lungeHero(event.side, speed);
        const target = this.stackTokens.get(event.targetId);
        if (target && !target.destroyed) {
          this.spawnDamageNumber(
            new Point(target.position.x, target.position.y),
            event.amount,
            event.kills,
            false,
            false,
            target,
          );
        }
        return;
      }
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
      // Garde `destroyed` (lot M4) : l'auto par rounds enchaîne les animations —
      // la scène/le jeton peuvent être détruits pendant un tween en vol.
      if (token.destroyed) return;
      token.position.set(start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t);
    });
    this.animatingIds.delete(stackId);
  }

  private async animateAttack(
    event: Extract<AppEvent, { type: 'StackAttacked' }>,
    speed: number,
  ): Promise<void> {
    const { attackerId, targetId, damage, kills, lucky, unlucky, dodged, ranged } = event;
    const attacker = this.stackTokens.get(attackerId);
    if (!attacker) return;
    const target = this.stackTokens.get(targetId);
    const origin = new Point(attacker.position.x, attacker.position.y);
    const dest = target ? new Point(target.position.x, target.position.y) : origin;
    const reduced = prefersReducedMotion();
    this.animatingIds.add(attackerId);
    // Impact commun (tir & mêlée) : flash + chiffres + micro-secousse. Une frappe
    // esquivée (`incorporeal`, A2b) affiche « esquive » sans dégâts.
    const impact = (): void => {
      if (!target || target.destroyed) return;
      if (dodged) {
        this.spawnFloatingLabel(dest, 'esquive', 0x8fb3d9, target);
      } else {
        target.tint = 0xff6666;
        this.spawnDamageNumber(dest, damage, kills, lucky, unlucky, target);
        if (!reduced) void this.shakeToken(target, dest);
      }
    };
    if (ranged) {
      // Tir (B6) : micro-recul du tireur → projectile traverse le plateau →
      // impact. Le SFX `combat-shoot` coïncide enfin avec un visuel qui vole.
      const recoil = new Point(origin.x - (dest.x - origin.x) * 0.06, origin.y - (dest.y - origin.y) * 0.06);
      await tween(ATTACK_LUNGE_MS / 3 / speed, (t) => {
        if (attacker.destroyed) return;
        attacker.position.set(origin.x + (recoil.x - origin.x) * t, origin.y + (recoil.y - origin.y) * t);
      });
      await spawnProjectile(this.fxLayer, origin, dest, { speed, reduced });
      impact();
      if (!attacker.destroyed) attacker.position.set(origin.x, origin.y);
    } else {
      // Mêlée : ruée à 35 % du chemin puis retour (inchangé).
      const mid = new Point(origin.x + (dest.x - origin.x) * 0.35, origin.y + (dest.y - origin.y) * 0.35);
      const half = ATTACK_LUNGE_MS / 2 / speed;
      // Gardes `destroyed` (lot M4) : l'auto par rounds enchaîne les animations —
      // la scène et ses jetons peuvent être détruits pendant un tween en vol.
      await tween(half, (t) => {
        if (attacker.destroyed) return;
        attacker.position.set(origin.x + (mid.x - origin.x) * t, origin.y + (mid.y - origin.y) * t);
      });
      impact();
      await tween(half, (t) => {
        if (attacker.destroyed) return;
        attacker.position.set(mid.x + (origin.x - mid.x) * t, mid.y + (origin.y - mid.y) * t);
      });
      if (!attacker.destroyed) attacker.position.set(origin.x, origin.y);
    }
    if (target && !target.destroyed) target.tint = 0xffffff;
    this.animatingIds.delete(attackerId);
  }

  /**
   * UXD-4 (+ fidélité HoMM Online, capture 4) : popup flottant à la position de
   * la cible après une frappe. Ligne de **dégâts** (`-N`, `★` sur coup de chance)
   * et, si la frappe tue, une 2ᵉ ligne **kills** plus grosse et colorée (mise en
   * avant façon HO). Monte et s'efface (~700 ms) ; `prefers-reduced-motion` :
   * statique puis fondu. Groupe transitoire ⇒ self-destruction (pas d'accumulation).
   */
  private spawnDamageNumber(
    at: Point,
    damage: number,
    kills: number,
    lucky: boolean,
    unlucky = false,
    follow?: Container | null,
  ): void {
    const group = new Container();
    // Marqueurs a11y (glyphe + couleur) : ★ chance (or), ⚑ malchance (bleu-gris).
    const prefix = lucky ? '★ ' : unlucky ? '⚑ ' : '';
    const dmg = new Text({
      text: `${prefix}-${damage}`,
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 22,
        fontWeight: '700',
        fill: lucky ? 0xf1c40f : unlucky ? 0x8fb3d9 : 0xffe0d6,
        stroke: { color: 0x1a1c22, width: 4 },
        align: 'center',
      },
    });
    dmg.anchor.set(0.5, 1);
    group.addChild(dmg);
    if (kills > 0) {
      dmg.position.y = -4; // laisse la place à la 2ᵉ ligne
      const killsText = new Text({
        text: `☠ ${kills}`,
        style: {
          fontFamily: 'system-ui, sans-serif',
          fontSize: 26,
          fontWeight: '700',
          fill: 0xff7a3c, // orange sang : les pertes ressortent (2ᵉ canal a11y : taille + glyphe)
          stroke: { color: 0x1a1c22, width: 4 },
          align: 'center',
        },
      });
      killsText.anchor.set(0.5, 0);
      group.addChild(killsText);
    }
    // S8.1 : ancré bien AU-DESSUS du sprite (≈1,5 rayon) — ne recouvre plus le
    // badge d'effectif (posé sous le jeton) ni les voisins immédiats.
    group.position.set(at.x, at.y - TOKEN_RADIUS * 1.5);
    this.fxLayer.addChild(group);
    const reduced = prefersReducedMotion();
    const startY = group.position.y;
    // S8.2 : si la pile suivie meurt (fondu du jeton terminé), écourter le popup
    // orphelin — plus de « −38 » flottant sur de l'herbe nue.
    let deadT: number | null = null;
    void tween(700, (t) => {
      if (group.destroyed) return; // scène détruite pendant le vol (lot M4)
      if (deadT === null && follow?.destroyed) deadT = t;
      if (deadT !== null) {
        group.alpha = Math.max(0, 1 - (t - deadT) / 0.15); // fondu rapide (~150 ms)
        return;
      }
      if (!reduced) group.position.y = startY - 30 * t;
      group.alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4; // plein puis fondu
    }).then(() => {
      if (!group.destroyed) group.destroy({ children: true });
    });
  }

  /** Chiffre de soin flottant (vert, `+N`) — lifeDrain / soin (A2a). */
  private spawnHealNumber(at: Point, amount: number, follow?: Container | null): void {
    if (amount <= 0) return;
    this.spawnFloatingLabel(at, `+${amount}`, 0x6fe08a, follow); // vert soin (a11y : signe + couleur)
  }

  /** Étiquette flottante générique (montée + fondu) — soin, esquive, etc. */
  private spawnFloatingLabel(at: Point, label: string, color: number, follow?: Container | null): void {
    const text = new Text({
      text: label,
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 22,
        fontWeight: '700',
        fill: color,
        stroke: { color: 0x1a1c22, width: 4 },
        align: 'center',
      },
    });
    text.anchor.set(0.5, 1);
    // S8.1 : ancré au-dessus du sprite (cohérent avec spawnDamageNumber).
    text.position.set(at.x, at.y - TOKEN_RADIUS * 1.5);
    this.fxLayer.addChild(text);
    const reduced = prefersReducedMotion();
    const startY = text.position.y;
    let deadT: number | null = null;
    void tween(700, (t) => {
      if (text.destroyed) return;
      if (deadT === null && follow?.destroyed) deadT = t; // S8.2 : suit la mort du jeton
      if (deadT !== null) {
        text.alpha = Math.max(0, 1 - (t - deadT) / 0.15);
        return;
      }
      if (!reduced) text.position.y = startY - 30 * t;
      text.alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
    }).then(() => {
      if (!text.destroyed) text.destroy();
    });
  }

  /** Micro-secousse d'un jeton touché (≤ 150 ms) — coupée par reduced-motion. */
  private async shakeToken(token: Container, home: Point): Promise<void> {
    await tween(150, (t) => {
      if (token.destroyed) return;
      const amp = (1 - t) * 3;
      token.position.set(home.x + Math.sin(t * Math.PI * 6) * amp, home.y);
    });
    if (!token.destroyed) token.position.set(home.x, home.y);
  }

  /**
   * I2 — respiration idle : chaque jeton oscille verticalement d'une amplitude
   * subtile, désynchronisé par un déphasage déterministe (hash de l'id). Coupé
   * en `reduce-motion` (tous les `bob` remis à 0). Purement présentation : ne
   * touche jamais `token.position` (placement hex / animations d'action) — seul
   * le conteneur `bob` interne bouge. Expose l'amplitude max pour le smoke.
   */
  private idleTick(): void {
    if (this.destroyed) return;
    const reduced = prefersReducedMotion();
    const time = performance.now() / 1000;
    let maxBob = 0;
    for (const [id, token] of this.stackTokens) {
      const bob = token.getChildByLabel('bob');
      if (!bob) continue;
      if (reduced) {
        bob.y = 0;
        continue;
      }
      const y = Math.sin(time * IDLE_BOB_HZ * Math.PI * 2 + idlePhase(id)) * IDLE_BOB_PX;
      bob.y = y;
      maxBob = Math.max(maxBob, Math.abs(y));
    }
    combatIdleStats.bob = reduced ? 0 : maxBob;
  }

  /**
   * I5 — micro-secousse du plateau sur kill de pile entière (~4 px, 120 ms).
   * Décale la RACINE de scène (`this.container`, toujours à l'origine — le
   * `camera.world` en dessous garde son pan/zoom) puis la restaure. Un verrou
   * évite le cumul quand plusieurs piles meurent d'affilée (auto par rounds).
   */
  private async shakeBoard(): Promise<void> {
    if (this.boardShaking) return;
    this.boardShaking = true;
    combatShakeStats.count += 1;
    await tween(SHAKE_MS, (t) => {
      if (this.destroyed || this.container.destroyed) return;
      const amp = (1 - t) * SHAKE_PX;
      this.container.position.set(Math.sin(t * Math.PI * 8) * amp, 0);
    });
    if (!this.destroyed && !this.container.destroyed) this.container.position.set(0, 0);
    this.boardShaking = false;
  }

  private async animateDeath(stackId: string, speed: number): Promise<void> {
    const token = this.stackTokens.get(stackId);
    if (!token) return;
    const reduced = prefersReducedMotion();
    const bob = token.getChildByLabel('bob');
    this.animatingIds.add(stackId);
    // I5 : la pile meurt (kill entier) ⇒ le plateau tressaille (hors reduce-motion).
    if (!reduced) void this.shakeBoard();
    await tween(DEATH_FADE_MS / speed, (t) => {
      if (token.destroyed) return; // scène détruite pendant le fondu (lot M4)
      token.alpha = 1 - t;
      // I4 : la mort n'est plus un simple fondu — le jeton bascule (~90°).
      if (bob && !reduced) bob.rotation = t * DEATH_TIP_RAD;
    });
    this.animatingIds.delete(stackId);
    if (!token.destroyed) token.destroy();
    this.stackTokens.delete(stackId);
    this.pendingDeathIds.delete(stackId); // mort différée honorée (B38)
  }
}

/**
 * Piles référencées par un événement ANIMÉ par la scène (B38) — la destruction
 * du jeton d'une pile morte est différée tant que l'un de ces événements est en
 * file. Aligné sur le switch de `animateEvent` : seuls les événements qui y
 * touchent un jeton comptent.
 */
function eventStackIds(event: AppEvent): string[] {
  switch (event.type) {
    case 'StackMoved':
    case 'StackDied':
    case 'StackHealed':
    case 'MoatDamaged':
      return [event.stackId];
    case 'StackAttacked':
      return [event.attackerId, event.targetId];
    case 'StackCursed':
    case 'StackFeared':
    case 'SpellCast':
    case 'UnitSpellCast':
    case 'HeroStruck':
      return [event.targetId];
    default:
      return [];
  }
}

/**
 * S6 — socle de pierre d'une structure de siège (tour de tir) : galette de
 * fondation crénelée au sol, à la place de l'ellipse de camp. Procédural et
 * déterministe (aucun RNG), teintes pierre cohérentes avec `drawBoulder`.
 */
function buildStructureBase(): Graphics {
  const g = new Graphics();
  const w = TOKEN_RADIUS * 0.95;
  const h = TOKEN_RADIUS * 0.42;
  const y = TOKEN_RADIUS * 0.72;
  // Ombre au sol + assise de pierre rectangulaire (fondation d'ouvrage).
  g.ellipse(0, y + h * 0.25, w, h * 0.5).fill({ color: 0x2a2620, alpha: 0.4 });
  g.roundRect(-w, y - h, w * 2, h * 1.4, 4)
    .fill({ color: 0x6f665a })
    .stroke({ width: 2, color: 0x3a332b });
  // Créneaux d'assise (2ᵉ canal non chromatique : c'est un ouvrage, pas un socle).
  for (let i = -2; i <= 2; i++) {
    g.rect(i * (w * 0.42) - w * 0.14, y - h - 5, w * 0.28, 6).fill({ color: 0x847a6b });
  }
  return g;
}

/** S6 — repli procédural d'une tour de tir (sprite absent/en cours) : tourelle de pierre. */
function buildStructureGraphic(): Graphics {
  const g = new Graphics();
  const w = TOKEN_RADIUS * 0.62;
  const top = -TOKEN_RADIUS * 0.95;
  const bottom = TOKEN_RADIUS * 0.5;
  g.rect(-w, top, w * 2, bottom - top)
    .fill({ color: 0x7c7266 })
    .stroke({ width: 2, color: 0x4d453c });
  // Créneaux du sommet.
  for (let i = -1; i <= 1; i++) {
    g.rect(i * w - w * 0.35, top - 7, w * 0.7, 8).fill({ color: 0x9a8f80 });
  }
  // Meurtrière (fente de tir).
  g.rect(-w * 0.22, top + w * 0.5, w * 0.44, bottom - top - w * 0.9).fill({ color: 0x2a2620 });
  return g;
}

/** Polygone de repli par pile — forme distincte par camp (sprite d'unité absent/en cours). */
function buildStackTokenGraphic(side: CombatSideId): Graphics {
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

/**
 * Respecte le réglage « réduire les animations » (a11y, doc 08 §4) : option en
 * jeu (lot M8 C3) UNIE au réglage système, via le helper partagé `reduceMotion`.
 */
function prefersReducedMotion(): boolean {
  return reduceMotion();
}

/**
 * S7.3 — teinte de médaillon déterministe dérivée d'un id de faction (FNV-1a),
 * même esprit que le `FactionBadge` de l'UI DOM : couleur sombre mais lisible
 * (jamais noir pur) sous l'initiale claire du héros. Ids de faction opaques.
 */
function factionTint(factionId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < factionId.length; i += 1) {
    h ^= factionId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // Teinte HSL déterministe → RGB, luminosité bornée basse (fond de médaillon).
  const hue = h % 360;
  return hslToHex(hue, 0.4, 0.28);
}

/** Conversion HSL→hex 0xRRGGBB (déterministe, pour la teinte de médaillon S7.3). */
function hslToHex(hDeg: number, s: number, l: number): number {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = hDeg / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  const to = (v: number): number => Math.round((v + m) * 255) & 0xff;
  return (to(r) << 16) | (to(g) << 8) | to(b);
}

/** Déphasage idle déterministe d'une pile (0..2π) dérivé de son id — désynchronise les jetons. */
function idlePhase(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 997;
  return (h / 997) * Math.PI * 2;
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
