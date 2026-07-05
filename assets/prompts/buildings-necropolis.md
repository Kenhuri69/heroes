# Planche — bâtiments necropolis

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle C (planche de vignettes, fond gris clair plat) de `docs/12-assets-style-guide.md`. Grille **4×2**,
> ordre row-major. Planche cible ≥ 2048×1024 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Building sheet, 7 fantasy dwellings of the same town in a 4x2 grid,
digital painting, painterly HoMM town-screen style,
each building isolated on its plot, slight 3/4 aerial view,
architectural identity: bone white, ash grey and black, necrotic green glow, tattered cloth, spectral mist,
soft directional light from upper-left,
each subject centered in its own cell, not touching cell edges,
clear spacing between cells,
cell 1: "necropolis dwelling t1" — the dwelling where "Skeleton (fr: Squelette)" creatures are recruited
cell 2: "necropolis dwelling t2" — the dwelling where "Rotting Zombie (fr: Zombie putride)" creatures are recruited
cell 3: "necropolis dwelling t3" — the dwelling where "Spectre" creatures are recruited
cell 4: "necropolis dwelling t4" — the dwelling where "Vampire" creatures are recruited
cell 5: "necropolis dwelling t5" — the dwelling where "Lich (fr: Liche)" creatures are recruited
cell 6: "necropolis dwelling t6" — the dwelling where "Doom Knight (fr: Cavalier funeste)" creatures are recruited
cell 7: "necropolis dwelling t7" — the dwelling where "Bone Dragon (fr: Dragon d'os)" creatures are recruited
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 4 --rows 2 --side 512 \
  --ids necropolis-dwelling-t1,necropolis-dwelling-t2,necropolis-dwelling-t3,necropolis-dwelling-t4,necropolis-dwelling-t5,necropolis-dwelling-t6,necropolis-dwelling-t7 \
  --out assets/raster_src --qc /tmp/qc-buildings-necropolis.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/buildings/necropolis/`.
