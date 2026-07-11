# Planche — bâtiments haven — planche 2/2

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle C (planche de vignettes, fond gris clair plat) de `docs/12-assets-style-guide.md`. Grille **2×1**,
> ordre row-major. Planche cible ≥ 1024×512 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Building sheet, 2 fantasy dwellings of the same town in a 2x1 grid,
digital painting, painterly HoMM town-screen style,
each building isolated on its plot, slight 3/4 aerial view,
architectural identity: off-white and light steel armor, sky-blue cloth, gold accents, holy light ambiance,
soft directional light from upper-left,
each subject centered in its own cell, not touching cell edges,
clear spacing between cells,
IMPORTANT: keep every subject fully inside its cell with generous empty margin all around — fully spread wings, weapons, staves and all extremities must NOT be cropped or touch any edge; zoom each subject out enough that nothing is clipped,
cell 1: "Statue of Judgement (fr: Statue du Jugement)" — a faction-specific town building
cell 2: "Cloister (fr: Cloître)" — a faction-specific town building
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no decorative sparkles, no star glints, no lens flare
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 2 --rows 1 --side 512 \
  --ids haven-statue,haven-cloister \
  --out assets/raster_src --qc /tmp/qc-buildings-haven-p2.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/buildings/haven/`.
