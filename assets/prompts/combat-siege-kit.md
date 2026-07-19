# Kit de siège PEINT — planche Gemini (option A, refonte visuelle du siège)

> **v8 — PLAN VUE DE DESSUS + profondeur au prompt (méthode retenue,
> itération 9).** Leçons cumulées : approche ENSEMBLE (tout connecté, jamais
> d'objet isolé) sur fond MAGENTA uni (chroma-key, pipeline de la planche v1
> réussie) ; la peinture v6 (guides par rangée) empilait des blocs ; les
> guides pseudo-3D v7 étaient laids et ambigus. Le gabarit est désormais un
> **PLAN** : la vue de dessus des **empreintes au sol** — géométrie pure,
> zéro volume dessiné — et c'est le **prompt** qui demande la profondeur
> avec une **petite inclinaison**. Gabarit :
> `assets/prompts/siege-ensemble-template.png` (1152×2048, généré par
> `gen_siege_ensemble_template.py`). Le plan montre, connectés :
>
> - la **bande continue** de courtine (merlons marqués sur le bord ouest,
>   chemin de ronde clair qui file d'une traite) ;
> - deux **cercles de tours** qui CHEVAUCHENT la bande (fusion évidente en
>   plan), couronnes à merlons radiaux ;
> - rangée 1 **fissurée** et rangée 7 **CASSÉE** (brèche déchiquetée +
>   gravats déversés vers le champ) EN SITUATION ;
> - **porte** en travers de l'axe (tunnel est-ouest, vantaux bois côté
>   assaillant) + **PONT-LEVIS** en bois attaché à la face ouest ;
> - **tour de tir EN RETRAIT** (baliste vue de dessus pointée à gauche)
>   derrière la porte, et sa **RUINE** derrière la brèche.
>
> L'extraction (`extract_siege_ensemble.py`, chroma-key + découpes
> géométriques du cuts JSON) sort : le **run** complet (tranches par rangée
> côté client), les **bandes-étalons** d'état (intact/fissuré/rasé), la
> **tour de tir** et sa **ruine** (`siege-piece-arrow-tower{,-razed}.png`),
> et patche le layout `siege-scene.json` (bloc `run`) — aucun code à toucher
> au dépôt. Côté client, une tour de tir DÉTRUITE laisse sa ruine sur l'hex.

## Procédure v8

1. Générer UNE image **1152×2048** avec le prompt ci-dessous + le gabarit
   `siege-ensemble-template.png` joint en référence (image-to-image).
2. Vérifier à l'œil : fond magenta uni, muraille d'un seul tenant, tours
   fondues au mur, pont-levis rattaché, profondeur discrète (pas de fausse
   perspective violente).
3. Déposer la peinture (ex. `assets/prompts/_incoming/siege-ensemble.png`)
   puis `python3 tools/assets/extract_siege_ensemble.py <chemin> --dry-run`
   (aperçu), puis sans `--dry-run` pour écrire dans `assets/combat/`.

## Prompt v8 (à coller tel quel, gabarit joint)

```
The attached image is a TOP-DOWN PLAN of a castle fortification: the grey
shapes are the exact ground FOOTPRINTS of the walls and towers, on a flat
solid magenta background.

Paint the fortification as finished game art directly OVER this plan,
keeping every footprint exactly in place and at the same size. Camera:
NEAR TOP-DOWN with a SLIGHT TILT — a small inclination, just enough to add
DEPTH. The tops (wall walkway, tower platforms) stay the dominant visible
surfaces; a narrow strip of the south-facing stone walls shows below them
to give height. Bases must stay on the plan's footprints. Keep the magenta
background flat and untouched — no ground, no cast shadows on the
background, no text.

Style: semi-realistic painterly fantasy game art (Might & Magic Heroes
Online battle screen), grey weathered ashlar stone with subtle moss, warm
light from the upper-left.

What the plan shows — ONE SINGLE connected fortification:
- the long vertical band is ONE CONTINUOUS curtain wall that enters the
  picture from the TOP edge and leaves at the BOTTOM edge — the town's
  enceinte continues beyond the image and closes off-screen, so the wall is
  simply CUT by the image borders (do not cap or finish its ends); the
  small teeth along its LEFT edge are its merlons (battlements facing the
  attacker) — paint the parapet as ONE unbroken line across the whole
  image, never divided into stacked blocks, with no crenellated rim or
  seam ACROSS the wall;
- the two big circles are round defensive towers standing ON the wall: the
  wall passes THROUGH each tower and continues on the other side (no seam,
  no gap), and their crenellated crowns (tick marks) carry the wall's
  battlement line around them;
- the X-shaped cracks near the top mark a DAMAGED stretch: deep cracks,
  chipped merlons, small debris — then the wall resumes clean;
- the jagged gap with the boulder shapes is a collapsed BREACH: broken
  stumps, a heap of rubble spilling toward the field on the left — then the
  wall resumes;
- the rectangle across the wall is a fortified GATEHOUSE: its light
  corridor is the gate tunnel crossing the wall, the dark chevron on its
  left face is a pair of closed wooden doors, and the brown planked
  rectangle attached to it is a lowered wooden DRAWBRIDGE (paint its planks
  and two chains back up to the gatehouse);
- the circle set back on the right, behind the gate, is a round tower with
  a wooden BALLISTA (giant crossbow) mounted on its top platform, aimed
  toward the LEFT — arms, string and bolt clearly visible from above;
- the broken circle behind the breach is the SAME ballista tower in RUINS:
  a collapsed crown, splintered ballista wreckage on the stump, rubble
  around the base.

Same stone and same lighting everywhere. No text, no watermark. Keep every
painted element within the plan's footprints.
```

## Critères d'acceptation v8

- La muraille est d'UN SEUL TENANT et va de BORD À BORD de l'image
  (l'enceinte se referme hors champ, fidélité HoMM3) : parapet ininterrompu
  sur toute la hauteur ; AUCUNE couronne/corniche crénelée EN TRAVERS du
  mur (les blocs empilés de la v6 sont LE motif de rejet).
- Le mur TRAVERSE les tours et ressort de l'autre côté (tout fermé en
  visuel) ; pont-levis rattaché à la porte.
- Profondeur DISCRÈTE : dessus dominants + fine bande de face sud — pas de
  fausse perspective violente, les bases restent sur les empreintes.
- Le fond reste magenta UNI (chroma-key) : rien de peint hors des guides.
- Pas de sol/ombre portée peinte SUR le fond (le client pose les ombres).
- Si un élément est raté : régénérer la peinture entière (cohérence de
  matière) plutôt que de mixer deux peintures.

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
