# Lot R0 — fermeture des écarts de vérification adversariale

> Plan vivant (guidelines §5). Suite de `.claude/plans/r0-plus-jamais-en-silence.md`
> (le lot R0 lui-même). Périmètre : **client + locales + docs uniquement** —
> zéro diff `packages/engine`, pas de bump `CURRENT_SAVE_VERSION`, golden inchangé.

## 0. Écarts relevés par le vérificateur (à fermer)

| # | Écart | Fichier:ligne (branche avant correction) |
|---|---|---|
| 1 | `eventBus.emit` d'un tour IA hors du `try/catch` neuf ⇒ un abonné qui lève rejoue le triple interdit (`aiTurn:null` + `currentPlayer` IA + zéro message) ; `installAiResume` avale le rejet en `console.error` seul | `app/dispatch.ts:257` + `:135-138` |
| 2 | La **porte de sortie** « Recharger la dernière sauvegarde » peut elle-même échouer en silence (`restoreLatestSave()` rend `false` sans message, rejet non capté) | `ui/shell.tsx:521-527` |
| 3 | Aucun test ne monte l'overlay `ai-failure` ni ne clique sa porte de sortie (seul le champ de store est asserté) | `tests/`, `packages/client/src` |
| 4 | Commentaire faux : « le signalement reviendra à la prochaine tentative » — `aiFailure` n'est jamais reposé à `true` sans dispatch réussi | `ui/shell.tsx:495-501` |
| 5 | Préviz partiellement conservée : `guardianHint` est mis à `null` avant le retour anticipé « destination inatteignable » | `scenes/adventure/AdventureScene.ts:586-593` |
| 6 | Effet de bord du rollback (événements déjà émis dans un état client non rollbacké) non tracé | plan + doc 02 §6 |

## 1. Décisions

- **#1** : le `try` de la boucle englobe `apply` **+** `setState` **+**
  `eventBus.emit` (un abonné qui lève = échec du tour IA, même traitement :
  rollback + toast). `installAiResume` traite le rejet par `handleAiTurnFailure`
  (sans repli ⇒ overlay) au lieu d'un `console.error` muet. Le bus lui-même
  **n'isole pas** ses abonnés : le corriger changerait la sémantique de tous les
  chemins d'émission (hors périmètre, guidelines §3) — on isole au point d'appel
  qui a la responsabilité du relais IA.
- **#2** : toast d'erreur i18n (patron `OptionsPanel.doSave`) sur `false` **et**
  sur rejet, plutôt qu'un bouton désactivé : il couvre aussi l'indisponibilité
  d'IndexedDB (navigation privée), qu'un `disabled` calculé une fois ne voit pas.
  Nouvelle clé `aiFailure.reloadError` (FR/EN).
- **#3** : **smoke** (`@core`) — l'overlay est du DOM/routing, non testable en
  unitaire (pas de jsdom ni de testing-library dans le client ; en ajouter pour
  un composant = dépendance nouvelle refusée). La transition `aiFailure → true`
  reste couverte en unitaire (`dispatch.test.ts`) ; le smoke couvre **rendu +
  porte de sortie** via un hook `setAiFailure` sur la surface `__HEROES_TEST__`
  existante. Écart #1 couvert en **unitaire** (abonné qui lève).
- **#4** : correction du **commentaire** (comportement inchangé) : « Fermer »
  laisse l'écran consultable ; la sortie reste le rechargement (ici ou par
  Menu → Continuer). Aucune ré-armature automatique n'est promise.
- **#5** : `guardianHint` n'est plus touché quand `path === null` (le retour
  anticipé passe **avant** le `setState`).
- **#6** : trace documentaire (doc 02 §6 + ce plan). Pas de code : dé-rejouer les
  déclencheurs narratifs exigerait un rollback de l'état client (journal,
  campagne, quêtes) — chantier hors périmètre R0, et le comportement actuel
  reste strictement meilleur que le gel de main.

## 2. Étapes & critères (chiffrés)

- [x] **G0** — plan écrit avant le code.
- [x] **G1** — `dispatch.ts` : `try` élargi à `setState`+`emit` ; `installAiResume`
      → `handleAiTurnFailure`.
      *vérif* : test unitaire — un abonné du bus qui lève pendant un tour IA ⇒
      (a) 1 toast `error`, (b) `game` rollbacké sur le siège **humain**,
      (c) `aiTurn === null`, (d) `dispatch` ne rejette pas.
