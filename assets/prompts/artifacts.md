# Planche — icônes d'artefacts

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle C (planche d'icônes, fond gris clair plat) de `docs/12-assets-style-guide.md`. Grille **4×1**,
> ordre row-major. Planche cible ≥ 2048×512 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Item sheet, 4 magical fantasy artifacts in a 4x1 grid,
digital painting, painterly MTG illustration quality,
rich material detail (metal, leather, gem, parchment),
soft directional light from upper-left,
each subject centered in its own cell, not touching cell edges,
clear spacing between cells,
cell 1: "Sharpened Blade (fr: Lame aiguisée)" — an offensive weapon-like relic (+2 attack)
cell 2: "Stone Aegis (fr: Égide de pierre)" — a protective relic (shield, aegis, bracer) (+2 defense)
cell 3: "Orb of Knowledge (fr: Orbe de savoir)" — a scholarly relic (orb, tome, circlet) (+2 knowledge)
cell 4: "Lucky Clover (fr: Trèfle de chance)" — a lucky charm relic (+1 luck)
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 4 --rows 1 --side 512 \
  --ids lame-aiguisee,egide-de-pierre,orbe-de-savoir,trefle-chance \
  --out assets/raster_src --qc /tmp/qc-artifacts.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/artifacts/`.
