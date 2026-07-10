# Planche — mines de ressources (objets de carte) — planche 1/2

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle C (planche de vignettes, fond gris clair plat) de `docs/12-assets-style-guide.md`. Grille **4×2**,
> ordre row-major. Planche cible ≥ 2048×1024 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Building sheet, 8 small fantasy resource mines in a 4x2 grid,
digital painting, painterly HoMM adventure-map style,
each mine isolated on its plot, slight 3/4 aerial view,
bold readable silhouette at 64 pixels (adventure map tile size),
soft directional light from upper-left,
each subject centered in its own cell, not touching cell edges,
clear spacing between cells,
IMPORTANT: keep every subject fully inside its cell with generous empty margin all around — fully spread wings, weapons, staves and all extremities must NOT be cropped or touch any edge; zoom each subject out enough that nothing is clipped,
cell 1: "gold mine" — a gold mine entrance with cart rails and nuggets
cell 2: "wood mine" — a sawmill with a water wheel and stacked logs
cell 3: "ore mine" — an open ore pit with wooden scaffolding
cell 4: "crystal mine" — a crystal cavern with glowing crystal clusters
cell 5: "gems mine" — a gem pond glittering with cut jewels
cell 6: "mercury mine" — an alchemist's lab with bubbling silver vats
cell 7: "essence mine" — an arcane essence extractor with a levitating orb
cell 8: "sulfur mine" — a smoking sulfur pit with yellow deposits
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no decorative sparkles, no star glints, no lens flare
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 4 --rows 2 --side 512 \
  --ids mine-gold,mine-wood,mine-ore,mine-crystal,mine-gems,mine-mercury,mine-essence,mine-sulfur \
  --out assets/raster_src --qc /tmp/qc-mines-p1.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/mines/`.
