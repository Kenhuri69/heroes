# assets/ — staging des assets générés

⚠️ **Zone de staging, PAS d'intégration** : rien dans `packages/client` ne
référence ce dossier. Le branchement dans le jeu (loader Pixi, lazy-loading,
révision du budget bundle < 800 Ko gzip) est un lot séparé, non ouvert —
voir `docs/12-assets-style-guide.md` §10 et
`.claude/plans/game-assets-generation.md`.

| Dossier | Contenu | Produit par |
|---|---|---|
| `prompts/` | Prompts de planche LLM personnalisés (générés, ne pas éditer) | `tools/assets/gen_prompts.py` |
| `tiles/` | Tuiles de terrain 64² tileables + `_preview.png` | `tools/assets/gen_tiles.py` |
| `ui/` | Icônes UI (mipmaps 64→16) + `_preview.png` | `tools/assets/gen_ui_icons.py` |
| `raster_src/` | Sujets détourés issus des planches (sortie brute QC) | `tools/assets/sheet_extract.py` |
| `units/<faction>/` | Sprites d'unités 512² validés | extraction + tri manuel |
| `heroes/` | Avatars de héros 256² | idem |
| `artifacts/` | Icônes d'artefacts détourées | idem |
| `buildings/<faction>/` | Vignettes de bâtiments | idem |
| `mines/` | Mines de ressources (objets de carte) | idem |
| `backgrounds/` | Fonds d'ambiance 1920×1080 | pièces uniques LLM |
| `logo/` | Logo master + déclinaisons | pièce unique LLM |

Règles de style, prompts-types et critères QC : `docs/12-assets-style-guide.md`.
Workflows : skills `asset-sheet` (planches LLM) et `asset-procedural`
(tuiles/icônes).
