# 10 — Plan d'implémentation Phase 2 : prototype jouable sur GitHub Pages

> **Phase 2 du projet = passage de la spécification (Phase 1) au code.**
> Elle recouvre la **Phase 0 « Fondations » de la roadmap (doc 09)** plus la
> tranche « arène de combat » de la phase MVP, et y ajoute ce que la roadmap
> ne détaillait pas : le **déploiement continu sur GitHub Pages** pour rendre
> chaque incrément testable en live. Ne pas confondre avec la « Phase 2 —
> Alpha » de la roadmap, qui reste inchangée.

**Objectif de sortie** : un prototype jouable accessible à l'URL
`https://kenhuri69.github.io/heroes/` — déplacer un héros sur une carte JSON
(souris + tactile), finir son tour, livrer un combat hex simple contre des
gardiens neutres, sauvegarder/recharger — le tout redéployé automatiquement à
chaque push sur `main`.

**Conformité** : ce plan applique les docs 01–09, en particulier les principes
non négociables du README (moteur sans faction, déterminisme, moteur sans
rendu, touch-first) et les guidelines §7 (smoke test headless livré **dans le
même lot** que le premier code) et §8.

## Écarts assumés par rapport à la demande initiale

| Demande | Spec Phase 1 | Décision |
|---|---|---|
| « Hex map + mouvement héros » | Doc 02 §2.1 : la carte d'aventure est en **grille carrée** (8 directions), l'hexagone est réservé au **combat** | Mouvement héros sur grille carrée ; la grille hex arrive avec l'**arène de combat** (sous-phase 2.4), livrée tôt conformément au risque n°1 de la roadmap |
| « Arcane Hunters prêt à charger » | Docs 05 & 09 : la faction complète est produite en **Alpha** (test grandeur nature de la modularité) | Un **paquet squelette** `arcane-hunters` (manifeste + T1 + locales) est chargé par le pipeline dès la Phase 2 pour prouver la modularité ; la production complète reste en Alpha |
| « Preview URL après chaque push » | — | GitHub Pages n'offre qu'une URL live par dépôt ; l'URL est exposée dans l'environnement `github-pages` de chaque run. Previews par PR = extension future (artefacts ou 2ᵉ dépôt), hors scope |

---

## 1. Structure complète du projet

