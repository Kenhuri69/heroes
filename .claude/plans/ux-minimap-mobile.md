# Plan — mini-map mobile (tiroir héros)

> Suivi noté du lot UXD-8 (`.claude/plans/ux-d8-desktop-minimap.md` §Hors
> périmètre) et du plan maître §6 : la mini-map était **desktop only**. Sur
> mobile, les joueurs n'ont aucune vue d'ensemble de la carte. On la monte dans
> le **tiroir héros** (doc 08 §2.1), le foyer mobile des panneaux.

## Choix

- **Réutiliser** le composant `MiniMap` (rendu, exploré, pastilles, clic =
  recentrage) via une prop `variant` : `'fixed'` (widget desktop existant,
  inchangé) ou `'drawer'` (mobile, dans le tiroir).
- **Classe distincte** `mini-map-drawer` (pas `mini-map`) pour que les règles
  `position: fixed` / `@media min-width:900px` du widget desktop **ne fuient
  pas** sur la version tiroir.
- **Exclusivité par viewport** : `.mini-map` (desktop) visible ≥ 900px ;
  `.mini-map-drawer` visible < 900px, masquée ≥ 900px (le widget fixe suffit) —
  jamais les deux en même temps.

## Étapes

- [x] `MiniMap.tsx` : prop `variant?: 'fixed' | 'drawer'` (défaut `fixed`) →
      classe + `data-testid` (`mini-map` / `mini-map-drawer`). Logique de rendu
      et clic inchangée.
- [x] `shell.tsx` : monter `<MiniMap variant="drawer" />` dans le tiroir héros,
      sous un intitulé i18n.
- [x] `styles.css` : `.mini-map-drawer` (statique, largeur 100 %, ratio
      intrinsèque, `pixelated`, cadre laiton) ; masquée ≥ 900px.
- [x] i18n : clé `hero.minimapTitle` (FR/EN).
- [x] Vérif (2026-07-07) : capture **mobile** (390×780) tiroir ouvert →
      `mini-map-drawer` visible **284×284**, zone explorée + pastilles héros/
      villes, widget fixe **masqué** (pas de doublon) ; clic recentre la caméra
      (0 erreur console). **Desktop** (1280) : widget fixe visible, mini-map
      tiroir masquée ⇒ exclusivité par viewport OK. Typecheck/lint/build verts,
      garde-fou couleurs vert, budget 253 Ko gzip.

## Hors périmètre / suivi

- Refonte du layout desktop en colonne droite : clôturée (le tiroir persistant
  EST le rail droit — voir `ux-d8-desktop-minimap.md`).
- `MiniMap` aria-label encore en dur FR (`Mini-carte (N héros)`, hérité d'UXD-8)
  — hole i18n **pré-existant** : ✅ **corrigé** (`.claude/plans/i18n-minimap-aria.md`,
  clé `hero.minimapAria` FR/EN + réactivité locale).
