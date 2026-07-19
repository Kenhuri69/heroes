# Kit de siège PEINT — planche Gemini (option A, refonte visuelle du siège)

> **But** : remplacer l'art procédural du rempart par de l'art peint au niveau
> du reste du jeu, SANS toucher au code : la planche est découpée par
> `tools/assets/extract_siege_kit.py` vers les clés existantes
> (`assets/combat/siege-piece-*.png`), canvas et ancres inchangés.
>
> **Gabarit** : `assets/prompts/siege-kit-template.png` (généré par
> `tools/assets/gen_siege_kit_template.py`). Chaque cellule contient la
> SILHOUETTE PÂLE du volume exact à peindre — mêmes proportions, mêmes
> contours. **Joindre le gabarit en image de référence** (image-to-image /
> « redraw over this layout ») : c'est lui qui garantit le calage.

## Procédure

1. Générer UNE image 2048×1536 avec le prompt ci-dessous + le gabarit joint.
2. Vérifier à l'œil : 6 volumes respectés, fond magenta uni, rien qui déborde
   des cellules, lumière haut-gauche partout.
3. Déposer le fichier où tu veux (ex. `assets/prompts/_incoming/siege-kit.png`)
   puis :
   `python3 tools/assets/extract_siege_kit.py <chemin> --dry-run` (aperçu)
   puis sans `--dry-run` pour écrire dans `assets/combat/`.
4. Rebuild + capture (l'assistant s'en charge en revue de PR).

## Prompt (à coller tel quel, gabarit joint)

```
Repaint each pale silhouette of the attached template as a finished painted
game asset, keeping EXACTLY the same position, size, proportions and outline
as the silhouette in its cell. Do not add anything outside the silhouettes.
Flat solid magenta (#FF00FF) background everywhere else, no shadows on the
background, no text, no borders.

Style: semi-realistic painterly fantasy game art (Might & Magic Heroes Online
battle screen), grey weathered castle stone with subtle moss, warm light from
the upper-left, crisp readable silhouettes at small size. High three-quarter
bird's-eye view (the ground plane is flattened, seen from about 45° above) —
NOT a frontal elevation.

Cell A (top-left): one massive curtain-wall block on a hexagonal footprint —
stone walkway on top, tall ashlar faces, a row of chunky crenellated merlons
running along the LEFT edge of the top face (battlements facing the attacker).
Cell B (top-middle): the SAME block as cell A, visibly damaged — deep cracks
across the walkway and face, a few chipped merlons, small debris at the base.
Cell C (top-right): the same emplacement RAZED — only a low jagged stump of
the wall remains, with a heap of broken stone blocks and rubble spilling
toward the lower-left.
Cell D (bottom-left): a fortified gatehouse block spanning two hexes of the
same wall — same stone and battlements, pierced by a tall pointed arch with
closed wooden double doors reinforced with iron bands, the arch facing the
lower-left.
Cell E (bottom-middle): a round defensive tower of the same stone — battlement
crown, arrow slits, slightly flared base.
Cell F (bottom-right): the same round tower but taller, with a wooden BALLISTA
(giant crossbow war machine) mounted on the top platform, aimed toward the
left, its arms and bolt clearly visible above the crown.
```

## Critères d'acceptation

- Chaque découpe remplit ≥ 80 % de la hauteur de sa silhouette (sinon le
  calage in-game dérive) ; l'extracteur cale au pied, centre en X.
- Les 6 pièces partagent pierre/lumière (elles seront côte à côte à l'écran,
  posées sur les tuiles de cour `siege-tile-court-*` et la scène peinte).
- Pas de sol/ombre portée peinte SOUS les pièces (le client pose les ombres).
- Si une cellule est ratée : régénérer la planche entière (cohérence de
  matière) plutôt que de mixer deux planches.
