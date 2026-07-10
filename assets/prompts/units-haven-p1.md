# Planche — unités haven (T1→T7) — planche 1/2

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle A (sprites 512² painterly, alpha strict après extraction) de `docs/12-assets-style-guide.md`. Grille **4×2**,
> ordre row-major. Planche cible ≥ 2048×1024 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Character sheet, 8 fantasy creatures of the same army in a 4x2 grid,
digital painting, heroic fantasy concept art style
(Heroes of Might and Magic, MTG illustration quality), painterly brush strokes,
dynamic action pose, 3/4 view, soft directional light from upper-left,
army visual identity: off-white and light steel armor, sky-blue cloth, gold accents, holy light ambiance,
clear power progression from cell 1 (weakest) to the last cell (mightiest),
each subject centered in its own cell, not touching cell edges,
clear spacing between cells,
IMPORTANT: keep every subject fully inside its cell with generous empty margin all around — fully spread wings, weapons, staves and all extremities must NOT be cropped or touch any edge; zoom each subject out enough that nothing is clipped,
cell 1: tier 1 unit "Conscript (fr: Conscrit)" — slow and massive
cell 2: tier 2 unit "Archer" — aiming a ranged weapon, slow and massive
cell 3: tier 3 unit "Blade Brother (fr: Frère-Lame)" — steady stance
cell 4: tier 4 unit "Griffin (fr: Griffon)" — large spread wings, airborne pose, swift and agile
cell 5: tier 5 unit "Priestess (fr: Prêtresse)" — aiming a ranged weapon, steady stance
cell 6: tier 6 unit "Griffin Knight (fr: Chevalier du Griffon)" — swift and agile
cell 7: tier 7 unit "Angel (fr: Ange)" — large spread wings, airborne pose, swift and agile
cell 8: tier 1 unit "Halberdier (fr: Hallebardier)" — steady stance
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no decorative sparkles, no star glints, no lens flare
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 4 --rows 2 --side 512 \
  --ids t1-conscrit,t2-archer,t3-frere-lame,t4-griffon,t5-pretresse,t6-chevalier-griffon,t7-ange,t1-conscrit-elite \
  --out assets/raster_src --qc /tmp/qc-units-haven-p1.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/units/haven/`.
