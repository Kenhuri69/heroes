# Planche — avatars de héros (archétypes par faction) — planche 2/2

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle B (bustes painterly 256²) de `docs/12-assets-style-guide.md`. Grille **4×1**,
> ordre row-major. Planche cible ≥ 2048×512 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Portrait sheet, 4 heroic fantasy bust portraits in a 4x1 grid,
painterly digital painting (Heroes of Might and Magic style), NOT photorealistic,
bust shot, 3/4 face turn, determined expression,
warm key light upper-left, cool rim light,
each bust fully isolated with clear empty space around head and shoulders (for clean cut-out),
each subject centered in its own cell, not touching cell edges,
clear spacing between cells,
IMPORTANT: keep every subject fully inside its cell with generous empty margin all around — fully spread wings, weapons, staves and all extremities must NOT be cropped or touch any edge; zoom each subject out enough that nothing is clipped,
cell 1: a battle-hardened might hero, armored commander of the vox-arcana faction — black gothic stone with silver/gold filigree, electric cyan and neon magenta, wisteria violet, Korean oni/pagoda accents, concert neon lanterns
cell 2: a wise magic hero, robed spellcaster of the vox-arcana faction — black gothic stone with silver/gold filigree, electric cyan and neon magenta, wisteria violet, Korean oni/pagoda accents, concert neon lanterns
cell 3: a battle-hardened might hero, armored commander of the dungeon faction — muted heroic fantasy palette matching the faction lore
cell 4: a wise magic hero, robed spellcaster of the dungeon faction — muted heroic fantasy palette matching the faction lore
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no decorative sparkles, no star glints, no lens flare
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 4 --rows 1 --side 256 \
  --ids vox-arcana-might,vox-arcana-magic,dungeon-might,dungeon-magic \
  --out assets/raster_src --qc /tmp/qc-hero-avatars-p2.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/heroes/`.
