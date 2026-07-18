# Planche — mur de siège (image unique) (famille S, phase 2 LLM)

> Rédigée à la main pour la **famille S** (sorts/effets/murs/invocations) — PAS
> générée par `gen_prompts.py` (famille non couverte). Règle **S** de
> `docs/12-assets-style-guide.md` ; phase 1 procédurale livrée par
> `tools/assets/gen_spell_assets.py`, phase 2 = montée en fidélité (art seul,
> **mêmes clés de fichier** ⇒ substitution par simple dépôt de PNG).
> Grille **1×1**, ordre row-major. Planche cible ≥ 1024×1024 px.

## Prompt (image unique — hors planche ; Gemini / Nano Banana)

```
A single medieval fantasy stone rampart wall segment, siege-battle prop,
digital painting, heroic fantasy concept art style (Heroes of Might and Magic, MTG illustration quality),
weathered grey ashlar masonry with crenellations (merlons) on top, mortar joints, moss in the cracks,
3/4 slightly-elevated battle view, soft directional light from upper-left, solid and defensive,
a defensive fortification wall, NOT a full castle, NOT a tower — just one wall segment,
subject centered with generous empty margin all around, nothing cropped,
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line, no banners, no soldiers
```

## Extraction au retour (image unique opaque → u2net)

```bash
python3 tools/assets/process_sprite.py --src <img> --id siege-wall --dest assets/combat --dry-run
# vérifier /tmp/siege-wall_check.png (silhouette de rempart nette) puis relancer sans --dry-run
```
→ `assets/combat/siege-wall.png` (résolveur `siegeWallUrl()` — drop-in direct, pas de mipmap).
