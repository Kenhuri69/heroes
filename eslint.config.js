import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // `.claude/` = plans + skills (outillage exécuté directement par node, hors
  // build/typecheck de l'app) — pas linté par la config TS du projet.
  { ignores: ['**/dist/**', '**/node_modules/**', 'playwright-report/**', 'test-results/**', '.claude/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Invariants du moteur (README §2, guidelines §8) — armés dès maintenant :
    // le moteur de règles et le pipeline de contenu doivent rester déterministes
    // (RNG seedé injecté) et sans dépendance au rendu/DOM.
    files: ['packages/engine/**/*.ts', 'packages/content/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Moteur déterministe : utiliser le RNG seedé (ctx.rng).' },
        { object: 'Date', property: 'now', message: 'Moteur déterministe : utiliser le temps de jeu (ctx.now).' },
        { object: 'performance', property: 'now', message: 'Moteur déterministe : utiliser le temps de jeu (ctx.now).' },
      ],
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['pixi.js', 'pixi.js/*', 'preact', 'preact/*'], message: 'Le moteur ne dépend jamais du rendu (doc 07 §2).' }] },
      ],
      'no-restricted-globals': ['error', 'document', 'window'],
    },
  },
  {
    // Service worker PWA (lot 8.1) : contexte worker (ni DOM, ni Node) — déclare
    // les globals du SW pour `no-undef`.
    files: ['data/sw.js'],
    languageOptions: {
      globals: { self: 'readonly', caches: 'readonly', fetch: 'readonly', URL: 'readonly' },
    },
  },
);
