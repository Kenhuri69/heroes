# Planche — jeu de rempart de siège continu (S1/S2, famille S, phase 2 LLM)

> Rédigée à la main (famille S — murs/effets, non couverte par `gen_prompts.py`).
> Complète `combat-siege-wall.md` (le pan unique actuel). Objectif audit doc 19
> §2.1/§2.2 : une **muraille continue** au lieu de blocs épars — pièces orientées
> ancrées bord-à-bord + **porte** distincte de la brèche + overlay de **fissures**.
> **Mêmes clés `combat/<id>`** ⇒ substitution par simple dépôt de PNG ; repli
> gracieux tant qu'absentes (le client retombe sur `siege-wall.png` puis le
> rocher procédural). Chaque prompt = **1 image**, staging `assets/combat/<id>.png`,
> ≥ 1024×1024 px, fond gris plat `#c8c8c8`.

## siege-wall-cracked (overlay de fissures — S2.2)

> Overlay ALPHA posé PAR-DESSUS un segment de rempart entamé (`siegeWallHp` sous
> le max). Doit être surtout transparent : uniquement fissures + éclats + poussière.

```
Only cracks and battle damage for a stone rampart wall, overlay texture,
digital painting, heroic fantasy concept art style (Heroes of Might and Magic quality),
jagged fracture lines, a few knocked-out ashlar blocks, chipped mortar, dust and small rubble,
NO full wall — just the damage marks meant to sit on top of an existing wall segment,
mostly empty transparent-looking area with the cracks concentrated center and lower,
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line
```

## siege-gate (porte de ville OUVERTE — S1.3, franchissable)

```
A single medieval fantasy stone gatehouse with its heavy timber gate standing OPEN, siege-battle prop,
digital painting, heroic fantasy concept art style (Heroes of Might and Magic quality),
two stout stone gate towers flanking a raised portcullis and open wooden doors, a clear dark passage through,
weathered grey ashlar masonry, iron banding on the doors, 3/4 slightly-elevated battle view,
reads clearly as "the town gate", NOT a breach, NOT a plain wall,
subject centered with generous empty margin all around, nothing cropped,
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no banners, no soldiers
```

## siege-gate-breached (porte défoncée — S1.3)

```
A single medieval fantasy stone gatehouse SMASHED OPEN by siege, siege-battle prop,
digital painting, heroic fantasy concept art style (Heroes of Might and Magic quality),
splintered broken wooden gate doors hanging off their hinges, twisted iron portcullis, cracked gate towers, scattered rubble in the passage,
weathered grey ashlar masonry, clearly a violently forced/breached gate, NOT an intact gate, NOT a plain wall,
subject centered with generous empty margin all around, nothing cropped,
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no banners, no soldiers
```

## siege-wall-top / -mid / -bottom / -stub (segments orientés — S1.1/S1.2)

> Jeu de 4 segments ancrés bord-à-bord sur la colonne d'hexes (absorbe le zigzag
> de l'offset pair/impair ⇒ muraille continue). `-top`/`-bottom` = extrémités
> (créneau d'angle vers l'intérieur), `-mid` = pan répétable qui se raccorde en
> haut ET en bas, `-stub` = moignon détruit (base arasée). Même gouache, même
> largeur, raccord vertical net. Générer chacun en 1 image (clés `combat/<id>`).

```
A single medieval fantasy stone rampart wall segment for a CONTINUOUS wall, siege-battle prop,
digital painting, heroic fantasy concept art style (Heroes of Might and Magic quality),
weathered grey ashlar masonry with crenellations on top, mortar joints, moss in the cracks,
front-facing elevation so segments tile edge-to-edge vertically, the wall face fills the full width of the frame with the stone reaching the LEFT and RIGHT edges (tileable sides),
<<VARIANT>>,
flat uniform light grey background (#c8c8c8) ONLY where there is no stone, no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no banners, no soldiers
```

Remplacer `<<VARIANT>>` par cellule :
- **siege-wall-top** : `the TOP end of the wall — a finished merlon-crenellated cap at the top edge, the stone continuing off the BOTTOM edge`
- **siege-wall-mid** : `a MIDDLE run of wall — the stone continues off BOTH the top and bottom edges, no cap`
- **siege-wall-bottom** : `the BOTTOM end of the wall — a finished stone base/plinth at the bottom edge, the stone continuing off the TOP edge`
- **siege-wall-stub** : `a DESTROYED wall stub — only the lower courses remain as a jagged low ruin, rubble and gaps, crenellations gone`

## Extraction au retour (image unique opaque → u2net)

```bash
python3 tools/assets/process_sprite.py --src <img> --id siege-gate --dest assets/combat --dry-run
# vérifier /tmp/siege-gate_check.png puis relancer sans --dry-run
```
→ `assets/combat/<id>.png` (drop-in direct, résolveurs `siegeWallUrl()` /
`siegeWallCrackedUrl()` + sélection par position S1.2, pas de mipmap).
