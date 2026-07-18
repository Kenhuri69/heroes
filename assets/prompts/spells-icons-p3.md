# Planche — icônes de sorts — complément 3/3 (3 manquantes) (famille S, phase 2 LLM)

> Rédigée à la main pour la **famille S**. Complète les 3 icônes absentes des
> planches p1/p2 (`earth-damage`, `earth-summon`, `fire-debuff`) — mêmes clés,
> même style de médaillon que p1/p2 (pour un grimoire homogène). Règle **S** de
> `docs/12-assets-style-guide.md`. Grille **3×1**, ordre row-major.
> Planche cible ≥ 1536×512 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Icon sheet, 3 fantasy spell rune medallions in a 3x1 row,
digital painting, painterly MTG illustration quality, crisp readable emblem/sigil design,
each icon a circular arcane medallion / engraved rune, strong silhouette readable at 32px,
soft directional light from upper-left, engraved decorative runes around the rim (no real words),
colour identifies the magic school, the engraved central motif identifies the spell effect,
each subject centered in its own cell, not touching cell edges, clear spacing between cells,
IMPORTANT: keep every emblem fully inside its cell with generous empty margin — nothing cropped or touching an edge,
CRITICAL: render ONLY the artwork — do NOT paint any caption, label, letters or words (the quoted "school-kind" strings are internal references, NOT to be drawn); produce EXACTLY 3 medallions, one per cell, same diameter, no repeat, no extra,
cell 1: "earth-damage" — amber-brown stone-and-root medallion showing a violent shattering rock blast / cracked-stone impact burst
cell 2: "earth-summon" — amber-brown stone-and-root medallion showing a summoning circle with an inscribed five-point star (NOT an ankh, NOT an arrow)
cell 3: "fire-debuff" — molten ember-red and orange fire medallion showing a descending downward-pointing arrow made of flame (weakening curse)
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no lens flare
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 3 --rows 1 --side 512 \
  --ids earth-damage,earth-summon,fire-debuff \
  --out assets/raster_src --qc /tmp/qc-spells-p3.png
```

Puis copier vers `assets/spells/`, **puis mipmaps** `_<64|48|32|24>` (même snippet que
`spells-icons-p1.md`). Si l'image LLM ajoute des icônes en trop / hors ordre, mapper
chaque médaillon à son id **à l'œil** (école×motif) avant d'écrire les mipmaps.
