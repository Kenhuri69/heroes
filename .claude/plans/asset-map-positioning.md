# Positionnement des assets sur la carte d'aventure

## Constat (captures utilisateur)

Sur la carte, les assets peints (écurie/stable, mine/carrière, fontaine,
bassin de gemmes, coffre, château, jeton de héros…) ne sont pas posés au
**centre du losange** de leur case : ils « flottent » au-dessus / en haut-gauche
de la case, le losange de terrain (et le `groundDiamond` repère) apparaît
nettement en dessous.

## Cause racine (hypothèse à vérifier)

Tous les assets de carte sont des PNG **512×512** qui embarquent leur propre
**socle isométrique** (parcelle-losange) : le contact au sol de l'objet est
dans la **moitié basse** de l'image, avec une marge transparente/ombre en
dessous, et la masse de l'objet monte.

Le code ancre le **bord bas** de l'image au centre de la case :
- `mapObjects.ts::placeSprite` → `anchor(0.5, 1)`, `position (TILE/2, TILE/2 + ISO_H/4)`
  (mines, tas, coffres, artefacts, lieux de bonus, camps/habitations) ;
- `townsLayer.ts` (château) et `AdventureScene.buildHeroToken` (héros) →
  `anchor(0.5, 1)`, `position (TILE/2, TILE/2)` ;
- `buildGuardian` (créature) → idem.

Comme le bord bas de l'image est bien plus bas que le contact réel de l'objet,
tout l'asset est remonté au-dessus du losange.

## Étapes

1. [x] **Vérifier empiriquement** — build client + Playwright headless, marqueurs
   `tileToScreen` au centre de chaque case sur proto-01 → décalage confirmé : les
   objets peints flottent d'un demi-losange au-dessus de leur case, les replis
   procéduraux (dessinés en coordonnées de boîte) sont, eux, centrés. Mesure alpha
   (Pillow) : contenu opaque jusqu'à ~0.87 de la hauteur, ~13 % de marge dessous.
2. [x] **Corriger l'ancrage** — helper `isoGroundSeatY(spriteHeight)` dans
   `projection.ts` : pose le bord bas `anchor(0.5,1)` sur le VERTEX AVANT du
   losange (`CONTENT_BOX/2 + ISO_TILE_H/2`) + la marge transparente
   (`CONTENT_BOTTOM_MARGIN = 0.13 × hauteur`). Appliqué à `placeSprite`
   (mines/tas/coffres/artefacts/lieux de bonus/camps) et au château
   (`townsLayer`). Figures debout (héros/gardien) inchangées (lisent correctement,
   asset d'unité distinct). Vérif capture après : stable/mine/fontaine/tente/
   château reposent sur le marqueur central de leur case ; château Haven validé
   via escarmouche.
3. [ ] **Non-régression** : typecheck ✅, lint ✅, tests ✅ (552), build ✅, smoke ⏳.
4. [ ] Commit + push + PR draft.

## Décisions

- **Deux familles d'assets** : (a) structures à socle iso embarqué (`placeSprite`
  + château) → assises par `isoGroundSeatY` ; (b) figures debout (héros/gardien,
  sprites d'unités) → conservent `anchor(0.5,1)` posé au centre du losange (pieds
  au sol), non modifiées — elles lisaient déjà correctement.
- Correctif **client pur** : zéro diff moteur/contenu, pas de bump save, golden
  inchangé (rendu uniquement).
- Le carré blanc du jeton héros `test-faction` (pas d'asset `hero-test-faction`)
  est un repli préexistant, hors périmètre.
