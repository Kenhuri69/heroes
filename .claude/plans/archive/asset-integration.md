# Plan — Intégration des assets dans le client

> Branche `claude/asset-integration` (depuis `main` à jour ; PR #40 mergée, non
> réutilisée). Objectif : brancher dans le client les PNG déjà produits et
> validés dans le staging `assets/`, **sans dupliquer les images dans le bundle
> JS** ni casser les invariants (moteur pur, budget < 800 Ko gzip, touch-first,
> docs = vérité, smoke headless). Débloque `docs/12 §10` (« lot intégration »).

## 0. État des lieux (recherche faite)

- `assets/` = staging versionné, **zéro référence** depuis `packages/client`
  (`grep -rn "assets/" packages/client/src` → vide). Contenu mergé dans `main` :
  tiles (14), ui (81), buildings/{core,haven,necropolis,arcane-hunters} (32),
  mines (8), artifacts (4).
- **Aucun `Assets.load` PixiJS aujourd'hui** : tuiles et objets de carte sont
  des `Graphics` colorés (placeholders doc 08 §5). J'introduis le 1ᵉʳ chemin de
  texture.
- **Deux types de surfaces** :
  - **PixiJS** (`Assets.load` → `Texture` → `Sprite`) :
    `render/tilemap.ts` (terrain, `Graphics` + `RenderTexture` par chunk),
    `render/mapObjects.ts` (tas de ressources = losanges, gardiens = fanions).
  - **DOM / Preact** (`<img>`) : `ui/TownScreen.tsx` (vignettes de bâtiments,
    aujourd'hui juste le nom localisé), `ui/HeroInventory.tsx` (10 slots
    d'artefacts, aujourd'hui le nom), icônes UI ressources/stats (`shell.tsx`,
    `styles.css` — actuellement CSS/texte ; `FactionBadge` reste procédural).
- **Conventions de nommage `assets/` → ids** :
  - tiles : `<terrain>-1|2|3.png` (grass/swamp/water/mountain) + `road-dirt.png`.
  - mines : `mine-<resource>.png` (gold/wood/ore/crystal/gems/mercury/sulfur/
    essence). Mappe les **tas de ressources** de la carte par `obj.resource`.
  - artifacts : `<artifactId>.png` (mapping **direct** par id).
  - buildings/core : `<buildingId>.png` (mapping **direct** : townHall, fort…).
  - buildings/`<faction>` : `<faction>-dwelling-t1..t7.png` (mapping par **tier**,
    pas par buildingId → lookup dwelling→tier requis).
- **Sérvir les PNG** : `vite.config.ts` a déjà `publicDir = ../../data` (le
  `data/` racine est servi tel quel via `fetch`). **Un seul `publicDir`
  possible** → on ne peut pas y ajouter `assets/` naïvement. D'où la décision de
  stratégie ci-dessous.
- **Garde-fou budget CI** : `find dist/assets \( -name '*.js' -o -name '*.css' \)`
  → ne compte **que** le JS/CSS. Des PNG émis en fichiers séparés (dist/assets/
  *.png hashés, ou statiques) sont **hors budget** sans toucher le garde-fou.
- **docs/07 §6** : intent = « atlas de la faction chargé à la demande (lazy) ».
  L'atlasing (TexturePacker) est une optimisation **ultérieure** ; des PNG
  individuels chargés à la demande honorent déjà « lazy » et gardent le budget
  vert.

## 1. Décisions à cadrer avec l'utilisateur (AVANT de coder)

1. **Stratégie de service des PNG** — recommandation : **(b) registre
   `import.meta.glob('.../assets/**/*.png', { eager:true, query:'?url' })`**.
   Justif : zéro dépendance, pas de conflit avec `publicDir` (déjà pris par
   `data/`), Vite empreinte + émet les PNG en fichiers séparés `dist/assets/
   *.png` (exclus du budget JS/CSS), seules ~140 chaînes d'URL entrent dans le
   JS (négligeable), octets PNG **fetchés à la demande** par `<img>`/`Assets.load`
   (lazy). Alternative (a) copie → `public/game-assets/` écartée : `publicDir`
   déjà utilisé, nécessiterait un plugin/copie. → **question posée**.
2. **Périmètre** — recommandation : **famille pilote (mines / objets de carte)
   d'abord**, pour valider bout-en-bout registre + service + budget + smoke sur
   une surface Pixi à faible rayon d'impact, puis étendre (tuiles → vignettes
   bâtiments → artefacts → icônes UI). → **question posée**.
3. **Fallback procédural si texture manquante** — recommandation : **oui**,
   garder les `Graphics`/pictos actuels en repli (texture absente ou erreur de
   chargement) → dégradation gracieuse, jamais de tuile blanche / img cassée.
   → **question posée**.

