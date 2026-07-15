# Planche — unités dungeon (T1→T7) — planche 1/2

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle A (sprites 512² painterly, alpha strict après extraction) de `docs/12-assets-style-guide.md`. Grille **4×2**,
> ordre row-major. Planche cible ≥ 2048×1024 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Character sheet, 8 fantasy creatures of the same army in a 4x2 grid,
digital painting, heroic fantasy concept art style
(Heroes of Might and Magic, MTG illustration quality), painterly brush strokes,
dynamic action pose, 3/4 view, soft directional light from upper-left,
army visual identity: dark violet and black, obsidian stone and cold silver, arcane magenta glow, coiled-serpent motifs, dark-elf sorcery, subterranean cavern ambiance,
clear power progression from cell 1 (weakest) to the last cell (mightiest),
each subject centered in its own cell, not touching cell edges,
clear spacing between cells,
IMPORTANT: keep every subject fully inside its cell with generous empty margin all around — fully spread wings, weapons, staves and all extremities must NOT be cropped or touch any edge; zoom each subject out enough that nothing is clipped,
cell 1: tier 1 unit "Scout (fr: Éclaireur)" — aiming a ranged weapon, steady stance
cell 2: tier 2 unit "Blood Fury (fr: Furie sanglante)" — swift and agile
cell 3: tier 3 unit "Minotaur (fr: Minotaure)" — steady stance
cell 4: tier 4 unit "Dark Raider (fr: Chevaucheur des ténèbres)" — charging forward, swift and agile
cell 5: tier 5 unit "Shadow Witch (fr: Sorcière d'ombre)" — swift and agile
cell 6: tier 6 unit "Hydra (fr: Hydre)" — steady stance
cell 7: tier 7 unit "Shadow Dragon (fr: Dragon d'ombre)" — large spread wings, airborne pose, swift and agile
cell 8: tier 1 unit "Assassin" — aiming a ranged weapon, swift and agile
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no decorative sparkles, no star glints, no lens flare
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 4 --rows 2 --side 512 \
  --ids t1-eclaireur,t2-furie-sanglante,t3-minotaure,t4-chevaucheur-tenebres,t5-sorciere-ombre,t6-hydre,t7-dragon-ombre,t1-eclaireur-elite \
  --out assets/raster_src --qc /tmp/qc-units-dungeon-p1.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/units/dungeon/`.
