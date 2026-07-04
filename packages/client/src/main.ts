import { Application, Point } from 'pixi.js';
import type { Command, GameState } from '@heroes/engine';
import { Camera } from './render/camera';
import { TILE_SIZE } from './render/tilemap';
import { loadGameContent, loadDefaultMap } from './app/content';
import { newGameCommand } from './app/game';
import { dispatch } from './app/dispatch';
import { appStore } from './app/store';
import { saveGame, restoreSavedGame } from './app/save';
import { AdventureScene } from './scenes/adventure/AdventureScene';
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
  await dispatch(newGameCommand(seed, report.content.config, map));

  const camera = new Camera(app);
  const scene = new AdventureScene(app, camera);
  camera.world.addChild(scene.container);
  app.stage.addChild(camera.world);
  scene.centerOnHero(app);

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
    save: () => saveGame(appStore.getState().game),
    load: restoreSavedGame,
  };
  window.__HEROES_READY__ = true; // signal pour le smoke test headless
}

void bootstrap();
