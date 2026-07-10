# Planche — jetons de héros sur la carte (montés, par faction)

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle A (sprites 512² painterly, alpha strict après extraction) de `docs/12-assets-style-guide.md`. Grille **4×2**,
> ordre row-major. Planche cible ≥ 2048×1024 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Character sheet, 5 mounted fantasy heroes of different armies in a 4x2 grid,
digital painting, heroic fantasy concept art style
(Heroes of Might and Magic, MTG illustration quality), painterly brush strokes,
each hero mounted on a steed, dynamic 3/4 view riding pose,
soft directional light from upper-left,
readable as a small map token at 64px tall,
each subject centered in its own cell, not touching cell edges,
clear spacing between cells,
IMPORTANT: keep every subject fully inside its cell with generous empty margin all around — fully spread wings, weapons, staves and all extremities must NOT be cropped or touch any edge; zoom each subject out enough that nothing is clipped,
cell 1: a heroic mounted commander of the haven faction riding a caparisoned steed, banner or cloak flowing — off-white and light steel armor, sky-blue cloth, gold accents, holy light ambiance
cell 2: a heroic mounted commander of the arcane-hunters faction riding a caparisoned steed, banner or cloak flowing — midnight blue and arcane violet, silver trim, glowing cyan runes, hunter gear
cell 3: a heroic mounted commander of the necropolis faction riding a caparisoned steed, banner or cloak flowing — bone white, ash grey and black, necrotic green glow, tattered cloth, spectral mist
cell 4: a heroic mounted commander of the sylvan-court faction riding a caparisoned steed, banner or cloak flowing — muted heroic fantasy palette matching the faction lore
cell 5: a heroic mounted commander of the vox-arcana faction riding a caparisoned steed, banner or cloak flowing — black gothic stone with silver/gold filigree, electric cyan and neon magenta, wisteria violet, Korean oni/pagoda accents, concert neon lanterns
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no decorative sparkles, no star glints, no lens flare
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 4 --rows 2 --side 512 \
  --ids hero-haven,hero-arcane-hunters,hero-necropolis,hero-sylvan-court,hero-vox-arcana \
  --out assets/raster_src --qc /tmp/qc-map-heroes.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/map/`.
