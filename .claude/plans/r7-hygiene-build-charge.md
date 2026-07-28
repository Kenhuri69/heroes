# Lot R7 — Hygiène de build et de charge

> Lot P3 du plan `.claude/plans/game-review-remediation-plan.md` §6 (constats
> **P1**, **P2**, **P3**, **B7** — chapitres 1 et 4 du même document).
> **Client + données + CI uniquement** : zéro diff `packages/engine`, pas de bump
> `CURRENT_SAVE_VERSION`, golden replay intouché.

Branche : `claude/r7-hygiene-build-charge` (base `origin/main` = `d6a031b`).

## 0. État de référence mesuré (avant correctifs)

Mesuré sur `d6a031b` après `pnpm build` :

| Mesure | Valeur |
|---|---|
| `dist/assets` total | **86 862 437 o** (82,8 Mio) — 773 PNG/JPG |
| Images issues de `assets/prompts/` embarquées | **2 863 270 o** (5 fichiers) |
| `logo/heroes-master.png` (1er écran) | **821 153 o**, 1024×1024 RGBA |
| `backgrounds/title.jpg` (1er écran) | 204 578 o |
| Bundle JS+CSS gzip | 363 Ko / 800 Ko |
| Empreinte art d'UNE faction (mesurée) | 6,7 → **11,0 Mio** (vox-arcana = max) |
| `data/sw.js` | `ASSETS_MAX = 300` entrées, **aucun** budget en octets |
| `app/daily.ts:27` | `const HUMAN_PLAYER_ID = 'player-1'` en dur |

Les 5 fichiers de `assets/prompts/` embarqués :
`_incoming/siege-ensemble.png` 1 209 415 o · `_incoming/siege-kit.png`
1 123 925 o · `siege-kit-template.png` 462 455 o ·
`siege-ensemble-template.png` 39 251 o · `siege-run-template.png` 28 224 o.

## 1. Étapes & critères de vérification

### 1.1 P1 — exclure le répertoire de génération du glob

- [x] `render/assets.ts` : ajouter `'!**/assets/prompts/**'` aux motifs de
      `import.meta.glob` (le seul motif d'exclusion existant était
      `'!**/_preview.png'`).
- [x] Garde-fou **CI** (`.github/workflows/ci.yml`) : après `pnpm build`, aucun
      fichier émis dans `dist/assets` ne provient de `assets/prompts/`. Le motif
      est **dérivé de l'arborescence réelle** (`find assets/prompts`), pas d'une
      liste figée — même esprit que le garde-fou faction dérivé de
      `data/factions/index.json` : un futur gabarit déposé dans `prompts/` est
      couvert sans toucher au workflow.
- **Critère chiffré** : `dist/assets` passe de 86 862 437 o à **≤ 84 000 000 o**
      (−2 863 270 o attendus, exactement les 5 fichiers ci-dessus).

### 1.2 P2 — logo recompressé + budgets d'images en CI

- [x] `assets/logo/heroes-master.png` recompressé à la taille réellement
      affichée. Affichage : `.menu-logo { max-width: 240px }` (`ui/menu.css`)
      ⇒ 480 px à DPR 2 ⇒ **512×512** (marge 2,13× la taille CSS) au lieu de
      1024×1024.
      **Critère chiffré** : ≤ **250 000 o** (mesuré 242 604 o, −71 %).
- [x] Deux bornes CI chiffrées, sur le modèle du budget bundle :
  1. **poids total de `dist/assets` ≤ 96 Mio (100 663 296 o)** ;
  2. **plus gros fichier du chemin critique ≤ 300 Ko (307 200 o)** — les images
     chargées par le PREMIER écran avant toute interaction : le logo
     (`render/assets.ts:logoUrl`) et le fond de titre
     (`titleBackgroundUrl`).

**Justification des bornes** (exigée par le lot) :

