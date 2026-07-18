# Planche — machines de guerre de SOUTIEN (S5a, tente & chariot)

> Rédigée à la main (complément du `war-machines.md` généré, qui ne couvre que
> baliste/catapulte/tour de tir). Deux machines de soutien manquantes ⇒ en
> pré-combat leur vignette est une case vide, en bataille un fanion rouge
> générique (audit doc 19 §2.5). Mêmes clés de fichier `units/core/<id>` ⇒
> substitution par simple dépôt de PNG (le registre auto-découvre, `unitSpriteUrl`
> retombe sur `units/core/<id>`). Règle A (sprites 512² painterly, alpha strict)
> de `docs/12-assets-style-guide.md`. Grille **2×1**, planche ≥ 1024×512 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Character sheet, 2 medieval fantasy support war machines in a 2x1 grid,
digital painting, heroic fantasy concept art style
(Heroes of Might and Magic, MTG illustration quality), painterly brush strokes,
mechanical/rigged constructs of timber, canvas, iron and rope, NOT living creatures,
3/4 view, deployed-on-battlefield stance, soft directional light from upper-left,
neutral weathered wood-canvas-and-iron palette, no faction heraldry,
each subject centered in its own cell, not touching cell edges, clear spacing between cells,
IMPORTANT: keep every subject fully inside its cell with generous empty margin all around — poles, canvas and all extremities must NOT be cropped or touch any edge; zoom each subject out enough that nothing is clipped,
cell 1: "First Aid Tent (fr: Tente de premiers soins)" — a small deployed field-medic canvas tent on a light wooden frame, open flap revealing bandages and healing supplies, a red-cross-free neutral banner pennant, planted stakes (immobile support machine)
cell 2: "Ammo Cart (fr: Chariot de munitions)" — a sturdy two-wheeled supply wagon loaded with stacked crates, bundled arrows/bolts and powder barrels under a tied canvas cover, parked with a brake chock (immobile support machine)
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no decorative sparkles, no star glints, no lens flare
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 2 --rows 1 --side 512 \
  --ids first-aid-tent,ammo-cart \
  --out assets/raster_src --qc /tmp/qc-war-machines-support.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/units/core/`
(`first-aid-tent.png`, `ammo-cart.png`). Aucun code à changer.
