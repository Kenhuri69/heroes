# Planche — vignettes de carte orphelines (planche B)

> **Fichier hand-authored** (PAS généré par `tools/assets/gen_prompts.py` — il ne
> sera ni écrasé ni regénéré). Regroupe les 7 objets de carte « vignette »
> genuinely-manquants qui restaient en cellules solo dans les planches générées,
> pour respecter « planche de 4 ou 8 ».
> Règle C (planche de vignettes, fond gris clair plat) de `docs/12-assets-style-guide.md`.
> Grille **4×2**, ordre row-major, **cellule 8 laissée vide** (7 sujets).
> Planche cible ≥ 2048×1024 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Item sheet, 7 small fantasy Heroes-of-Might-and-Magic adventure-map objects in a
4x2 grid (leave the bottom-right cell 8 completely empty),
digital painting, painterly HoMM adventure-map vignette style,
each object isolated on flat ground, slight 3/4 aerial view,
bold readable silhouette at 64 pixels (adventure map tile size),
soft directional light from upper-left, rich material detail,
each subject centered in its own cell, not touching cell edges, clear spacing between cells,
IMPORTANT: keep every subject fully inside its cell with generous empty margin all around — roofs, banners, spires and all extremities must NOT be cropped or touch any edge; zoom each subject out enough that nothing is clipped,
cell 1: "resonance pile" — a humming tuning-fork crystal on a small lacquered stand, faint violet glow
cell 2: "resonance mine" — a small mine rig of humming crystal tuning-forks and silver resonating pipes on a stone platform, night-blue and gold
cell 3: "Haven stables" — a white-and-gold stone cavalry stable block with an arched gateway and blue pennants
cell 4: "Haven Statue of Judgement" — a tall white-marble angelic statue holding scales and a sword on a stone plinth, gold trim
cell 5: "Haven cloister" — an arcaded white-stone monastery courtyard with a bell tower and stained glass, blue-and-gold banners
cell 6: "Arcane Hunters contract board" — a dark-wood bounty notice board pinned with parchments beside a lantern, night-blue timber and silver, cyan rune glow
cell 7: "neutral recruit dwelling" — a plain grey barracks tent with an orange banner, deliberately simple placeholder look
cell 8: (empty)
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no decorative sparkles, no star glints, no lens flare
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

7 ids sur une grille 4×2 : `sheet_extract.py` ne traite que les ids fournis
(cellule 8 ignorée).

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 4 --rows 2 --side 512 \
  --ids pile-resonance,mine-resonance,haven-stables,haven-statue,haven-cloister,arcane-hunters-contracts,test-faction-dwelling-t1 \
  --out assets/raster_src --qc /tmp/qc-orphans-map-vignettes.png
```

Vérifier la planche QC : cadre **vert = PASS** partout. Un FAIL → regénérer ou
ajuster `--tol`/`--inset`/`--min-area`. **Ne jamais committer un FAIL.**

## Rangement (copier chaque PNG validé vers sa destination)

```bash
mkdir -p assets/resources assets/buildings/test-faction
cp assets/raster_src/pile-resonance.png            assets/resources/
cp assets/raster_src/mine-resonance.png            assets/mines/
cp assets/raster_src/haven-stables.png             assets/buildings/haven/
cp assets/raster_src/haven-statue.png              assets/buildings/haven/
cp assets/raster_src/haven-cloister.png            assets/buildings/haven/
cp assets/raster_src/arcane-hunters-contracts.png  assets/buildings/arcane-hunters/
cp assets/raster_src/test-faction-dwelling-t1.png  assets/buildings/test-faction/
```

> Note : cette planche B **supersède** `resource-piles-p2.md` (générée, 1 cellule
> solo `pile-resonance`) — l'ignorer.
