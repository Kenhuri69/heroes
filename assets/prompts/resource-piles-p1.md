# Planche — tas de ressources ramassables (objets de carte) — planche 1/2

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle C (planche de vignettes, fond gris clair plat) de `docs/12-assets-style-guide.md`. Grille **4×2**,
> ordre row-major. Planche cible ≥ 2048×1024 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Item sheet, 8 small fantasy resource piles lying on the ground in a 4x2 grid,
digital painting, painterly HoMM adventure-map style,
collectible loot piles resting on flat ground, slight 3/4 aerial view,
bold readable silhouette at 64 pixels (adventure map tile size),
soft directional light from upper-left,
each subject centered in its own cell, not touching cell edges,
clear spacing between cells,
IMPORTANT: keep every subject fully inside its cell with generous empty margin all around — fully spread wings, weapons, staves and all extremities must NOT be cropped or touch any edge; zoom each subject out enough that nothing is clipped,
cell 1: "gold pile" — a small heap of gold coins with a few loose coins
cell 2: "wood pile" — a neat stack of cut timber logs
cell 3: "ore pile" — a pile of grey iron ore chunks
cell 4: "crystal pile" — a cluster of glowing purple crystal shards
cell 5: "gems pile" — a small mound of colorful cut gemstones
cell 6: "mercury pile" — a corked flask of quicksilver on a small crate
cell 7: "essence pile" — a glowing arcane phial nested in a small chest
cell 8: "sulfur pile" — a heap of yellow sulfur powder and rocks
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no decorative sparkles, no star glints, no lens flare
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 4 --rows 2 --side 512 \
  --ids pile-gold,pile-wood,pile-ore,pile-crystal,pile-gems,pile-mercury,pile-essence,pile-sulfur \
  --out assets/raster_src --qc /tmp/qc-resource-piles-p1.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/resources/`.
