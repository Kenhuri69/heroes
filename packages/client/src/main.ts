import { Application } from 'pixi.js';
import { Camera } from './render/camera';
import { buildCheckerboard, BOARD_SIZE_PX } from './render/checkerboard';

declare global {
  interface Window {
    __HEROES_READY__?: boolean;
  }
}

async function bootstrap(): Promise<void> {
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

  const camera = new Camera(app);
  camera.world.addChild(buildCheckerboard());
  // Damier centré à l'ouverture
  camera.world.position.set(
    (app.screen.width - BOARD_SIZE_PX) / 2,
    (app.screen.height - BOARD_SIZE_PX) / 2,
  );
  app.stage.addChild(camera.world);

  window.__HEROES_READY__ = true; // signal pour le smoke test headless
}

void bootstrap();
