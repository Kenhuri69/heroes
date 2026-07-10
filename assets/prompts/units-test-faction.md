# Planche — unités test-faction (T1→T7)

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle A (sprites 512² painterly, alpha strict après extraction) de `docs/12-assets-style-guide.md`. Grille **2×1**,
> ordre row-major. Planche cible ≥ 1024×512 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Character sheet, 2 fantasy creatures of the same army in a 2x1 grid,
digital painting, heroic fantasy concept art style
(Heroes of Might and Magic, MTG illustration quality), painterly brush strokes,
dynamic action pose, 3/4 view, soft directional light from upper-left,
army visual identity: plain neutral grey with orange accents (placeholder faction),
clear power progression from cell 1 (weakest) to the last cell (mightiest),
each subject centered in its own cell, not touching cell edges,
clear spacing between cells,
IMPORTANT: keep every subject fully inside its cell with generous empty margin all around — fully spread wings, weapons, staves and all extremities must NOT be cropped or touch any edge; zoom each subject out enough that nothing is clipped,
cell 1: tier 1 unit "Recruit (fr: Recrue)" — slow and massive
cell 2: tier 1 unit "Elite Recruit (fr: Recrue d'élite)" — steady stance
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no decorative sparkles, no star glints, no lens flare
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 2 --rows 1 --side 512 \
  --ids t1-recruit,t1-recruit-elite \
  --out assets/raster_src --qc /tmp/qc-units-test-faction.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/units/test-faction/`.