Monorepo **pnpm workspaces** conforme au découpage de la doc 07 §2, outillé
Vite. Seul `packages/client` produit un site statique (celui déployé sur
Pages) ; `engine`, `content` et les données sont consommés en sources par Vite
(pas de build intermédiaire en Phase 2 — on l'introduira si les temps de
build l'exigent).

```
heroes/
├── package.json                 # racine : scripts globaux, devDeps partagées
├── pnpm-workspace.yaml          # packages/*
├── tsconfig.base.json           # strict: true, noUncheckedIndexedAccess, etc.
├── eslint.config.js             # frontières d'imports (doc 06 §4) + interdits (§8)
├── .github/
│   └── workflows/
│       ├── ci.yml               # typecheck, lint, vitest, validation contenu, smoke
│       └── deploy.yml           # build client + déploiement GitHub Pages
├── packages/
│   ├── engine/                  # RÈGLES PURES — zéro import DOM/Pixi
│   │   ├── src/
│   │   │   ├── core/            # GameState, Command, apply(), events, rng (PCG32)
│   │   │   ├── adventure/       # grille carrée, mouvement A*, économie, calendrier
│   │   │   ├── combat/          # grille hex 12×10, vagues, riposte, dégâts, IA
│   │   │   ├── content/         # registres (unités, capacités, hooks) — génériques
│   │   │   └── index.ts
│   │   ├── test/                # Vitest : unitaires + property-based + golden replays
│   │   └── package.json         # "sideEffects": false, aucune dependency runtime hors immer
│   ├── content/                 # chargeur/validateur de paquets (Zod) + schémas
│   │   ├── src/
│   │   │   ├── schemas/         # zod : manifest, unit, building, hero, spell, map
│   │   │   ├── loader.ts        # loadFactionPack(), loadCore(), rapport d'erreurs
│   │   │   └── registry.ts      # enregistrement dans les registres du moteur
│   │   └── test/
│   ├── client/                  # rendu Pixi 8 + UI Preact + input + scènes
│   │   ├── index.html
│   │   ├── vite.config.ts       # base '/heroes/' (cf. §4)
│   │   ├── public/              # favicon, manifest PWA (plus tard)
│   │   └── src/
│   │       ├── main.ts          # bootstrap : Application Pixi + montage UI
│   │       ├── app/             # store Zustand, bus d'événements moteur→présentation
│   │       ├── scenes/          # adventure/, combat/, town/ (vide en Ph.2), menu/
│   │       ├── render/          # camera.ts, tilemap.ts, hexgrid.ts, sprites.ts, fog.ts
│   │       ├── input/           # pointer.ts (tap-tap, appui long, pinch/pan — doc 08)
│   │       ├── ui/              # Preact : shell, barre ressources, fin de tour, menus
│   │       └── assets/          # placeholders génériques teintés (doc 08 §5)
│   └── tools/                   # CLI : faction:new, faction:validate (faction:sim → Alpha)
│       └── src/
├── data/                        # CONTENU — jamais importé par le moteur, servi par Vite
│   ├── core/
│   │   ├── config.json          # constantes d'équilibrage (doc 02 : jamais en dur)
│   │   ├── abilities.json       # catalogue générique paramétrable (doc 02 §5.4)
│   │   └── spells/
│   ├── factions/
│   │   ├── index.json           # registre des paquets à charger
│   │   ├── test-faction/        # générée par faction:new — jalon Phase 0 roadmap
│   │   └── arcane-hunters/      # squelette : manifest + t1 + locales (cf. §5.4)
│   └── maps/
│       └── proto-01.map.json    # petite carte 32×32 pour le prototype
├── schemas/                     # JSON Schemas exportés depuis Zod (validation CI + éditeurs)
├── tests/
│   └── smoke.spec.ts            # Playwright + Chromium headless (guideline §7)
└── docs/
```

Décisions structurantes :

- **`data/` hors de `packages/`** : le contenu n'est pas du code. En dev et en
  build, Vite le copie tel quel (`publicDir` additionnel via plugin statique) et
  le client le charge par `fetch()` — même mécanique qu'en production, ce qui
  garantit que le pipeline data-driven est exercé dès le premier jour.
- **`packages/ai` et `packages/server`** (doc 07) ne sont **pas créés** en
  Phase 2 : rien de spéculatif (guidelines §2). L'IA de combat heuristique
  (doc 02 §5.6) vit dans `engine/combat` car elle fait partie des règles
  (auto-résolution déterministe).
- Alias TS/Vite : `@heroes/engine`, `@heroes/engine-api` (sous-chemin exporté
  par `engine` — surface publique pour les futurs modules de faction),
  `@heroes/content`.

## 2. Architecture technique détaillée

### 2.1 Le moteur : fonction pure commande → état + événements

La règle d'or de la doc 07 §2, traduite en signature :

```ts
// packages/engine/src/core/engine.ts
export interface EngineResult {
  state: GameState;          // nouvel état immuable (Immer)
  events: GameEvent[];       // MoveStepped, ResourcePicked, CombatStarted…
}

export function apply(state: GameState, cmd: Command): EngineResult;
export function validate(state: GameState, cmd: Command): CommandError | null;
```

- `GameState` : un seul arbre **JSON-sérialisable** (sauvegarde = snapshot ;
  réseau futur = mêmes commandes). Il contient le RNG (`rngState`), le
  calendrier (jour/semaine/mois), joueurs, héros, villes, carte, brouillard.
- `Command` : union discriminée sérialisable — Phase 2 : `MoveHero`,
  `EndTurn`, `PickChoice` (coffres), `CombatAction`, `StartGame`.
- **Événements** : le rendu anime à partir des événements, l'état « saute » à
  la fin (doc 07 §3). Aucun événement n'est nécessaire à la correction des
  règles — ils sont purement descriptifs.
- **Déterminisme** : RNG **PCG32** dont l'état vit dans `GameState`. Règle
  ESLint `no-restricted-globals`/`no-restricted-properties` interdisant
  `Math.random`, `Date.now`, `performance.now` dans `engine`, `content` et
  les futurs modules de faction. Golden test de replay dès la Phase 2 : une
  partie scriptée (liste de commandes) rejouée en CI, hash de l'état final
  comparé (doc 07 §7).
- **Moteur sans rendu** : `engine/package.json` ne déclare aucune dépendance
  DOM/Pixi ; la frontière est vérifiée par ESLint (`no-restricted-imports`)
  **et** par un test Vitest qui importe le moteur dans un environnement Node nu.

### 2.2 State management côté client

Conforme doc 07 §3 :

```
UI Preact / input Pixi ──Command──► dispatch()
   dispatch = validate + engine.apply (synchrone en Ph.2, Web Worker si besoin)
        │
        ├─► store Zustand  : setState({ game: result.state })   → sélecteurs → UI Preact
        └─► eventBus.emit(result.events)                        → animations Pixi, sons, toasts
```

- Le store Zustand ne contient que `GameState` + un état d'UI léger (écran
  courant, sélection, préférences). Pixi ne lit **jamais** le store en boucle
  de rendu : les scènes maintiennent leur scène-graphe à partir des événements
  et re-synchronisent sur l'état après chaque commande (réconciliation simple —
  quelques dizaines d'entités en Phase 2).
