# Planche — icônes de sorts — planche 1/2 (fire/water/earth/air) (famille S, phase 2 LLM)

> Rédigée à la main pour la **famille S** (sorts/effets/murs/invocations) — PAS
> générée par `gen_prompts.py` (famille non couverte). Règle **S** de
> `docs/12-assets-style-guide.md` ; phase 1 procédurale livrée par
> `tools/assets/gen_spell_assets.py`, phase 2 = montée en fidélité (art seul,
> **mêmes clés de fichier** ⇒ substitution par simple dépôt de PNG).
> Grille **4×4**, ordre row-major. Planche cible ≥ 2048×2048 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Icon sheet, 16 fantasy spell rune medallions in a 4x4 grid,
digital painting, painterly MTG illustration quality, crisp readable emblem/sigil design,
each icon a circular arcane medallion / engraved rune, strong silhouette readable at 32px,
soft directional light from upper-left,
colour identifies the magic school, the engraved motif identifies the spell effect,
each subject centered in its own cell, not touching cell edges, clear spacing between cells,
IMPORTANT: keep every emblem fully inside its cell with generous empty margin — nothing cropped or touching an edge,
CRITICAL: render ONLY the artwork — do NOT paint any text, caption, label, letters or numbers anywhere (the quoted "school-kind" strings are internal references, NOT to be drawn); produce EXACTLY 16 medallions, one per grid cell, all the same diameter, no repeated icon, no extra icon, no empty cell,
cell 1: "air-adventure" — pale steel and sky-blue wind spell rune emblem showing a compass-rose / cartographer map
cell 2: "air-buff" — pale steel and sky-blue wind spell rune emblem showing an ascending upward-arrow blessing
cell 3: "air-damage" — pale steel and sky-blue wind spell rune emblem showing a violent blast / jagged bolt
cell 4: "air-debuff" — pale steel and sky-blue wind spell rune emblem showing a descending downward-arrow curse
cell 5: "earth-buff" — amber-brown stone and root spell rune emblem showing an ascending upward-arrow blessing
cell 6: "earth-damage" — amber-brown stone and root spell rune emblem showing a violent blast / jagged bolt
cell 7: "earth-debuff" — amber-brown stone and root spell rune emblem showing a descending downward-arrow curse
cell 8: "earth-resurrectFull" — amber-brown stone and root spell rune emblem showing an ankh / rune of full life
cell 9: "earth-summon" — amber-brown stone and root spell rune emblem showing a summoning circle with an inscribed star
cell 10: "fire-damage" — molten ember-red and orange fire spell rune emblem showing a violent blast / jagged bolt
cell 11: "fire-debuff" — molten ember-red and orange fire spell rune emblem showing a descending downward-arrow curse
cell 12: "water-buff" — azure and frost-blue water spell rune emblem showing an ascending upward-arrow blessing
cell 13: "water-cure" — azure and frost-blue water spell rune emblem showing a cleansing droplet-and-cross
cell 14: "water-damage" — azure and frost-blue water spell rune emblem showing a violent blast / jagged bolt
cell 15: "water-debuff" — azure and frost-blue water spell rune emblem showing a descending downward-arrow curse
cell 16: "water-heal" — azure and frost-blue water spell rune emblem showing a radiant healing cross
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no lens flare
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 4 --rows 4 --side 512 \
  --ids air-adventure,air-buff,air-damage,air-debuff,earth-buff,earth-damage,earth-debuff,earth-resurrectFull,earth-summon,fire-damage,fire-debuff,water-buff,water-cure,water-damage,water-debuff,water-heal \
  --out assets/raster_src --qc /tmp/qc-spells-icons-p1.png
```

Puis copier les PNG validés de `assets/raster_src/` vers `assets/spells/`,
**puis générer les mipmaps** (section suivante).

## Post-traitement — mipmaps (obligatoire pour le drop-in)

`spellIconUrl(school, kind, px)` lit `spells/<school>-<kind>_<64|48|32|24>`. Après
copie des 512² dans `assets/spells/`, décliner chaque icône en mipmaps LANCZOS :

```bash
python3 - <<'EOF'
from PIL import Image
from pathlib import Path
for p in Path('assets/spells').glob('*.png'):
    if p.stem == '_preview' or any(p.stem.endswith('_%d' % s) for s in (64,48,32,24)):
        continue
    img = Image.open(p).convert('RGBA')
    for s in (64,48,32,24):
        img.resize((s,s), Image.LANCZOS).save(p.with_name('%s_%d.png' % (p.stem, s)), optimize=True)
    p.unlink()  # retire le 512 brut : seuls les mipmaps sont referencés
EOF
```
> Alternative (choix d'implémentation phase 2) : ajouter un repli non suffixé à
> `spellIconUrl` pour consommer directement un `spells/<school>-<kind>.png` unique.
