# Plan — Lot N2a : système de quêtes générique (`engine/quest`)

Cœur moteur du lot narratif N2 (doc 13 §5–6). Système **générique** : le moteur
interprète un **catalogue fermé de conditions** et applique des récompenses ; il
ne connaît **ni texte, ni dialogue, ni faction, ni quête nommée** (comme les
capacités de combat). Livré isolément (revue + bump de save + golden), l'UI et
le prologue Haven suivent en **N2b**.

## Portée N2a (moteur seul)

- `engine/quest/types.ts` : `QuestCondition` (superset générique réutilisant
  `VictoryCondition`), `QuestStep`, `QuestReward`, `QuestDef`, `QuestRuntime`,
  `QuestState`.
- `engine/quest/evaluate.ts` : `questConditionMet` (délègue les conditions
  partagées à `conditionMet` de `scenario/outcome` — une seule notion
  d'« objectif », doc 13 §6.2) + `evaluateQuests` (avance les étapes satisfaites,
  applique les récompenses à la complétion) + `applyRewards`.
- `GameState.quests: QuestState | null` (embarqué par `StartGame`, comme
  `scenario`). **Bump `CURRENT_SAVE_VERSION` 6 → 7.**
- Événements `QuestStarted` / `QuestAdvanced` / `QuestCompleted`.
- Câblage : un **seul point d'appel** `evaluateQuests(draft, events)` en fin de
  `apply()` (après le handler) — toute commande qui change l'état fait avancer
  les quêtes. No-op si `draft.quests === null` (partie libre / golden).
- Golden **re-fixé** (raison notée : nouveau champ sérialisé `quests`).
- Tests unitaires moteur (`quest.test.ts`).

## Catalogue de conditions (fermé, générique)

- Réutilisées de `VictoryCondition` : `captureTown`, `defeatHero`,
  `surviveDays`, `eliminateAllEnemies`.
- Nouvelles : `buildStructure{buildingId}`, `ownUnits{unitId,count}`,
  `defeatGuardian{objectId}`, `visitTile{x,y}`. Toutes évaluables purement
  depuis `GameState` (aucun compteur d'action → déterminisme, replay-safe).

## Récompenses

`resources{Partial<Resources>}`, `artifact{artifactId}`, `units{unitId,count}` —
appliquées au joueur propriétaire de la quête (humain par défaut).

## Différé à N2b

Schémas de contenu `data/story/`, `trigger`/chaînage de quêtes, `dialogBefore`,
boîte de dialogue + journal, prologue Haven, smoke narratif. Convergence
complète `scenario`↔`quest` (le scénario reste un système à part ; N2a partage
seulement l'évaluateur de conditions — merge total = risque golden, différé).

## Étapes & vérif

1. Types + evaluate → engine typecheck.
2. State (champ + bump + createEmptyState) + commands (StartGame) + events.
3. Câblage `apply()` + handler `StartGame`.
4. Export index.
5. Golden re-fixé (raison notée).
6. `quest.test.ts` : embed → étape satisfaite → `QuestAdvanced` → complétion →
   `QuestCompleted` + récompense appliquée ; multi-étapes ; no-op sans quêtes.

- [x] typecheck 4/4
- [x] tests moteur 294 (5 quêtes + golden re-fixé `aba92b9f`→`05da0520`, raison notée)
- [x] tests content 73 (inchangés)
- [x] `content:check` (5 paquets, inchangé)
- [x] garde-fou faction (grep CI local : propre)
- [x] build client (JS ~79 Ko gzip, < 800 Ko)
- [x] smoke desktop + mobile (pas d'UI en N2a — non-régression, save v7)

## Décisions / écarts

- **Un seul point d'appel** `evaluateQuests` en fin de `apply()` : couvre toute
  commande sans câblage par-commande ; no-op hors campagne.
- **Convergence `scenario`↔`quest` partielle** (doc 13 §6.2 vise une fusion) :
  N2a partage l'évaluateur de conditions (`conditionMet` réutilisé) mais laisse
  `engine/scenario` intact — un merge total déstabiliserait le golden et les
  tests scénario pour un gain nul en N2a. Convergence différée, notée.
- **Conditions state-based** (`ownUnits`/`visitTile` lues de l'état, pas de
  compteur d'action) → déterministe, replay-safe.
- **Bump save 6→7** : la garde de version (3.8) rejette proprement les v6.
  Golden re-fixé (nouveau champ `quests: null`, simulation inchangée).
- **Différé N2b** : schémas contenu `data/story/`, triggers/chaînage,
  `dialogBefore`, boîte de dialogue + journal, prologue Haven, smoke narratif.
