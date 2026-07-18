# Planche — unités invoquées (élémentaires) (famille S, phase 2 LLM)

> Rédigée à la main pour la **famille S** (sorts/effets/murs/invocations) — PAS
> générée par `gen_prompts.py` (famille non couverte). Règle **S** de
> `docs/12-assets-style-guide.md` ; phase 1 procédurale livrée par
> `tools/assets/gen_spell_assets.py`, phase 2 = montée en fidélité (art seul,
> **mêmes clés de fichier** ⇒ substitution par simple dépôt de PNG).
> Grille **4×1**, ordre row-major. Planche cible ≥ 2048×512 px.

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

```
Character sheet, 4 summoned elemental creatures in a 4x1 row,
digital painting, heroic fantasy concept art style (Heroes of Might and Magic, MTG illustration quality),
painterly brush strokes, dynamic conjured-spirit pose, 3/4 view, soft directional light from upper-left,
each is a raw elemental spirit made purely of its element, no armour and no weapons,
each subject centered in its own cell, not touching cell edges, clear spacing between cells,
IMPORTANT: keep every subject fully inside its cell with generous empty margin — nothing cropped or touching an edge,
cell 1: "elementaire-de-terre" — a summoned earth elemental of rock and amber with glowing molten cracks — a stocky boulder-golem elemental, elemental spirit (no armour, no weapons)
cell 2: "elementaire-d-air" — a summoned air elemental of pale swirling wind and cloud with faint lightning — an airy vortex elemental, elemental spirit (no armour, no weapons)
cell 3: "elementaire-de-feu" — a summoned fire elemental of living flame and ember with a molten core — a blazing fire elemental, elemental spirit (no armour, no weapons)
cell 4: "elementaire-d-eau" — a summoned water elemental of flowing translucent water and foam — a surging water elemental, elemental spirit (no armour, no weapons)
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no lens flare
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 4 --rows 1 --side 512 \
  --ids elementaire-de-terre,elementaire-d-air,elementaire-de-feu,elementaire-d-eau \
  --out assets/raster_src --qc /tmp/qc-units-summoned.png
```
> Sujets translucides (air/eau) souvent écrasés → ré-extraire ces cellules avec
> `--method rembg --rembg-model birefnet-general` si l'alpha mange le voile.

Puis copier vers `assets/units/core/` (résolus par le repli **core** de
`unitSpriteUrl`, faction-agnostique). **Seul `elementaire-de-terre` est câblé
aujourd'hui** (sort `invocation-elementaire`, doc 02) ; les 3 autres sont stagés
**en avance** pour de futures invocations — inertes tant qu'aucun sort/contenu ne
les référence.
