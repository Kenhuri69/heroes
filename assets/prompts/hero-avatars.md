# Planche — avatars de héros (archétypes par faction)

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle B (bustes painterly 256²) de `docs/12-assets-style-guide.md`. Grille **4×2**,
> ordre row-major. Planche cible ≥ 2048×1024 px.

## Prompt (à coller dans le LLM image)

```
Portrait sheet, 6 heroic fantasy bust portraits in a 4x2 grid,
painterly digital painting (Heroes of Might and Magic style), NOT photorealistic,
bust shot, 3/4 face turn, determined expression,
warm key light upper-left, cool rim light,
each bust over a soft dark faction-themed backdrop kept INSIDE its cell,
each subject centered in its own cell, not touching cell edges,
clear spacing between cells,
cell 1: a battle-hardened might hero, armored commander of the haven faction — off-white and light steel armor, sky-blue cloth, gold accents, holy light ambiance
cell 2: a wise magic hero, robed spellcaster of the haven faction — off-white and light steel armor, sky-blue cloth, gold accents, holy light ambiance
cell 3: a battle-hardened might hero, armored commander of the arcane-hunters faction — midnight blue and arcane violet, silver trim, glowing cyan runes, hunter gear
cell 4: a wise magic hero, robed spellcaster of the arcane-hunters faction — midnight blue and arcane violet, silver trim, glowing cyan runes, hunter gear
cell 5: a battle-hardened might hero, armored commander of the necropolis faction — bone white, ash grey and black, necrotic green glow, tattered cloth, spectral mist
cell 6: a wise magic hero, robed spellcaster of the necropolis faction — bone white, ash grey and black, necrotic green glow, tattered cloth, spectral mist
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 4 --rows 2 --side 256 \
  --ids haven-might,haven-magic,arcane-hunters-might,arcane-hunters-magic,necropolis-might,necropolis-magic \
  --out assets/raster_src --qc /tmp/qc-hero-avatars.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/heroes/`.
