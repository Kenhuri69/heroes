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

> ⚠️ **Reprise après interruption (limite d'usage).** Le tableau ci-dessous a
> d'abord été rempli par la session interrompue **sans que le pipeline ait été
> rejoué sur l'état final** — plusieurs valeurs étaient donc des intentions, pas
> des mesures (client annoncé à « 60 tests », bundle à 372 137 o, smoke déclaré
> vert). La session de reprise a **tout re-exécuté depuis zéro** sur le commit
> `wip` et remplace ces chiffres par les mesures réelles. Aucun résultat hérité
> n'est conservé sur parole.

| # | Étape | Résultat re-mesuré |
|---|---|---|
| 1 | `pnpm typecheck` | ✅ (5 projets) |
| 2 | `pnpm lint` | ✅ |
| 3 | `pnpm test` | ✅ moteur **935** · contenu **164** · client **43** (9 fichiers, dont les 2 du lot : +10 tests) — 1 flake d'environnement, cf. §3 |
| 4 | `pnpm content:check` | ✅ 7 paquets, 2 cartes, 16 scénarios |
| 5 | `pnpm build` | ✅ 17,5 s |
| 6 | garde-fou zéro faction dans `packages/` | ✅ statut=1 |
| 7 | garde-fou zéro couleur en dur hors `tokens.css` | ✅ statut=1 |
| 8 | budget bundle < 800 Ko gzip | ✅ **362 245 o** (44 % du budget) |
| 9 | smoke Playwright `@core` | ✅ **43 tests / 43**, 5,3 min, **0 rejeu** (cf. §3.2 — protocole `CI=1` + `flock`) |

Invariants du diff (contrôlés) : **0 fichier `packages/engine`** modifié ·
`CURRENT_SAVE_VERSION = 35` **identique** à `origin/main` · **0 fixture golden**
touchée · **0 clé de locale** ajoutée (le lot n'introduit aucune chaîne visible :
tout est build, CI, SW et identité de joueur).

Mesures spécifiques au lot (**re-mesurées à la reprise**) :

| Mesure | Avant (`origin/main`) | Après | Borne CI |
|---|---|---|---|
| `dist/assets` total | 86 862 437 o | **83 420 746 o** (−3 441 691 o, −4,0 %) | ≤ 100 663 296 o (96 Mio) |
| Images émises dans `dist/assets` | 773 | **768** (−5) | — |
| Fichiers de `assets/prompts/` dans `dist/assets` | 5 (2 863 270 o) | **0** | 0 (garde-fou dédié) |
| Logo `heroes-master.png` (1er écran) | 821 153 o, 1024² | **242 604 o, 512²** (−70,5 %) | — |
| Plus gros fichier du chemin critique | 821 153 o | **242 604 o** | ≤ 307 200 o (300 Ko) |
| Budget octets du cache SW | absent | **50 Mio** | test unitaire |

**Preuves exigées par le lot, faites à la reprise :**

- *Le gain sur `dist/` est réel* : `du -sb` avant/après ⇒ −3 441 691 o, et le
  décompte d'images passe de 773 à **768**, soit exactement les 5 fichiers de
  `assets/prompts/`. (L'écart avec les −2 863 270 o des seuls prompts est le
  correctif logo : −578 549 o. Total attendu −3 441 819 o ; mesuré −3 441 691 o,
  les 128 o de différence venant du ré-encodage des noms hashés.)
- *Le garde-fou n'est pas vacant* : confronté à un faux positif injecté
  (`dist/assets/siege-kit-deadbeef.png`), il **échoue** en nommant la source
  (`assets/prompts/_incoming/siege-kit.png`) — il détecte donc bien une fuite, et
  ne confond pas `siege-kit.png` avec `siege-kit-template.png` (glob de hash à 8
  caractères exactement).
- *Le logo reste net* : PNG relu **à l'image** (pas seulement au poids) —
  composition identique à l'original 1024² (couronne, filigranes d'or, lettrage
  « HEROES », lame), aucun banding ni artefact de rééchantillonnage. Affiché à
  240 px CSS (`.menu-logo { max-width: 240px }`, `img { width: 100% }`) ⇒ 480 px
  à DPR 2 : les 512² gardent une marge, y compris sur écran haute densité.

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
- **`dist/assets` mesuré à 83 420 746 o** au lieu des ~84,0 Mo prévus : le
  correctif logo retire 578 549 o de plus que la seule exclusion des prompts.

### 3.1 Écarts relevés à la reprise (session 2)

