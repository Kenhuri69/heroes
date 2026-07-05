---
name: asset-sheet
description: Produire des assets du jeu via une planche LLM image (unités militaires, icônes d'artefacts, vignettes de bâtiments, avatars de héros) — de la génération du prompt personnalisé à l'extraction QC vers le staging assets/. Utiliser dès qu'on veut créer/regénérer les visuels d'une faction, d'artefacts ou d'avatars (« génère les sprites Necropolis », « la planche artefacts est prête, découpe-la »). Ne PAS utiliser pour les tuiles de terrain ni les icônes UI (skill asset-procedural), ni pour intégrer des images dans le client (lot intégration non ouvert — docs/12 §10).
---

# Produire des assets par planche LLM

Source de vérité : `docs/12-assets-style-guide.md` (Règles A/B/C, palettes par
faction, prompts-types, critères QC §8, anti-patterns §9).

## Prérequis
```bash
python3 -c "import PIL, numpy, scipy" 2>/dev/null \
  || python3 -m pip install -r tools/assets/requirements.txt
```
`rembg` (LOURD, ~176 Mo de modèle) uniquement pour un fond chargé — ne
l'installer qu'à la demande.

## Étapes

### 1. Générer le prompt de planche depuis les données
```bash
python3 tools/assets/gen_prompts.py
```
→ `assets/prompts/<planche>.md` (grille, ids row-major, prompt prêt à coller,
commande d'extraction exacte). Toujours regénérer après un changement de
`data/` (nouvelle faction, nouvel artefact…).

### 2. Générer la planche avec le LLM image
Coller le prompt (Gemini / Nano Banana / Copilot). Contraintes non
négociables (docs/12 §4) : fond **gris clair plat #c8c8c8**, un sujet centré
par cellule, aucun contact entre sujets ni avec les bords, pas de
cadre/texte/ombre portée. Un fond sombre = sujets indétourables = re-run.

### 3. Extraire avec la porte QC
Lancer la commande `sheet_extract.py` inscrite dans le fichier de prompt.
Regarder la planche `--qc` : cadre **vert = PASS**, **rouge = FAIL**. Un FAIL
→ corriger (meilleure planche, ou `--tol`/`--inset`/`--min-area`) et
relancer. **Ne jamais committer un FAIL** (le script sort en code 1).

### 4. Ranger dans le staging
Copier les PNG validés de `assets/raster_src/` vers la destination indiquée
dans le fichier de prompt (`assets/units/<faction>/`, `assets/artifacts/`,
`assets/buildings/<faction>/`, `assets/heroes/`).

Pour une image unique hors planche (boss, artefact épique rendu avec décor) :
```bash
python3 tools/assets/process_sprite.py --src <img> --id <id> --dest <staging> --dry-run
# vérifier /tmp/<id>_check.png puis relancer sans --dry-run
```
`--model birefnet` (défaut) pour les sujets translucides (spectres, voiles) ;
`u2net` suffit pour les sujets opaques.

## Pièges
- **Aucune intégration client** dans ce périmètre : rien dans
  `packages/client` ne doit référencer `assets/` (docs/12 §10, budget bundle).
- Ordre des `--ids` = ordre row-major des cellules de la planche — ne pas
  réordonner.
- Sujets translucides écrasés (ailes, brume) → refaire l'extraction avec
  `--method rembg --rembg-model birefnet-general`.
