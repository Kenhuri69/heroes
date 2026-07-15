# Planche — bâtiments dungeon

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle C (planche de vignettes, fond gris clair plat) de `docs/12-assets-style-guide.md`. Grille **4×2**,
> ordre row-major. Planche cible ≥ 2048×1024 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Building sheet, 8 fantasy dwellings of the same town in a 4x2 grid,
digital painting, painterly HoMM town-screen style,
each building isolated on its plot, slight 3/4 aerial view,
architectural identity: dark violet and black, obsidian stone and cold silver, arcane magenta glow, coiled-serpent motifs, dark-elf sorcery, subterranean cavern ambiance,
soft directional light from upper-left,
each subject centered in its own cell, not touching cell edges,
clear spacing between cells,
IMPORTANT: keep every subject fully inside its cell with generous empty margin all around — fully spread wings, weapons, staves and all extremities must NOT be cropped or touch any edge; zoom each subject out enough that nothing is clipped,
cell 1: "Scouts' Lair (fr: Antre des éclaireurs)" — the dwelling where "Scout (fr: Éclaireur)" creatures are recruited
cell 2: "Blood Arena (fr: Arène sanglante)" — the dwelling where "Blood Fury (fr: Furie sanglante)" creatures are recruited
cell 3: "Labyrinth (fr: Labyrinthe)" — the dwelling where "Minotaur (fr: Minotaure)" creatures are recruited
cell 4: "Underground Stables (fr: Écuries souterraines)" — the dwelling where "Dark Raider (fr: Chevaucheur des ténèbres)" creatures are recruited
cell 5: "Witches' Circle (fr: Cercle des sorcières)" — the dwelling where "Shadow Witch (fr: Sorcière d'ombre)" creatures are recruited
cell 6: "Hydra Pit (fr: Fosse aux hydres)" — the dwelling where "Hydra (fr: Hydre)" creatures are recruited
cell 7: "Dragon Cavern (fr: Caverne des dragons)" — the dwelling where "Shadow Dragon (fr: Dragon d'ombre)" creatures are recruited
cell 8: "Cursed Well (fr: Puits de Malédiction)" — a faction-specific town building
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no decorative sparkles, no star glints, no lens flare
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 4 --rows 2 --side 512 \
  --ids dungeon-dwelling-t1,dungeon-dwelling-t2,dungeon-dwelling-t3,dungeon-dwelling-t4,dungeon-dwelling-t5,dungeon-dwelling-t6,dungeon-dwelling-t7,dungeon-cursed-well \
  --out assets/raster_src --qc /tmp/qc-buildings-dungeon.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/buildings/dungeon/`.
