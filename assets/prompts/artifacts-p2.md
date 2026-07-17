# Planche — icônes d'artefacts — planche 2/2

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle C (planche d'icônes, fond gris clair plat) de `docs/12-assets-style-guide.md`. Grille **3×1**,
> ordre row-major. Planche cible ≥ 1536×512 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Item sheet, 3 magical fantasy artifacts in a 3x1 grid,
digital painting, painterly MTG illustration quality,
rich material detail (metal, leather, gem, parchment),
soft directional light from upper-left,
each subject centered in its own cell, not touching cell edges,
clear spacing between cells,
IMPORTANT: keep every subject fully inside its cell with generous empty margin all around — fully spread wings, weapons, staves and all extremities must NOT be cropped or touch any edge; zoom each subject out enough that nothing is clipped,
cell 1: "Cloak of Denial (fr: Cape du refus)" — a scholarly relic (orb, tome, circlet) (+1 knowledge)
cell 2: "Talisman of Constancy (fr: Talisman de constance)" — a protective relic (shield, aegis, bracer) (+1 defense)
cell 3: "Seal of the Untouchable (fr: Sceau de l’intouchable)" — a relic crackling with raw magic (+1 power)
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no decorative sparkles, no star glints, no lens flare
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 3 --rows 1 --side 512 \
  --ids cape-du-refus,talisman-de-constance,sceau-de-l-intouchable \
  --out assets/raster_src --qc /tmp/qc-artifacts-p2.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/artifacts/`.
