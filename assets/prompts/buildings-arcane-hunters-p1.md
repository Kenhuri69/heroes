# Planche — bâtiments arcane-hunters — planche 1/2

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle C (planche de vignettes, fond gris clair plat) de `docs/12-assets-style-guide.md`. Grille **4×2**,
> ordre row-major. Planche cible ≥ 2048×1024 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Building sheet, 8 fantasy dwellings of the same town in a 4x2 grid,
digital painting, painterly HoMM town-screen style,
each building isolated on its plot, slight 3/4 aerial view,
architectural identity: midnight blue and arcane violet, silver trim, glowing cyan runes, hunter gear,
soft directional light from upper-left,
each subject centered in its own cell, not touching cell edges,
clear spacing between cells,
IMPORTANT: keep every subject fully inside its cell with generous empty margin all around — fully spread wings, weapons, staves and all extremities must NOT be cropped or touch any edge; zoom each subject out enough that nothing is clipped,
cell 1: "Duskwatch Pupil dwelling (fr: Habitation : Élève de Sombreveille)" — the dwelling where "Duskwatch Pupil (fr: Élève de Sombreveille)" creatures are recruited
cell 2: "Bound Familiar dwelling (fr: Habitation : Familier lié)" — the dwelling where "Bound Familiar (fr: Familier lié)" creatures are recruited
cell 3: "Circle Prefect dwelling (fr: Habitation : Préfet de Cercle)" — the dwelling where "Circle Prefect (fr: Préfet de Cercle)" creatures are recruited
cell 4: "Wandering Librarian dwelling (fr: Habitation : Bibliothécaire Errant)" — the dwelling where "Wandering Librarian (fr: Bibliothécaire Errant)" creatures are recruited
cell 5: "Oathbound Blade dwelling (fr: Habitation : Lame du Serment)" — the dwelling where "Oathbound Blade (fr: Lame du Serment)" creatures are recruited
cell 6: "Abyss Huntress dwelling (fr: Habitation : Chasseresse de l'Abîme)" — the dwelling where "Abyss Huntress (fr: Chasseresse de l'Abîme)" creatures are recruited
cell 7: "Trained Manticore dwelling (fr: Habitation : Manticore de Dressage)" — the dwelling where "Trained Manticore (fr: Manticore de Dressage)" creatures are recruited
cell 8: "Demonic Penitent dwelling (fr: Habitation : Pénitent Démonique)" — the dwelling where "Demonic Penitent (fr: Pénitent Démonique)" creatures are recruited
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 4 --rows 2 --side 512 \
  --ids arcane-hunters-dwelling-t1,arcane-hunters-dwelling-t2,arcane-hunters-dwelling-t3,arcane-hunters-dwelling-t4,arcane-hunters-dwelling-t5,arcane-hunters-dwelling-t6,arcane-hunters-dwelling-t7,arcane-hunters-dwelling-t8 \
  --out assets/raster_src --qc /tmp/qc-buildings-arcane-hunters-p1.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/buildings/arcane-hunters/`.
