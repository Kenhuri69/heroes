# Planche — unités test-faction (T1→T7)

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle A (sprites 512² painterly, alpha strict après extraction) de `docs/12-assets-style-guide.md`. Grille **1×1**,
> ordre row-major. Planche cible ≥ 512×512 px.

## Prompt (à coller dans le LLM image)

```
Character sheet, 1 fantasy creatures of the same army in a 1x1 grid,
digital painting, heroic fantasy concept art style
(Heroes of Might and Magic, MTG illustration quality), painterly brush strokes,
dynamic action pose, 3/4 view, soft directional light from upper-left,
army visual identity: plain neutral grey with orange accents (placeholder faction),
clear power progression from cell 1 (weakest) to the last cell (mightiest),
each subject centered in its own cell, not touching cell edges,
clear spacing between cells,
cell 1: tier 1 unit "Recruit (fr: Recrue)" — slow and massive
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 1 --rows 1 --side 512 \
  --ids t1-recruit \
  --out assets/raster_src --qc /tmp/qc-units-test-faction.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/units/test-faction/`.
