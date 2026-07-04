import { Application, Point } from 'pixi.js';
import type { Command, GameState } from '@heroes/engine';
import { Camera } from './render/camera';
import { TILE_SIZE } from './render/tilemap';
import { loadGameContent, loadDefaultMap } from './app/content';
import { buildUnitCatalog, newGameCommand } from './app/game';
import { dispatch } from './app/dispatch';
import { appStore } from './app/store';
import { saveGame, restoreSavedGame } from './app/save';
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
    };
  }
}

async function bootstrap(): Promise<void> {
  const report = await loadGameContent();
  window.__HEROES_CONTENT__ = {
    factions: report.content.packs.map((p) => p.manifest.id),
    rejected: report.rejected.map((r) => r.id),
  };
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

  // Seed injectable (`?seed=42`) : parties reproductibles pour le smoke test.
  const seedParam = Number(new URLSearchParams(location.search).get('seed'));
  const seed = Number.isInteger(seedParam) && seedParam > 0 ? seedParam : Date.now();
  appStore.setState({ strengthBands: report.content.config.display.strengthBands });
  await dispatch(newGameCommand(seed, report.content.config, map, buildUnitCatalog(report)));
  // Flux menu (doc 08 §2.5) branché en intégration 2.5 — partie directe pour l'instant.
  appStore.setState({ screen: 'game' });

  const camera = new Camera(app);
  const scene = new AdventureScene(app, camera);
  camera.world.addChild(scene.container);
  app.stage.addChild(camera.world);
  scene.centerOnHero(app);

  // Bascule aventure ↔ combat : la scène de combat se monte quand l'état
  // moteur ouvre un combat, se démonte à sa résolution (doc 07 §3).
  let combatScene: CombatScene | null = null;
  const syncScenes = (): void => {
    const inCombat = appStore.getState().game.combat !== null;
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
  appStore.subscribe(syncScenes);
  syncScenes();

  // Mode arène `/#arena` (doc 10 §3) : combat immédiat, armées des données
  // (miroir de l'armée de départ) — testable sans jouer l'aventure.
  if (location.hash === '#arena') {
    const army = report.content.config.newGame.startingArmy.map((s) => ({ ...s }));
    await dispatch({ type: 'StartCombat', attacker: army, defender: army, terrain: 'grass' });
  }

  const uiRoot = document.getElementById('ui-root');
  if (!uiRoot) throw new Error('missing #ui-root');
  mountUi(uiRoot);

  window.__HEROES_TEST__ = {
    getState: () => appStore.getState().game,
    dispatch,
    tileToScreen: (x, y) => {
      const p = camera.world.toGlobal(new Point((x + 0.5) * TILE_SIZE, (y + 0.5) * TILE_SIZE));
      return { x: p.x, y: p.y };
    },
    save: () => saveGame(appStore.getState().game, 'manual'),
    load: () => restoreSavedGame('manual'),
  };
  window.__HEROES_READY__ = true; // signal pour le smoke test headless
}

void bootstrap();