- **Le pipeline n'avait jamais été rejoué** sur l'état livré par la session 1 :
  §2 a été intégralement re-mesuré (voir l'avertissement en tête de §2). Bilan :
  le travail de la session 1 est **fonctionnel tel quel** — aucun point du
  périmètre n'a dû être refait, seuls les chiffres rapportés étaient faux.
  - client annoncé « 9 fichiers / 60 tests » ⇒ réel **43 tests** (le lot en
    ajoute 10 : 7 `sw-prune` + 3 `daily`) ;
  - bundle annoncé 372 137 o ⇒ réel **362 245 o** ;
  - `dist/assets` annoncé 83 764 615 o ⇒ réel **83 420 746 o**.
- **Flake d'environnement, pas une régression** : au premier passage,
  `engine/test/combat-property.test.ts` a dépassé le `testTimeout` de 5 s
  (conteneur 4 vCPU partagé entre agents). Re-joué seul : **vert en 1,55 s**,
  soit 3× sous la limite. Le lot ne touche **pas** `packages/engine` — aucun lien
  de causalité possible.
- **Ajout à la reprise — garde-fou prompts non vacant** : la boucle dérivée de
  `find assets/prompts` passait « vert » sans rien vérifier si l'arborescence
  disparaissait (répertoire renommé, checkout partiel). Un compteur `seen` fait
  désormais échouer l'étape si aucune source n'est trouvée — même patron que le
  `crit -eq 0` de l'étape voisine (budget d'images). Vérifié dans les deux sens
  (build sain ⇒ 0 fuite sur 5 sources ; fuite injectée ⇒ échec nommé).
- **Pillow indisponible à la reprise** : le module `PIL` n'est pas installé dans
  cet environnement (la session 1 avait dû l'installer). La recompression étant
  **déjà faite et commitée**, ce n'est pas bloquant : la vérification s'est faite
  sans PIL — lecture directe de l'entête IHDR (512×512, profondeur 8, type
  couleur 6 = RGBA) et **relecture visuelle** du PNG. Conséquence : aucune
  re-compression supplémentaire n'a été tentée à la reprise.
- **`assets/prompts/` reste versionné** (seulement exclu du *build*) : les
  planches brutes de `_incoming/` alimentent `tools/assets/extract_*.py`. Sortir
  le répertoire du dépôt serait un autre débat (hors périmètre R7).

### 3.2 Hygiène de port du smoke (piège avéré du projet)

Le port 4173 est partagé entre agents concurrents et `playwright.config.ts`
porte `reuseExistingServer: !CI` — un smoke lancé sans précaution peut mesurer le
build d'un **autre** agent, sans la moindre erreur visible. Protocole appliqué :

1. `CI=1` sur l'appel Playwright ⇒ `reuseExistingServer: false` : une collision
   de port devient une **erreur bruyante** au lieu d'un silencieux « je teste le
   build du voisin ». (`CI=1` active aussi `forbidOnly` et `retries: 2`.)
2. Sérialisation par `flock` sur le verrou partagé, `--workers=1`.
3. Le serveur est démarré **et arrêté** par Playwright lui-même (jamais de
   preview en tâche de fond sous le verrou, qui hériterait du descripteur et
   bloquerait les autres agents). Vérifié après coup : aucun processus résiduel
   de cette session. Un `vite preview` **appartenant à un autre agent** tournait
   au moment du contrôle — laissé en vie, comme le veut la règle.

Résultat : 43/43 en 5,3 min, **aucun rejeu** (les 2 `retries` de `CI=1` n'ont
jamais été consommés).

## 4. Bilan du lot

Les 4 points du périmètre sont livrés et vérifiés :

| Point | Constat | Livré | Vérification |
|---|---|---|---|
| 1 | **P1** — 2,86 Mo de planches de génération dans le build | `'!…/assets/prompts/**'` au glob | garde-fou **CI réel** (`ci.yml`), non vacant, testé dans les deux sens ; −5 fichiers, −3,44 Mo mesurés |
| 2 | **P2** — logo de 821 Ko sur le premier écran | 512² RGBA, **242 604 o** | 2 bornes CI chiffrées (total 96 Mio, chemin critique 300 Ko), justifiées en §1.2 ; netteté contrôlée **à l'image** |
| 3 | **P3** — cache SW borné en entrées seulement | `ASSETS_MAX_BYTES = 50 Mio` cumulé, ordre d'insertion **inchangé** | 7 tests unitaires de `selectAssetEvictions` (plafonds séparés, cumulés, ordre, bornes) |
| 4 | **B7** — `'player-1'` en dur dans les contrats | `playerId` en paramètre requis ; `humanPlayerId(game)` au rafraîchissement | 3 tests unitaires — les contrats visent le joueur **passé** |

Reste hors périmètre, assumé : les 83 Mo d'art *lazy* ne sont pas réduits (c'est
le prix de 7 maisons, et il est désormais **sous garde-fou** plutôt que non
mesuré) ; aucun autre asset du chemin non-critique n'a été recompressé.
