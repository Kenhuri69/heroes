# Option B — harmoniser les 6 props de forêt (set cohérent)

## Problème
`assets/tiles/props/forest-1..6.png` (art Gemini déposé) mélangent les saisons :
`forest-1/3/4/5` vert tempéré, mais `forest-2` chêne d'automne orange et
`forest-6` bouleaux jaunes → couvert incohérent (le lot A a corrigé le placement/
échelle/miroir, pas la palette). Recolorage PIL écarté : sur `forest-2`, 99,9 %
des pixels visibles sont chauds (tronc brun ⊂ même gamme que le feuillage orange)
⇒ pas de masque fiable feuille/tronc.

## Solution (voie canonique doc 12 §7.5)
Regénérer une **planche cohérente** de 6 props de forêt : une seule saison (forêt
tempérée verte, accord avec l'herbe de base), 6 silhouettes **variées** mais même
palette / ligne de sol / empreinte / hauteur (⇒ échelle homogène, complète le
plafond de hauteur du lot A). Fond gris clair plat ⇒ alpha propre. Intégration =
**dépôt de PNG homonymes** dans `assets/tiles/props/` (registre auto-découvert,
`gen_tiles.py` conserve l'art déposé). **Zéro code, zéro moteur.**

## Étapes
1. [x] Diagnostic + rejet du recolorage (échantillonnage HSV).
2. [x] Rédiger le prompt de planche harmonisé + commande d'extraction →
   `assets/prompts/props-forest.md`.
3. [ ] **(utilisateur)** Générer la planche 3×2 dans Gemini (Nano Banana/Copilot
   en repli), fond gris #c8c8c8, 1 sujet/cellule, pas de contact bords.
4. [ ] Extraire avec la porte QC (`sheet_extract.py`) — QC **verte** obligatoire.
5. [ ] Copier les 6 PNG validés vers `assets/tiles/props/forest-<n>.png`.
6. [ ] Vérif : `gen_tiles.py` (art conservé, planche de contrôle), rendu carte à
   l'œil, typecheck/lint/build/smoke (non-régression), budget < 800 Ko gzip
   (PNG hors bundle JS).
7. [ ] Commit + PR draft.

## Écarts / décisions
- Grille 3×2, ids `forest-1..6`, `--side 512`, extraction vers `assets/raster_src`
  puis copie manuelle (convention §7.5 / map-props).
- Variété de silhouettes conservée (exigence §7.5) ; seule la **saison/palette**
  est unifiée.
- Étape 3 nécessite l'outil image (non disponible côté agent) → livrable = prompt.