- [x] **G2** — `shell.tsx` : porte de sortie qui échoue ⇒ 1 toast `error`
      (`aiFailure.reloadError`), overlay laissé en place.
      *vérif* : smoke — sans aucune sauvegarde, clic « Recharger » ⇒ `toast`
      `data-kind="error"` visible **et** `ai-failure` toujours visible.
- [x] **G3** — smoke `@core` de l'overlay : `ai-failure` rendu, clic
      « Recharger » **avec** sauvegarde ⇒ overlay disparu (0 occurrence).
- [x] **G4** — commentaire `AiFailureNotice` conforme au comportement.
- [x] **G5** — `AdventureScene` : tap sur tuile bloquée ⇒ `guardianHint`
      inchangé. *vérif* : couvert par le smoke B5 existant + relecture.
- [x] **G6** — doc 02 §6 : effet de bord du rollback tracé ; locales FR/EN à
      parité.
- [x] **G7** — pipeline 9 étapes vert, invariants du diff contrôlés.

## 3. Journal d'exécution (écarts & décisions)

- **G1** : `handleAiTurnFailure` est déclaré (fonction hoistée) après
  `installAiResume` — pas de réorganisation nécessaire. Le test unitaire ajouté
  (`dispatch.test.ts`, 3ᵉ cas) enregistre un abonné `eventBus.on` qui lève sur le
  1ᵉʳ événement d'un `AiTurn` ; il est **désabonné** en fin de test (le bus est un
  singleton de module partagé par les autres cas).
- **G1 (écart constaté)** : sur le chemin `installAiResume`, l'exception d'un
  abonné est désormais captée **dans la boucle** ⇒ `runAiLoop` ne rejette plus.
  Le `.catch` reste néanmoins branché sur `handleAiTurnFailure` (défense du
  chemin résiduel : `countPendingAiTurns`/`yieldToPaint`), conformément à la
  recommandation du vérificateur.
- **G2** : `restoreLatestSave` rend `false` (aucune sauvegarde / slot vide) OU
  rejette (IndexedDB indisponible) — les deux mènent au même toast. L'overlay
  **reste affiché** : le joueur voit que la sortie a échoué au lieu de croire
  l'action passée.
- **G3** : hook `setAiFailure` ajouté à `__HEROES_TEST__` (surface de test déjà
  existante, cf. `importAiTurnSave`) — il pose l'état de store, il ne simule pas
  l'échec moteur (celui-ci est unitaire). Smoke tagué `@core` : c'est la seule
  porte de sortie d'une partie autrement injouable.
- **G5** : le `path &&` du ternaire `guardianHint` devient inutile une fois le
  retour anticipé déplacé — supprimé (orphelin créé par ce changement,
  guidelines §3).
- **G6 — effet de bord du rollback (trace)** : `handleAiTurnFailure` restaure
  `gameBefore`, mais les événements du `EndTurn` humain et des tours IA **déjà
  réussis** ont été émis dans un état client (journal narratif, campagne, quêtes,
  combat-log, toasts) qui, lui, n'est **pas** rollbacké. Le joueur rejoue son
  tour ⇒ des déclencheurs narratifs/quêtes peuvent se rejouer (doublon de
  journal). Aucune divergence avec la sauvegarde (`autosave` n'écrit que si
  `currentPlayer` est humain). Assumé pour R0 ; noté doc 02 §6.
- **G7 — pipeline** : typecheck ✅ · lint ✅ · tests ✅ (moteur **935**, contenu
  **164**, client **43** dont 1 nouveau) · `content:check` ✅ (7 paquets, 2 cartes,
  16 scénarios) · build ✅ · garde-fou faction `statut=1` ✅ · garde-fou couleurs
  `statut=1` ✅ · bundle **362 798 octets** gzip (< 819 200, 44 %) · smoke `@core`
  **45/45** (44 avant ce lot + le nouveau `ai-failure`), sérialisé sous `flock`.
  *Écart* : une exécution intermédiaire de `pnpm test` a montré 2 échecs de
  **charge** (`combat-property`, `ai-adventure` — timeouts de tests de propriété,
  3 vitest en parallèle sur 4 vCPU partagés) ; rejoués isolément : **12/12 verts**.
  Aucun fichier moteur n'est touché par ce lot (`git diff origin/main --
  packages/engine` = vide) — flake d'environnement, pas de régression.
- **Invariants du diff** : `git diff origin/main -- packages/engine` = **0 ligne**,
  `CURRENT_SAVE_VERSION` inchangé, aucune fixture golden touchée, locales FR/EN à
  parité (+1 clé de chaque côté).
