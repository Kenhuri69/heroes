import { Application, Assets, Container, Graphics, Point, Sprite, Text } from 'pixi.js';
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
import { onTap } from '../../input/pointer';
import { Camera } from '../../render/camera';
import { heroAvatarUrl, unitSpriteUrl } from '../../render/assets';
import { heroArchetype } from '../../app/game';
import { HEX_SIZE, computeBoardBounds, drawBoard, hexKey, offsetToPixel, pixelToOffset } from '../../render/hexgrid';
import { combatPreview } from './preview';
import { reduceMotion } from '../../app/motion';

const ATTACKER_COLOR = 0xc0392b;
const DEFENDER_COLOR = 0x2e6da4;
const TOKEN_RADIUS = HEX_SIZE * 0.62;
const ACTIVE_RING_COLOR = 0xf1c40f;

// Durées de base (ms) à vitesse ×1 — divisées par `combatSpeed` (doc 08 §2.4).
const MOVE_MS_PER_HEX = 140;
const ATTACK_LUNGE_MS = 220;
const DEATH_FADE_MS = 260;

// C-HEROSPRITE (doc 08 §2.4) : jeton du héros au flanc de la grille.
const HERO_TOKEN_RADIUS = HEX_SIZE * 0.85;
const HERO_FLANK_OFFSET = HEX_SIZE * 1.3; // du bord du plateau au centre du jeton
const HERO_LUNGE_MS = 260;
const HERO_LUNGE_PX = HEX_SIZE * 0.6;

