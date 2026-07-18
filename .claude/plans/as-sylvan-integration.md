# AS-SYLVAN — intégration des planches Sylvan Court (Lot 6 item 6)

> L'utilisateur a généré les 5 planches Sylvan depuis les prompts de `assets/prompts/`
> (units p1/p2, buildings p1/p2, avatars) et les a fournies. On les découpe via
> `sheet_extract.py` (floodfill déterministe, QC verte) et on **remplace** l'art
> Sylvan déjà stagé. **Assets uniquement — zéro code, zéro moteur** (registre
> auto-découvert par nom de fichier, doc 12 §10 ; PNG hors bundle).

## Découpe (QC 100 % verte)
- `units-p1` (4×2) → t1-lucine, t2-archer-sylvestre, t3-dryade, t4-loup-argent,
  t5-licorne, t6-treant, t7-aieul, t1-lucine-elite (8/8 PASS).
- `units-p2` (4×2, **défaut de génération** : une pile « Tréant » en trop insérée
  en cellule 6 ⇒ décalage) → extraction avec un id **poubelle** `zz-extra-treant`
  en cellule 6 pour que `t7-aieul-elite` retombe sur la cellule 7 (Awakened Elder).
  Ids gardés : t2/t3/t4/t5/t6/t7-*-elite (6 utiles, 7/7 PASS).
- `buildings-p1` (4×2) → sylvan-court-dwelling-t1..t7 + sylvan-court-heart-grove (8/8).
- `buildings-p2` (1×1) → sylvan-court-grail (1/1).
- `avatars` (4×2, 2 remplies) → sylvan-court-might, sylvan-court-magic (2/2).

## Placement (remplace l'existant commité)
- 14 unités → `assets/units/sylvan-court/`
- 9 bâtiments → `assets/buildings/sylvan-court/`
- 2 avatars → `assets/heroes/`

## Vérification
- [x] `sheet_extract` : 25/25 sprites PASS (0 FAIL), aucune contamination de texte
      (les libellés gravés dans les planches tombent sous le seuil de composant /
      sont retirés comme bave de bord). QC visuelle relue plate par plate.
- [x] `pnpm build` vert ; bundle **342 167 ≤ 819 200** (PNG hors bundle, hashés).
- [x] Smoke @core « le client démarre sans erreur » (registre d'assets intact).
- Zéro moteur, zéro faction en dur, pas de bump save (assets seuls).
