# Planche — bâtiments vox-arcana — planche 1/2

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle C (planche de vignettes, fond gris clair plat) de `docs/12-assets-style-guide.md`. Grille **4×2**,
> ordre row-major. Planche cible ≥ 2048×1024 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Building sheet, 8 fantasy dwellings of the same town in a 4x2 grid,
digital painting, painterly HoMM town-screen style,
each building isolated on its plot, slight 3/4 aerial view,
architectural identity: black gothic stone with silver/gold filigree, electric cyan and neon magenta, wisteria violet, Korean oni/pagoda accents, concert neon lanterns,
soft directional light from upper-left,
each subject centered in its own cell, not touching cell edges,
clear spacing between cells,
IMPORTANT: keep every subject fully inside its cell with generous empty margin all around — fully spread wings, weapons, staves and all extremities must NOT be cropped or touch any edge; zoom each subject out enough that nothing is clipped,
cell 1: "Dwelling: Apprentice Choir (fr: Habitation : Chœur d'apprentis)" — the dwelling where "Apprentice Choir (fr: Chœur d'apprentis)" creatures are recruited
cell 2: "Dwelling: Duelist (fr: Habitation : Duelliste)" — the dwelling where "Duelist (fr: Duelliste)" creatures are recruited
cell 3: "Dwelling: Hippogriff (fr: Habitation : Hippogriffe)" — the dwelling where "Hippogriff (fr: Hippogriffe)" creatures are recruited
cell 4: "Dwelling: Idol Huntress (fr: Habitation : Chasseuse-Idole)" — the dwelling where "Idol Huntress (fr: Chasseuse-Idole)" creatures are recruited
cell 5: "Dwelling: Thestral (fr: Habitation : Sombral)" — the dwelling where "Thestral (fr: Sombral)" creatures are recruited
cell 6: "Dwelling: Spellmaster (fr: Habitation : Maître de Sortilèges)" — the dwelling where "Spellmaster (fr: Maître de Sortilèges)" creatures are recruited
cell 7: "Dwelling: Phoenix (fr: Habitation : Phénix)" — the dwelling where "Phoenix (fr: Phénix)" creatures are recruited
cell 8: "Dwelling: Honmoon Avatar (fr: Habitation : Avatar du Honmoon)" — the dwelling where "Honmoon Avatar (fr: Avatar du Honmoon)" creatures are recruited
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no decorative sparkles, no star glints, no lens flare
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 4 --rows 2 --side 512 \
  --ids vox-arcana-dwelling-t1,vox-arcana-dwelling-t2,vox-arcana-dwelling-t3,vox-arcana-dwelling-t4,vox-arcana-dwelling-t5,vox-arcana-dwelling-t6,vox-arcana-dwelling-t7,vox-arcana-dwelling-t8 \
  --out assets/raster_src --qc /tmp/qc-buildings-vox-arcana-p1.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/buildings/vox-arcana/`.