- Le Web Worker (doc 07 §3) est **différé** : l'interface `dispatch()` est déjà
  asynchrone (`Promise<EngineResult>`) pour que le passage en worker soit un
  changement d'implémentation, pas d'API.

### 2.3 Rendu PixiJS 8

- **Deux couches** (docs 07 §1, 08 §1) : canvas plein écran (carte, combat) +
  UI DOM Preact superposée. Le canvas ne rend jamais de texte de gestion.
- **Scènes** : `MenuScene` (DOM seul), `AdventureScene`, `CombatScene`. Une
  scène = un `Container` racine monté/démonté sur `app.stage` + ses handlers.
- **Carte d'aventure** : tuiles 64 px logiques, rendu par chunks de 16×16
  tuiles pré-rendus en `RenderTexture` avec culling par la caméra (doc 07 §6).
  Brouillard 2 états : texture dédiée (1 px/tuile, `SCALE_MODES.NEAREST`
  étirée) mise à jour incrémentalement. En Phase 2, la carte proto 32×32 tient
  sans chunks — l'API `Tilemap` est néanmoins écrite chunkée d'emblée car
  c'est structurel, pas de l'optimisation prématurée.
- **Combat** : grille hex **pointy-top 12×10** en coordonnées axiales,
  surbrillances (hexes atteignables, cibles) via `Graphics` partagés.
- **Caméra** : un `Container` monde transformé (position/scale) ; pan (drag),
  pinch-zoom, molette. Touch-first : gestes natifs Pointer Events, cibles
  ≥ 44 px, « tap-tap » pour toute action irréversible (doc 08 §1).
- **Assets** : placeholders générés (formes teintées + initiales) en Phase 2 ;
  chargement par `Assets.load()` avec manifeste par paquet de faction (lazy
  par faction — doc 07 §6, la modularité paie aussi ici).

### 2.4 Chargement de contenu data-driven

Pipeline (doc 06 §1) :

1. `fetch('data/factions/index.json')` → liste des paquets.
2. Pour chaque paquet : `fetch` du `manifest.json` + fichiers référencés.
3. **Validation Zod** de chaque fichier ; rapport d'erreurs agrégé, précis
   (chemin + champ + attendu/reçu). Paquet invalide ⇒ rejeté avec rapport,
   jamais de crash (doc 06 §1).
4. Enregistrement dans les registres du moteur : contenu (unités, bâtiments,
   héros, sorts), capacités (IDs du catalogue générique), hooks.
5. Les mêmes schémas Zod tournent en CI sur tout `data/` (`pnpm content:check`)
   et sont exportés en JSON Schema dans `schemas/` (autocomplétion éditeur).

Le moteur ne voit que des **IDs et des données validées** — aucun nom de
faction n'apparaît dans `packages/engine` (critère CI : grep interdit de
`haven|necropolis|arcane` hors de `data/` et des tests de contenu).

### 2.5 Modularité factions — ce qui est livré en Phase 2

