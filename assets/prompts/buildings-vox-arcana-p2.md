# Planche — bâtiments vox-arcana — planche 2/2

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle C (planche de vignettes, fond gris clair plat) de `docs/12-assets-style-guide.md`. Grille **4×2**,
> ordre row-major. Planche cible ≥ 2048×1024 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Building sheet, 5 fantasy dwellings of the same town in a 4x2 grid,
digital painting, painterly HoMM town-screen style,
each building isolated on its plot, slight 3/4 aerial view,
architectural identity: black gothic stone with silver/gold filigree, electric cyan and neon magenta, wisteria violet, Korean oni/pagoda accents, concert neon lanterns,
soft directional light from upper-left,
each subject centered in its own cell, not touching cell edges,
clear spacing between cells,
IMPORTANT: keep every subject fully inside its cell with generous empty margin all around — fully spread wings, weapons, staves and all extremities must NOT be cropped or touch any edge; zoom each subject out enough that nothing is clipped,
cell 1: "The Sorting Hat: House of the Lion (fr: Le Choixpeau : Maison du Lion)" — a faction-specific town building
cell 2: "The Sorting Hat: House of the Serpent (fr: Le Choixpeau : Maison du Serpent)" — a faction-specific town building
cell 3: "The Sorting Hat: House of the Eagle (fr: Le Choixpeau : Maison de l'Aigle)" — a faction-specific town building
cell 4: "The Sorting Hat: House of the Badger (fr: Le Choixpeau : Maison du Blaireau)" — a faction-specific town building
cell 5: "The Sorting Hat: House Venari (fr: Le Choixpeau : Maison Venari)" — a faction-specific town building
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no decorative sparkles, no star glints, no lens flare
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 4 --rows 2 --side 512 \
  --ids vox-arcana-house-lion,vox-arcana-house-serpent,vox-arcana-house-eagle,vox-arcana-house-badger,vox-arcana-house-venari \
  --out assets/raster_src --qc /tmp/qc-buildings-vox-arcana-p2.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/buildings/vox-arcana/`.
