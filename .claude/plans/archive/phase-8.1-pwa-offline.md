# Plan — Lot 8.1 : PWA hors-ligne (installable, offline-first)

Item Beta doc 09 (« PWA hors-ligne »). Le jeu est déjà 100 % jouable hors-ligne
au niveau logique (moteur pur + IndexedDB) ; il manque la **coque PWA** : un
service worker qui met en cache la coquille d'app + les assets + le contenu
data-driven, un manifeste web (installable), des icônes.

Approche **sans dépendance** (cohérent avec l'ethos du projet : types D1 écrits à
la main, etc.) plutôt que vite-plugin-pwa/Workbox — SW hand-rolled ~90 lignes,
entièrement maîtrisé, hors budget bundle.

## Portée

- `data/icons/{icon-192,icon-512,apple-touch-icon-180}.png` — icônes générées
  sans dépendance (encodeur PNG maison) : épée sombre sur fond doré, maskable-safe.
  `data/icons/icon.svg` — variante vectorielle nette (desktop/Android).
- `data/manifest.webmanifest` — name/short_name/description, `start_url` +
  `scope` = `/heroes/`, `display: standalone`, couleurs, icônes (192/512 +
  maskable). Servi via publicDir (= `data/`) → `/heroes/manifest.webmanifest`.
- `data/sw.js` — service worker **offline-first** :
  - navigation (`mode: navigate`) → **network-first**, repli sur la coquille en
    cache (offline) ;
  - `/assets/` (noms hashés, immuables) → **cache-first** ;
  - reste same-origin GET (JSON de contenu, icônes, manifeste) →
    **stale-while-revalidate** (rapide + rafraîchi) ;
  - cache versionné (`heroes-cache-v1`), purge des anciens caches à l'`activate` ;
    `skipWaiting` + `clients.claim` pour une MAJ immédiate.
- `packages/client/index.html` — `<link rel="manifest">`, `theme-color`,
  `apple-touch-icon`, métas iOS (`apple-mobile-web-app-*`).
- `packages/client/src/main.ts` — enregistrement du SW en **PROD uniquement**
  (`import.meta.env.PROD`), après `load`, sur `${BASE_URL}sw.js`.

## Vérification (critères)

1. **typecheck 5/5** · moteur golden inchangé · content:check · guards faction/
   couleur · budget < 800 Ko gzip (le SW/manifeste/icônes sont hors `dist/assets/`).
2. **build** : `dist/sw.js`, `dist/manifest.webmanifest`, `dist/icons/*.png`
   émis à la racine servie (`/heroes/…`).
3. **smoke** (nouveau cas) :
   - manifeste joignable + `<link rel=manifest>` présent ;
   - service worker **enregistré et actif** (`navigator.serviceWorker.ready`) ;
   - **preuve hors-ligne** : charger l'app, `context.setOffline(true)`, recharger,
     l'app **démarre quand même** (menu visible) — la coquille + le contenu sont
     servis par le cache.
4. docs : doc 09 (PWA ✅ + backend déployé), doc 07 (§ sauvegarde/PWA), CLAUDE.md.

## Étapes

1. [x] Icônes PNG (192/512/180) générées + SVG.
2. [x] manifest.webmanifest + sw.js.
3. [x] index.html (manifest/theme/apple) + main.ts (register PROD).
4. [x] smoke (manifest + SW ready + reload offline) — vert desktop + mobile.
5. [x] Vérif complète (typecheck 5/5, build émet dist/{sw,manifest,icons}, budget
   259 Ko/800 Ko, guards, smoke 104 passés) + docs (09/CLAUDE) + PR.

## Décisions / écarts

- **SW hand-rolled** vs Workbox : minimalisme, zéro dépendance, contrôle total,
  budget intact. Runtime caching (pas de precache exhaustif) : la coquille se
  peuple au 1ᵉʳ chargement en ligne, puis tout marche hors-ligne.
- **Icônes sans PIL** : encodeur PNG maison (aucune toolchain image dispo).
- **Enregistrement en PROD only** : le smoke tourne sur le build de prod (`vite
  preview`) ⇒ le SW est bien exercé ; en dev le SW ne gêne pas le HMR.
