# Planche — bâtiments arcane-hunters — planche 2/2

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle C (planche de vignettes, fond gris clair plat) de `docs/12-assets-style-guide.md`. Grille **4×1**,
> ordre row-major. Planche cible ≥ 2048×512 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Building sheet, 4 fantasy dwellings of the same town in a 4x1 grid,
digital painting, painterly HoMM town-screen style,
each building isolated on its plot, slight 3/4 aerial view,
architectural identity: midnight blue and arcane violet, silver trim, glowing cyan runes, hunter gear,
soft directional light from upper-left,
each subject centered in its own cell, not touching cell edges,
clear spacing between cells,
IMPORTANT: keep every subject fully inside its cell with generous empty margin all around — fully spread wings, weapons, staves and all extremities must NOT be cropped or touch any edge; zoom each subject out enough that nothing is clipped,
cell 1: "Circle of the Watcher (fr: Cercle du Vigile)" — a faction-specific town building
cell 2: "Circle of the Hunt (fr: Cercle de la Traque)" — a faction-specific town building
cell 3: "Circle of the Seal (fr: Cercle du Sceau)" — a faction-specific town building
cell 4: "Circle of the Abyss (fr: Cercle de l’Abîme)" — a faction-specific town building
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 4 --rows 1 --side 512 \
  --ids arcane-hunters-circle-vigile,arcane-hunters-circle-traque,arcane-hunters-circle-sceau,arcane-hunters-circle-abime \
  --out assets/raster_src --qc /tmp/qc-buildings-arcane-hunters-p2.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/buildings/arcane-hunters/`.
