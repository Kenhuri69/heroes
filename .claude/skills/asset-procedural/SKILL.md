---
name: asset-procedural
description: Générer ou regénérer les assets procéduraux du jeu — tuiles de terrain de la carte d'aventure (gen_tiles.py) et icônes globales d'UI ressources/stats (gen_ui_icons.py). Utiliser pour ajouter un terrain, une variante de tuile, une icône de ressource/stat, ou retoucher leur rendu (« ajoute une tuile de neige », « l'icône or est illisible à 16px »). Ne PAS utiliser pour les sprites d'unités, artefacts, bâtiments, avatars (skill asset-sheet) ni pour intégrer les images dans le client.
---

# Assets procéduraux (tuiles & icônes UI)

Source de vérité : `docs/12-assets-style-guide.md` — Règle P : **déterminisme
absolu** (`random.Random(seed dérivé de l'id)`, jamais d'horloge ni de random
global : re-run = octets identiques), tuiles **tileables** (motifs dessinés
avec wrap ±64 px), icônes lisibles à **16 px**.

## Prérequis
```bash
python3 -c "import PIL" 2>/dev/null \
  || python3 -m pip install -r tools/assets/requirements.txt
```

## Tuiles de terrain
```bash
python3 tools/assets/gen_tiles.py
```
→ `assets/tiles/<terrain>-<1..3>.png` (64², opaque, tileable) + `road-dirt.png`
+ `_preview.png` (damier 2×2 par tuile = contrôle de tileabilité à l'œil).

- Les terrains couverts sont lus dans `data/core/config.json`
  (`adventure.terrains`) ; le script **échoue** si un terrain n'a pas de
  recette → ajouter une fonction dans `TERRAIN_RECIPES` (palette sourde,
  motifs via `_wrap_ellipse`/`_wrap_line` uniquement, sinon couture).
- Nouvelle variante : incrémenter `VARIANTS` (le seed par variante fait le
  reste).

## Icônes UI
```bash
python3 tools/assets/gen_ui_icons.py
```
→ `assets/ui/<id>_{64,48,32,24,16}.png` + `_preview.png` (rendu 64 px et
16 px côte à côte).

- Ajouter une icône = une fonction de dessin (canvas 256², formes pleines,
  liseré `OUTLINE`, un rehaut) + une entrée dans `ICONS`.
- Vérifier la **lisibilité à 16 px** sur `_preview.png` avant de committer ;
  une silhouette illisible → simplifier les formes, pas les couleurs.

## Vérification (les deux scripts)
1. Exécution sans erreur, relire `_preview.png`.
2. Déterminisme : relancer le script, `git status` ne doit montrer **aucun
   fichier modifié** (octets identiques).
3. Committer les PNG regénérés AVEC la modification du script (même commit).

## Pièges
- Aucune intégration client : rien dans `packages/client` ne référence
  `assets/` (docs/12 §10).
- Un motif dessiné sans wrap crée une couture invisible à l'unité mais
  flagrante en damier — toujours contrôler `_preview.png`.
