import { Application, Point } from 'pixi.js';
import type { Command, GameState } from '@heroes/engine';
import { Camera } from './render/camera';
import { TILE_SIZE } from './render/tilemap';
import { loadGameContent, loadDefaultMap } from './app/content';
import { buildHeroSetup, buildTownSetup, buildUnitCatalog, newGameCommand } from './app/game';
import { dispatch } from './app/dispatch';
import { appStore } from './app/store';
import { exportSave, importSave, saveGame, restoreSavedGame } from './app/save';
import { installAutosave } from './app/autosave';
import { initI18n } from './app/i18n';
import { AdventureScene } from './scenes/adventure/AdventureScene';
import { CombatScene } from './scenes/combat/CombatScene';
import { mountUi } from './ui/shell';

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
    };
  }
}

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
    background: '#1a1c22',
    antialias: false,
    resolution: Math.min(window.devicePixelRatio, 2),
    autoDensity: true,
    preference: 'webgl',
  });

  const root = document.getElementById('canvas-root');
  if (!root) throw new Error('missing #canvas-root');
  root.appendChild(app.canvas);

  // Scènes construites paresseusement : une partie peut démarrer depuis le
  // menu (Nouvelle partie), une sauvegarde (Continuer/­import) ou `?seed=N`.
  let camera: Camera | null = null;
  let combatScene: CombatScene | null = null;
  const ensureScenes = (): void => {
    const { game, screen } = appStore.getState();
    if (!game.started || screen !== 'game') return;
    if (!camera) {
      camera = new Camera(app);
      const scene = new AdventureScene(app, camera);
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
    } else if (!inCombat && combatScene) {
      combatScene.destroy();
      combatScene = null;
      camera.world.visible = true;
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
      ),
    );
    appStore.setState({ screen: 'game' });
  };

  installAutosave(); // autosave à chaque fin de tour (doc 07 §4)
  appStore.setState({ strengthBands: report.content.config.display.strengthBands });
  // « Nouvelle partie » du menu (contrat lot G) — seed horloge côté client.
  window.addEventListener('heroes:new-game', () => void startNewGame(Date.now()));

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
  };
  window.__HEROES_READY__ = true; // signal pour le smoke test headless
}

void bootstrap();
