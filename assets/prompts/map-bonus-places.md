# Planche — lieux de bonus de la carte (fontaine, écurie, tour de guet, moulin)

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle C (planche de vignettes, fond gris clair plat) de `docs/12-assets-style-guide.md`. Grille **4×1**,
> ordre row-major. Planche cible ≥ 2048×512 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Item sheet, 4 fantasy map bonus locations in a 4x1 grid,
digital painting, painterly MTG illustration quality,
rich material detail (stone, timber, iron, water, cloth),
soft directional light from upper-left,
readable as a small map icon at 64px tall,
each subject centered in its own cell, not touching cell edges,
clear spacing between cells,
IMPORTANT: keep every subject fully inside its cell with generous empty margin all around — fully spread wings, weapons, staves and all extremities must NOT be cropped or touch any edge; zoom each subject out enough that nothing is clipped,
cell 1: an ornate stone fountain with clear flowing water and a soft blessing aura, a place granting good luck
cell 2: a wooden horse stable with a fenced paddock, hay bales and a saddled horse, a place granting swift travel
cell 3: a tall slender stone watchtower with a lit lantern at its top, a lookout that extends sight over the land
cell 4: a rustic water mill with a turning wooden wheel beside a small stream, a place that produces resources
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no decorative sparkles, no star glints, no lens flare
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 4 --rows 1 --side 512 \
  --ids fountain,stable,watchtower,mill \
  --out assets/raster_src --qc /tmp/qc-map-bonus-places.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/map/`.
