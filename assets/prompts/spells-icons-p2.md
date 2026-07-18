# Planche — icônes de sorts — planche 2/2 (neutral/traque/scene/lumiere/prime) (famille S, phase 2 LLM)

> Rédigée à la main pour la **famille S** (sorts/effets/murs/invocations) — PAS
> générée par `gen_prompts.py` (famille non couverte). Règle **S** de
> `docs/12-assets-style-guide.md` ; phase 1 procédurale livrée par
> `tools/assets/gen_spell_assets.py`, phase 2 = montée en fidélité (art seul,
> **mêmes clés de fichier** ⇒ substitution par simple dépôt de PNG).
> Grille **5×4**, ordre row-major. Planche cible ≥ 2560×2048 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Icon sheet, 20 fantasy spell rune medallions in a 5x4 grid,
digital painting, painterly MTG illustration quality, crisp readable emblem/sigil design,
each icon a circular arcane medallion / engraved rune, strong silhouette readable at 32px,
soft directional light from upper-left,
colour identifies the magic school, the engraved motif identifies the spell effect,
each subject centered in its own cell, not touching cell edges, clear spacing between cells,
IMPORTANT: keep every emblem fully inside its cell with generous empty margin — nothing cropped or touching an edge,
CRITICAL: render ONLY the artwork — do NOT paint any text, caption, label, letters or numbers anywhere (the quoted "school-kind" strings are internal references, NOT to be drawn); produce EXACTLY 20 medallions, one per grid cell, all the same diameter, no repeated icon, no extra icon, no empty cell,
cell 1: "lumiere-buff" — radiant holy-gold light spell rune emblem showing an ascending upward-arrow blessing
cell 2: "lumiere-damage" — radiant holy-gold light spell rune emblem showing a violent blast / jagged bolt
cell 3: "lumiere-heal" — radiant holy-gold light spell rune emblem showing a radiant healing cross
cell 4: "neutral-buff" — silver-grey raw arcane spell rune emblem showing an ascending upward-arrow blessing
cell 5: "neutral-damage" — silver-grey raw arcane spell rune emblem showing a violent blast / jagged bolt
cell 6: "neutral-dispel" — silver-grey raw arcane spell rune emblem showing an unravelling spiral undoing magic
cell 7: "prime-buff" — dark-violet bone and spectral-green death magic spell rune emblem showing an ascending upward-arrow blessing
cell 8: "prime-damage" — dark-violet bone and spectral-green death magic spell rune emblem showing a violent blast / jagged bolt
cell 9: "prime-debuff" — dark-violet bone and spectral-green death magic spell rune emblem showing a descending downward-arrow curse
cell 10: "scene-buff" — magenta-and-violet stage/spotlight spell rune emblem showing an ascending upward-arrow blessing
cell 11: "scene-debuff" — magenta-and-violet stage/spotlight spell rune emblem showing a descending downward-arrow curse
cell 12: "scene-heal" — magenta-and-violet stage/spotlight spell rune emblem showing a radiant healing cross
cell 13: "traque-applyMarks" — deep hunter-green thorn-and-arrow (the Hunt) spell rune emblem showing a hunter targeting reticle
cell 14: "traque-banish" — deep hunter-green thorn-and-arrow (the Hunt) spell rune emblem showing a collapsing vortex / rift
cell 15: "traque-damage" — deep hunter-green thorn-and-arrow (the Hunt) spell rune emblem showing a violent blast / jagged bolt
cell 16: "traque-debuff" — deep hunter-green thorn-and-arrow (the Hunt) spell rune emblem showing a descending downward-arrow curse
cell 17: "traque-rally" — deep hunter-green thorn-and-arrow (the Hunt) spell rune emblem showing a raised banner / rallying horn
cell 18: "traque-silence" — deep hunter-green thorn-and-arrow (the Hunt) spell rune emblem showing a crossed-out sealed circle (mute)
cell 19: "traque-stealth" — deep hunter-green thorn-and-arrow (the Hunt) spell rune emblem showing a veiled fading eye
cell 20: "traque-teleport" — deep hunter-green thorn-and-arrow (the Hunt) spell rune emblem showing a concentric portal ring / mist-step
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no lens flare
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 5 --rows 4 --side 512 \
  --ids lumiere-buff,lumiere-damage,lumiere-heal,neutral-buff,neutral-damage,neutral-dispel,prime-buff,prime-damage,prime-debuff,scene-buff,scene-debuff,scene-heal,traque-applyMarks,traque-banish,traque-damage,traque-debuff,traque-rally,traque-silence,traque-stealth,traque-teleport \
  --out assets/raster_src --qc /tmp/qc-spells-icons-p2.png
```

Puis copier vers `assets/spells/`, **puis mipmaps** (même snippet que la planche 1/2).
