# Plan — Écran de chargement au démarrage

> **Retour de jeu (utilisateur, 2026-07)** : « le chargement du jeu est long au
> début (téléchargement de toutes les ressources). Il faudrait un effet de
> chargement le temps que tout soit disponible. »

## Diagnostic
`index.html` rend `#canvas-root`/`#ui-root` **vides** sur fond `#1a1c22` : pendant
tout le bootstrap (`loadGameContent` → `loadDefaultMap` → `app.init` →
`preloadPixiTextures` qui télécharge tous les PNG → `mountUi`), l'écran est **noir
et muet**. Le `LoadingOverlay` Preact n'aide pas : il n'existe qu'**après**
`mountUi` (et ne sert qu'à la génération de carte). La phase lourde est
`preloadPixiTextures` (téléchargement de toutes les textures).

## Approche (client + données uniquement, zéro moteur, pas de bump save)
Un **boot loader statique dans `index.html`** — peint **instantanément** par le
navigateur (HTML + CSS inline, avant même le bundle JS) — que `main.ts` fait
avancer par phase puis retire quand l'app est prête.

### Étapes
1. **`index.html`** : `#boot-loader` (titre « Heroes », anneau qui tourne, barre de
   progression, ligne de statut) + CSS inline dans le `<style>` existant. Couleurs
   d'identité (or `#f2c14e` sur `#1a1c22`). `prefers-reduced-motion` ⇒ pas de
   rotation. → vérif : présent dans le HTML servi, visible avant tout JS.
2. **`render/assets.ts`** : `preloadPixiTextures(onProgress?)` rapporte
   `(done, total)` réels (compteur sur `Assets.load().finally`). → vérif : typecheck.
3. **`main.ts`** : `setBoot(label, progress)` (DOM direct) appelé par phase —
   contenu → carte → init → **textures (progression réelle 30→95 %)** → prêt ;
   `hideBootLoader()` (fondu + retrait) au `__HEROES_READY__` ; retrait immédiat
   dans `showFatalError` (le bandeau d'erreur le remplace). Libellé i18n
   `boot.assets` une fois l'i18n chargée (avant : « Chargement… » statique).
   → vérif : le loader disparaît une fois prêt (aucun overlay bloquant résiduel).
4. **Locales** `data/core/locales/{fr,en}.json` : clé `boot.assets`. → vérif : parité.
5. **Smoke** : après `__HEROES_READY__`, `#boot-loader` est retiré/masqué (pas
   d'overlay collé qui bloquerait l'input). → vérif : `@core`.

## Invariants
Client + données seulement. Zéro diff moteur, pas de bump `CURRENT_SAVE_VERSION`,
budget bundle inchangé (CSS inline négligeable, aucune image). Pipeline vert avant PR.

## Suivi
- [x] 1 boot loader HTML/CSS (index.html : anneau + barre + statut, or/ardoise, reduce-motion)
- [x] 2 preload onProgress (compteur `done/total` réel sur la phase textures)
- [x] 3 main.ts phases (0.15 contenu → 0.25 carte → 0.30 init → 0.30-0.95 textures) + hide au ready + retrait sur erreur fatale
- [x] 4 locales `boot.assets` FR/EN (content:check parité OK)
- [x] 5 smoke `@core` (présent dans le HTML servi + retiré au ready) — vert
- **Vérif** : build + content:check + lint + typecheck verts ; 2 tests (boot + i18n) verts.
