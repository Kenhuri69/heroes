# Plan — Lot M8 : Confort desktop & finitions (C2, C3, C12, C25, C4)

> **Dernier lot** du plan `.claude/plans/ux-revue-mmho.md`. Client seul + doc.
> Aucun raccourci/garde n'est requis (mobile intact) ; tout est réglable.

## Constats

- **C2 (P2)** : un seul raccourci (Échap). Ajouter des hotkeys desktop
  (jamais requis) : `E` fin de tour, `H` tiroir héros, `T` ville, `Espace`
  = Attendre en combat, `D` = Défendre. Documentés dans Options.
- **C3 (P2)** : pas de bascule « réduire les animations » en jeu — seul l'OS
  est respecté. Ajouter une option qui **union** OS ∪ réglage.
- **C12 (P2)** : fin de tour sans garde-fou si un héros a tous ses PM
  (convention HoMM). Confirmation légère (tap-tap), désactivable.
- **C25 (P2)** : tiroir héros mal hiérarchisé (mini-carte en tête avant
  l'identité). Réordonner : identité (portrait/niveau/jauges) en tête,
  mini-carte en dernier. Sections repliables = raffinement différé.
- **C4 (P2)** : doc 08 §2.5 promet une option « daltonisme » qui n'existe pas —
  en pratique les motifs non chromatiques sont **toujours** actifs (§4).
  **Aligner le doc**, pas le code.

## Étapes

1. **`app/motion.ts`** : `reduceMotion()` = option (store `reduceMotionOption`,
   miroir localStorage) **∪** `matchMedia('(prefers-reduced-motion: reduce)')` ;
   `applyReduceMotion(on)` pose `documentElement.dataset.reduceMotion`. La
   scène de combat consomme ce helper (au lieu de son `prefersReducedMotion`
   local OS-only). CSS : dupliquer le bloc « couper le mouvement » sous
   `:root[data-reduce-motion='true']` (l'attribut OU le média).
   → *Vérif* : smoke « activer l'option ⇒ `data-reduce-motion=true` ».
2. **Raccourcis desktop (C2)** : dans le handler `keydown` global de
   `shell.tsx`, ajouter E/H/T (hors combat, ignorés si focus dans un champ
   ou modale ouverte) ; dans `CombatUi`, Espace/D quand c'est au joueur.
   Échap inchangé.
   → *Vérif* : smoke « E termine le tour ».
3. **Garde-fou fin de tour (C12)** : si ≥ 1 héros humain a `movementPoints`
   == max du jour, `EndTurn` ouvre une confirmation légère (overlay tap-tap,
   « Des héros n'ont pas bougé »). Option `confirmEndTurn` (défaut on).
   → *Vérif* : smoke « fin de tour sans avoir bougé ⇒ confirmation ».
4. **Tiroir héros réordonné (C25)** : identité (avatar, niveau, jauges XP/
   mana) juste après `HeroStrip` ; mini-carte déplacée en fin de tiroir.
5. **Options (C3/C2/C12)** : bascule « Réduire les animations », bascule
   « Confirmer la fin de tour », et un bloc « Raccourcis » (liste, desktop).
6. **Doc (C4)** + doc 08 §2.5/§4 alignés ; journaux.

## Vérifications de sortie

- [x] Smoke : 2 nouveaux tests (raccourci E + garde-fou C12 ; option animations
      → data-reduce-motion) desktop+mobile ; suite complète (résultat au journal).
- [x] Typecheck 5/5, lint, garde-fous, contenu 83.

## Journal

- 2026-07-08 : plan ouvert (M7 mergé #151, branche repartie de main), livré.
  `app/motion.ts` (`reduceMotion` = option ∪ OS, `data-reduce-motion` sur
  `<html>`, init localStorage) consommé par CombatScene + CSS attribut ; store
  `reduceMotionOption`/`confirmEndTurn`/`pendingEndTurn`. `app/end-turn.ts`
  (`requestEndTurn` garde-fou C12, `confirm/cancelPendingEndTurn`) réutilisé par
  bouton + hotkey. shell.tsx : hotkeys E/H/T (garde saisie/modale/combat),
  overlay `EndTurnConfirm`, tiroir réordonné (identité en tête, mini-carte en
  fin). combat.tsx : hotkeys Espace/D. Options : bascules « Réduire les
  animations » / « Confirmer la fin de tour » + rappel des raccourcis. 10 clés
  FR/EN. Doc 08 §2.5/§4 (C4 : plus d'option daltonisme, motifs toujours actifs).
  Écarts : helper smoke `endTurn` (garde C12) — 8 clics `end-turn` reroutés ;
  un `sed` trop large avait rendu le helper récursif (corrigé) ; le test hotkey
  clique d'abord la tuile du héros pour donner le focus clavier au document
  (absent au chargement dans le contexte Playwright, présent pour un vrai
  joueur). Sections repliables du tiroir = raffinement différé.
