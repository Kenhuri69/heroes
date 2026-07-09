# Plan — Lot 4.20 : câblage de la croissance partagée apex (`sharedGrowthGroups`)

> Clôture du **Lot B** de `phase-4-reverify.md` (dernier vrai trou non différé de
> l'Alpha Arcane Hunters). Choix utilisateur : **câbler la feature complète**
> (plutôt que corriger la doc). Un **point d'extension moteur générique** de plus,
> garde-fou « zéro faction dans le moteur » maintenu.

## Objectif

Les Arcane Hunters ont **8 tiers** mais T7 (Manticore) et T8 (Pénitent) forment un
**double sommet** : ils **partagent une seule croissance hebdomadaire** ; le joueur
**choisit** chaque semaine lequel des deux voit son stock grossir (doc 05 §3.1/§8).
Le schéma `sharedGrowthGroups` existait (validé par le loader) mais **n'était ni
déclaré** (manifeste `{}`) **ni câblé** dans le moteur — T7/T8 croissaient
indépendamment.

## Modèle générique (aucun nom de faction dans le moteur)

- **Donnée** : `manifest.sharedGrowthGroups = { apex: [t7id, t8id] }` (déjà
  supporté par le schéma, membres ≥ 2, références validées).
- **Catalogue** : `buildGrowthGroupCatalog(report)` fusionne les groupes de tous
  les paquets → `Record<groupId, string[]>`, **erreur sur id de groupe en double**
  (même garde que `buildHouseCatalog`). Embarqué par `StartGame`.
- **État** : `GameState.growthGroups: Record<string, string[]>` (catalogue) +
  `TownState.sharedGrowthChoice: Record<string, string>` (préférence permanente du
  joueur, groupId → unitId destinataire ; `{}` par défaut).
- **Croissance** (`applyWeeklyGrowth`, au `WeekStarted`) : index inverse
  unitId→groupId ; pour chaque ville, par groupe présent (membres bâtis en
  dwelling), **seul le destinataire grossit** (choix du joueur s'il est bâti,
  sinon le 1er membre présent). Les autres membres du groupe sont sautés.
  Les unités hors groupe : inchangé.
- **Commande** `ChooseSharedGrowth { townId, groupId, unitId }` : ville du joueur
  actif, groupe connu, `unitId` ∈ groupe **et** dwelling bâti dans la ville. Pose
  `town.sharedGrowthChoice[groupId] = unitId` (effet à la prochaine semaine).
  Événement `SharedGrowthChosen` pour le feedback UI.
- **Save** : `CURRENT_SAVE_VERSION` 13 → **14** (2 nouveaux champs de forme) ;
  golden re-fixé (forme seule, aucune ville dans le journal golden ⇒ simulation
  inchangée).

## Étapes & vérification

1. **Moteur — état & save** : `GameState.growthGroups`, `TownState.sharedGrowthChoice`,
   `createEmptyState`, bump save v14 + commentaire. → typecheck engine.
2. **Moteur — StartGame** : embarquer `cmd.growthGroups`, copier `sharedGrowthChoice`
   des villes. Commande + champ optionnel. → typecheck.
3. **Moteur — croissance** : `applyWeeklyGrowth` respecte le groupe (index inverse,
   destinataire). → test unitaire.
4. **Moteur — commande `ChooseSharedGrowth`** : validate + handler (`town/shared-growth.ts`),
   câblage `engine.ts` (validate switch, handlers, GAME_OVER_BLOCKED), code d'erreur
   `unknownGrowthGroup`, événement. → test unitaire (choix change le destinataire).
5. **Contenu** : `buildGrowthGroupCatalog` (loader) + export ; manifeste AH
   `{ apex: [t7-manticore, t8-penitent] }`. → content typecheck + test + `content:check`.
6. **Client** : `buildGrowthGroupSetup(report)` + `growthGroups` dans les 4 sites
   `StartGame` ; sélecteur apex dans `RecruitTab` (groupes présents ≥ 2 dwellings)
   dispatchant `ChooseSharedGrowth` ; locales FR/EN. → typecheck client + build.
7. **Golden** : relever le nouveau hash, mettre à jour + commenter. → tests engine.
8. **Docs** : doc 05 §5/§8 (câblé, plus différé), doc 02 §4.1 (croissance partagée
   générique), doc 06 (checklist), CLAUDE.md. → relecture.
9. **Vérif finale** : typecheck 4/4, lint, tests engine+content, content:check,
   garde-fou faction (grep), build < 800 Ko, smoke desktop+mobile.

## Vérification par lot

- [x] typecheck 5/5
- [x] tests moteur (golden re-fixé `0968d47e` + town-shared-growth ×9) — 401 passants
- [x] tests content (+ buildGrowthGroupCatalog / manifeste AH ×2) — 96 passants
- [x] `content:check` (6 paquets, parité fr/en)
- [x] garde-fou faction (grep : aucun nom de faction dans `packages/`) + garde-fou CSS
- [x] build client (276 Ko gzip < 800 Ko)
- [x] smoke desktop + mobile — 132 passants

## Décisions / écarts

- **Préférence permanente** (pas de choix bloquant à chaque semaine) : plus simple,
  touch-first, et fidèle (le joueur règle « qui grossit » ; défaut = 1er membre).
  Le recrutement reste inchangé (les deux unités restent recrutables selon leur
  stock respectif).
- **Erreur sur id de groupe en double** entre paquets (comme les Maisons) : les
  labels de groupe doivent être uniques tous paquets confondus.
