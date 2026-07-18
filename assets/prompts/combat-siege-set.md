# Planche — rempart de siège (S1, muraille CONTINUE peinte)

> **Décision (2026-07) : muraille COMPOSÉE, pas de sprite horizontal par hex.**
> `drawSiegeWall` place le long de la colonne de murs : **courtine** (tuilée
> verticalement) + **tours** aux extrémités + **porte** à l'ouverture, avec un
> **repli procédural** intégral (dessin vectoriel) tant que l'art peint manque.
> Le client consomme ces clés PEINTES si présentes, sinon procédural :
> - `combat/siege-curtain` → `TilingSprite` VERTICAL (doit **tuiler haut↔bas**) ;
> - `combat/siege-tower` → sprite posé aux extrémités de tronçon ;
> - `combat/siege-gate` → **procédural pour l'instant** (l'ancienne planche porte
>   horizontale ne tient pas dans l'ouverture verticale de 2 hex ; un art de porte
>   VERTICAL pourra être câblé plus tard).
>
> Style validé (réf. captures du jeu d'origine) : peinture semi-réaliste *Might &
> Magic Heroes Online*, pierre claire, lumière douce, sur **fond gris plat**
> `#c8c8c8` (détourage `tools/assets/*` → alpha strict). Les anciennes planches
> HORIZONTALES (`siege-wall`/`-cracked`/`-breached`/`-gate`) restent stagées mais
> **superposées par la composition** (elles ne tuilent pas verticalement).

## siege-curtain (courtine VERTICALE, tuilable haut↔bas — À GÉNÉRER)
```
A vertical run of medieval castle curtain wall, viewed slightly from the attacker's side so it runs top-to-bottom of the frame — painterly game asset, Might & Magic Heroes Online concept-art style, semi-realistic.
A tall stone wall band running vertically; a crenellated battlement (merlons + walkway) along the LEFT edge facing the viewer, the ashlar wall face to the right; light beige-grey stone, mortar joints, moss.
The stone reaches the TOP and BOTTOM edges of the frame so vertical copies stack seamlessly (tileable vertically); no feature that would break the seam at top/bottom.
Front elevation, evenly lit, crisp readable forms. Flat uniform light grey background (#c8c8c8), no cast shadow.
No text, no watermark, no border, no ground line, no banners.
```

## siege-tower (tour crénelée, plus haute que le mur — À GÉNÉRER)
```
A single medieval round defensive stone tower, tall, painterly game asset, Might & Magic Heroes Online concept-art style, semi-realistic.
Cylindrical grey ashlar tower with a crenellated top, narrow arrow-slits, a flat battlemented roof, subtle weathering and moss, standing taller than a wall.
Front 3/4 view, evenly lit, crisp readable silhouette. Centered with generous margin, flat uniform light grey background (#c8c8c8), no cast shadow.
No text, no watermark, no border, no ground line, no banners.
```

> Extraction → `assets/combat/siege-curtain.png` & `siege-tower.png`
> (`process_sprite.py` ou détourage fond-connecté). Dépôt ⇒ la composition passe
> automatiquement au peint (repli procédural sinon).
>
> Ligne de style commune :
> `painterly digital game illustration, Might & Magic Heroes Online concept-art
> style, semi-realistic, muted natural stone palette, soft cinematic light, crisp
> readable forms, subtle hand-painted texture, no cartoon outlines, no cel shading`

## Anciennes planches horizontales (stagées, superposées) — pour mémoire

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
