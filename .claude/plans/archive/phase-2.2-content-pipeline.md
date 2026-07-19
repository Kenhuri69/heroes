# Plan — Phase 2.2 : Pipeline de contenu data-driven

Réf : `docs/10-plan-phase-2-implementation.md` §2.4–§2.5, §3 (Phase 2.2),
§5.3–§5.4 ; doc 06 (modularité). Invariant clé : le moteur ne connaît aucune
faction ; ajouter un paquet = données uniquement (+ `index.json`).

## Étapes — toutes livrées ✅

Vérification finale locale : typecheck OK, lint OK, 28 tests verts
(20 moteur + 8 contenu), `content:check` 2 paquets valides, build OK,
smoke desktop+mobile OK (chargement navigateur des 2 paquets vérifié).

Trouvailles en cours de route :
- Le garde-fou grep a attrapé les IDs `haven-player`/`necro-player` du golden
  test moteur → renommés `player-red`/`player-blue`, hash refigé `bb81d9db`
  (changement de journal voulu, tracé dans le commit).
- IDs de capacités en **camelCase** (doc 02 §5.4 : `noRetaliation`…) ≠ ids de
  contenu en kebab-case → deux regex distinctes dans les schémas.
- `parseFile` : signature `z.ZodTypeAny` + `z.output<S>` pour préserver les
  `.default()` de Zod.

- [x] `packages/content` : schémas Zod (`manifest`, `unit`, catalogue de
      capacités, index) + loader agnostique du support (fonction `readJson`
      injectée : fetch côté client, fs côté CLI) + rapport d'erreurs agrégé
      → vérif : tests Vitest — paquet corrompu (stat invalide, capacité
      inconnue, clé de locale manquante, id dupliqué) ⇒ rapport précis,
      jamais d'exception non contrôlée.
- [x] Règles croisées (doc 06 §5.3) : IDs de capacités présents au catalogue,
      textes `@loc:` complets dans chaque locale (fr, en), `tier ≤ tiers` du
      manifeste, coûts limités aux ressources connues (7 communes + ressources
      de faction), `sharedGrowthGroups` référençant des unités existantes,
      convention fichier = id d'unité.
- [x] `packages/tools` (CLI via tsx) : `faction:new <id>` (génère un squelette
      valide + inscrit dans `index.json`), `faction:validate <id>`,
      `content:check` (tout `data/`) → vérif : `pnpm faction:validate
      test-faction` vert ; `content:check` vert en CI.
- [x] `data/` : `core/abilities.json` (catalogue Phase 2 : flying, shooter,
      noRetaliation, mark, undead, doubleAttack), `factions/index.json`,
      `test-faction/` **générée par le CLI** (dogfooding), squelette
      `arcane-hunters/` (manifest doc 10 §5.4 + t1-eleve + locales)
      → vérif : critère de modularité — le commit d'ajout du paquet ne touche
      que `data/`.
- [x] Client : `publicDir` → `data/` (servi par fetch, même pipeline dev/prod),
      chargement des paquets au démarrage via le loader, résumé exposé pour le
      smoke (`window.__HEROES_CONTENT__`), erreurs de paquet en console.error
      (le smoke échoue si nos paquets cassent)
      → vérif : smoke étendu — les 2 paquets chargés et validés dans le
      navigateur, desktop + mobile.
- [x] CI : étape `pnpm content:check` (ci.yml + deploy.yml) + garde-fou
      « moteur sans faction » : grep interdisant les IDs de faction dans
      `packages/` → vérif : CI verte.
- [x] Docs même lot : doc 10 §5.4 (manifest squelette : champ `units`,
      `sharedGrowthGroups` vidé — cf. écarts), doc 06 §3 (note : unités
      listées dans le manifeste), CLAUDE.md (structure + phase).
- [x] Vérification complète locale puis commit, push, PR draft.

## Écarts / décisions

1. **Le manifeste liste ses unités** (`"units": ["t1-eleve"]`) : un navigateur
   ne peut pas lister un dossier ; la convention `units/<id>.json` est
   vérifiée par le validateur. Doc 06 §3 étant un « extrait », une note y est
   ajoutée ; doc 10 §5.4 mis à jour.
2. **`sharedGrowthGroups` vidé dans le squelette arcane-hunters** : la règle
   croisée « les groupes référencent des unités existantes » rejetterait un
   groupe apex sans t7/t8. Le groupe revient avec le lineup complet (Alpha).
   Doc 10 §5.4 mis à jour en conséquence.
3. **`factionBonuses`/`abilityModules`/`hooks` refusés s'ils sont non vides**
   (`max(0)`) tant que le moteur ne les interprète pas : accepter du contenu
   silencieusement ignoré serait un mensonge de validation. Les schémas
   s'ouvriront quand les points d'extension seront câblés (2.4+).
4. **Schémas `building`/`hero`/`spell`/`map` différés** : aucune donnée ni
   consommateur avant 2.3/2.4 — les livrer maintenant serait spéculatif
   (guidelines §2). Le doc 10 les liste pour la phase ; l'écart est assumé et
   tracé ici.
5. **Registre moteur différé en 2.4** : le moteur ne consomme pas encore
   d'unités (le combat arrive en 2.4). Le `ContentRegistry` vit pour l'instant
   dans `packages/content` (validation + accès par id), l'enregistrement dans
   le moteur suivra avec le combat.
6. CLI en TypeScript exécuté par **tsx** (devDep de tools) — évite de dépendre
   du type-stripping Node encore instable entre versions.
