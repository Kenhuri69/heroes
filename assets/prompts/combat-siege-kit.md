# Kit de siège PEINT — planche Gemini (option A, refonte visuelle du siège)

> **v7 — L'ENSEMBLE DE LA MURAILLE SUR FOND MAGENTA, COURTINE D'UN SEUL
> TENANT (méthode retenue, itération 9).** Leçon de la peinture v6 (rejetée :
> « les murs ne se connectent pas ») : les guides par rangée faisaient
> peindre des blocs empilés — le guide de courtine est désormais UNE BANDE
> CONTINUE et le prompt interdit explicitement l'empilement. Exigences croisées du porteur : une **approche ensemble**
> (tout dessiner assemblé, avec les connexions — jamais d'objet isolé) sur un
> **fond magenta uni** (pas de décor à préserver ; l'extraction est un
> chroma-key, le pipeline de la planche v1 réussie). Gabarit :
> `assets/prompts/siege-ensemble-template.png` (1152×2048, généré par
> `gen_siege_ensemble_template.py`), qui présente **tous les cas possibles,
> connectés** :
>
> - tours d'extrémité **FUSIONNÉES** au mur (le mur entre dans la tour) ;
> - courtine continue avec les états EN SITUATION — rangée 1 **fissurée**,
>   rangée 7 **CASSÉE** (brèche effondrée) ;
> - **porte** (gatehouse dans l'axe du mur) + **PONT-LEVIS** abaissé vers
>   l'assaillant (tablier de bois + chaînes) ;
> - **tour de tir EN RETRAIT** dans la cour (derrière la porte) et sa
>   **RUINE** en retrait derrière la brèche (tour de tir cassée).
>
> L'extraction (`extract_siege_ensemble.py`, chroma-key + découpes
> géométriques du cuts JSON) sort : le **run** complet (tranches par rangée
> côté client), les **bandes-étalons** d'état (intact/fissuré/rasé), la
> **tour de tir** et sa **ruine** (`siege-piece-arrow-tower{,-razed}.png`),
> et patche le layout `siege-scene.json` (bloc `run`) — aucun code à toucher
> au dépôt. Côté client, une tour de tir DÉTRUITE laisse sa ruine sur l'hex.

## Procédure v7

1. Générer UNE image **1152×2048** avec le prompt ci-dessous + le gabarit
   `siege-ensemble-template.png` joint en référence (image-to-image).
2. Vérifier à l'œil : fond magenta uni partout, la muraille d'un seul tenant
   (pas de segments isolés), pont-levis rattaché à la porte, lumière
   haut-gauche.
3. Déposer la peinture (ex. `assets/prompts/_incoming/siege-ensemble.png`)
   puis `python3 tools/assets/extract_siege_ensemble.py <chemin> --dry-run`
   (aperçu), puis sans `--dry-run` pour écrire dans `assets/combat/`.

## Prompt v7 (à coller tel quel, gabarit joint)

```
Repaint the grey guide fortification of the attached image as finished
painted game art, keeping EXACTLY the same position, size and footprint as
the guides. Flat solid magenta (#FF00FF) background everywhere else — no
shadows, no ground, no text on the background.

Style: semi-realistic painterly fantasy game art (Might & Magic Heroes
Online battle screen), grey weathered ashlar stone with subtle moss, warm
light from the upper-left, high three-quarter bird's-eye view (the ground
plane is flattened, seen from about 45° above) — NOT a frontal elevation.

The long grey band is the footprint of ONE SINGLE continuous curtain wall:
paint it as ONE unbroken crenellated stone rampart running from the top of
the image to the bottom. The crenellated parapet runs in ONE continuous
line along the wall's LEFT edge (battlements facing the attacker), from the
north tower all the way to the south tower. Do NOT divide the wall into
stacked blocks or platforms. Do NOT paint any horizontal crenellated rim,
ledge or seam ACROSS the wall — the only interruptions along the wall are
the two end towers, the gatehouse and the breach. Everything is CONNECTED
into a single ensemble:
- both ends of the rampart are crowned by round defensive towers FUSED into
  the wall (the wall enters the tower, no seam);
- near the top (where the cracked guide is): a DAMAGED stretch — deep
  cracks, chipped merlons, small debris — then the wall resumes clean;
- below the gate (where the broken guide is): a collapsed BREACH — jagged
  broken stumps, a heap of rubble spilling toward the field — then the wall
  resumes;
- at the centre: a fortified GATEHOUSE fused into the rampart, tall pointed
  arch with closed wooden double doors facing the LEFT, and a lowered
  wooden DRAWBRIDGE attached under the door, its plank deck reaching toward
  the lower-left, held by two chains rising to the gatehouse wall;
- set back on the right (courtyard side), behind the gate: a round tower
  with a wooden BALLISTA (giant crossbow war machine) mounted on the top
  platform, aimed toward the left, its arms and bolt clearly visible;
- set back on the right, behind the breach: the SAME ballista tower BROKEN —
  only its lower half remains, jagged shattered crown, splintered wooden
  wreckage of the ballista on the stump, rubble around the base.

Same stone and same lighting everywhere. No text, no watermark. Keep every
painted element within the guide footprints.
```

## Critères d'acceptation v7

- La muraille est d'UN SEUL TENANT (tours fusionnées, porte dans l'axe,
  pont-levis rattaché) — aucun élément isolé hormis les deux tours de tir
  en retrait (qui sont des structures de cour dans le jeu).
- AUCUNE couronne/corniche crénelée EN TRAVERS du mur entre les tours : le
  parapet file d'une traite ; toute peinture « en blocs empilés » est un
  motif de rejet (c'est ce qui a tué la v6).
- Le fond reste magenta UNI (chroma-key) : rien de peint hors des guides.
- Les extrémités hautes/basses des rangées fissurée et cassée se raccordent
  au mur intact (le mur « reprend » après le dégât).
- Pas de sol/ombre portée peinte SOUS les pièces (le client pose les ombres).
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
