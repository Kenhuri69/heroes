# Planche — structures & objets de la carte (villes + objets) — planche 2/2

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle C (planche de vignettes, fond gris clair plat) de `docs/12-assets-style-guide.md`. Grille **1×1**,
> ordre row-major. Planche cible ≥ 512×512 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Item sheet, 1 fantasy map structures and objects in a 1x1 grid,
digital painting, painterly MTG illustration quality,
rich material detail (stone, timber, iron, cloth),
soft directional light from upper-left,
readable as a small map icon at 64px tall,
each subject centered in its own cell, not touching cell edges,
clear spacing between cells,
IMPORTANT: keep every subject fully inside its cell with generous empty margin all around — fully spread wings, weapons, staves and all extremities must NOT be cropped or touch any edge; zoom each subject out enough that nothing is clipped,
cell 1: a small mossy stone shrine with a glowing rune, a place of blessing
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no decorative sparkles, no star glints, no lens flare
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 1 --rows 1 --side 512 \
  --ids shrine \
  --out assets/raster_src --qc /tmp/qc-map-props-p2.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/map/`.
