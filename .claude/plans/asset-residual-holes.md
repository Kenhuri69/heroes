# Plan — Résidus de fond enclavés dans les sprites détourés

## Problème (retour utilisateur, capture in-game)
Certains sprites d'unités détourés gardent un **résidu de fond gris** (le
`#c8c8c8` plat des planches, doc 12 §4) dans les zones **enclavées** par le
sujet : ex. le triangle intérieur de l'arc des archers (éclaireur Dungeon,
archer Haven/Sylvan, préfet AH…), l'espace entre les jambes d'une monture,
entre les poutres des machines de guerre, ou le halo enclos par un ruban de
magie.

## Cause racine
`tools/assets/sheet_extract.py::_floodfill_alpha` ne classe en fond que les
composantes connexes **touchant un bord** de la cellule (remplissage depuis les
bords). Une poche de fond entièrement entourée par le sujet n'est jamais
atteinte ⇒ reste opaque. `rembg` n'aide pas ici : le fond global est déjà
retiré, le défaut est un **trou intérieur** de la même couleur plate.

## Discriminateur sûr (ne pas casser les squelettes / l'argenté)
Un vrai trou de fond ≠ un détail clair légitime (os d'un squelette, argent
d'une armure). Critères cumulés :
- **neutre** : chroma ≤ 12 (le fond est gris pur ; FX cyan/violet, or, chair
  sont chromatiques) ;
- **bande de valeur** : 172 ≤ luminance ≤ 214 (autour de `#c8c8c8` = 200) ;
- **plat** : écart-type local (5×5) ≤ 9 (l'os/argent est texturé/dégradé) ;
- **enclavé** : bordure de la composante entourée à ≥ 90 % de sujet opaque
  (≠ silhouette d'os, dont le contour touche largement la transparence) ;
- **taille** : aire ≥ 180 px (ignore le bruit).

Vérifié visuellement sur les 35 sprites signalés (overlays magenta) : aucune
région ne mord sur le sujet ni sur un FX coloré.

## Étapes
1. [x] Diagnostic + scan `assets/units/**` → 35 sprites concernés. Overlays QC vérifiés.
2. [x] Régler `--grow` (dilatation du masque pour absorber le liseré anti-aliasé)
       → `grow=1` optimal (halo retiré, corde d'arc préservée ; `grow=2` mange la corde).
3. [x] Outil réutilisable `tools/assets/declutter_holes.py` (dry-run/apply + QC).
4. [x] Appliquer aux 35 sprites. Re-scan → **0 résidu** ; rendu final vérifié
       (éclaireur/archer Haven/catapulte : triangle d'arc transparent, corde
       préservée ; sorcière : halo enclavé retiré). PNG 512² intègres.
5. [x] Patch source `_floodfill_alpha` : reprise des trous de fond enclavés
       (composante de fond non reliée au bord + **plate**, écart de couleur < 8).
       Test synthétique OK : poche plate retirée, détail gris peint préservé,
       sujet & fond extérieur corrects.
6. [ ] Commit + push + PR + merge.

## Portée retenue (décision de sûreté)
Correctif appliqué aux **35 unités** uniquement. Le scan repère aussi des
régions dans buildings/artifacts/mines/resources/map, MAIS ces catégories
contiennent de la pierre/verre/métal **gris légitimes** : faux positifs
**prouvés** — socle de la statue d'ange (`haven-statue`), flacon de
`pile-mercury`, verrerie de `mine-mercury`. Une application aveugle les
troerait. Ces catégories nécessitent une passe **curée** fichier par fichier
(l'outil `declutter_holes.py --dry-run` produit les overlays QC pour ça) ;
laissées hors de cette PR pour ne pas abîmer d'art réel (guidelines §8).
Vrais positifs repérés côté non-unités pour une future passe : `trefle-chance`,
`vox-arcana-dwelling-t4`, `market`, `hero-*`, `signpost`.

## Hors périmètre
- Aucune intégration/rendu client modifié (assets consommés tels quels).
- Pas de changement moteur, pas de bump `CURRENT_SAVE_VERSION`.
- Outillage Python asset hors CI (généré hors-ligne via skills) ⇒ patch source
  validé par test synthétique inline, pas de nouveau harnais de test Python.
