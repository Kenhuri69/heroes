import { Application, Point } from 'pixi.js';
import type { Command, GameState } from '@heroes/engine';
import { CURRENT_SAVE_VERSION, serializeState } from '@heroes/engine';
import { Camera } from './render/camera';
import { TILE_SIZE } from './render/tilemap';
import { loadGameContent, loadDefaultMap, loadScenarioMap } from './app/content';
import {
  buildFactionSetup,
  buildHeroSetup,
  buildTownSetup,
  buildUnitCatalog,
  newGameCommand,
  scenarioStartCommand,
  skirmishStartCommand,
  type SkirmishConfig,
} from './app/game';
import { dispatch } from './app/dispatch';
import { appStore } from './app/store';
import { navigate } from './app/router';
import { exportSave, importSave, saveGame, restoreSavedGame, encodeHeroesFile } from './app/save';
import { installAutosave } from './app/autosave';
import { initI18n, t } from './app/i18n';
import { preloadPixiTextures, combatBackgroundUrl } from './render/assets';
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
    if (scene) {
      scene.destroy();
      scene = null;
    }
    if (camera) {
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
      scene.centerOnHero(app);
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
    await dispatch(scenarioStartCommand(report, scenario, seed, scenarioMap));
    navigate('adventure');
  };

  /**
   * Démarre une escarmouche vs IA (doc 09, Alpha 4.14) : scénario généré à
   * l'exécution depuis la config du joueur (factions + difficulté), sur la carte
   * par défaut déjà chargée. Même découplage que « Nouvelle partie ».
   */
  const startSkirmish = async (config: SkirmishConfig, seed: number): Promise<void> => {
    await dispatch(skirmishStartCommand(report, config, seed, map));
    navigate('adventure');
  };

  installAutosave(); // autosave à chaque fin de tour (doc 07 §4)
  appStore.setState({
    strengthBands: report.content.config.display.strengthBands,
    scenarios: report.content.scenarios,
    factions: report.content.packs.map((p) => p.manifest.id),
  });
  // « Nouvelle partie » du menu (contrat lot G) — seed horloge côté client.
  // Remédiation CL8 : un échec ne laisse plus une promesse rejetée non gérée
  // (page muette) — il est surfacé en toast et journalisé.
  window.addEventListener('heroes:new-game', () => {
    startNewGame(Date.now()).catch((err: unknown) => {
      console.error('startNewGame', err);
      pushToast(t('toast.newGameFailed'));
    });
  });
  // Sélection de scénario au menu (doc 08, plan phase-3.5 lot U) — même
  // découplage que « Nouvelle partie » : le menu émet, l'intégration écoute.
  window.addEventListener('heroes:start-scenario', (e) => {
    const { scenarioId } = (e as CustomEvent<{ scenarioId: string }>).detail;
    startScenario(scenarioId, Date.now()).catch((err: unknown) => {
      console.error('startScenario', err);
      pushToast(t('toast.scenarioFailed'));
    });
  });
  // Escarmouche vs IA (doc 09, Alpha 4.14) — même découplage : l'écran émet la
  // config, l'intégration construit et joue la commande.
  window.addEventListener('heroes:start-skirmish', (e) => {
    const config = (e as CustomEvent<SkirmishConfig>).detail;
    startSkirmish(config, Date.now()).catch((err: unknown) => {
      console.error('startSkirmish', err);
      pushToast(t('toast.skirmishFailed'));
    });
  });

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
    dispatch,
    tileToScreen: (x, y) => {
      if (!camera) return { x: -1, y: -1 };
      const p = camera.world.toGlobal(new Point((x + 0.5) * TILE_SIZE, (y + 0.5) * TILE_SIZE));
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
