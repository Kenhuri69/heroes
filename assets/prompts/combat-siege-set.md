# Planche — rempart de siège (S1/S2, famille S)

> **Style validé** (réf. captures du jeu d'origine, 2026-07) : illustration
> peinte semi-réaliste type *Might & Magic Heroes Online* — pierre claire,
> lumière douce, formes lisibles, sur **fond gris plat** `#c8c8c8` (détourage).
> **Art LIVRÉ** pour `siege-wall`, `siege-wall-cracked`, `siege-wall-breached`,
> `siege-gate` (extraits via `tools/assets/*` → alpha strict). Regénérer =
> reprendre ces prompts. Mêmes clés `combat/<id>` ⇒ substitution par dépôt de PNG.
>
> Ligne de style à garder dans chaque prompt :
> `painterly digital game illustration, Might & Magic Heroes Online concept-art
> style, semi-realistic, muted natural stone palette, soft cinematic light, crisp
> readable forms, subtle hand-painted texture, no cartoon outlines, no cel shading`

## siege-wall (segment intact)
```
A single medieval stone rampart wall segment — painterly game asset, Might & Magic Heroes Online concept-art style, semi-realistic.
Light beige-grey ashlar blocks with mortar joints and crenellations on top, subtle weathering and moss, front-on elevation, evenly lit, crisp readable forms, hand-painted stone texture.
Centered with generous margin, flat uniform light grey background (#c8c8c8), no cast shadow.
No text, no watermark, no border, no ground line, no banners.
```

## siege-wall-cracked (endommagé — 1er palier)
```
A single medieval stone rampart wall segment, battle-damaged — painterly game asset, Might & Magic Heroes Online concept-art style, semi-realistic.
Light beige-grey ashlar blocks; dark jagged cracks radiate across the stone from a caved-in spot, one or two knocked-out blocks, loose rubble and dust falling at the base.
Front-on elevation, evenly lit, crisp painterly stone. Centered with margin, flat uniform light grey background (#c8c8c8), no cast shadow.
No text, no watermark, no border, no ground line.
```

## siege-wall-breached (percé — 2e palier)
```
A medieval stone rampart wall segment with a blasted BREACH punched clean through the middle — painterly game asset, Might & Magic Heroes Online concept-art style, semi-realistic.
Light beige-grey ashlar blocks around a ragged dark opening; dark cracks radiate outward from the hole; broken blocks and rubble tumble into a dusty pile at the base.
Front-on elevation, evenly lit, crisp painterly stone. Centered with margin, flat uniform light grey background (#c8c8c8), no cast shadow.
No text, no watermark, no border, no ground line.
```

## siege-gate (porte fermée — staged, câblage S1.3 à venir)
```
A medieval fortified stone gatehouse with a closed iron-banded timber gate — painterly game asset, Might & Magic Heroes Online concept-art style, semi-realistic.
Two squat crenellated stone towers flanking a pointed arch, a raised portcullis grille, grey ashlar masonry with subtle wear, front-on elevation, evenly lit, crisp readable forms.
Centered with margin, flat uniform light grey background (#c8c8c8), no cast shadow.
No text, no watermark, no border, no ground line, no banners.
```

## Extraction (fond gris → alpha) — recette utilisée
Détourage par fond-connecté au bord + plus grande composante (jette le sparkle du
générateur, coin bas-droit) + trim. Sortie `assets/combat/<id>.png`, cap 640 px.
Consommé par `siegeWallUrl()` / `siegeWallCrackedUrl()` / `siegeWallBreachedUrl()`
(3 paliers d'usure pilotés par le ratio de PV). `siege-gate` attend le câblage
géométrique S1.2/S1.3 (porte sur les rangées d'ouverture).
