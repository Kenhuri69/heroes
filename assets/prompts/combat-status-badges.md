# Planche — badges d'effet de combat (famille S, phase 2 LLM)

> Rédigée à la main pour la **famille S** (sorts/effets/murs/invocations) — PAS
> générée par `gen_prompts.py` (famille non couverte). Règle **S** de
> `docs/12-assets-style-guide.md` ; phase 1 procédurale livrée par
> `tools/assets/gen_spell_assets.py`, phase 2 = montée en fidélité (art seul,
> **mêmes clés de fichier** ⇒ substitution par simple dépôt de PNG).
> Grille **7×1**, ordre row-major. Planche cible ≥ 1792×256 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Icon sheet, 7 combat status-effect badges in a 7x1 row,
digital painting, clean bold game-UI badge style, crisp and readable at 16px,
each badge a small circular token with a thick dark rim and one clear central pictogram,
soft top-left light, high contrast pictogram over a solid coloured disc,
each subject centered in its own cell, not touching cell edges, clear spacing between cells,
IMPORTANT: keep every badge fully inside its cell with generous margin — nothing cropped or touching an edge,
cell 1: "status-buff" — a emerald-green circular status token badge showing an ascending upward arrow (blessing)
cell 2: "status-debuff" — a violet-purple circular status token badge showing a descending downward arrow (weakening)
cell 3: "status-silence" — a slate-grey circular status token badge showing a crossed-out sealed circle (mute)
cell 4: "status-poison" — a sickly toxic-green circular status token badge showing a venom droplet with a faint skull (poison)
cell 5: "status-mark" — a danger-red circular status token badge showing a targeting reticle / crosshair (the Mark)
cell 6: "status-immobilized" — a iron-brown circular status token badge showing two chain links / a shackle (rooted)
cell 7: "status-stealth" — a shadow-blue circular status token badge showing a veiled half-closed eye (concealment)
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 7 --rows 1 --side 256 \
  --ids status-buff,status-debuff,status-silence,status-poison,status-mark,status-immobilized,status-stealth \
  --out assets/raster_src --qc /tmp/qc-status-badges.png
```

Puis copier vers `assets/ui/`, **puis mipmaps** (section suivante).

## Post-traitement — mipmaps (`statusIconUrl` : `ui/status-<name>_<32|24|16>`)

```bash
python3 - <<'EOF'
from PIL import Image
from pathlib import Path
for p in Path('assets/ui').glob('status-*.png'):
    if any(p.stem.endswith('_%d' % s) for s in (32,24,16)):
        continue
    img = Image.open(p).convert('RGBA')
    for s in (32,24,16):
        img.resize((s,s), Image.LANCZOS).save(p.with_name('%s_%d.png' % (p.stem, s)), optimize=True)
    p.unlink()
EOF
```
