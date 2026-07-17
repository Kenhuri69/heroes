# Planche — bâtiments sylvan-court — planche 1/2

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle C (planche de vignettes, fond gris clair plat) de `docs/12-assets-style-guide.md`. Grille **4×2**,
> ordre row-major. Planche cible ≥ 2048×1024 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Building sheet, 8 fantasy dwellings of the same town in a 4x2 grid,
digital painting, painterly HoMM town-screen style,
each building isolated on its plot, slight 3/4 aerial view,
architectural identity: muted heroic fantasy palette matching the faction lore,
soft directional light from upper-left,
each subject centered in its own cell, not touching cell edges,
clear spacing between cells,
IMPORTANT: keep every subject fully inside its cell with generous empty margin all around — fully spread wings, weapons, staves and all extremities must NOT be cropped or touch any edge; zoom each subject out enough that nothing is clipped,
cell 1: "Dwelling: Lucine (fr: Habitation : Lucine)" — the dwelling where "Lucine" creatures are recruited
cell 2: "Dwelling: Sylvan Archer (fr: Habitation : Archer Sylvestre)" — the dwelling where "Sylvan Archer (fr: Archer Sylvestre)" creatures are recruited
cell 3: "Dwelling: Dryad (fr: Habitation : Dryade)" — the dwelling where "Dryad (fr: Dryade)" creatures are recruited
cell 4: "Dwelling: Silver Wolf (fr: Habitation : Loup d'Argent)" — the dwelling where "Silver Wolf (fr: Loup d'Argent)" creatures are recruited
cell 5: "Dwelling: Unicorn (fr: Habitation : Licorne)" — the dwelling where "Unicorn (fr: Licorne)" creatures are recruited
cell 6: "Dwelling: Treant (fr: Habitation : Tréant)" — the dwelling where "Treant (fr: Tréant)" creatures are recruited
cell 7: "Dwelling: Elder of the Wood (fr: Habitation : Aïeul de la Forêt)" — the dwelling where "Elder of the Wood (fr: Aïeul de la Forêt)" creatures are recruited
cell 8: "Heart Grove (fr: Bosquet du Cœur)" — a faction-specific town building
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no decorative sparkles, no star glints, no lens flare
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 4 --rows 2 --side 512 \
  --ids sylvan-court-dwelling-t1,sylvan-court-dwelling-t2,sylvan-court-dwelling-t3,sylvan-court-dwelling-t4,sylvan-court-dwelling-t5,sylvan-court-dwelling-t6,sylvan-court-dwelling-t7,sylvan-court-heart-grove \
  --out assets/raster_src --qc /tmp/qc-buildings-sylvan-court-p1.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/buildings/sylvan-court/`.
