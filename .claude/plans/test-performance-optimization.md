# Optimisation du temps d'exécution des tests

> Plan vivant (guideline §5). Objectif : réduire la dérive du temps de test en
> CI **sans régression de couverture**. Analyse d'abord, implémentation par lots
> ensuite (scope validé avec l'utilisateur).

## 1. Constat — d'où vient le temps (mesuré sur pipeline de référence)

Run CI de référence **#29191810965** (`claude/net-sec-2`, succès, 11 min 19 s).
Ventilation par étape (`get_workflow_run_usage` + `list_workflow_jobs`) :

| Étape | Durée | Part |
|---|---|---|
| checkout + setup + install | ~14 s | 2 % |
| `pnpm typecheck` | 13 s | 2 % |
| `pnpm lint` | 4 s | <1 % |
| **`pnpm test` (unitaires moteur + contenu)** | **25 s** | 4 % |
| `content:check` + 2 gardes-fous grep | ~0 s | 0 % |
| `pnpm build` | 11 s | 2 % |
| `playwright install chromium` | 20 s | 3 % |
| **`pnpm smoke` (Playwright)** | **9 min 49 s** | **87 %** |

**Le smoke Playwright est ~87 % du temps de CI. C'est LE levier.** Les
unitaires (25 s pour 110 fichiers) ne sont pas le problème.

## 2. Dérive dans le temps (référence demandée)

- Historique git de `tests/smoke.spec.ts` : **74 → 88 tests en 2 jours**
  (+515 lignes), soit +1 à 3 tests par lot de feature livré.
- Durées CI observées (runs succès 11–12/07) : de **9,6 min à 14 min**.
- Cause mécanique de la dérive : **coût ≈ linéaire** en nombre de tests, car
  chaque `test()` refait un `openGame()` complet (`page.goto` + attente
  `__HEROES_READY__` + init Pixi ≈ 2–4 s incompressibles) et **tout tourne en
  série**. Chaque lot ajoute donc ~7–20 s (× projets × retries) définitivement.

## 3. Cause racine du coût actuel

1. **Aucun parallélisme intra-fichier.** `playwright.config.ts` ne définit ni
   `fullyParallel` ni `workers`. Les 88 tests vivent dans **un seul fichier**
   (`tests/smoke.spec.ts`, 3173 lignes). Playwright paralléllise par *fichier* ;
   un fichier = un worker par projet ⇒ **seulement 2 streams actifs** (desktop +
   mobile) sur un runner 4 vCPU. Deux cœurs restent oisifs.
2. **Duplication desktop × mobile.** Les 88 tests tournent sur les **deux**
   projets (176 exécutions), alors que **2 seulement** sont réellement
   spécifiques au viewport (`test.skip` throttling desktop). La quasi-totalité
   teste de la logique/UI identique dans les deux viewports.
3. **Retries × 2 en CI.** Un test flaky peut coûter jusqu'à ×3.
4. **Coût de boot répété.** ~88 boots d'app pour des assertions parfois légères
   (une modale, un toast) → beaucoup de setup redondant.
5. **Smoke rejoué au déploiement.** `deploy.yml` refait tout le smoke sur `main`
   (couche de sécurité voulue, mais double le coût par merge).

## 4. Axes d'amélioration (rangés par impact / risque de régression)

### Axe A — Parallélisme (impact ÉNORME, risque NUL de régression) ✅ recommandé
- `fullyParallel: true` + `workers` explicite (4 sur runner GH). Paralléllise
  les 88 tests *dans* le fichier au lieu de 2 streams.
- Isolation déjà garantie : chaque test a son `page`/contexte (IndexedDB, seed
  fixe par test) ⇒ aucun état partagé cassé par la parallélisation.
- **Projection** : 9 min 49 → **~3–5 min** (facteur ~2, de 2 à 4 streams).
- ⚠️ Sous-risque : les 2 tests « fluidité throttling CPU ×4 » mesurent des FPS ;
  les faire tourner concurremment à d'autres tests CPU peut les rendre flaky.
  Mitigation : les isoler (`test.describe.configure({ mode: 'serial' })` ou un
  projet dédié mono-worker), pas les paralléliser.

### Axe B — Sharding CI (impact fort, risque nul) ✅ recommandé
- Matrice `--shard=i/N` sur 2–3 runners parallèles. Cumulable avec A.
- **Projection** : ~5 min → **~2 min** de mur (coût-minutes constant).
- ⚠️ La 2ᵉ étape « budget bundle » et gardes-fous ne doivent tourner qu'une fois
  (les garder dans le job non-shardé).

### Axe C — Élaguer la duplication mobile (impact fort, risque FAIBLE) ✅ recommandé
- Faire tourner sur **mobile** uniquement les tests dont le viewport est le
  sujet (HUD mobile, tiroirs, overlay paysage, cibles tactiles, throttling
  carte) — via tag `@mobile` ou un 3ᵉ projet ciblant un `grep`. Le reste en
  desktop seul.
- **Projection** : ~176 → ~100 exécutions (−43 %).
- ⚠️ Non-régression : on perd la vérif « ça marche aussi en 412px » pour les
  tests non tagués. Mitigation : tagger explicitement tout test réellement
  responsive ; garder un smoke mobile « parcours critique » complet.

### Axe D — Réduire/fiabiliser les retries (impact moyen, risque faible)
- Passer `retries` 2 → 1 **après** avoir stabilisé (les helpers `toPass`
  existants sont déjà des points de synchro déterministes). Chaque retry évité
  sur un flaky économise un run complet du test.
- ⚠️ À ne faire qu'une fois la flakiness résiduelle traitée, sinon on troque du
  temps contre des faux rouges.

### Axe E — Regroupement de tests partageant le même état (impact moyen, risque faible)
- Fusionner des `test()` qui refont le **même** `openGame`/setup pour des
  assertions indépendantes, en un seul test à étapes (`test.step`), ou sous un
  `describe` avec `beforeAll` réutilisant un contexte. Candidats à revue :
  - **Confort/routeur/accessibilité** : `confort E`, `confort ?`, `confort
    reduce-motion`, `routeur Échap`, `routeur options`, `accessibilité 3 crans`
    → 6 boots pour des vérifs UI légères sur le même écran de départ.
  - **Ville** (~12 tests bootant chacun + construisant) : en-tête revenu,
    parité lore, erreur de construction, upgrade, guilde, marché… beaucoup
    partagent « démarrer → ouvrir ville ».
- Gain = suppression de N−1 boots par groupe (~2–4 s chacun).
- ⚠️ Non-régression : un test groupé qui échoue tôt masque les assertions
  suivantes. Utiliser `test.step` (rapport clair) et ne grouper que des
  assertions vraiment sur le même état, sinon on nuit au diagnostic.

### Axe F — Dédoublonnage (impact moyen, risque faible) — à AUDITER avant coupe
- Zones de recouvrement à examiner (ne pas supprimer à l'aveugle) :
  - Combat : `arène /#arena`, `écran pré-combat`, `combat victoire gardien`,
    `auto-combat round`, `file d'ordre` — plusieurs entrent en combat par des
    portes différentes ; vérifier lesquels valident une surface *distincte*.
  - Campagne : `campagne ch1/necropolis/AH` — 3 tests quasi identiques dont le
    seul but est « faction = données pures ». Un test paramétré peut suffire,
    OU descendre cette vérif en unitaire (contenu) où elle coûte ~ms.
- ⚠️ Un « doublon » de smoke peut couvrir un chemin d'intégration réel différent
  (rendu, i18n, routing) qu'un unitaire ne voit pas. Auditer, pas présumer.

### Axe G — Descendre des vérifs du smoke vers l'unitaire (impact moyen, risque faible)
- Le smoke doit couvrir **l'intégration rendu/UI** (guideline §7). Des tests qui
  vérifient surtout une **règle moteur** via le hook `__HEROES_TEST__.dispatch`
  (ex. « faction = données pures », effets de sort, calculs) sont mieux, et
  ~1000× plus vite, en `@heroes/engine`/`@heroes/content` (25 s pour 110
  fichiers vs ~7 s **par** test smoke).
- ⚠️ Ne migrer que ce qui n'exerce pas réellement le DOM/Pixi.

### Axe H — Exécution optionnelle / à deux vitesses (impact fort sur la PR, risque politique)
- Séparer un **smoke « cœur »** (parcours critique, ~15–20 tests, tourne sur
  chaque PR, cible < 2 min) d'un **smoke « complet »** (tout, tourne à la fusion
  sur `main`, en nightly, ou sur label `full-smoke`).
- **Projection** : temps ressenti par PR divisé par ~4.
- ⚠️ **Compromis de non-régression explicite** : une régression hors « cœur »
  n'est vue qu'au merge/nightly, pas sur la PR. Choix de politique à valider par
  l'utilisateur. Filet : le job `deploy.yml` sur `main` joue déjà le smoke
  complet ⇒ rien ne part en prod non testé.

### Axe I — Micro-gains d'infra (impact faible, risque nul)
- Cacher le navigateur Playwright (`~/.cache/ms-playwright`) via
  `actions/cache` → économise les ~20 s de `playwright install`.
- Réutiliser l'artefact de `build` entre l'étape build et le smoke (déjà local,
  gain marginal).
- `vitest` : déjà rapide ; laisser tel quel.

## 5. Projection combinée

| Scénario | Temps smoke estimé |
|---|---|
| Aujourd'hui | 9 min 49 s |
| + Axe A (fullyParallel, 4 workers) | ~4–5 min |
| + Axe C (élagage mobile) | ~2,5–3 min |
| + Axe B (sharding ×2) | ~1,5–2 min |
| + Axe H (smoke cœur sur PR) | < 2 min ressenti (PR) |

Cible réaliste **zéro-régression** (A+C, éventuellement B+I) : **~2–3 min**,
soit ~×4 plus rapide, sans toucher à la couverture.

## 6. Ordre d'implémentation proposé (par lots atomiques, chacun vérifié)

1. **Lot 1 — Parallélisme (A + I)** : `fullyParallel`, `workers`, isoler les 2
   tests throttling, cache navigateur. Zéro changement de test ⇒ non-régression
   triviale (mêmes tests, mêmes assertions). *Vérif : smoke vert, temps mesuré.*
2. **Lot 2 — Élagage mobile (C)** : tagguer les tests responsive, restreindre le
   projet mobile. *Vérif : le projet mobile ne garde que les tests tagués, smoke
   vert.*
3. **Lot 3 — Sharding (B)** (optionnel) : matrice CI. *Vérif : somme des shards
   couvre 88 tests.*
4. **Lot 4 — Regroupement/dédoublonnage (E/F/G)** : audit test par test, PR
   séparée. *Vérif : nb d'assertions conservé, smoke vert.*
5. **Lot 5 — Deux vitesses (H)** (décision de politique) : si l'utilisateur le
   veut.

## 7. Périmètre retenu (décision utilisateur 2026-07-12)

**Lots 1+2+3** : parallélisme (A), cache navigateur (I), élagage mobile (C),
sharding CI (B). Lots 4/5 (dédoublonnage, deux vitesses) non retenus pour l'instant.

### Décisions d'implémentation
- **Parallélisme** : `fullyParallel: true`, `workers: 4` en CI. Sûr : chaque test
  a déjà un contexte/IndexedDB isolé (le vert actuel le prouve), la
  parallélisation ne fait que répartir les mêmes tests.
- **Tests de throttling (`@perf`)** : mesurent des FPS sous SwiftShader (CPU) ⇒
  flakiness si concurrents. Isolés dans un job CI dédié `--workers=1`, exclus des
  shards parallèles (`--grep-invert=@perf`). Idem dans `deploy.yml`.
- **Élagage mobile** : le projet `mobile` ne joue plus que les tests tagués
  `@mobile` (parcours critique + tests réellement responsive/tactiles). **Le
  projet `desktop` reste inchangé et joue les 88 tests** ⇒ zéro régression de
  couverture desktop ; seule la couverture *viewport mobile* des tests non tagués
  est retirée (assumé). Allowlist `@mobile` (12) :
  démarrage, tap-tap déplacement, HUD mobile, fiche d'unité au tap, combat
  gardien, menu Nouvelle partie, ville construire/recruter, parité tactile lore,
  3 crans de police, multi-héros/villes (tiroir), autosave→Continuer,
  save/reload IndexedDB.
- **Sharding** : `ci.yml` scindé en 3 jobs parallèles — `quality`
  (typecheck/lint/unit/guards/build/budget), `smoke` (matrice shard 1..2/2,
  parallèle, `@perf` exclu), `smoke-perf` (desktop, `@perf`, workers=1). Cache
  `~/.cache/ms-playwright`.

## 8. Journal
- 2026-07-12 : analyse initiale. Diagnostic : smoke = 87 % du temps, dérive
  ~+1-3 tests/lot, cause racine = zéro parallélisme intra-fichier + duplication
  mobile.
- 2026-07-12 : périmètre validé (Lots 1+2+3). Implémentation en cours.
- 2026-07-12 : **livré.** `playwright.config.ts` (`fullyParallel`, `workers=4`,
  projet mobile `grep: /@mobile/`), 12 tests tagués `@mobile` + 2 `@perf`,
  `ci.yml` scindé en 3 jobs (`quality` / `smoke` matrice 2 shards / `smoke-perf`
  mono-worker) + cache navigateur, `deploy.yml` aligné (isolation `@perf` +
  cache). **Vérifs** : `--list` → mobile 12, `@perf` 2, total 100 (vs 176
  avant, −43 %), shards 49/49 équilibrés ; run parallèle (4 workers, 2 projets,
  mode CI) 10/10 vert en 43,9 s ; `@perf` isolé 2/2 vert (22 / 12,1 fps) ;
  lint + typecheck verts.
- 2026-07-12 : **1er run CI rouge → corrigé.** `quality` vert (~1m30) mais les 3
  jobs smoke rouges : (1) `pnpm smoke -- <args>` NE transmet PAS les arguments
  ⇒ chaque job lançait la suite entière (non shardée, `@perf` inclus) ; (2)
  `workers=4` sature les 4 vCPU sous SwiftShader ⇒ timeouts 30 s sur les tests
  lourds. Fix : appel direct `pnpm exec playwright test <args>` (ci.yml +
  deploy.yml), `workers: 2` en CI, `timeout: 45 s` en CI. Vérif locale : les 5
  tests lourds tombés en CI passent avec workers=2 (54,9 s). Note : la CI teste
  le merge PR+main (main a avancé : +tests N-ARCS.4/5), d'où le décalage de
  lignes vs local.