const MARGIN_TOP = 96; // bandeau armées + round (doc 08 §2.4)
const MARGIN_BOTTOM = 96; // barre d'actions
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
  private readonly stacksLayer = new Container();
  /** UXD-4 : effets éphémères (chiffres de dégâts flottants) au-dessus des piles. */
  private readonly fxLayer = new Container();
  private readonly activeRing: Graphics;
  private readonly stackTokens = new Map<string, Container>();
  private readonly animatingIds = new Set<string>();
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

  private readonly resizeObserver: ResizeObserver;
  private readonly unsubscribeStore: () => void;
  private readonly unsubscribeEvents: () => void;
  private readonly unsubscribeTap: () => void;

  constructor(private readonly app: Application) {
    this.boardLayer.addChild(this.boardGfx, this.heroLayer, this.stacksLayer, this.fxLayer);
    this.fxLayer.eventMode = 'none'; // purement décoratif : ne capte jamais le tap
    this.heroLayer.eventMode = 'none'; // jetons de héros décoratifs (C-HEROSPRITE)
    // Le plateau vit dans la caméra de combat (pan/pinch/molette, plancher tactile).
    this.camera = new Camera(app, { minZoom: MIN_COMBAT_SCALE, maxZoom: MAX_SCALE });
    this.camera.world.addChild(this.boardLayer);
    this.container.addChild(this.camera.world);

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
    this.container.removeChild(this.camera.world);
    this.camera.destroy(); // retire les listeners + détruit world (plateau, tokens)
    this.container.destroy({ children: true });
  }

  // ——— Layout ———

  private layout(): void {
    const bounds = computeBoardBounds();
    const availW = Math.max(1, this.app.screen.width - MARGIN_SIDE * 2);
    const availH = Math.max(1, this.app.screen.height - MARGIN_TOP - MARGIN_BOTTOM);
    // Plancher d'échelle : hexes ≥ 44 px même en portrait (le plateau déborde
    // alors et se déplace au pan/pinch, doc 08 §1/§2.4). Cap à MAX_SCALE.
    const fit = Math.min(availW / bounds.width, availH / bounds.height, MAX_SCALE);
    const scale = Math.max(fit, MIN_COMBAT_SCALE);
    this.camera.world.scale.set(scale);
    this.camera.world.position.set(
      MARGIN_SIDE + (availW - bounds.width * scale) / 2 - bounds.minX * scale,
      MARGIN_TOP + (availH - bounds.height * scale) / 2 - bounds.minY * scale,
    );
    // Un resize recentrait déjà la caméra (pan perdu) : recadrer sur la pile
    // active plutôt que sur le centre du plateau quand il déborde (R5b).
    const combat = appStore.getState().game.combat;
    if (combat) this.centerOnActive(combat);
  }

  /**
   * UXD-0 R5b : à l'OUVERTURE du combat seulement, si le plateau déborde de
   * l'écran (échelle plancher 44 px en portrait), centre la vue sur l'hex de
   * la pile active — sinon aucune unité n'était visible au 1er round. Le
   * pan/pinch de l'utilisateur reste maître ensuite (pas de recentrage).
   */
  private centerOnActive(combat: CombatState): void {
    const bounds = computeBoardBounds();
    const scale = this.camera.world.scale.x;
    const availW = Math.max(1, this.app.screen.width - MARGIN_SIDE * 2);
    const availH = Math.max(1, this.app.screen.height - MARGIN_TOP - MARGIN_BOTTOM);
    if (bounds.width * scale <= availW && bounds.height * scale <= availH) return; // layout() centré suffit
    const active = combat.stacks.find((s) => s.id === combat.activeStackId) ?? combat.stacks[0];
    if (!active) return;
    const { x, y } = offsetToPixel(active.pos);
    this.camera.world.position.set(
      this.app.screen.width / 2 - x * scale,
      MARGIN_TOP + availH / 2 - y * scale,
    );
  }

  // ——— Resync depuis le store (réconciliation simple, doc 10 §2.2) ———

  private sync(): void {
    if (this.destroyed) return;
    const combat = appStore.getState().game.combat;
    if (!combat) {
      this.combatShown = false;
      this.selection = null;
      combatPreview.set(null);
      this.boardGfx.clear();
      this.fxLayer.removeChildren().forEach((c) => c.destroy()); // purge des chiffres flottants
      for (const [id, token] of this.stackTokens) {
        if (this.animatingIds.has(id)) continue;
        token.destroy();
        this.stackTokens.delete(id);
      }
      this.activeRing.visible = false;
      for (const token of this.heroTokens.values()) token.destroy({ children: true });
      this.heroTokens.clear();
      return;
    }
    if (!this.combatShown) {
      this.combatShown = true;
      this.centerOnActive(combat);
      this.buildHeroTokens(combat);
    }
    this.syncStacks(combat);
    this.redrawBoard();
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
      // Socle + cadre circulaire au liseré du camp (repli visible tant que
      // l'avatar n'est pas chargé — ou s'il n'existe pas).
      token.addChild(
        new Graphics()
          .ellipse(0, HERO_TOKEN_RADIUS * 0.9, HERO_TOKEN_RADIUS * 0.8, HERO_TOKEN_RADIUS * 0.3)
          .fill({ color, alpha: 0.85 })
          .stroke({ width: 2, color: 0x1a1c22 })
          .circle(0, 0, HERO_TOKEN_RADIUS)
          .fill(0x232630)
          .stroke({ width: 3, color }),
      );
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
    // Base de camp (ellipse au sol) : distingue attaquant/défenseur.
    token.addChild(
      new Graphics()
        .ellipse(0, TOKEN_RADIUS * 0.7, TOKEN_RADIUS * 0.85, TOKEN_RADIUS * 0.35)
        .fill({ color: side === 'attacker' ? ATTACKER_COLOR : DEFENDER_COLOR, alpha: 0.85 })
        .stroke({ width: 2, color: 0x1a1c22 }),
    );
    const fallback = buildStackTokenGraphic(side);
    token.addChild(fallback);

    const catalog = appStore.getState().game.unitCatalog;
    const url = unitSpriteUrl(stack.unitId, catalog[stack.unitId]?.groupId);
    if (url) {
      void Assets.load(url).then((texture) => {
        if (this.destroyed || token.destroyed) return;
        token.removeChild(fallback);
        fallback.destroy();
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5, 0.72); // pieds posés sur la base de camp
        const scale = (TOKEN_RADIUS * 2.4) / Math.max(texture.width, texture.height);
        sprite.scale.set(scale);
        token.addChildAt(sprite, 1); // au-dessus de la base, sous l'anneau actif
      });
    }
    return token;
  }

  /**
   * C-SIEGE2 : hexes bloqués rendus comme obstacles = obstacles + murs de siège
   * (`combat.siegeWalls`). Le rempart apparaît donc comme bloqueur sur la grille
   * (art de rempart distinct = polish .2) et la surbrillance d'atteignabilité,
   * calculée par le moteur (`reachableHexes`), l'exclut déjà.
   */
  private blockedKeys(combat: CombatState): Set<string> {
    const set = new Set(combat.obstacles.map(hexKey));
    for (const w of combat.siegeWalls ?? []) set.add(hexKey(w));
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
        selected: ally?.pos ?? null,
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
    combatPreview.set(null);
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
        await this.animateAttack(event, speed);
        return;
      case 'StackDied':
        await this.animateDeath(event.stackId, speed);
        return;
      case 'StackHealed': {
        // lifeDrain / soin (A2a) : chiffre vert flottant sur la pile soignée.
        const token = this.stackTokens.get(event.stackId);
        if (token) this.spawnHealNumber(new Point(token.position.x, token.position.y), event.amount);
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
        if (target && !target.destroyed && event.amount > 0) {
          const at = new Point(target.position.x, target.position.y);
          const kind = appStore.getState().game.spellCatalog[event.spellId]?.kind;
          if (kind === 'heal') this.spawnHealNumber(at, event.amount);
          else this.spawnDamageNumber(at, event.amount, event.kills, false, false);
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
    const { attackerId, targetId, damage, kills, lucky, unlucky, dodged } = event;
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
    // Gardes `destroyed` (lot M4) : l'auto par rounds enchaîne les animations —
    // la scène et ses jetons peuvent être détruits pendant un tween en vol.
    await tween(half, (t) => {
      if (attacker.destroyed) return;
      attacker.position.set(origin.x + (mid.x - origin.x) * t, origin.y + (mid.y - origin.y) * t);
    });
    // Impact : flash sur la cible + chiffres de dégâts flottants + micro-secousse.
    // Une frappe esquivée (`incorporeal`, A2b) affiche « esquive » sans dégâts.
    if (target && !target.destroyed) {
      if (dodged) {
        this.spawnFloatingLabel(dest, 'esquive', 0x8fb3d9);
      } else {
        target.tint = 0xff6666;
        this.spawnDamageNumber(dest, damage, kills, lucky, unlucky);
        if (!prefersReducedMotion()) void this.shakeToken(target, dest);
      }
    }
    await tween(half, (t) => {
      if (attacker.destroyed) return;
      attacker.position.set(mid.x + (origin.x - mid.x) * t, mid.y + (origin.y - mid.y) * t);
    });
    if (!attacker.destroyed) attacker.position.set(origin.x, origin.y);
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
    group.position.set(at.x, at.y - TOKEN_RADIUS * 0.6);
    this.fxLayer.addChild(group);
    const reduced = prefersReducedMotion();
    const startY = group.position.y;
    void tween(700, (t) => {
      if (group.destroyed) return; // scène détruite pendant le vol (lot M4)
      if (!reduced) group.position.y = startY - 30 * t;
      group.alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4; // plein puis fondu
    }).then(() => {
      if (!group.destroyed) group.destroy({ children: true });
    });
  }

  /** Chiffre de soin flottant (vert, `+N`) — lifeDrain / soin (A2a). */
  private spawnHealNumber(at: Point, amount: number): void {
    if (amount <= 0) return;
    this.spawnFloatingLabel(at, `+${amount}`, 0x6fe08a); // vert soin (a11y : signe + couleur)
  }

  /** Étiquette flottante générique (montée + fondu) — soin, esquive, etc. */
  private spawnFloatingLabel(at: Point, label: string, color: number): void {
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
    text.position.set(at.x, at.y - TOKEN_RADIUS * 0.6);
    this.fxLayer.addChild(text);
    const reduced = prefersReducedMotion();
    const startY = text.position.y;
    void tween(700, (t) => {
      if (text.destroyed) return;
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

  private async animateDeath(stackId: string, speed: number): Promise<void> {
    const token = this.stackTokens.get(stackId);
    if (!token) return;
    this.animatingIds.add(stackId);
    await tween(DEATH_FADE_MS / speed, (t) => {
      if (token.destroyed) return; // scène détruite pendant le fondu (lot M4)
      token.alpha = 1 - t;
    });
    this.animatingIds.delete(stackId);
    if (!token.destroyed) token.destroy();
    this.stackTokens.delete(stackId);
  }
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