| Mécanisme (doc 06) | Phase 2 | Plus tard |
|---|---|---|
| Schémas + validateur + rapport d'erreurs | ✅ complet | évolutions de schéma versionnées |
| Registre de contenu (unités, bâtiments, héros, sorts) | ✅ | — |
| Catalogue de capacités génériques | ✅ ~6 capacités (celles des unités du proto : `flying`, `shooter`, `noRetaliation`, `mark`, `undead`, `doubleAttack`) | ~20 au MVP |
| `AbilityModule` / `AdventureHook` (points d'extension code) | Interfaces publiées dans `@heroes/engine-api` + registres fonctionnels ; **aucun module livré** | premiers modules : Nécromancie (MVP), `consumeMarks`/`demonform` (Alpha) |
| `faction:new` / `faction:validate` | ✅ (CLI Node dans `tools/`) | `faction:sim` (Alpha) |
| Paquets | `test-faction` (générée) + squelette `arcane-hunters` | Haven + Necropolis complètes (MVP) |

## 3. Plan d'implémentation par sous-phases

Chaque sous-phase se termine par un incrément **déployé sur Pages** et des
critères vérifiables (guidelines §4). Priorités : P0 = bloque tout, P1 = cœur
du jalon, P2 = si le temps le permet.

### Phase 2.0 — Bootstrap & déploiement continu (P0, ~2–3 jours)

*Le pipeline de déploiement est livré en premier : tout le reste devient
visible en live dès son premier commit.*

1. Monorepo pnpm + TS strict + ESLint (frontières + interdits déterminisme)
   + Vitest + Playwright. → vérif : `pnpm typecheck && pnpm lint && pnpm test`
   verts sur squelette vide.
2. `packages/client` : page Vite + Pixi 8 qui affiche un damier pan/zoomable
   (souris + tactile). → vérif : 60 fps, gestes pinch/drag OK sur mobile.
3. **`tests/smoke.spec.ts`** (Playwright/Chromium headless) : la page charge,
   le canvas est présent, aucun échec console. Livré **dans le même lot** que
   le premier code (guideline §7). → vérif : passe en local et en CI.
4. `ci.yml` + `deploy.yml` + activation Pages (cf. §4). → vérif : l'URL
   `https://kenhuri69.github.io/heroes/` affiche le damier après merge sur `main`.

### Phase 2.1 — Cœur du moteur (P0, ~1 semaine)

1. `GameState`, `Command`, `apply()`, événements, RNG PCG32, calendrier
   jour/semaine. → vérif : unitaires + property-based (« l'or n'est jamais
   négatif », « apply est pur : même état+commande ⇒ même résultat »).
2. Golden replay : partie scriptée rejouée en CI, hash d'état comparé.
   → vérif : casse si on introduit un `Math.random`.
3. Sérialisation snapshot + journal de commandes. → vérif : save→load→hash égal.

### Phase 2.2 — Pipeline de contenu (P0, ~1 semaine, parallélisable avec 2.1)

1. Schémas Zod (manifest, unit, building, hero, spell, map) + loader + rapport
   d'erreurs. → vérif : paquet corrompu ⇒ rapport précis, pas de crash.
2. CLI `faction:new` / `faction:validate` ; génération de `test-faction`.
   → vérif : `pnpm faction:validate test-faction` vert en CI.
3. Squelette `arcane-hunters` (cf. §5.4) chargé au démarrage. → vérif :
   critère de modularité — l'ajout du paquet ne modifie **aucun** fichier hors
   `data/` (`git diff --stat` le prouve, comme doc 06 §5.8).

### Phase 2.3 — Carte d'aventure & mouvement héros (P1, ~1,5 semaine)

1. Format `*.map.json` + carte proto 32×32 ; rendu tuiles + décor + objets.
2. Héros : sélection, **A\* 8 directions** avec coûts de terrain/routes
   (doc 02 §1.5), prévisualisation chemin + jours (points verts/jaunes),
   tap-tap (doc 08 §2.1), points de mouvement quotidiens, `EndTurn`.
3. Brouillard 2 états ; ramassage de ressources ; barre de ressources (UI).
   → vérif jalon Phase 0 roadmap : *déplacer un héros sur une carte JSON,
   fin de tour, sauvegarde/rechargement IndexedDB* + smoke test étendu
   (déplacement scripté via seed fixe, position finale attendue).

### Phase 2.4 — Arène de combat hex (P1, ~2 semaines)

*Livrée tôt, testable seule via `/#arena` (risque n°1, doc 09).*

1. Moteur : grille hex 12×10, vagues d'initiative par vitesse décroissante,
   déplacer/attaquer/attendre/défendre, riposte 1×/round, dégâts (formule
   doc 02 §5.3), moral/chance, ~6 capacités du catalogue. → vérif :
   property-based « un combat se termine toujours » + cas tabulaires de dégâts.
2. IA heuristique des deux camps (doc 02 §5.6) + auto-combat re-simulable.
   → vérif : même seed ⇒ même résultat, 1000× en CI.
3. Scène Pixi : rendu hex, surbrillances, **prévisualisation de dégâts
   obligatoire** (doc 08 §2.4), tap-tap, vitesses ×1/×2/×4.
4. Intégration aventure : gardien neutre sur la carte ⇒ combat ⇒ retour carte
   avec pertes appliquées. → vérif : smoke test « victoire contre le gardien ».

### Phase 2.5 — Boucle jouable & finitions prototype (P1/P2, ~1 semaine)

1. Menu principal (Continuer / Nouvelle partie / Options minimales), i18n
   FR/EN branchée (les clés `@loc:` du contenu passent déjà par `locales/`).
2. Sauvegarde IndexedDB (`idb`) : autosave fin de tour + 1 slot manuel,
   export/import `.heroes` (P2).
3. XP/niveau basique (attributs seulement — compétences : MVP) (P2).
4. Passe mobile : portrait (bandeau ressources, tiroir), paysage combat.
   → vérif : smoke test en viewport mobile + desktop (doc 07 §7) ;
   budget bundle < 800 Ko gzip vérifié en CI.

**Sortie de Phase 2** = jalon Phase 0 roadmap atteint **+** arène de combat
jouable **+** URL publique à jour. La suite (villes, 12 compétences, 20 sorts,
Haven/Necropolis complètes, 3 scénarios…) est la Phase MVP de la roadmap,
inchangée.

## 4. Build & déploiement GitHub Pages

### 4.1 `packages/client/vite.config.ts`

```ts
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'node:path';

export default defineConfig({
  // GitHub Pages sert le site sous /<repo>/ — crucial pour tous les assets.
  // Base FIXE (et non conditionnelle au build) : `vite preview` résout
  // `command === 'serve'`, une base conditionnelle casserait le smoke test
  // sur le build de prod. Même comportement en dev/preview/prod.
  base: '/heroes/',
  plugins: [preact()],
  resolve: {
    alias: {
      '@heroes/engine': path.resolve(__dirname, '../engine/src'),
      '@heroes/engine-api': path.resolve(__dirname, '../engine/src/api'),
      '@heroes/content': path.resolve(__dirname, '../content/src'),
    },
  },
  // data/ est servi tel quel : le chargement data-driven passe par fetch()
  // en dev comme en prod (même code, même pipeline).
  publicDir: path.resolve(__dirname, '../../data'),
  build: {
    target: 'es2022',
    sourcemap: true,
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          pixi: ['pixi.js'],            // gros vendor stable → cache long terme
          engine: ['@heroes/engine'],
        },
      },
    },
  },
  server: { host: true },              // test tactile sur device du LAN en dev
});
```

> Note : `publicDir` pointé sur `data/` copie le contenu à la racine du site
> (`/heroes/factions/...`). Le loader utilise `import.meta.env.BASE_URL` comme
> préfixe de fetch pour fonctionner en dev (`/`) comme sur Pages (`/heroes/`).

### 4.2 `.github/workflows/deploy.yml`

Déploiement **officiel GitHub Pages via Actions** (pas de branche `gh-pages` :
moins d'écritures git, permissions minimales, URL visible sur chaque run).

> **État actuel** : depuis la Phase 2.0, ce workflow build réellement le
> client (la version bootstrap qui publiait `site/` a été remplacée et
> `site/` supprimé). Les étapes `pnpm test` (tests moteur) et
> `pnpm content:check` s'activent avec les Phases 2.1 et 2.2.

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:      # déploiement manuel possible depuis l'onglet Actions

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true   # seul le dernier push sur main est déployé

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      # Qualité avant déploiement : on ne publie jamais un build rouge.
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test                       # Vitest (moteur + contenu)
      - run: pnpm content:check              # validation de tous les paquets

      - run: pnpm --filter client build

      # Smoke test headless SUR LE BUILD DE PROD (guideline §7)
      - run: pnpm exec playwright install chromium --with-deps
      - run: pnpm smoke:preview              # vite preview + tests/smoke.spec.ts

      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: packages/client/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}   # ← URL affichée sur le run
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Un `ci.yml` séparé exécute les mêmes étapes de qualité (sans déploiement) sur
toutes les PR — le déploiement ne se déclenche que sur `main`.

### 4.3 Activer GitHub Pages (une fois, dans les settings du dépôt)

1. **Settings → Pages → Build and deployment → Source : `GitHub Actions`**
   (et non « Deploy from a branch »).
2. Vérifier **Settings → Actions → General → Workflow permissions** :
   « Read repository contents » suffit (le déploiement utilise l'OIDC
   `id-token`, pas le `GITHUB_TOKEN` en écriture).
3. Pousser sur `main` (ou lancer `deploy.yml` via *workflow_dispatch*).
4. L'URL apparaît dans Settings → Pages et sur chaque run, environnement
   `github-pages` : `https://kenhuri69.github.io/heroes/`.
5. (Dépôt privé : Pages exige un plan payant — passer le dépôt en public si
   besoin pour le playtest.)

## 5. Code de base prioritaire

Ordre de création des premiers fichiers (chaque bloc = un commit vert).
Les extraits ci-dessous fixent les conventions ; ce sont des références
d'implémentation, pas du pseudo-code.

### 5.1 Bootstrap PixiJS 8 + caméra

```ts
// packages/client/src/main.ts
import { Application } from 'pixi.js';
import { mountUi } from './ui/shell';
import { Camera } from './render/camera';
import { loadGameContent } from './app/content';
import { AdventureScene } from './scenes/adventure/AdventureScene';

const app = new Application();
await app.init({
  resizeTo: window,
  background: '#1a1c22',
  antialias: false,                       // pixel-perfect tuiles 64 px
  resolution: Math.min(window.devicePixelRatio, 2),
  autoDensity: true,
  preference: 'webgl',                    // webgpu quand Pixi le jugera prioritaire
});
document.getElementById('canvas-root')!.appendChild(app.canvas);

const content = await loadGameContent();  // §5.3 — data-driven, fail = écran d'erreur lisible
const camera = new Camera(app);           // pan/pinch/molette, bornes monde
const scene = new AdventureScene(app, camera, content);
app.stage.addChild(camera.world);
mountUi(document.getElementById('ui-root')!);   // Preact par-dessus le canvas
```

```ts
// packages/client/src/render/camera.ts — touch-first (doc 08 §1)
import { Application, Container, FederatedPointerEvent, Point } from 'pixi.js';

export class Camera {
  readonly world = new Container();
  private pointers = new Map<number, Point>();
  private pinchDist = 0;

  constructor(private app: Application) {
    const stage = app.stage;
    stage.eventMode = 'static';
    stage.hitArea = app.screen;
    stage.on('pointerdown', this.onDown);
    stage.on('pointermove', this.onMove);
    stage.on('pointerup', this.onUp);
    stage.on('pointerupoutside', this.onUp);
    app.canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  private onDown = (e: FederatedPointerEvent) => {
    this.pointers.set(e.pointerId, e.global.clone());
    if (this.pointers.size === 2) this.pinchDist = this.currentPinchDist();
  };

  private onMove = (e: FederatedPointerEvent) => {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    if (this.pointers.size === 1) {                    // pan à un doigt / drag souris
      this.world.x += e.global.x - prev.x;
      this.world.y += e.global.y - prev.y;
    }
    this.pointers.set(e.pointerId, e.global.clone());
    if (this.pointers.size === 2) {                    // pinch-zoom
      const d = this.currentPinchDist();
      this.zoomAt(this.pinchCenter(), d / this.pinchDist);
      this.pinchDist = d;
    }
  };

  private onUp = (e: FederatedPointerEvent) => this.pointers.delete(e.pointerId);

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.zoomAt(new Point(e.offsetX, e.offsetY), e.deltaY < 0 ? 1.1 : 1 / 1.1);
  };

  private zoomAt(screen: Point, factor: number) {
    const next = Math.min(2, Math.max(0.5, this.world.scale.x * factor));
    const local = this.world.toLocal(screen);
    this.world.scale.set(next);
    const after = this.world.toGlobal(local);
    this.world.x += screen.x - after.x;               // zoom centré sur le geste
    this.world.y += screen.y - after.y;
  }

  private currentPinchDist(): number { /* distance entre les 2 pointeurs */ return 0; }
  private pinchCenter(): Point { /* milieu des 2 pointeurs */ return new Point(); }
}
```

*(Distinction tap vs drag — seuil ~8 px / 250 ms — dans `input/pointer.ts` :
un « tap » remonte à la scène pour la logique tap-tap, un drag est consommé
par la caméra. Le clamp aux bornes du monde arrive avec la carte.)*

### 5.2 Moteur : commande, RNG, mouvement

```ts
// packages/engine/src/core/rng.ts — PCG32, état sérialisable (doc 07 §3)
export interface RngState { hi: number; lo: number; incHi: number; incLo: number }

export function seedRng(seed: number): RngState { /* init PCG32 */ }
export function nextU32(s: RngState): { value: number; state: RngState } { /* pur */ }
export function rollRange(s: RngState, min: number, max: number)
  : { value: number; state: RngState } { /* pur, bornes incluses */ }
```

```ts
// packages/engine/src/core/commands.ts
export type Command =
  | { type: 'StartGame'; seed: number; mapId: string; players: PlayerSetup[] }
  | { type: 'MoveHero'; heroId: string; path: GridPos[] }   // chemin déjà validé A*
  | { type: 'EndTurn'; playerId: string }
  | { type: 'CombatAction'; action: CombatAction }
  | { type: 'PickChoice'; choiceId: string; option: string };  // coffre : or ou XP
```

```ts
// packages/engine/src/core/engine.ts
import { produce } from 'immer';

export function apply(state: GameState, cmd: Command): EngineResult {
  const err = validate(state, cmd);
  if (err) throw new EngineError(err);
  const events: GameEvent[] = [];
  const next = produce(state, (draft) => {
    handlers[cmd.type](draft, cmd as never, events);  // table de handlers, pas de switch géant
  });
  return { state: next, events };
}
```

Le handler `MoveHero` consomme les points de mouvement tuile par tuile
(coûts doc 02 §1.5), émet `MoveStepped` par tuile, s'arrête sur interception
d'événement (ressource, gardien) — standard HoMM (doc 08 §2.1).

### 5.3 Chargement data-driven des factions

```ts
// packages/content/src/schemas/manifest.ts — miroir Zod du manifeste (doc 06 §3)
import { z } from 'zod';

export const manifestSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]+$/),
  schemaVersion: z.literal(1),                    // Phase 2 démarre à 1 ; migrations doc 06 §7
  name: z.string().startsWith('@loc:'),           // toute string visible est localisée
  nativeTerrain: z.string(),
  keyResources: z.array(z.string()).length(2),
  factionResources: z.array(z.object({
    id: z.string(), icon: z.string(), cap: z.number().int().positive(),
  })).default([]),
  factionBonuses: z.array(z.discriminatedUnion('type', [/* effets déclaratifs */])).default([]),
  spellSchool: z.string().nullable(),
  heroSkills: z.array(z.string()).default([]),
  tiers: z.number().int().min(7).max(8),
  sharedGrowthGroups: z.record(z.string(), z.array(z.string())).default({}),
  abilityModules: z.array(z.string()).default([]),
  hooks: z.array(z.string()).default([]),
  aiProfile: z.object({
    aggression: z.number().min(0).max(1),
    focusFire: z.number().min(0).max(1),
    preferredTargets: z.string(),
  }),
});
```

```ts
// packages/content/src/loader.ts
export interface FactionPack { manifest: Manifest; units: Unit[]; /* buildings… */ }
export interface LoadReport { ok: FactionPack[]; rejected: { id: string; errors: string[] }[] }

export async function loadFactionPacks(baseUrl: string): Promise<LoadReport> {
  const index = indexSchema.parse(await fetchJson(`${baseUrl}factions/index.json`));
  const report: LoadReport = { ok: [], rejected: [] };
  for (const id of index.factions) {
    try {
      report.ok.push(await loadPack(baseUrl, id));   // fetch + parse Zod de chaque fichier
    } catch (e) {
      report.rejected.push({ id, errors: formatZodErrors(e) });  // rejet propre, jamais de crash
    }
  }
  return report;
}

export function registerPacks(registry: ContentRegistry, packs: FactionPack[]): void {
  for (const pack of packs) {
    for (const unit of pack.units) {
      for (const ref of unit.abilities) {
        if (!registry.abilities.has(ref.id))         // règle croisée : capacité inconnue = rejet
          throw new ContentError(`${pack.manifest.id}/${unit.id}: unknown ability '${ref.id}'`);
      }
      registry.units.register(unit);
    }
    // buildings, heroes, spells… même mécanique. Le moteur ne voit que des IDs.
  }
}
```

### 5.4 Paquet squelette Arcane Hunters (preuve de modularité)

```jsonc
// data/factions/index.json
{ "factions": ["test-faction", "arcane-hunters"] }
```

```jsonc
// data/factions/arcane-hunters/manifest.json — extrait du manifeste doc 06 §3,
// réduit au squelette Phase 2 (schemaVersion 1 : pas encore de bonus/hook codés)
{
  "id": "arcane-hunters",
  "schemaVersion": 1,
  "name": "@loc:faction.name",
  "nativeTerrain": "mistmoor",
  "keyResources": ["mercury", "gems"],
  "factionResources": [{ "id": "essence", "icon": "icons/essence.png", "cap": 999 }],
  "factionBonuses": [],
  "spellSchool": null,
  "heroSkills": [],
  "tiers": 8,
  "sharedGrowthGroups": { "apex": ["t7-manticore", "t8-penitent"] },
  "abilityModules": [],
  "hooks": [],
  "aiProfile": { "aggression": 0.7, "focusFire": 0.9, "preferredTargets": "marked" }
}
```

```jsonc
// data/factions/arcane-hunters/units/t1-eleve.json — stats doc 05 §4
{
  "id": "t1-eleve",
  "tier": 1,
  "name": "@loc:unit.t1-eleve.name",
  "stats": { "hp": 5, "attack": 3, "defense": 2, "damage": [1, 3], "speed": 5 },
  "growthPerWeek": 12,
  "cost": { "gold": 35 },
  "abilities": [{ "id": "mark" }]
  // `swarm` (doc 05) attend le catalogue étendu du MVP — noté dans le paquet, pas ajouté au moteur en douce
}
```

**Le critère qui compte** : ce paquet est ajouté par un commit qui ne touche
**que** `data/` (+ `index.json`). La CI l'atteste (doc 06 §5.8). Une unité
Arcane Hunters est recrutable dans l'arène de combat dès la Phase 2.4 — la
faction complète (Marques consommables, Cercles, Essence, T8 demonform)
reste produite en Alpha via sa checklist.

### 5.5 Grille hex de combat (rendu)

```ts
// packages/client/src/render/hexgrid.ts — pointy-top, coordonnées axiales
// Convention moteur : combat/hex.ts fournit les mêmes maths côté règles (sans Pixi).
const HEX_SIZE = 36;                                   // rayon ; ≥ 44 px de cible tactile au zoom 1

export function hexToPixel(q: number, r: number): { x: number; y: number } {
  return {
    x: HEX_SIZE * Math.sqrt(3) * (q + r / 2),
    y: HEX_SIZE * 1.5 * r,
  };
}

export function pixelToHex(x: number, y: number): { q: number; r: number } {
  const q = ((Math.sqrt(3) / 3) * x - y / 3) / HEX_SIZE;
  const r = (2 / 3) * y / HEX_SIZE;
  return hexRound(q, r);                               // arrondi cubique standard
}

export function drawBoard(g: Graphics, reachable: Set<string>): void {
  for (let r = 0; r < 10; r++)
    for (let q = 0; q < 12; q++) {                     // 12 col × 10 rangées (doc 02 §5.1)
      const { x, y } = hexToPixel(q - (r >> 1), r);    // stockage « offset », maths axiales
      g.regularPoly(x, y, HEX_SIZE - 1, 6, Math.PI / 6)
        .fill(reachable.has(`${q},${r}`) ? 0x2e4a2e : 0x22242c)
        .stroke({ width: 1, color: 0x3a3d47 });
    }
}
```

### 5.6 UI minimale (Preact)

```tsx
// packages/client/src/ui/ResourceBar.tsx
import { useGame } from '../app/store';

const RESOURCES = ['gold', 'wood', 'ore', 'crystal', 'gems', 'sulfur', 'mercury'] as const;

export function ResourceBar() {
  const player = useGame((s) => s.game.players[s.game.currentPlayer]);
  return (
    <header class="resource-bar">                    {/* bandeau haut compact en portrait (doc 08) */}
      {RESOURCES.map((id) => (
        <button class="resource" onClick={() => showDetail(id)}> {/* tap = détail, pas de hover requis */}
          <img src={iconUrl(id)} alt="" /> {player.resources[id]}
        </button>
      ))}
    </header>
  );
}
```

Écrans Phase 2 : menu principal (Continuer/Nouvelle partie/Options), barre de
ressources, panneau héros sélectionné (armée 7 slots, lecture seule), bouton
« Fin de tour » (gros, bas-droite en mobile), toasts d'événements. Tout en
DOM ; le canvas ne rend que carte et combat (doc 07 §1).

## 6. Récapitulatif des garde-fous (à câbler dès la Phase 2.0)

| Invariant (README / guidelines §8) | Mécanisme de contrôle |
|---|---|
| Moteur sans faction | grep CI interdisant les IDs de faction hors `data/` ; ajout de paquet = diff `data/` uniquement |
| Déterminisme | lint `Math.random`/`Date.now` interdits dans `engine`+`content` ; golden replay en CI |
| Moteur sans rendu | ESLint `no-restricted-imports` + test d'import Node nu |
| Touch-first | smoke Playwright en viewport mobile ; cibles ≥ 44 px revues à chaque écran |
| Budgets perf | taille bundle vérifiée en CI (< 800 Ko gzip) ; test 60 fps throttlé ×4 (au plus tard Phase 2.4) |
| Docs = source de vérité | tout écart d'implémentation constaté ⇒ mise à jour du doc 0X concerné dans le même commit |
