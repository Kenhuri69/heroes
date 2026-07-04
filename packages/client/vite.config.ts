import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  // GitHub Pages sert le site sous /<repo>/. Base fixe (et non conditionnelle
  // au build) : `vite preview` résout `command === 'serve'`, une base
  // conditionnelle casserait le smoke test sur le build de prod.
  base: '/heroes/',
  resolve: {
    alias: {
      '@heroes/content': path.resolve(__dirname, '../content/src'),
    },
  },
  // data/ est servi tel quel : le chargement data-driven passe par fetch()
  // en dev comme en prod (même code, même pipeline).
  publicDir: path.resolve(__dirname, '../../data'),
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          pixi: ['pixi.js'],
        },
      },
    },
  },
  server: { host: true },
});
