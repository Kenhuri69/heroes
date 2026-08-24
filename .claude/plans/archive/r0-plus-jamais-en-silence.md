# Lot R0 — Ne plus jamais échouer en silence (B1, B3, B5, B6)

> Plan vivant (guidelines §5). Source : `.claude/plans/game-review-remediation-plan.md`
> §6 « Lot R0 » + constats B1/B3/B5/B6 (§1). Périmètre : **client + données
> (locales) + docs uniquement** — zéro diff `packages/engine`, pas de bump
> `CURRENT_SAVE_VERSION`, golden inchangé.

## 0. Constats couverts (preuves du plan de revue)

| Id | Preuve | Symptôme |
|---|---|---|
| B1 | `app/dispatch.ts:215` + `app/end-turn.ts:14-18` | un `AiTurn` qui lève ⇒ `aiTurn: null` mais `currentPlayer` reste l'IA ⇒ **partie figée sans un message** |
| B3 | `app/end-turn.ts:14-18` | `catch` vide ⇒ « Fin de tour » peut être un no-op muet |
| B5 | `scenes/adventure/AdventureScene.ts:576-579` | tap sur une tuile sans chemin ⇒ préviz effacée, aucun retour ; idem tour IA (`:469`) et animation (`:462`) |
| B6 | `ui/shell.tsx:573`, `:652` | tous les rejets de `ReorderArmy`/`SplitStack` avalés |

## 1. Décisions d'interaction (⇒ doc 08 §3)

1. **Anti-spam** : le système de toasts existant (`ui/toasts.tsx`) empile sans
   dédupliquer (4 s de vie chacun). Les chemins de R0 se déclenchent **en
   rafale** (10 taps sur une montagne). Décision : ajouter `pushToastOnce()`
   (nouveau, ~4 lignes) — n'ajoute rien si un toast **identique (message + kind)
   est encore visible**. `pushToast` reste **inchangé** : dédupliquer tous les
   toasts d'événement risquerait de masquer de l'information légitimement
   répétée (deux ramassages identiques sur un même chemin).
2. **Remettre la main au joueur après un échec de tour IA** : `currentPlayer`
   est un champ moteur ; le corriger côté client fabriquerait un état que le
   moteur n'a jamais produit (et qu'un autosave pourrait figer) — **refusé**
   (guidelines §8). Deux issues, toutes deux client :
   - **rollback** vers l'état d'AVANT le dispatch (`gameBefore` de `dispatch`,
     un état produit par le moteur, où c'est bien au joueur humain de jouer) :
     la main revient au joueur, son tour n'est pas consommé ;
   - si aucun état de repli humain n'est disponible (reprise `installAiResume`
     après chargement d'une sauvegarde « prise en plein relais IA »), overlay
     **explicite** « partie bloquée » avec **action de récupération**
     (« Recharger la dernière sauvegarde ») — l'issue minimale acceptable.
3. **Retours discrets** (tour IA en cours, déplacement en cours) : toast `info`
   dédupliqué — pas d'overlay, pas de SFX (`info` est muet).
4. **Destination inaccessible** : toast `error` dédupliqué ET **préviz
   conservée** (le joueur ne perd pas le chemin déjà posé).
5. **Réorg/split** : seul le rejet `notYourHero` (= hors tour, sans conséquence)
   reste silencieux — testé explicitement ; tout autre rejet est toasté.

## 2. Étapes & critères de vérification (chiffrés)

- [x] **E0** — plan écrit avant le code ; branche `claude/r0-plus-jamais-en-silence`
      sur `origin/main` (d6a031b), `pnpm install` OK.
- [x] **E1** — `pushToastOnce` dans `ui/toasts.tsx`.
      *vérif* : test unitaire client — 3 appels identiques d'affilée ⇒
      `store.toasts.length === 1` ; message différent ⇒ 2 toasts.
- [x] **E2** — `end-turn.ts` : `catch` vide ⇒ `pushToastOnce(commandErrorMessage(err), 'error')`.
      *vérif* : test unitaire — `dispatch` qui rejette ⇒ 1 toast `error` **et**
      le tour n'est pas consommé (`game` inchangé).
- [x] **E3** — `dispatch.ts` : `try/catch` autour du `apply(AiTurn)` **dans** la
      boucle + même traitement pour `MAX_AI_TURNS_PER_DISPATCH` (plus de `throw`
      qui traverse `dispatch`).
      *vérif* : test unitaire — `apply(AiTurn)` qui lève ⇒ (a) ≥ 1 toast `error`,
      (b) `game` rollbacké sur l'état humain (`currentPlayer` = siège humain ⇒
      le joueur peut agir), (c) `aiTurn === null`, (d) `dispatch` ne rejette pas.
      Sans état de repli humain ⇒ `aiFailure === true` (overlay + rechargement).
