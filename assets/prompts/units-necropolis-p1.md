# Planche — unités necropolis (T1→T7) — planche 1/2

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle A (sprites 512² painterly, alpha strict après extraction) de `docs/12-assets-style-guide.md`. Grille **4×2**,
> ordre row-major. Planche cible ≥ 2048×1024 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Character sheet, 8 fantasy creatures of the same army in a 4x2 grid,
digital painting, heroic fantasy concept art style
(Heroes of Might and Magic, MTG illustration quality), painterly brush strokes,
dynamic action pose, 3/4 view, soft directional light from upper-left,
army visual identity: bone white, ash grey and black, necrotic green glow, tattered cloth, spectral mist,
clear power progression from cell 1 (weakest) to the last cell (mightiest),
each subject centered in its own cell, not touching cell edges,
clear spacing between cells,
IMPORTANT: keep every subject fully inside its cell with generous empty margin all around — fully spread wings, weapons, staves and all extremities must NOT be cropped or touch any edge; zoom each subject out enough that nothing is clipped,
cell 1: tier 1 unit "Skeleton (fr: Squelette)" — unmistakably undead, slow and massive
cell 2: tier 2 unit "Rotting Zombie (fr: Zombie putride)" — unmistakably undead, slow and massive
cell 3: tier 3 unit "Spectre" — unmistakably undead, large spread wings, airborne pose, swift and agile
cell 4: tier 4 unit "Vampire" — unmistakably undead, steady stance
cell 5: tier 5 unit "Lich (fr: Liche)" — unmistakably undead, aiming a ranged weapon, steady stance
cell 6: tier 6 unit "Doom Knight (fr: Cavalier funeste)" — unmistakably undead, charging forward, swift and agile
cell 7: tier 7 unit "Bone Dragon (fr: Dragon d'os)" — unmistakably undead, large spread wings, airborne pose, swift and agile
cell 8: tier 1 unit "Skeleton Warrior (fr: Squelette guerrier)" — unmistakably undead, steady stance
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no decorative sparkles, no star glints, no lens flare
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 4 --rows 2 --side 512 \
  --ids t1-squelette,t2-zombie,t3-spectre,t4-vampire,t5-liche,t6-cavalier-funeste,t7-dragon-os,t1-squelette-elite \
  --out assets/raster_src --qc /tmp/qc-units-necropolis-p1.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/units/necropolis/`.
