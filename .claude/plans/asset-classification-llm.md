# Plan — Classification des assets (Python vs LLM) & boucle de génération

> But : inventorier **tous** les assets nécessaires au jeu, classer chacun selon
> son mode de production (**Python procédural** ou **planche/pièce LLM**), lister
> les **manques d'art peint** (tout a déjà un repli procédural gracieux — rien
> n'est « cassé »), et fournir les **prompts** à passer dans Gemini puis intégrer.
>
> Source de vérité du style : `docs/12-assets-style-guide.md` (règles P/A/B/C/D/E/G/H).
> Les prompts LLM sont **dérivés des données** par `tools/assets/gen_prompts.py`
> (ne jamais les éditer à la main) et stockés dans `assets/prompts/`.

## 1. Classification par famille

### 1a. Familles PYTHON (procédural, déterministe — `random.Random(seed)`)
Aucune génération LLM. Re-lancer le script = octets identiques. **Toutes présentes**,
regénérables à volonté.

| Famille | Règle | Script | Sortie |
|---|---|---|---|
| Tuiles de terrain (carrées + ISO) | P | `gen_tiles.py` | `assets/tiles/*`, `tiles/iso/*` |
| Props de relief (repli forêt/montagne) | P | `gen_tiles.py` | `assets/tiles/props/*` |
| Icônes UI (ressources, stats, jour) | P | `gen_ui_icons.py` | `assets/ui/*` |
| Chrome d'UI (cadres 9-slice, rubans) | G | `gen_chrome.py` | `assets/ui/chrome/*` |
| Blasons de faction (écus) | H | `gen_faction_badge.py` | `assets/badges/*` |
| SFX + jingles victoire/défaite | F | `gen_sfx.py` | `assets/audio/sfx/*`, `audio/music/<jingle>` |

### 1b. Familles LLM (planche Gemini + détourage, ou pièce unique)
Prompt dérivé des données par `gen_prompts.py` → planche Gemini → `sheet_extract.py`
(QC verte obligatoire) → dépôt sous `assets/<famille>/`.

| Famille | Règle | Prompt(s) | Sortie |
|---|---|---|---|
| Sprites d'unités | A | `units-<faction>-p*.md`, `war-machines.md` | `assets/units/<faction>/*` |
| Avatars de héros | B | `hero-avatars-p*.md` | `assets/heroes/*` |
| Icônes d'artefacts | C | `artifacts-p1.md`, `artifacts-p2.md` | `assets/artifacts/*` |
| Vignettes de bâtiments | C | `buildings-<faction>-p*.md`, `buildings-core.md` | `assets/buildings/<faction>/*` |
| Mines / tas de ressources | C | `mines-p*.md`, `resource-piles-p*.md` | `assets/mines/*`, `resources/*` |
| Objets & jetons de carte | C | `map-*.md`, `orphans-map-vignettes.md` | `assets/map/*` |
| Maisons Vox Arcana | C | `faction-vox-arcana.md` | `assets/houses/vox-arcana/*` |
| Fonds d'ambiance | D | `backgrounds.md` | `assets/backgrounds/*` |
| Logo | E | `logo.md` | `assets/logo/*` |
| Musiques d'ambiance | F | `audio-music.md` | `assets/audio/music/*` |

## 2. Analyse d'écart (art peint manquant — repli procédural en attendant)

Dérivée d'un diff données ↔ `assets/` reproduisant les résolveurs de
`packages/client/src/render/assets.ts`. Faux positifs écartés :
- **Avatars de héros** : 100 % couverts (les nommés sans art dédié pointent leur
  clé `avatar` vers l'archétype de faction, qui existe).
- **Repli élite→base** : les variantes `-elite` réutilisent l'art de base → pas requises.
- **`panoplie-gladiateur`** : c'est un **set** (bonus de panoplie), pas un artefact
  à icône → exclu à raison par `gen_prompts.py`.
- **`test-faction`** : placeholder assumé (doc 12 §2.3) → pas d'art.

### Manques réels (LLM à générer)
| Lot | Famille | Manquants | Prompt |
|---|---|---|---|
| **G1** | Artefacts (C) | 6 : `bottes-de-sept-lieues`, `longue-vue`, `pendentif-de-bravoure`, `cape-du-refus`, `talisman-de-constance`, `sceau-de-l-intouchable` | `artifacts-p1.md` (planche 4×2) + `artifacts-p2.md` (3×1) |
| **G2** | Vignettes « grail » (C) | 6 (1/faction hors test) : `haven-grail`, `necropolis-grail`, `arcane-hunters-grail`, `sylvan-court-grail`, `vox-arcana-grail`, `dungeon-grail` | inclus dans `buildings-<faction>-p2.md` |
| **G3** | Fonds de combat (D) | polish : `combat-rough`, `combat-snow`, `combat-river` (`combat-water` inutile — pas de combat sur l'eau) | `backgrounds.md` |

> Les planches C sont **atomiques** : régénérer une planche produit aussi les
> sujets déjà présents (cohérence de style). Pour G1 les planches p1/p2 couvrent
> les 11 artefacts ; seuls les 6 ci-dessus sont réellement absents.

## 3. Étapes & vérification

1. [x] Inventaire + classification (ce document). → *vérif : tableau §1 exhaustif vs doc 12*
2. [x] Régénération des prompts depuis les données (`gen_prompts.py`). → *vérif : `git status assets/prompts` ; artefacts 11 sujets couverts, grail présent par faction*
3. [x] Suppression de l'orphelin `assets/prompts/artifacts.md` (remplacé par `-p1/-p2`).
4. [x] **Handoff G1 (artefacts)** → l'utilisateur a généré les 2 planches dans Gemini.
5. [x] Intégration G1 : `sheet_extract.py` (QC 11/11 verte) → 6 manquants copiés dans
       `assets/artifacts/` → build (budget vert) + smoke « assets sans 404 » vert.
       *Note p2 : planche à cadres par cellule → `--inset 0.09 --tol 55` pour
       démarrer le remplissage à l'intérieur du cadre (halo gris sinon).*
6. [x] **G2 (grail)** intégré : planche Gemini irrégulière (7 sujets, tour Arcane
       **dupliquée**, disposition non-grille) → extraction par **boîtes englobantes
       auto-détectées** (hors grille fixe) + **keep-largest-component** (éclats
       parasites supprimés), QC 6/6 verte → `assets/buildings/<faction>/<faction>-grail.png`
       (6 factions hors test) → build + smoke « assets » vert.
7. [x] **G3 (fonds de combat)** intégré : 3 pièces uniques Gemini (Règle D)
       `rough`/`snow`/`river` → cover-resize 1920×1080 + crop centré + JPEG q85
       (< 500 Ko) → `assets/backgrounds/combat-{rough,snow,river}.jpg` → build +
       smoke « assets » vert. **Boucle d'assets terminée** (tous les manques d'art
       peint identifiés au §2 sont comblés).

## 4. Journal
- 2026-07-17 : classification établie ; prompts régénérés (artefacts éclatés en
  2 planches suite à l'ajout des artefacts post-MVP ; ajout des prompts bâtiments
  dungeon/sylvan-court absents ; inclusion des vignettes grail). Aucun diff moteur.
