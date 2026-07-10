# Planche — unités sylvan-court (T1→T7) — planche 2/2

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle A (sprites 512² painterly, alpha strict après extraction) de `docs/12-assets-style-guide.md`. Grille **4×2**,
> ordre row-major. Planche cible ≥ 2048×1024 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Character sheet, 6 fantasy creatures of the same army in a 4x2 grid,
digital painting, heroic fantasy concept art style
(Heroes of Might and Magic, MTG illustration quality), painterly brush strokes,
dynamic action pose, 3/4 view, soft directional light from upper-left,
army visual identity: muted heroic fantasy palette matching the faction lore,
clear power progression from cell 1 (weakest) to the last cell (mightiest),
each subject centered in its own cell, not touching cell edges,
clear spacing between cells,
IMPORTANT: keep every subject fully inside its cell with generous empty margin all around — fully spread wings, weapons, staves and all extremities must NOT be cropped or touch any edge; zoom each subject out enough that nothing is clipped,
cell 1: tier 2 unit "Master Archer (fr: Maître Archer)" — aiming a ranged weapon, steady stance
cell 2: tier 3 unit "Elder Dryad (fr: Dryade Ancienne)" — steady stance
cell 3: tier 4 unit "Spectral Wolf (fr: Loup Spectral)" — swift and agile
cell 4: tier 5 unit "War Unicorn (fr: Licorne de Guerre)" — swift and agile
cell 5: tier 6 unit "Ancient Treant (fr: Tréant Ancestral)" — swift and agile
cell 6: tier 7 unit "Awakened Elder (fr: Aïeul Éveillé)" — swift and agile
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no decorative sparkles, no star glints, no lens flare
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 4 --rows 2 --side 512 \
  --ids t2-archer-sylvestre-elite,t3-dryade-elite,t4-loup-argent-elite,t5-licorne-elite,t6-treant-elite,t7-aieul-elite \
  --out assets/raster_src --qc /tmp/qc-units-sylvan-court-p2.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/units/sylvan-court/`.
