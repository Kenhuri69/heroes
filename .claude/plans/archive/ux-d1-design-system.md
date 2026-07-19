# Plan — UXD-1 : design system « gouache » (style uniforme)

> Lot 1 du plan maître `.claude/plans/ux-design-overhaul.md` (§3). Fonde les
> lots UXD-2/5/7. Objectif : une seule source de vérité pour couleurs, typo,
> rayons, espacements — zéro littéral de couleur hors tokens — et une identité
> typographique qui parle la langue des fonds peints. **Layout inchangé** :
> même géométrie, habillage unifié.

## Étapes

- [x] Typographie display : **Cinzel** (OFL 1.1, capitales trajanes — la voix
      HoMM), WOFF2 latin **25,9 Ko servi localement** (`ui/fonts/`, licence
      consignée), `font-display: swap`, repli `Georgia, serif`. Corps de texte
      inchangé (`system-ui`). Vérifié : le `.woff2` est émis en fichier
      séparé (`assetsInlineLimit: 0`), donc hors mesure JS/CSS du budget —
      bundle mesuré à **245 Ko gzip** après le lot (plafond 800 Ko).
- [x] `ui/tokens.css` : palette encre/parchemin/laiton/sang dérivée des
      valeurs existantes (pas de re-design sauvage) + tokens sémantiques
      (surfaces, voiles, bordures, états success/danger/lock), rayons,
      espacements, durées, familles de police.
- [x] Refactor des feuilles `ui/*.css` vers `var(--…)` : plus AUCUN littéral
      `#hex`/`rgba(` hors `tokens.css` (les .tsx à littéraux = repli
      procédural de rendu, hors périmètre CSS).
- [x] Application de la voix display : titres d'écrans/sections, boutons de
      menu, gros boutons d'action (Fin de tour), round de combat — via
      `--font-display`.
- [x] **Garde-fou CI** : step `ci.yml` qui échoue si un littéral de couleur
      apparaît dans `ui/*.css` hors `tokens.css` (même esprit que le garde-fou
      faction).
- [x] Vérification : build + budget, re-passe `ux-audit` 30 captures 0 WARN,
      smokes verts, captures avant/après jointes à la PR.

## Décisions

- **Cinzel** (capitales) plutôt qu'une serif à bas-de-casse : rendu
  « chronique/Trajan » des titres HoMM ; le corps de texte reste system-ui
  pour la lisibilité des longues descriptions. Déclaré `400 900` (fonte
  variable) — un seul fichier pour tous les poids.
- Les tokens reprennent les valeurs **existantes** (encre #101218…#3a3d47,
  parchemin #e8e2d0, sang #7a2d22/#a0503f, or #f1c40f…) : UXD-1 unifie, il ne
  re-peint pas — les ajustements de teinte viendront avec les lots visuels
  (UXD-4/5) sur une base saine.
- Couleurs des `.tsx` (replis procéduraux PixiJS/`RESOURCE_COLORS`) : hors
  périmètre — ce sont des couleurs de RENDU data-driven, pas du style UI.

## Écarts constatés

- Cinzel ne dessine pas de vraies minuscules (petites capitales) : assumé
  pour titres/boutons ; jamais utilisé pour du texte courant.
- `image-rendering`/valeurs uniques conservées telles quelles (pas des
  couleurs).