- *Total 96 Mio* : mesuré **84,0 Mio** après le correctif 1.1. La marge de
  +12 Mio est calibrée sur l'empreinte art de la plus grosse faction déjà
  livrée (vox-arcana, **11,0 Mio**) : une 8ᵉ maison peut atterrir sans toucher
  la CI, mais un saut plus gros (nouvelle famille d'assets, ou régression qui
  ré-embarque un répertoire de travail volumineux) devient une **décision
  explicite** qui doit bumper le budget. Une borne serrée à +5 % aurait au
  contraire garanti un bump mécanique à chaque faction, donc un garde-fou
  ignoré.
- *Complémentarité assumée* : ces 2,86 Mio de planches ne suffiraient pas à
  faire sauter la borne totale — c'est pourquoi 1.1 a son **propre** garde-fou
  par nom de fichier. Le budget total attrape les dérives de volume, le garde-fou
  prompts attrape les fuites de répertoire de travail.
- *300 Ko sur le chemin critique* : le fond de titre pèse déjà 204 578 o et est
  irréductible sans perte visible ; 300 Ko laisse 46 % de marge au-dessus de lui
  et **exclut** structurellement un retour à un fichier de 821 Ko sur le premier
  écran (le constat P2).

### 1.3 P3 — cache SW borné en octets

- [x] `data/sw.js` : budget en octets **en plus** du plafond d'entrées,
      **éviction par ordre d'insertion inchangée**.
- [x] Décision d'extraction (le lot demande un test unitaire d'une fonction de
      SW hand-rolled, hors bundle) : la **décision** d'élagage (combien
      d'entrées les plus anciennes évincer) part dans `data/sw-prune.js`, un
      script **classique** chargé par `importScripts('./sw-prune.js')`. Rejeté :
      passer le SW en `type: 'module'` (change l'enregistrement + support
      navigateur) ; rejeté : dupliquer la logique dans un module client
      (dérive garantie). Le fichier reste dans `data/` (servi tel quel, hors
      bundle) et la fonction est **pure** (tableau de tailles → nombre
      d'entrées à évincer), donc testable en vitest via un évaluateur de 3
      lignes qui fournit un `self` factice.
- [x] Test unitaire `packages/client/src/app/sw-prune.test.ts` (niveau
      *unitaire client* — arbre de décision du skill `test-authoring` : logique
      pure, aucun navigateur requis).
- **Critères chiffrés** (assertions) : plafond d'entrées seul inchangé
      (301 entrées ⇒ 1 éviction) ; budget d'octets déclenchant seul
      (10 entrées × 8 Mio sous un budget de 50 Mio ⇒ évince jusqu'à retomber
      sous le budget) ; ordre d'insertion respecté (ce sont **les plus
      anciennes** qui partent) ; jamais plus d'évictions que d'entrées.
