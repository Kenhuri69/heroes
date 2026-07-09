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
3. [x] **(utilisateur)** Planche 3×2 verte cohérente générée (Gemini) et fournie.
4. [x] Extraite avec la porte QC (`sheet_extract.py`) → **6/6 PASS**.
5. [x] Post-traitement :
   - rogné à la boîte alpha (base au sol, l'extracteur laissait 10 % de marge ⇒
     arbres flottants + trop petits) ;
   - **lacs de gris de fond internes** (trouées du houppier, jusqu'à 5 % sur
     forest-6) retirés par détourage neutre numpy — rembg birefnet indisponible
     (modèle bloqué 403 par le proxy) ; gris résiduel ≤ 0,12 % ;
   - réduit à 256 px max (déco carte rendue ~46 px) ⇒ 604 Ko/6 (contre 1,3 Mo).
   - déposés `assets/tiles/props/forest-1..6.png`.
6. [~] Vérif : `gen_tiles.py` (« art déposé, conservé » ×6, seul l'art forêt +
   `_preview` changent, tuiles procédurales identiques) ✅ ; build ✅ ;
   smoke **en cours** ; PNG hors bundle JS (budget JS intact).
7. [ ] Commit + push (PR #180 existante).

## Écarts / décisions
- Grille 3×2, ids `forest-1..6`, `--side 512`, extraction vers `assets/raster_src`
  puis copie manuelle (convention §7.5 / map-props).
- Variété de silhouettes conservée (exigence §7.5) ; seule la **saison/palette**
  est unifiée.
- Étape 3 nécessite l'outil image (non disponible côté agent) → livrable = prompt.