- [x] **E4** — `AdventureScene.handleTap` : 3 sorties muettes traitées
      (destination inaccessible + préviz **conservée**, tour IA, animation).
      *vérif* : smoke `@core` — tap sur une tuile de montagne ⇒ toast visible,
      `cancel-path` (préviz) **toujours** visible.
- [x] **E5** — `shell.tsx` : `ReorderArmy`/`SplitStack` ⇒ helper partagé
      (silencieux sur `notYourHero` seul).
      *vérif* : test unitaire — `notYourHero` ⇒ 0 toast ; `invalidReorder` /
      erreur opaque ⇒ 1 toast `error`.
- [x] **E6** — locales FR/EN (parité exacte) + docs 08 §3 (feedback d'échec) et
      02 §6 (fin de tour : un relais IA en échec rend la main).
- [x] **E7** — captures avant/après (skill `ux-audit`) hors dépôt + mesure DOM
      chiffrée du nouveau retour (nb de toasts après 3 taps sur une montagne).
- [x] **E8** — pipeline 9 étapes vert, invariants du diff contrôlés.

## 3. Journal d'exécution (écarts & décisions)

- **E1** : `pushToastOnce` exporté de `ui/toasts.tsx` (à côté de `pushToast`).
  Les deux helpers de report (`reportCommandError` / `reportArmyCommandError`)
  vivent dans un **nouveau** module minuscule `app/command-error.ts` plutôt que
  dans `shell.tsx` : c'est ce qui les rend testables en **unitaire** sans monter
  tout le shell (Pixi/assets) — 2 fonctions, 3 appelants.
- **E2/E3** : le `console.error` est conservé **en plus** du toast (diagnostic
  développeur) ; le toast est le canal joueur.
- **E3** : `runAiLoop(fallback?)` reçoit `gameBefore` depuis `dispatch`. La
  reprise `installAiResume` (chargement de partie) l'appelle **sans** repli ⇒
  branche « état bloqué signalé ». `apply` n'est **pas** relancé après rollback :
  l'échec est signalé, le joueur décide (rejouer son tour ou recharger) — aucune
  boucle automatique.
- **E3** : nouveau champ de store `aiFailure: boolean` (défaut `false`), remis à
  `false` au rollback, au rechargement d'une sauvegarde (`restoreSavedGame`) et
  au retour menu (`navigate`), + overlay `AiFailureNotice` (2 actions,
  `.end-turn-confirm-actions` déjà ≥ 44 px, aucune couleur en dur).
- **E4** : les 2 sorties **volontairement muettes** (tap hors carte, tap sur la
  tuile de son propre héros) sont documentées dans le code — le plan de revue les
  exclut explicitement (annulation de préviz, pas refus d'action). `handleTap`
  sortait aussi en silence quand `hero`/`map`/`config` manquent : laissé tel quel
  (état d'amorçage, pas une action refusée).
- **Écart outillage (E7/E8)** : le port **4173 est occupé** par le `vite preview`
  d'un **autre agent** (lancé hors `flock`) ⇒ `reuseExistingServer` aurait testé
  SON build. Contournement : preview privé (4273 pour les captures, 4373 pour le
  smoke via une copie temporaire de `playwright.config.ts`, **supprimée avant le
  commit**), le tout sous `flock` pour sérialiser la charge CPU. Aucun fichier de
  config temporaire n'entre dans le diff.
- **E7 — mesure DOM chiffrée** (build de prod, desktop 1280×720, `?seed=42`,
  préviz posée sur (6,3) puis **3 taps** sur la montagne (14,4) après dézoom
  molette) :

  | Mesure | avant (origin/main) | après |
  |---|---|---|
  | toasts affichés après 3 taps | **0** (constat B5 reproduit) | **1** (« Destination inaccessible ») |
  | préviz `cancel-path` après les taps | **effacée** | **conservée** |
  | héros déplacé à tort | non | non |

  Captures : `captures/r0-avant/` et `captures/r0-apres/` du scratchpad — 97
  fichiers chacun (96 écrans `ux-audit` × viewport × cran + `blocked-tap.png`).
  `ux-audit` : **0 cible < 44 px, 0 étape en échec** avant ET après ;
  `adventure-real-mobile-font1.png` **strictement identique** (aucune régression
  visuelle sur les écrans standards, le lot n'ajoute que du feedback d'échec).
- **E8 — pipeline** : typecheck ✅ · lint ✅ · tests ✅ (moteur **935**, contenu
  **164**, client **42** dont **9 nouveaux**) · `content:check` ✅ (7 paquets,
  2 cartes, 16 scénarios) · build ✅ · garde-fou faction `statut=1` ✅ · garde-fou
  couleurs `statut=1` ✅ · bundle **362 768 octets gzip** (< 819 200, 44 %) ·
  smoke `@core` **44/44** (dont le nouveau test R0/B5).
  *Écarts* : (a) deux exécutions intermédiaires de `pnpm test` ont montré 1 à 2
  échecs **de charge** (3 vitest en parallèle sur 4 vCPU partagés avec d'autres
  agents) — disparus à froid, run final `exit=0` ; (b) `pnpm typecheck` passait
  alors que `pnpm build` (même `tsc`) échouait sur le typage d'un `vi.fn` du
  nouveau test : corrigé (`vi.fn<(cmd: unknown) => Promise<never>>`), les deux
  sont verts.
- **Invariants du diff** : `git diff origin/main -- packages/engine` = **0 ligne**,
  `CURRENT_SAVE_VERSION` inchangé (35), **aucune** fixture golden touchée, locales
  **1196 clés FR = 1196 EN** (0 manquante de part et d'autre).

## 4. Vérification adversariale — écarts relevés & résolution

Une relecture adversariale du lot a trouvé **6 écarts** ; tous fermés dans
`.claude/plans/r0-verification-gaps.md` (même branche). Résumé :

| # | Écart | Résolution |
|---|---|---|
| 1 | **Critère 2 non tenu** : le `try/catch` n'entourait que `apply` ; `eventBus.emit` (9 abonnés, aucun isolé) restait dehors ⇒ un abonné qui lève rejouait le triple interdit (`aiTurn:null` + `currentPlayer` IA + zéro message). `installAiResume` avalait le rejet en `console.error`. | `try` élargi à `setState` + `emit` ; `installAiResume` → `handleAiTurnFailure`. Test unitaire dédié (abonné qui lève). |
| 2 | **Défaut introduit** : la porte de sortie (« Recharger la dernière sauvegarde ») échouait elle-même en silence (`false` sans message, rejet non capté). | Toast d'erreur i18n (`aiFailure.reloadError`) sur `false` **et** sur rejet ; l'overlay reste affiché. |
| 3 | **Couverture absente** : `ai-failure*` n'apparaissait dans aucun test (seul le champ de store était asserté). | Smoke `@core` : overlay rendu, sortie en échec dite, sortie réussie ⇒ overlay levé (hook `setAiFailure`). |
| 4 | **Commentaire ≠ comportement** : « le signalement reviendra à la prochaine tentative » est faux. | Commentaire corrigé (+ doc 08 §3) ; comportement inchangé. |
| 5 | **Régression mineure** : `guardianHint` effacé juste avant le retour « destination inatteignable » ⇒ conservation *partielle* de la préviz. | Retour anticipé placé **avant** la mise à jour ; assertion ajoutée au smoke B5. |
| 6 | **Effet de bord non tracé** : le rollback ne rejoue pas l'état client (journal/quêtes/campagne) déjà alimenté par les événements émis. | Tracé (doc 02 §6 + plan) ; assumé pour R0. |
