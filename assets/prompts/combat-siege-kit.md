# Kit de siège PEINT — planche Gemini (option A, refonte visuelle du siège)

> **v2 — RUN DE MURAILLE (itération en cours).** La planche v1 a livré la
> qualité mais ses cellules étaient des OBJETS finis (4 côtés fermés) ⇒ rien
> ne se connectait. La v2 fait dessiner des **pièces de raccord** : gabarit
> `assets/prompts/siege-run-template.png` (2×2), extraction
> `tools/assets/extract_siege_run.py`. **Les tours de la v1 sont validées et
> conservées** — seules courtine/fissurée/brèche/porte sont régénérées.

## Prompt v2 (à coller tel quel, gabarit siege-run-template.png joint)

```
Repaint each pale guide of the attached template as finished painted game art,
keeping the same position and proportions. CRITICAL: in every cell the wall
band must RUN OFF the top and bottom edges of its cell (cut mid-masonry, no
finished ends, no towers) so that segments can be stacked seamlessly into one
continuous rampart. Flat solid magenta (#FF00FF) background, no text.

Style: semi-realistic painterly fantasy game art (Might & Magic Heroes Online),
grey weathered castle stone matching the attached style, subtle moss, warm
light from the upper-left, high three-quarter bird's-eye view. The wall band:
tall ashlar stone rampart seen slightly from its left side, walkway on top,
chunky crenellated merlons running along its LEFT edge, evenly spaced.

Cell A (top-left): plain curtain-wall segment, perfectly continuable.
Cell B (top-right): the same segment, badly damaged — deep cracks, chipped
merlons, small debris at the base; same width and same cut ends as cell A.
Cell C (bottom-left): the same segment COLLAPSED in its middle: the wall ends
in jagged broken stumps and a heap of rubble fills the central gap; the top
and bottom parts of the band remain identical to cell A so they still connect.
Cell D (bottom-right): the same wall band, pierced in its middle by a
fortified gatehouse: a slightly wider gate block INSIDE the run, tall pointed
arch with closed wooden doors facing LEFT, and a short stone threshold ramp
extending from the arch toward the lower-left (it will meet a stone causeway
over the moat); above and below the gatehouse the plain wall band continues to
the cell edges, identical to cell A.
```

---

## v1 (archive — planche 6 objets, tours toujours en service)

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
