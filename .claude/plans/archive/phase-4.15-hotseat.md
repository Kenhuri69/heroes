# Plan — Alpha 4.15 : hot-seat (multi-humain local)

> Deuxième tiers de l'item roadmap doc 09 ligne 47 (après l'escarmouche 4.14).
> Deux joueurs **humains** sur le même appareil, tour par tour. Sorts d'aventure
> = lot suivant (4.16).

## Constat de cadrage (exploration)
- Le moteur est déjà **N joueurs** (`players`, `currentPlayer`, `controller`).
- `runAiLoop` (client) s'arrête **déjà** dès que `currentPlayer` est humain →
  après le `EndTurn` du joueur 1, la main passe au joueur 2 humain sans rien
  changer à la boucle.
- **Point de re-keying unique** : tous les helpers HUD (héros, villes, brouillard,
  sélection, toasts) passent par `humanId(game)`. Le rendre **actif** (=
  `players[currentPlayer]` si humain) fait suivre tout le plateau au joueur dont
  c'est le tour — **aucune modification moteur**, comportement solo inchangé.
- `evaluateOutcome` calcule **déjà** le bon `winnerPlayerId` dans les deux sens
  (le survivant). Seul le libellé « Victoire/Défaite » de l'overlay est
  centré-sur-soi ; en hot-seat on affichera le **vainqueur nommé**.

## Conception (client only, zéro moteur)
- `humanId(game)` : renvoie le joueur **actif** s'il est humain, sinon le premier
  humain (repli). Re-keye HUD + brouillard + sélection + toasts au tour courant.
- Escarmouche : `SkirmishConfig.opponent: 'ai' | 'human'`. En `human`, le joueur 2
  est `controller: 'human'` (hot-seat) et **sans** mise à l'échelle de difficulté
  (parité). L'écran ajoute un choix « Adversaire : IA / Joueur 2 » ; la difficulté
  ne s'affiche qu'en mode IA.
- `HandoffOverlay` (« passez l'appareil ») : overlay forcé (hors pile de modales,
  comme `OutcomeOverlay`) affiché quand ≥ 2 humains, hors combat/fin de partie, et
  que le joueur actif n'a pas encore accusé réception de son tour (`turnAck` dans
  le store, remis à `null` à chaque `navigate`). « Continuer » pose `turnAck`.
- `OutcomeOverlay` : à ≥ 2 humains, titre = **vainqueur** (« Victoire du Joueur
  N ») au lieu de Victoire/Défaite.

## Lots
- [x] `app/game.ts` : `humanId` → joueur actif ; `SkirmishConfig.opponent` +
  `skirmishStartCommand` (contrôleur J2 + pas de scaling en hot-seat).
- [x] `app/store.ts` + `app/router.ts` : `turnAck` (reset dans `navigate`).
- [x] `ui/HandoffOverlay.tsx` + `ui/shell.tsx` : overlay de passage d'appareil.
- [x] `ui/SkirmishScreen.tsx` : toggle adversaire, difficulté conditionnelle.
- [x] `ui/OutcomeOverlay.tsx` : vainqueur nommé en multi-humain.
- [x] Locales FR/EN : `skirmish.opponent*`/`player2Faction`, `handoff.*`,
  `outcome.winner`.
- [x] Smoke : escarmouche hot-seat → 2 humains ; overlay de passage au J1, puis
  fin de tour ⇒ overlay J2 ⇒ le plateau suit le J2 (`town-player-2`, plus
  `town-player-1`). Desktop + mobile.
- [x] Docs 08 §2.5/§3 + roadmap 09. Plan à jour.

## Écarts / décisions constatés
- **Zéro code moteur** confirmé : `runAiLoop` s'arrêtait déjà sur chaque humain ;
  le seul point de re-keying était `humanId`. Golden intact.
- `evaluateOutcome` calcule déjà le bon `winnerPlayerId` dans les deux sens ⇒
  l'overlay nomme le vainqueur sans toucher au moteur.
- **Handoff** = overlay forcé (comme `OutcomeOverlay`/`SkillChoice`), hors pile de
  modales ; `turnAck` remis à `null` par `navigate` (nouvelle partie / retour menu).
- Difficulté ignorée en hot-seat (parité stricte J1/J2, mult. = 1).

## Invariants
Moteur pur **inchangé** (golden stable), RNG seedé, zéro nom de faction dans
`packages/`, budget < 800 Ko, anti-gel ×4, garde-fou faction local, smoke
desktop + mobile.

## Journal
- **2026-07-06** — Création après merge #71 (escarmouche 4.14). Base = `origin/
  main` (b03735c). Cadrage : hot-seat = re-keying `humanId` sur le joueur actif +
  toggle d'adversaire dans l'escarmouche + overlay de passage ; aucun code moteur.
- **2026-07-06** — Implémentation complète. Tout vert : typecheck 4/4, lint,
  `content:check`, build (~233 Ko gzip < 800), smoke desktop + mobile (nouveau cas
  hot-seat) + suite complète 68 verts, garde-fou faction propre. Aucun code
  moteur/contenu touché (golden intact).
