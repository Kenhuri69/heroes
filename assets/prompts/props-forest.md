# Planche — props de relief FORÊT (set cohérent, remplace l'art disparate)

> Planche **manuelle** de la règle §7.5 de `docs/12-assets-style-guide.md` (les
> props de relief ne sont pas émis par `gen_prompts.py`). Grille **3×2**, ordre
> row-major. Planche cible ≥ 1536×1024 px.
>
> But : lever l'incohérence de saison des props actuels (`forest-2` chêne
> d'automne, `forest-6` bouleaux jaunes) — **une seule saison, forêt tempérée
> verte**, 6 silhouettes variées mais même palette / échelle / ligne de sol.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Item sheet, 6 Heroes-of-Might-and-Magic forest map decorations in a 3x2 grid,
digital painting, painterly MTG illustration quality,
ONE consistent season and palette across ALL six cells: lush temperate GREEN
summer forest, cool and warm greens with brown trunks, NO autumn colors, NO
orange, NO yellow foliage, NO snow,
each cluster standing upright on flat ground, viewed slightly from above
(isometric map angle), same ground baseline at the bottom of every cell,
similar overall height and similar footprint width in every cell so they scale
uniformly, tall enough to rise above a map tile,
soft directional light from the upper-left, consistent light direction in all cells,
varied silhouettes cell to cell (keep shape variety, unify only the palette):
cell 1: a tight group of three tall dark-green spruce conifers
cell 2: a mixed clump of green conifers of different heights
cell 3: one large broadleaf tree with a full rounded green canopy and a sturdy brown trunk
cell 4: a small stand of slender birches with GREEN summer leaves and pale trunks
cell 5: a dense thicket of green broadleaf trees and low bushes
cell 6: a lone wind-bent pine with an irregular green silhouette
each subject centered in its own cell, not touching cell edges, clear spacing between cells,
IMPORTANT: keep every tree fully inside its cell with generous empty margin all around — no branch or treetop cropped or touching any edge,
flat uniform light grey background (#c8c8c8), no ground plane, no ground shadow, no ground line,
no text, no watermark, no signature, no border frame, no decorative sparkles
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 3 --rows 2 --side 512 \
  --ids forest-1,forest-2,forest-3,forest-4,forest-5,forest-6 \
  --out assets/raster_src --qc /tmp/qc-props-forest.png
```

Regarder `/tmp/qc-props-forest.png` : cadre **vert = PASS**. Un FAIL → meilleure
planche ou ajuster `--tol` / `--inset` / `--min-area`, relancer.

Puis copier les 6 PNG validés de `assets/raster_src/` vers
`assets/tiles/props/forest-<n>.png` (écrase l'art disparate actuel). Le client
les reprend sans câblage (registre auto-découvert) ; `gen_tiles.py` conserve
l'art déposé et régénère la planche de contrôle `_preview.png`.
```bash
python3 tools/assets/gen_tiles.py   # vérifie : « art déposé, conservé » ×6
```
