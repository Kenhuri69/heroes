import { Application, Point } from 'pixi.js';
import type { Command, GameState, GridPos } from '@heroes/engine';
import { CURRENT_SAVE_VERSION, findPath, serializeState } from '@heroes/engine';
import { Camera } from './render/camera';
import { isoTileCenter } from './render/projection';
import { WORLD_OCEAN_CSS } from './render/worldBorder';
import { loadGameContent, loadDefaultMap, loadScenarioMap, resolveGeneratedMap } from './app/content';
import {
  buildFactionSetup,
  buildGrowthGroupSetup,
  buildHeroRosterSetup,
  buildHeroSetup,
  buildHouseSetup,
  buildTownSetup,
  buildUnitCatalog,
  newGameCommand,
  newGameStartCommand,
  resolveNewGameConfig,
  scenarioStartCommand,
  skirmishStartCommand,
  type NewGameRawConfig,
  type SkirmishConfig,
} from './app/game';
import { dispatch } from './app/dispatch';
import { appStore } from './app/store';
import { navigate } from './app/router';
import { exportSave, importSave, saveGame, restoreSavedGame, encodeHeroesFile } from './app/save';
import { installAutosave } from './app/autosave';
import { installCombatLog } from './app/combat-log';
import { initTelemetry } from './app/telemetry';
import { initAudio } from './app/audio';
import { initReduceMotion } from './app/motion';
import { initNarrative, initCombatBarks, loadScenarioNarrative, loadFreeModeNarrative } from './app/narrative';
import { buildDailyQuests } from './app/daily';
import { armDailyRefresh, disarmDailyRefresh } from './app/daily-refresh';
import { registerCamera, unregisterCamera } from './app/camera-control';
import { playOpeningCutscene } from './app/cutscene';
import { initCampaign, startCampaignChapter, campaignFlags } from './app/campaign';
import { initI18n, t } from './app/i18n';
import { preloadPixiTextures, combatBackgroundUrl, chromeFrameUrl, chromeRibbonUrl, initHeroAvatars } from './render/assets';
import { AdventureScene } from './scenes/adventure/AdventureScene';
import { CombatScene } from './scenes/combat/CombatScene';
import { mountUi } from './ui/shell';
import { pushToast } from './ui/toasts';

declare global {
  interface Window {
    __HEROES_READY__?: boolean;
    /** Résumé du contenu chargé — inspecté par le smoke test. */
    __HEROES_CONTENT__?: { factions: string[]; rejected: string[] };
    /** Surface de test (smoke Playwright) : état, commandes, coordonnées écran. */
    __HEROES_TEST__?: {
      getState: () => GameState;
      getPlayerColors: () => Record<string, number>;
      dispatch: (cmd: Command) => Promise<unknown>;
      tileToScreen: (x: number, y: number) => { x: number; y: number };
      save: () => Promise<void>;
      load: () => Promise<boolean>;
      /** Aller-retour export → import `.heroes` (couverture smoke du lot F). */
      saveRoundtrip: () => Promise<boolean>;
      /** Import d'une sauvegarde à version de forme incompatible (lot 3.8) — doit échouer. */
      importIncompatibleSave: () => Promise<boolean>;
      /** Démarre un scénario par id, seed fixe (couverture smoke du lot U). */
      startScenario: (scenarioId: string) => Promise<void>;
      /** Démarre une escarmouche vs IA, seed fixe (couverture smoke Alpha 4.14). */
      startSkirmish: (config: SkirmishConfig) => Promise<void>;
      /** Démarre un chapitre de campagne, seed fixe (couverture smoke N3a). */
      startCampaignChapter: (campaignId: string, chapterIndex: number) => Promise<void>;
      /** Drapeaux de campagne posés par les choix de dialogue (couverture smoke N3c.2). */
      campaignFlags: () => Record<string, boolean>;
      /** Progression des tours IA (UX multi-joueurs) — non-null pendant qu'une IA joue. */
      getAiTurn: () => { seat: number; done: number; total: number } | null;
      /** Abonnement au store (couverture smoke) : observe l'état d'UI transitoire (ex. `aiTurn`). */
      subscribe: (cb: () => void) => () => void;
      /** Chemin A* moteur d'un héros vers (x,y), autres héros/gardiens bloqués, destination permise (smoke H-VS-H). */
      findPath: (heroId: string, x: number, y: number) => GridPos[] | null;
      /** Ids des héros ayant un jeton RENDU sur la carte (smoke : visibilité des héros adverses en vision). */
      renderedHeroIds: () => string[];
    };
  }
}

