# Planche — unités arcane-hunters (T1→T8) — planche 1/2

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle A (sprites 512² painterly, alpha strict après extraction) de `docs/12-assets-style-guide.md`. Grille **4×2**,
> ordre row-major. Planche cible ≥ 2048×1024 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Character sheet, 8 fantasy creatures of the same army in a 4x2 grid,
digital painting, heroic fantasy concept art style
(Heroes of Might and Magic, MTG illustration quality), painterly brush strokes,
dynamic action pose, 3/4 view, soft directional light from upper-left,
army visual identity: midnight blue and arcane violet, silver trim, glowing cyan runes, hunter gear,
clear power progression from cell 1 (weakest) to the last cell (mightiest),
each subject centered in its own cell, not touching cell edges,
clear spacing between cells,
IMPORTANT: keep every subject fully inside its cell with generous empty margin all around — fully spread wings, weapons, staves and all extremities must NOT be cropped or touch any edge; zoom each subject out enough that nothing is clipped,
cell 1: tier 1 unit "Duskwatch Pupil (fr: Élève de Sombreveille)" — steady stance
cell 2: tier 2 unit "Bound Familiar (fr: Familier lié)" — large spread wings, airborne pose, swift and agile
cell 3: tier 3 unit "Circle Prefect (fr: Préfet de Cercle)" — aiming a ranged weapon, steady stance
cell 4: tier 4 unit "Wandering Librarian (fr: Bibliothécaire Errant)" — slow and massive
cell 5: tier 5 unit "Oathbound Blade (fr: Lame du Serment)" — swift and agile
cell 6: tier 6 unit "Abyss Huntress (fr: Chasseresse de l'Abîme)" — aiming a ranged weapon, swift and agile
cell 7: tier 7 unit "Trained Manticore (fr: Manticore de Dressage)" — large spread wings, airborne pose, swift and agile
cell 8: tier 8 unit "Demonic Penitent (fr: Pénitent Démonique)" — swift and agile
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no decorative sparkles, no star glints, no lens flare
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 4 --rows 2 --side 512 \
  --ids t1-eleve,t2-familier,t3-prefet,t4-bibliothecaire,t5-lame,t6-chasseresse,t7-manticore,t8-penitent \
  --out assets/raster_src --qc /tmp/qc-units-arcane-hunters-p1.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/units/arcane-hunters/`.
