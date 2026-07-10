# Planche — unités arcane-hunters (T1→T8) — planche 2/2

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
cell 1: tier 1 unit "Duskwatch Graduate (fr: Diplômé de Sombreveille)" — steady stance
cell 2: tier 2 unit "Elder Familiar (fr: Familier Aîné)" — large spread wings, airborne pose, swift and agile
cell 3: tier 3 unit "High Prefect (fr: Grand Préfet)" — aiming a ranged weapon, steady stance
cell 4: tier 4 unit "Living Archivist (fr: Archiviste Vivant)" — steady stance
cell 5: tier 5 unit "Consecrated Blade (fr: Lame Consacrée)" — swift and agile
cell 6: tier 6 unit "Abyss Tracker (fr: Traqueuse de l'Abîme)" — aiming a ranged weapon, swift and agile
cell 7: tier 7 unit "Royal Manticore (fr: Manticore Royale)" — large spread wings, airborne pose, swift and agile
cell 8: tier 8 unit "Damned Penitent (fr: Pénitent Damné)" — swift and agile
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no decorative sparkles, no star glints, no lens flare
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 4 --rows 2 --side 512 \
  --ids t1-eleve-elite,t2-familier-elite,t3-prefet-elite,t4-bibliothecaire-elite,t5-lame-elite,t6-chasseresse-elite,t7-manticore-elite,t8-penitent-elite \
  --out assets/raster_src --qc /tmp/qc-units-arcane-hunters-p2.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/units/arcane-hunters/`.