## 1bis. Décisions de l'utilisateur (2026-07-05)

1. **Service PNG** : « la meilleure approche pour enrichir de nouveaux assets,
   peu importe le coût technique » ⇒ **registre auto-découvert `import.meta.glob`
   ?url** (ajouter un asset = déposer le fichier, zéro câblage) + `assetsInlineLimit:
   0` pour que **tous** les PNG (y compris les petites icônes UI) sortent du
   bundle JS. Le garde-fou budget n'est **pas** révisé (budget ~225 Ko gzip).
2. **Périmètre** : **tout d'un coup** (5 surfaces).
3. **Fallback** : **oui**, repli procédural gracieux.

## 2. Étapes

- [x] Plan écrit + décisions cadrées via AskUserQuestion.
- [x] Registre `render/assets.ts` : `import.meta.glob(['…/assets/**/*.png',
      '!**/_preview.png'], {eager, ?url})` → map `clé → url` + résolveurs
      faction-agnostiques (tuile+variante, mine par ressource, artefact par id,
      bâtiment core/faction par id, icône UI par id+mipmap) + préchargement Pixi
      (`preloadPixiTextures`) + lecture synchrone du cache (`getTexture`).
- [x] `assetsInlineLimit: 0` (vite.config.ts) : tous les PNG en fichiers séparés
      hors bundle JS (JS 392→225 Ko, budget 225 Ko gzip).
- [x] Composant DOM `ui/AssetImg.tsx` (repli gracieux `onError`/URL absente).
- [x] Surfaces Pixi : `render/tilemap.ts` (sprites de tuiles + repli aplats),
      `render/mapObjects.ts` (sprites de mines + repli losange ; gardien reste
      procédural, aucun asset).
- [x] Surfaces DOM : `ui/shell.tsx` (icônes de ressources, repli pastille CSS),
      `ui/TownScreen.tsx` (vignettes de bâtiments), `ui/HeroInventory.tsx`
      (icônes d'artefacts) + CSS de chaque.
- [x] Préchargement branché au bootstrap (`main.ts`, après `app.init`).
- [x] Smoke étendu : « assets : PNG servis sans 404 + icônes/vignettes
      affichées » (desktop + mobile) — 0 404, `naturalWidth > 0`, familles
      tuiles/mines/res servies.
- [x] Vérif verte : typecheck 4/4, lint, 210+70 tests (golden intact, moteur
      non touché), content:check, **44 smoke**, **budget 225 Ko gzip**.
- [x] `docs/12 §10` réécrit (lot ouvert, stratégie, convention de nommage).
- [ ] Commit + push + PR **draft**.
- **Skill `asset-integrate`** : **non créée** (YAGNI) — le registre est
  auto-découvert, ajouter un asset = déposer le PNG nommé par convention
  (documentée doc 12 §10.2). Une skill n'apporterait rien de plus aujourd'hui.

## 3. Invariants tenus

- **Moteur pur (§8)** : intégration 100 % rendu, **zéro** modif de
  `packages/engine`, aucune faction en dur (mapping par données).
- **Budget < 800 Ko gzip** : PNG hors bundle JS ; garde-fou non contourné,
  vérifié vert après build. Toute révision du garde-fou serait une décision
  explicite documentée (a priori **inutile** avec la stratégie (b)).
- **Touch-first + docs = vérité** : `docs/12 §10` mis à jour dans le même lot.
- **Smoke headless (§7)** : preuve de chargement (0 404) + affichage, desktop +
  mobile, dans le même lot.

## 4. Journal
- **2026-07-05** — Cadrage : recherche faite (docs/07 §6, docs/12 §10, plan
  génération, 4 surfaces, nommage, publicDir, garde-fou budget). Plan rédigé,
  3 décisions posées à l'utilisateur avant tout code.
- **2026-07-05** — **Intégration livrée (5 surfaces, tout d'un coup)** : registre
  auto-découvert `render/assets.ts` + `AssetImg` (repli DOM) ; tuiles & mines en
  sprites Pixi (préchargées au bootstrap, repli procédural) ; icônes de
  ressources, vignettes de bâtiments, icônes d'artefacts en `<img>`.
  `assetsInlineLimit: 0` → 139 PNG émis hors bundle, **budget 225 Ko gzip**
  (garde-fou non révisé). Moteur **non touché** (golden `be72de4b` intact).
  Smoke étendu (0 404 + affichage, desktop + mobile → 44 tests). docs/12 §10
  réécrit. Découverte notable : sans `assetsInlineLimit: 0`, Vite inlinait les
  petites icônes UI (< 4 Ko) en base64 dans le JS (+125 Ko) — corrigé. Skill
  `asset-integrate` volontairement non créée (registre auto-découvert, YAGNI).
