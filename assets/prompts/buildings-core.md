# Planche — bâtiments communs de ville

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle C (planche de vignettes, fond gris clair plat) de `docs/12-assets-style-guide.md`. Grille **4×2**,
> ordre row-major. Planche cible ≥ 2048×1024 px.

## Prompt (à coller dans le LLM image)

```
Building sheet, 6 medieval fantasy town buildings in a 4x2 grid,
digital painting, painterly HoMM town-screen style,
each building isolated on its plot, slight 3/4 aerial view,
soft directional light from upper-left,
each subject centered in its own cell, not touching cell edges,
clear spacing between cells,
cell 1: "Town Hall (fr: Hôtel de ville)" — a stately town hall with a clock tower
cell 2: "Fort" — a fortified keep with battlements
cell 3: "Mage Guild (fr: Guilde des mages)" — a wizard tower with a glowing observatory
cell 4: "Market (fr: Marché)" — a bustling covered market stall
cell 5: "Tavern (fr: Taverne)" — a cosy timber tavern with a hanging sign
cell 6: "Forge" — a smithy with a glowing furnace and anvil
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 4 --rows 2 --side 512 \
  --ids townHall,fort,mageGuild,market,tavern,forge \
  --out assets/raster_src --qc /tmp/qc-buildings-core.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/buildings/core/`.