/** Seed fixe pour un démarrage de scénario reproductible (hook de test). */
const TEST_SCENARIO_SEED = 42;

async function bootstrap(): Promise<void> {
  const report = await loadGameContent();
  window.__HEROES_CONTENT__ = {
    factions: report.content.packs.map((p) => p.manifest.id),
    rejected: report.rejected.map((r) => r.id),
  };
  initI18n(report);
  // Avatars dédiés des héros nommés (M-TAVERN.3) : réf de nom → clé de fiche.
  initHeroAvatars(report.content.packs.flatMap((p) => p.heroes));
  const map = await loadDefaultMap(report);

  const app = new Application();
  await app.init({
    resizeTo: window,
    // Canvas TRANSPARENT (lot U5-E) : `#canvas-root`/`body` gardent `#1a1c22`
    // (aventure/menu inchangés) et la toile de combat peinte est posée en fond
    // DOM de `#canvas-root` pendant le combat — coût de rendu par-frame nul
    // (composé par le navigateur), contrairement au sprite plein écran (anti-gel).
    backgroundAlpha: 0,
    antialias: false,
    resolution: Math.min(window.devicePixelRatio, 2),
    autoDensity: true,
    preference: 'webgl',
  });

  const root = document.getElementById('canvas-root');
  if (!root) throw new Error('missing #canvas-root');
  root.appendChild(app.canvas);

  // Réchauffe le cache de textures PixiJS (tuiles + objets de carte) avant la
  // 1ʳᵉ scène : les surfaces de rendu lisent le cache en synchrone et retombent
  // sur les placeholders procéduraux si une texture manque (lot intégration).
  await preloadPixiTextures();

  // Scènes construites paresseusement : une partie peut démarrer depuis le
  // menu (Nouvelle partie), une sauvegarde (Continuer/­import) ou `?seed=N`.
  let camera: Camera | null = null;
  let scene: AdventureScene | null = null;
  let combatScene: CombatScene | null = null;
  // Détruit toutes les scènes (retour menu / changement de carte) — remédiation
  // CL1 : sans ça, la scène capturait la carte du premier lancement et rejouait
  // la partie suivante sur l'ancien terrain, en fuyant textures et listeners.
  const teardownScenes = (): void => {
    if (combatScene) {
      combatScene.destroy();
      combatScene = null;
    }
    root.style.backgroundImage = ''; // retire la toile de combat (U5-E)
    root.style.backgroundColor = ''; // retire la mer d'aventure (UXD-3A)
    if (scene) {
      scene.destroy();
      scene = null;
    }
    if (camera) {
      unregisterCamera();
      camera.destroy();
      camera = null;
    }
  };
  const ensureScenes = (): void => {
    const { game, screen } = appStore.getState();
    if (!game.started || screen !== 'adventure') {
      teardownScenes();
      return;
    }
    if (!camera) {
      camera = new Camera(app);
      scene = new AdventureScene(app, camera);
      camera.world.addChild(scene.container);
      app.stage.addChild(camera.world);
      // Mer profonde en fond DOM (UXD-3A) : couvre tout le vide au-delà de la
      // carte sans coût de remplissage par-frame (le rivage est rendu en Pixi).
      root.style.backgroundColor = WORLD_OCEAN_CSS;
      scene.centerOnHero(app);
      registerCamera(camera, app); // cinématiques caméra (N3c.1)
    }
    // Bascule aventure ↔ combat sur l'état moteur (doc 07 §3).
    const inCombat = game.combat !== null;
    if (inCombat && !combatScene) {
      combatScene = new CombatScene(app);
      app.stage.addChild(combatScene.container);
      camera.world.visible = false;
      camera.setEnabled(false); // libère les gestes app.stage pour la caméra de combat
      // Toile de combat peinte du terrain en fond DOM (U5-E) — coût par-frame nul.
      const url = game.combat ? combatBackgroundUrl(game.combat.terrain) : undefined;
      root.style.backgroundImage = url ? `url(${url})` : '';
      root.style.backgroundSize = 'cover';
      root.style.backgroundPosition = 'center';
    } else if (!inCombat && combatScene) {
      combatScene.destroy();
      combatScene = null;
      camera.world.visible = true;
      camera.setEnabled(true);
      root.style.backgroundImage = ''; // retour carte : retire la toile (U5-E)
    }
  };
  appStore.subscribe(ensureScenes);

  const startNewGame = async (seed: number): Promise<void> => {
    await dispatch(
      newGameCommand(
        seed,
        report.content.config,
        map,
        buildUnitCatalog(report),
        buildTownSetup(report),
        buildHeroSetup(report),
        buildFactionSetup(report),
        buildHouseSetup(report),
        buildGrowthGroupSetup(report),
        buildHeroRosterSetup(report),
      ),
    );
    navigate('adventure');
  };

  /**
   * Démarre un scénario par id (doc 02 §6, plan phase-3.5 lot U) : résout sa
   * carte (même chemin que `loadDefaultMap`, différé jusqu'ici car async) puis
   * construit et joue le `StartGame` multi-joueurs correspondant.
   */
  const startScenario = async (scenarioId: string, seed: number): Promise<void> => {
    const scenario = report.content.scenarios.find((s) => s.id === scenarioId);
    if (!scenario) throw new Error(`scénario inconnu '${scenarioId}'`);
    const scenarioMap = await loadScenarioMap(report, scenario);
    disarmDailyRefresh(); // scénario = quêtes propres, pas de contrats journaliers
    // Charge le catalogue narratif AVANT le dispatch : les `QuestStarted` émis
    // par `StartGame` alimentent alors le journal (et enfilent les dialogues).
    loadScenarioNarrative(scenario);
    await dispatch(scenarioStartCommand(report, scenario, seed, scenarioMap));
    navigate('adventure');
    // Cinématique d'ouverture (N3c.1) : jouée en arrière-plan une fois la scène en
    // place — ne bloque pas le démarrage (elle attend l'interaction du joueur).
    void playOpeningCutscene(scenario);
  };

  /**
   * Démarre une escarmouche vs IA (doc 09, Alpha 4.14) : scénario généré à
   * l'exécution depuis la config du joueur (factions + difficulté), sur la carte
   * par défaut déjà chargée. Même découplage que « Nouvelle partie ».
   */
  const startSkirmish = async (config: SkirmishConfig, seed: number): Promise<void> => {
    // Carte aléatoire (doc 09, Live 6.2) : générée + validée en mémoire par le
    // même `loadMap` ; sinon la carte par défaut déjà chargée.
    const skirmishMap = config.randomMap ? await resolveGeneratedMap(report, seed) : map;
    // Quêtes journalières (doc 13 §4.2, N4c) : générées déterministiquement depuis
    // le seed, embarquées dans le StartGame ; leur narration alimente le journal.
    const daily = buildDailyQuests(report, config.humanFactionId, seed);
    loadFreeModeNarrative(daily.metas);
    await dispatch(skirmishStartCommand(report, config, seed, skirmishMap, daily.questState));
    // Rafraîchissement quotidien (N-DAILYREFRESH) : armé avec le contexte de mode
    // libre ; les jours suivants génèrent de nouveaux contrats via `AddQuests`.
    armDailyRefresh(report, config.humanFactionId, seed);
    navigate('adventure');
  };

  /**
   * « Nouvelle partie » configurable (doc 09) : résout les paramètres laissés sur
   * « Aléatoire » (déterministe depuis le seed), GÉNÈRE la carte à la taille et à
   * la densité de ressources choisies, puis joue le `StartGame` à N joueurs. La
   * génération pouvant prendre du temps, un overlay de chargement affiche
   * l'avancée par étapes ; `requestAnimationFrame` entre les étapes laisse la
   * barre se peindre. Toujours nettoyé (succès comme échec) via `finally`.
   */
  const startNewGameSetup = async (raw: NewGameRawConfig): Promise<void> => {
    const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));
    const setLoading = (label: string, progress: number): void =>
      appStore.setState({ loading: { label, progress } });
    disarmDailyRefresh(); // « Nouvelle partie » n'embarque pas de contrats journaliers
    try {
      setLoading('newgame.loading.prepare', 0.1);
      await raf();
      const factionIds = report.content.packs.map((p) => p.manifest.id);
      const resolved = resolveNewGameConfig(raw, factionIds, buildHeroRosterSetup(report), raw.seed);

      setLoading('newgame.loading.map', 0.35);
      await raf();
      const generatedMap = await resolveGeneratedMap(report, raw.seed, {
        width: resolved.map.width,
        height: resolved.map.height,
        startPositionCount: resolved.map.startPositionCount,
        resourceMultiplier: resolved.map.resourceMultiplier,
        guardianDensity: resolved.map.guardianDensity,
        mineDensity: resolved.map.mineDensity,
        eventBuildingDensity: resolved.map.eventBuildingDensity,
        pickupDensity: resolved.map.pickupDensity,
      });

      setLoading('newgame.loading.players', 0.75);
      await raf();
      const command = newGameStartCommand(report, resolved.setup, raw.seed, generatedMap);

      setLoading('newgame.loading.init', 0.95);
      await raf();
      // Couleurs de joueur choisies (lot 6.4) — présentation client, posée avant le
      // rendu de la scène ; `navigate('menu')` les oubliera au retour menu.
      appStore.setState({ playerColors: resolved.colors });
      await dispatch(command);
      navigate('adventure');
    } finally {
      appStore.setState({ loading: null });
    }
  };

  /** Démarre un chapitre de campagne (doc 13 §4.1, N3a) — report de héros géré par le module. */
  const startChapter = async (campaignId: string, chapterIndex: number, seed: number): Promise<void> => {
    const campaign = report.content.campaigns.find((c) => c.id === campaignId);
    if (!campaign) throw new Error(`campagne inconnue '${campaignId}'`);
    disarmDailyRefresh(); // campagne = quêtes de scénario, pas de contrats journaliers
    await startCampaignChapter(report, campaign, chapterIndex, seed);
  };

  installAutosave(); // autosave à chaque fin de tour (doc 07 §4)
  installCombatLog(); // journal de combat (UX-COMBATLOG, doc 08 §2.4) — accumule les événements
  initTelemetry(); // télémétrie locale opt-in (doc 09, Alpha 4.19) — no-op si désactivée
  initReduceMotion(); // option « réduire les animations » (lot M8 C3) — miroir localStorage
  initAudio(); // ambiance sonore (UXD-6B) — silencieuse tant qu'aucun fichier audio
  initNarrative(); // couche narrative branchée sur les événements de quête (doc 13, N2b)
  initCombatBarks(); // barks de combat au début d'un combat de campagne (doc 13, N4b)
  initCampaign(report); // avancement de campagne branché sur les événements (doc 13, N3a)
  appStore.setState({
    strengthBands: report.content.config.display.strengthBands,
    scenarios: report.content.scenarios,
    campaigns: report.content.campaigns,
    factions: report.content.packs.map((p) => p.manifest.id),
    // Roster de héros nommés jouables (H-NAMED.2) — pour le choix du héros de départ.
    rosterHeroes: Object.entries(buildHeroRosterSetup(report)).map(([id, def]) => ({
      id,
      factionId: def.factionId,
      name: def.name,
    })),
  });
  // « Nouvelle partie » configurable (doc 09) : l'écran émet la config brute,
  // l'intégration résout les tirages, génère la carte (overlay de progression) et
  // joue la commande. Un échec est surfacé en toast (comme les autres démarrages).
  window.addEventListener('heroes:start-newgame', (e) => {
    const config = (e as CustomEvent<NewGameRawConfig>).detail;
    startNewGameSetup(config).catch((err: unknown) => {
      console.error('startNewGameSetup', err);
      pushToast(t('toast.newGameFailed'), 'error');
    });
  });
  // Sélection de scénario au menu (doc 08, plan phase-3.5 lot U) — même
  // découplage que « Nouvelle partie » : le menu émet, l'intégration écoute.
  window.addEventListener('heroes:start-scenario', (e) => {
    const { scenarioId } = (e as CustomEvent<{ scenarioId: string }>).detail;
    startScenario(scenarioId, Date.now()).catch((err: unknown) => {
      console.error('startScenario', err);
      pushToast(t('toast.scenarioFailed'), 'error');
    });
  });
  // Escarmouche vs IA (doc 09, Alpha 4.14) — même découplage : l'écran émet la
  // config, l'intégration construit et joue la commande.
  window.addEventListener('heroes:start-skirmish', (e) => {
    const config = (e as CustomEvent<SkirmishConfig>).detail;
    startSkirmish(config, Date.now()).catch((err: unknown) => {
      console.error('startSkirmish', err);
      pushToast(t('toast.skirmishFailed'), 'error');
    });
  });
  // Sélection d'un chapitre de campagne (doc 13 §4.1, N3a) — même découplage.
  window.addEventListener('heroes:start-chapter', (e) => {
    const { campaignId, chapterIndex } = (e as CustomEvent<{ campaignId: string; chapterIndex: number }>).detail;
    startChapter(campaignId, chapterIndex, Date.now()).catch((err: unknown) => {
      console.error('startChapter', err);
      pushToast(t('toast.scenarioFailed'), 'error');
    });
  });

  // Chrome décoratif (doc 12 Règle G, skill asset-chrome) : on expose les URLs
  // résolues du cadre/ruban en variables CSS `:root`, consommées par les classes
  // partagées `.chrome-framed` / `.chrome-ribbon` (border-image). Absent ⇒ la
  // variable reste vide et les classes retombent sur la bordure tokenisée.
  const frameUrl = chromeFrameUrl();
  const ribbonUrl = chromeRibbonUrl();
  if (frameUrl) document.documentElement.style.setProperty('--chrome-frame', `url(${frameUrl})`);
  if (ribbonUrl) document.documentElement.style.setProperty('--chrome-ribbon', `url(${ribbonUrl})`);

  const uiRoot = document.getElementById('ui-root');
  if (!uiRoot) throw new Error('missing #ui-root');
  mountUi(uiRoot);

  // `?seed=N` : partie directe reproductible (smoke) ; `#arena` : + combat.
  const seedParam = Number(new URLSearchParams(location.search).get('seed'));
  if (Number.isInteger(seedParam) && seedParam > 0) {
    await startNewGame(seedParam);
    if (location.hash === '#arena') {
      const army = report.content.config.newGame.startingArmy.map((s) => ({ ...s }));
      await dispatch({ type: 'StartCombat', attacker: army, defender: army, terrain: 'grass' });
    }
  } else if (location.hash === '#editor') {
    // Éditeur de carte (doc 08, Alpha 4.18) — accès direct sans démarrer de partie.
    navigate('editor');
  }

  window.__HEROES_TEST__ = {
    getState: () => appStore.getState().game,
    getPlayerColors: () => appStore.getState().playerColors,
    dispatch,
    tileToScreen: (x, y) => {
      if (!camera) return { x: -1, y: -1 };
      const c = isoTileCenter(x, y); // même projection que le rendu (Lot A1)
      const p = camera.world.toGlobal(new Point(c.x, c.y));
      return { x: p.x, y: p.y };
    },
    save: () => saveGame(appStore.getState().game, 'manual'),
    load: () => restoreSavedGame('manual'),
    saveRoundtrip: async () => importSave(await exportSave(appStore.getState().game)),
    importIncompatibleSave: async () => {
      const parsed = JSON.parse(serializeState(appStore.getState().game)) as { saveVersion: number };
      parsed.saveVersion = CURRENT_SAVE_VERSION + 1; // version future non supportée
      return importSave(await encodeHeroesFile(JSON.stringify(parsed), []));
    },
    startScenario: (scenarioId) => startScenario(scenarioId, TEST_SCENARIO_SEED),
    startSkirmish: (config) => startSkirmish(config, TEST_SCENARIO_SEED),
    startCampaignChapter: (campaignId, chapterIndex) =>
      startChapter(campaignId, chapterIndex, TEST_SCENARIO_SEED),
    campaignFlags,
    getAiTurn: () => appStore.getState().aiTurn,
    subscribe: (cb) => appStore.subscribe(cb),
    findPath: (heroId, x, y) => {
      const game = appStore.getState().game;
      const hero = game.heroes.find((h) => h.id === heroId);
      if (!game.map || !game.config || !hero) return null;
      const blocked = [
        ...game.heroes.filter((h) => h.id !== heroId).map((h) => h.pos),
        ...game.map.objects.filter((o) => o.type === 'guardian').map((o) => o.pos),
      ];
      return findPath(game.config, game.map, hero.pos, { x, y }, blocked, true);
    },
    renderedHeroIds: () => scene?.renderedHeroIds() ?? [],
  };
  window.__HEROES_READY__ = true; // signal pour le smoke test headless
}

