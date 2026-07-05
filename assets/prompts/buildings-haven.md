# Planche — bâtiments haven

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle C (planche de vignettes, fond gris clair plat) de `docs/12-assets-style-guide.md`. Grille **4×2**,
> ordre row-major. Planche cible ≥ 2048×1024 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Building sheet, 7 fantasy dwellings of the same town in a 4x2 grid,
digital painting, painterly HoMM town-screen style,
each building isolated on its plot, slight 3/4 aerial view,
architectural identity: off-white and light steel armor, sky-blue cloth, gold accents, holy light ambiance,
soft directional light from upper-left,
each subject centered in its own cell, not touching cell edges,
clear spacing between cells,
IMPORTANT: keep every subject fully inside its cell with generous empty margin all around — fully spread wings, weapons, staves and all extremities must NOT be cropped or touch any edge; zoom each subject out enough that nothing is clipped,
cell 1: "Conscript dwelling (fr: Habitation : Conscrit)" — the dwelling where "Conscript (fr: Conscrit)" creatures are recruited
cell 2: "Archer dwelling (fr: Habitation : Archer)" — the dwelling where "Archer" creatures are recruited
cell 3: "Blade Brother dwelling (fr: Habitation : Frère-Lame)" — the dwelling where "Blade Brother (fr: Frère-Lame)" creatures are recruited
cell 4: "Griffin dwelling (fr: Habitation : Griffon)" — the dwelling where "Griffin (fr: Griffon)" creatures are recruited
cell 5: "Priestess dwelling (fr: Habitation : Prêtresse)" — the dwelling where "Priestess (fr: Prêtresse)" creatures are recruited
cell 6: "Griffin Knight dwelling (fr: Habitation : Chevalier du Griffon)" — the dwelling where "Griffin Knight (fr: Chevalier du Griffon)" creatures are recruited
cell 7: "Angel dwelling (fr: Habitation : Ange)" — the dwelling where "Angel (fr: Ange)" creatures are recruited
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 4 --rows 2 --side 512 \
  --ids haven-dwelling-t1,haven-dwelling-t2,haven-dwelling-t3,haven-dwelling-t4,haven-dwelling-t5,haven-dwelling-t6,haven-dwelling-t7 \
  --out assets/raster_src --qc /tmp/qc-buildings-haven.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/buildings/haven/`.
