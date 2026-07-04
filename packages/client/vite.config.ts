import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages sert le site sous /<repo>/. Base fixe (et non conditionnelle
  // au build) : `vite preview` résout `command === 'serve'`, une base
  // conditionnelle casserait le smoke test sur le build de prod.
  base: '/heroes/',
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