/**
 * Remédiation CL8 : un échec de bootstrap (fetch/validation du contenu, init
 * Pixi) affichait auparavant une page blanche muette. On surface un bandeau
 * d'erreur bilingue (l'i18n peut ne pas être initialisée si c'est le
 * chargement du contenu qui a échoué) au lieu d'une promesse rejetée perdue.
 */
function showFatalError(err: unknown): void {
  console.error('bootstrap', err);
  const banner = document.createElement('div');
  banner.setAttribute('role', 'alert');
  banner.style.cssText =
    'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
    'padding:2rem;text-align:center;background:#1a1c22;color:#e8e8ea;font-family:sans-serif;z-index:9999';
  banner.textContent =
    'Échec du chargement du jeu. Réessayez de recharger la page. · ' +
    'Failed to load the game. Please reload the page.';
  document.body.appendChild(banner);
}

bootstrap().catch(showFatalError);

/**
 * PWA (lot 8.1) : enregistre le service worker offline-first en PROD uniquement
 * (le smoke tourne sur le build de prod ⇒ le SW y est exercé ; en dev on
 * n'interfère pas avec le HMR de Vite). Échec silencieux : le jeu reste jouable
 * sans SW (moteur pur + IndexedDB).
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch((err) => console.warn('SW registration failed', err));
  });
}
