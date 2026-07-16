# Planche — machines de guerre communes (Forge, faction-agnostiques)

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle A (sprites 512² painterly, alpha strict après extraction) de `docs/12-assets-style-guide.md`. Grille **3×1**,
> ordre row-major. Planche cible ≥ 1536×512 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Character sheet, 3 medieval fantasy war machines and siege engines in a 3x1 grid,
digital painting, heroic fantasy concept art style
(Heroes of Might and Magic, MTG illustration quality), painterly brush strokes,
mechanical constructs of timber, iron and rope, NOT living creatures,
3/4 view, ready-for-battle stance, soft directional light from upper-left,
neutral weathered wood-and-iron palette, no faction heraldry,
each subject centered in its own cell, not touching cell edges,
clear spacing between cells,
IMPORTANT: keep every subject fully inside its cell with generous empty margin all around — fully spread wings, weapons, staves and all extremities must NOT be cropped or touch any edge; zoom each subject out enough that nothing is clipped,
cell 1: "Ballista (fr: Baliste)" — a large wheeled bolt-thrower ballista, taut torsion springs and a heavy iron-tipped bolt loaded, crew rigging
cell 2: "Catapult (fr: Catapulte)" — a heavy timber catapult / trebuchet with a loaded boulder in its sling arm and counterweight, siege-breaking bulk
cell 3: "Arrow Tower (fr: Tour de tir)" — a fixed fortified arrow tower of stone and timber, arrow-slits and a crenellated top, planted on the ground (immobile defensive structure)
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no decorative sparkles, no star glints, no lens flare
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 3 --rows 1 --side 512 \
  --ids ballista,catapulte,arrow-tower \
  --out assets/raster_src --qc /tmp/qc-war-machines.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/units/core/`.
