# Planche — structures & objets de la carte (villes + objets) — planche 1/2

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle C (planche de vignettes, fond gris clair plat) de `docs/12-assets-style-guide.md`. Grille **4×2**,
> ordre row-major. Planche cible ≥ 2048×1024 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Item sheet, 8 fantasy map structures and objects in a 4x2 grid,
digital painting, painterly MTG illustration quality,
rich material detail (stone, timber, iron, cloth),
soft directional light from upper-left,
readable as a small map icon at 64px tall,
each subject centered in its own cell, not touching cell edges,
clear spacing between cells,
IMPORTANT: keep every subject fully inside its cell with generous empty margin all around — fully spread wings, weapons, staves and all extremities must NOT be cropped or touch any edge; zoom each subject out enough that nothing is clipped,
cell 1: a grand haven faction castle-town seen in slight 3/4 aerial view, walls, towers and keep — architecture identity: off-white and light steel armor, sky-blue cloth, gold accents, holy light ambiance
cell 2: a grand arcane-hunters faction castle-town seen in slight 3/4 aerial view, walls, towers and keep — architecture identity: midnight blue and arcane violet, silver trim, glowing cyan runes, hunter gear
cell 3: a grand necropolis faction castle-town seen in slight 3/4 aerial view, walls, towers and keep — architecture identity: bone white, ash grey and black, necrotic green glow, tattered cloth, spectral mist
cell 4: a grand sylvan-court faction castle-town seen in slight 3/4 aerial view, walls, towers and keep — architecture identity: muted heroic fantasy palette matching the faction lore
cell 5: a grand vox-arcana faction castle-town seen in slight 3/4 aerial view, walls, towers and keep — architecture identity: black gothic stone with silver/gold filigree, electric cyan and neon magenta, wisteria violet, Korean oni/pagoda accents, concert neon lanterns
cell 6: a grand dungeon faction castle-town seen in slight 3/4 aerial view, walls, towers and keep — architecture identity: muted heroic fantasy palette matching the faction lore
cell 7: a closed wooden treasure chest bound with iron and gold, faint gold glint at the lid seam
cell 8: a small recruitment war-camp: a peaked tent with a pennant and a low campfire
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no decorative sparkles, no star glints, no lens flare
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 4 --rows 2 --side 512 \
  --ids town-haven,town-arcane-hunters,town-necropolis,town-sylvan-court,town-vox-arcana,town-dungeon,chest,camp \
  --out assets/raster_src --qc /tmp/qc-map-props-p1.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/map/`.
