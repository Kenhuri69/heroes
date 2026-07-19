# Correctif — orientation des hexes du champ de bataille

## Symptôme (retour de jeu, captures fournies)
Le « damier » du champ de bataille ne correspond pas au jeu d'origine (HoMM) :
notre grille de combat s'affiche comme un treillis entrecroisé en losanges
(argyle / X qui se croisent) au lieu d'un nid d'abeille hexagonal propre.

## Cause racine
`packages/client/src/render/hexgrid.ts` :
- Le **layout** (`hexToPixel` / `pixelToHex`) est en maths **pointy-top**
  (formule axiale standard, odd-r ; le picking au tap le confirme — il est
  correct).
- Mais `drawBoard` dessine chaque hex avec
  `g.regularPoly(x, y, r, 6, Math.PI / 6)`.

Dans PixiJS 8, `ShapePath.regularPoly` applique un décalage intégré de −π/2 :
`startAngle = -Math.PI/2 + rotation`. Conséquence :
- `rotation = 0`      → hexagone **pointy-top** (pointes haut/bas)
- `rotation = Math.PI/6` → hexagone **flat-top** (pointes gauche/droite)

Le code dessinait donc des hexes **flat-top** sur un lattice **pointy-top** :
décalage de 30° ⇒ les hexes ne pavent pas ⇒ leurs arêtes se croisent ⇒ motif
en losanges au lieu d'hexagones. HoMM, lui, montre des hexes pointy-top propres.

## Correctif (client uniquement, chirurgical)
- `hexgrid.ts:181` : rotation `Math.PI / 6` → `0` (hexes pointy-top, alignés sur
  le layout et sur HoMM).
- Commentaire ajouté pour documenter la convention PixiJS (−π/2) et éviter la
  régression.

Zéro diff moteur, pas de bump `CURRENT_SAVE_VERSION`, golden inchangé (rendu pur).

## Vérification — FAIT ✅
1. `pnpm -w typecheck` → OK
2. `pnpm -w lint` → OK
3. Tests moteur (`@heroes/engine`) → 819 verts (golden inchangé, rien côté moteur)
4. `pnpm -w build` → OK (budget bundle respecté)
5. Smoke Playwright combat/arène (15 tests, dont ciblage au tap + sorts) → verts
6. Capture `/#arena` (seed 42) : la grille est désormais un nid d'abeille
   pointy-top **propre** (plus d'argyle), conforme à HoMM. → confirmé visuellement
