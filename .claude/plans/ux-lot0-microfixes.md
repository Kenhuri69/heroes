# Lot 0 (P0) — Micro-correctifs ergonomie sans risque

> Reprise du plan `game-ergonomics-immersion-review.md` §5, Lot 0 (recommandé en
> premier : plus gros ratio confort/risque, ½ journée). **Client + locales
> uniquement — zéro diff moteur, pas de bump `CURRENT_SAVE_VERSION`.** Chaque item
> cite son constat. Vérif : typecheck · lint · content (locales) · engine (golden)
> · build · bundle · smoke @core + capture. Doc 08 alignée si besoin.

## Items

1. **E2 — `Se rendre (0 or)` absurde** (`combat.tsx:296`). Quand `surrenderGold===0`,
   afficher le libellé sans montant (`combat.surrenderFree`). → verif : le bouton
   n'affiche « (0 or) » à aucun cran ; libellé payant inchangé.
2. **M-1 — « Continuer » désactivé ambigu** (`MenuScreen.tsx:71-76`). Sous-libellé
   i18n « Aucune sauvegarde » sous le bouton quand `!canContinue`. → verif : capture
   menu sans save ; le bouton actif n'affiche pas le sous-libellé.
3. **V-3/V-4 — polish plan de ville** (`TownScreen`/CSS). V-3 : séparateur orphelin
   qui reste seul en fin de ligne au cran 3 mobile ⇒ `nowrap` par segment / masquer
   le séparateur en repli. V-4 : pastille « disponible » = anneau **pointillé** ≈
   spinner ⇒ forme distincte (ex. losange/anneau plein + libellé, 2ᵉ canal). →
   verif : captures ville cran 3 mobile + statut « disponible ».
4. **E15 — raccourcis découvrables** (`OptionsPanel.tsx:202`). Bouton « Voir les
   raccourcis » sous l'astuce, ouvre `ShortcutsOverlay` en local (indépendant de la
   pile de modales ⇒ marche depuis le menu ET en jeu). → verif : accessible sans
   clavier ; overlay s'ouvre/ferme ; capture Options desktop.

## Journal
- [x] Item 1 (surrender) — `combat.surrenderFree` quand coût 0 (`combat.tsx`).
- [x] Item 2 (continue) — sous-libellé `menu.continueEmpty` groupé sous le bouton
      grisé (`MenuScreen` + `.menu-continue-slot/-hint`). Vérifié en capture
      (« No saved game » sous « Continue » désactivé).
- [x] Item 3 (V-3/V-4) — pip « disponible » trait **plein** (plus pointillé/spinner) ;
      sous-titre ville en flex-wrap sans séparateurs `·` sous 480 px (V-3).
- [x] Item 4 (shortcuts button) — bouton « Voir les raccourcis » dans Options
      (`ShortcutsOverlay` rendu en local, marche menu+jeu). Vérifié en capture.
      **Bonus** : le panneau des raccourcis n'avait AUCUN fond (transparent, lisible
      seulement sur décor sombre) ⇒ `ShortcutsOverlay.css` lui donne le fond opaque
      des autres modales — améliore aussi la vue en jeu (`?`).
- [x] Recette verte : typecheck · lint · content 148 (i18n parité) · engine
      (golden inchangé, non touché) · build · bundle 327 957 ≤ 819 200 · smoke
      @core 26 · gardes faction/couleurs. Captures menu/options/shortcuts.
      Items 1 & 3 (écrans en jeu) couverts par typecheck + smoke.
