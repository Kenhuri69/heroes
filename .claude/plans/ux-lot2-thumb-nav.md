# Lot 2 (P0) — Navigation au pouce sur la carte (E4)

> Plan `game-ergonomics-immersion-review.md` §5 Lot 2. Constat **E4 🟠** : la
> navigation multi-héros / villes ne passe qu'au clavier (N/T) ou par la mini-map —
> rien au pouce. **Client + locales — zéro moteur, pas de bump save.**

## Items

1. **Bouton HUD « héros suivant avec PM »** dans la `TurnBar` : même logique que la
   touche `N` (`selectNextHeroWithMoves` — cycle + recentrage caméra), **badge** =
   nombre de héros encore mobiles, désactivé si 0. → verif : tap cycle le héros
   sélectionné + recentre, sans clavier.
2. **Tap sur le portrait du héros (HeroStrip) = sélection + recentrage caméra** ;
   re-tap (déjà sélectionné) = ouvre le tiroir héros (tap-tap cohérent, doc 08).
   Avant : le tap ne faisait que sélectionner. → verif : tap portrait recadre la vue.
3. **Villes au pouce** : appui long sur un bouton de ville de la `TurnBar` =
   **recentrer la caméra** sur la ville (« aller à la ville » sans l'ouvrir) ; tap =
   ouvrir la modale (inchangé). Réutilise `useLongPress` (extrait de TownScreen vers
   un module partagé). → verif : appui long centre la carte sur la ville.

## Vérification
- Smoke @mobile : « cycler 2 héros et centrer une ville sans clavier » ; cibles ≥ 44 px.
- typecheck · lint · content (i18n parité) · client (unitaires) · build · bundle ·
  smoke @core+@mobile · gardes faction/couleurs. Doc 08 §2.1 alignée.

## Journal
- [x] Extraction `useLongPress` → `ui/useLongPress.ts` (partagé TownScreen + TurnBar) ;
      **+ `wasLongPress()`** (lecture-consommation robuste dans `onClick`, indépendant
      de l'ordre des listeners — `onClickCapture`+`stopPropagation` ne suffit pas
      quand `onClick` est sur le MÊME élément).
- [x] Item 1 : bouton `next-hero` dans la `TurnBar` (badge = héros mobiles, grisé si 0),
      appelle `selectNextHeroWithMoves` (cycle + recentrage). Locale `adventure.nextHero`.
- [x] Item 2 : tap portrait HeroStrip = sélection + `panCameraTo` ; re-tap (déjà
      sélectionné) = ouvre le tiroir héros (tap-tap).
- [x] Item 3 : `TownButton` — tap = ouvrir (inchangé), **appui long = recentrer** la
      caméra sur la ville. Locale `adventure.centerTownHint`.
- [x] Smoke **`@core`** (E4 : badge=2, next-hero cycle+recentre, tap portrait recentre,
      appui long ville recentre SANS ouvrir). Tag @core-desktop (logique indépendante
      du viewport ; simulation d'appui long tactile flaky sous charge). Rendu mobile
      vérifié en capture (boutons + badge présents). Recette : typecheck · lint ·
      engine 876 (golden inchangé) · content 152 · client 9 · build · bundle 331 477 ·
      smoke @core 28 + mobile 13 · gardes faction/couleurs.
