# Plan — Lot M1 : Combat, lisibilité d'état (C13, C14, C18)

> Premier lot du plan de revue UX `.claude/plans/ux-revue-mmho.md` (ordre
> conseillé M1→M2→M4→M5). Couvre aussi le Lot 2 « file d'ordre de tour » du
> plan parallèle `homm-online-divergence-remediation.md` (D2), qui attendait un
> feu vert — donné par « lance le travail ».

## Constats traités

- **C13 (P0)** : le bandeau de combat liste les camps triés par slot, pas
  l'ordre de passage (`combat.tsx:34-35`). Doc 08 §2.4 promet « ordre du round ».
- **C14 (P0)** : aucune stat d'unité consultable en combat (chips et jetons
  muets) — viole « lisibilité d'état » (doc 08 §1.4) et A2.
- **C18 (P2)** : noms de chips tronqués (« Élève de Sombr… ») ; consigne de
  prévisualisation volumineuse qui recouvre le plateau en mobile.

## Étapes

1. **Moteur — helper pur d'ordre de passage** : extraire `initiativeSpeed`
   (vitesse effective + Σ `speedMod`, non bornée — actuel `speedWithStatus`
   privé de `turns.ts`) vers `state-helpers.ts`, et ajouter
   `roundActionOrder(combat, catalog)` → `{ current, next }` : piles restantes
   du round (vague normale vitesse décroissante puis attente vitesse
   croissante, mêmes départages que `pickNext`) + projection du round suivant.
   La projection ignore les aléas résolus au moment du tour (saut de moral
   négatif, immobilisation). `turns.ts` consomme le helper (source unique).
   → *Vérif* : test `combat-order.test.ts` (ordre, phase d'attente, départage
   camp/slot, actif en tête, exclusion des piles mortes/acted) ; golden replay
   inchangé.
2. **Client — bandeau d'ordre de passage** : remplacer les deux rangées par
   camp par **une file** de chips dans l'ordre d'action (actif en tête, round
   suivant estompé après un séparateur), défilement horizontal en mobile.
   Camp indiqué par liseré coloré **+ glyphe** (2ᵉ canal, A5). Chips devenues
   interactives ⇒ cibles ≥ 44 px (A1).
3. **Client — fiche de pile** : tap sur une chip ⇒ panneau `StackSheet`
   (effectif, PV de la tête de pile, attaque/défense, dégâts min–max, vitesse,
   munitions, statuts de sorts avec durée, posture défense/attente,
   immobilisation, marques). Fermeture ×/backdrop/Échap. i18n FR/EN.
   Écart assumé : le tap sur le **jeton canvas** est différé au geste
   d'appui long générique du lot M2 (un seul point d'entrée : les chips).
4. **Client — lisibilité** : nom de chip sur 2 lignes max (plus d'ellipse à
   9em), consigne de prévisualisation compacte en mobile.
5. **Tests & docs** : smoke « la file d'ordre s'affiche (actif en tête) et la
   fiche de pile s'ouvre/se ferme » ; docs/08 §2.4 mis à jour (état M1) ;
   journal des deux plans.

## Vérifications de sortie

- [x] Tests moteur verts (352, dont `combat-order.test.ts` ×5 + golden).
- [x] Smoke Playwright : 105 passés dont le nouveau test (desktop + mobile).
      Écart : « fin de tour : jour suivant » a échoué UNE fois sous charge
      (suite complète, 2 workers) puis passe isolé — flaky préexistant, hors
      du périmètre du diff (aventure, pas combat).
- [x] Typecheck 5/5 + lint + garde-fous faction/couleurs + contenu (83).
- [x] Captures après (arène desktop + mobile, fiche ouverte) : bandeau mobile
      sur UNE rangée défilante (~1/3 de la hauteur d'avant), consigne compacte
      qui ne recouvre plus le plateau, marqueurs de camp visibles.

## Journal

- 2026-07-08 : plan ouvert ; branche repartie de `origin/main` (PR #125 mergée).
- 2026-07-08 : étapes 1–4 implémentées. Moteur : `initiativeSpeed` extrait
  (source unique avec `pickNext`), `roundActionOrder` + test dédié, exports.
  Client : file d'ordre (chips-boutons ≥ 44 px, marqueur de camp losange/anneau,
  round suivant estompé), `StackSheet` (stats + statuts + postures, Échap/
  backdrop/×), consigne mobile compacte, tokens `--side-*`. Locales FR/EN
  (15 clés). Doc 08 §2.4 mise à jour (état M1).