- Budget retenu : **`ASSETS_MAX_BYTES = 50 Mio`**. Justification : le SW ne met
  en cache que ce qui a été réellement fetché ; une session type charge la
  coquille + tuiles + icônes + l'art des factions rencontrées. À 300 entrées
  d'assets peints (fonds de siège 620 Ko, toiles de combat 400 Ko), le plafond
  d'entrées **seul** autorisait > 100 Mio, au-delà des quotas d'origine usuels
  sur mobile ; 50 Mio garde une partie complète hors-ligne (coquille ~1 Mo +
  ~84 Mio d'art disponibles dont seule une fraction est visitée) tout en bornant
  la croissance.

### 1.4 B7 — identité du joueur humain dans les contrats journaliers

- [x] `app/daily.ts` : suppression de `HUMAN_PLAYER_ID`, `buildDailyQuests`
      reçoit `playerId` en **paramètre requis**.
- [x] Appelants : escarmouche (`main.ts`) passe `PLAYER_ID` (constante de
      convention du client déjà exportée par `app/game.ts`, celle que
      `skirmishStartCommand` matérialise) ; le **rafraîchissement quotidien**
      (`daily-refresh.ts`, jour ≥ 2, où l'état de jeu existe) lit l'identité
      humaine **réelle** via `humanPlayerId(game)` (R3) au lieu d'une constante.
- **Critère** : test unitaire — les `QuestDef` générés portent le `playerId`
      passé, et plus jamais `'player-1'` quand on passe autre chose.

### 1.5 Docs (même commit)

- [x] `docs/07-architecture.md` : budgets CI (bundle + images) et budget en
      octets du cache SW.
- [x] `docs/12-assets-style-guide.md` : `assets/prompts/` = répertoire de
      travail **exclu du build** (+ règle pour un futur répertoire de travail).

## 2. Pipeline de vérification

| # | Étape | Résultat |
|---|---|---|
| 1 | `pnpm typecheck` | ✅ |
| 2 | `pnpm lint` | ✅ |
| 3 | `pnpm test` | ✅ 935 moteur + contenu + **client 9 fichiers / 60 tests** (+2 fichiers, +12 tests) |
| 4 | `pnpm content:check` | ✅ |
| 5 | `pnpm build` | ✅ |
| 6 | garde-fou zéro faction dans `packages/` | ✅ statut=1 |
| 7 | garde-fou zéro couleur en dur hors `tokens.css` | ✅ statut=1 |
| 8 | budget bundle < 800 Ko gzip | ✅ **372 137 o** (45 %) |
| 9 | smoke Playwright `@core` | ✅ 74 tests (1 re-joué isolé : `pwa-offline`, cf. §3) |

Mesures spécifiques au lot :

| Mesure | Avant | Après |
|---|---|---|
| `dist/assets` total | 86 862 437 o | **83 764 615 o** (−3 097 822 o, −3,6 %) |
| Fichiers de `assets/prompts/` dans `dist/assets` | 5 | **0** |
| Logo (chemin critique) | 821 153 o | **242 604 o** (−70,5 %) |
| Plus gros fichier du chemin critique | 821 153 o | **242 604 o** ≤ 307 200 o |
| Budget octets du cache SW | absent | **50 Mio** |

## 3. Écarts constatés & décisions en cours de route

- **Bornes CI plutôt que « bornes serrées »** : voir la justification de 1.2 —
  une borne à +5 % du mesuré aurait été bumpée à chaque faction, donc inutile.
- **Palette 256 couleurs écartée pour le logo** : 56 331 o (−93 %) mais
  `max abs diff = 46` sur un canal vs le RGBA rééchantillonné (banding visible
  sur les dégradés/halo d'un logo peint). Retenu : RGBA 512² `optimize=True`
  (242 604 o, −70,5 %), sans perte de définition à l'affichage.
- **Recadrage du logo écarté** : la boîte alpha ne couvre que
  (159,102)-(864,921) sur 1024² — recadrer changerait la composition à l'écran
  (le CSS cale sur la largeur de l'image). Hors périmètre « surgical ».
- **`importScripts` retenu** pour rendre l'élagage testable (cf. 1.3) : le SW
  reste un script classique, l'enregistrement (`main.ts`) est inchangé. Le smoke
  `pwa-offline` couvre le risque (si `sw-prune.js` ne se chargeait pas,
  l'installation du SW échouerait et le démarrage hors-ligne casserait) — il est
  **vert**.
- **`pruneAssets` lit `content-length`** pour peser les entrées : évite de
  relire les corps (300 × `blob()` dans le SW). Les réponses sans en-tête sont
  comptées 0 o ⇒ le budget est une borne **best-effort**, jamais bloquante ; le
  plafond d'entrées reste le filet de sécurité. Documenté dans `sw.js`.
- **Ordre des paramètres de `buildDailyQuests`** : `playerId` inséré en 3ᵉ
  position (avant `seed`) — les types (string vs number) rendent toute
  inversion d'appel impossible à compiler.
- **Smoke** : premier passage, `pwa-offline` (desktop) a timeouté seul
  (contention du preview partagé) ; re-joué isolé ⇒ vert. Signalé comme demandé.
- **`dist/assets` mesuré à 83 764 615 o** au lieu des ~84,0 Mo prévus : le
  correctif logo retire 578 549 o de plus que la seule exclusion des prompts.
