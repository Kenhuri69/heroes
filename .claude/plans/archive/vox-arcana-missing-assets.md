# Plan — Assets manquants de Vox Arcana

## Constat (captures utilisateur)
Écran de ville « Vox Arcana » : vignettes de bâtiments **vides** (tuile beige de
repli) pour les habitations (`vox-arcana-dwelling-t1..t8`) et pour les bâtiments
« Le Choixpeau » (`vox-arcana-house-{lion,serpent,eagle,badger,venari}`). Sur la
carte, le jeton de héros/ville retombe sur le repli procédural.

## Diagnostic
Le résolveur `buildingUrl(id, factionId)` cherche `buildings/<factionId>/<id>`.
Il **n'existe aucun** `assets/buildings/vox-arcana/`. Or :
- Les **5 blasons de Maisons** existent déjà (`assets/houses/vox-arcana/house-*.png`,
  lot 16) mais **ne sont consommés nulle part** → art perdu.
- Les **8 vignettes d'habitations** n'ont jamais été générées (le prompt de
  faction 16 ne couvrait pas les bâtiments ; pas de `buildings-vox-arcana.md`).
- `map/hero-vox-arcana`, `map/town-vox-arcana`, `backgrounds/town-vox-arcana`
  absents → repli procédural (dégradé/forme).

## Lots

### A — Câbler les blasons de Maisons existants (art présent) ✅ livrable ici
Générique/data-driven, zéro `if (faction)`. Une vignette de bâtiment à effet
`houseChoice` utilise le blason `houses/<factionId>/<houseId>`.
- `render/assets.ts` : nouveau résolveur `houseBadgeUrl(factionId, houseId)`.
- `ui/TownScreen.tsx` : helper `buildingThumbUrl(def, id, factionId)` — préfère
  le blason pour les bâtiments `houseChoice`, repli `buildingUrl`. Appliqué aux
  2 sites (vue peinte + liste Construire).
- verify : typecheck + lint + build + smoke ; les 5 tuiles « Le Choixpeau »
  affichent le blason au lieu du repli.

### B — Préparer le pipeline des vignettes d'habitations manquantes
- `tools/assets/gen_prompts.py` : ajouter l'entrée `PALETTES['vox-arcana']`
  (palette doc 16, cohérente avec le prompt de faction).
- Regénérer les prompts → produit `assets/prompts/buildings-vox-arcana.md`
  (8 habitations + 5 maisons), prêt pour la planche LLM.
- verify : le fichier de prompt est émis, ids row-major corrects.

### C — Génération d'image externe (hors environnement) ⚠️
Les PNG peints (8 habitations, fond de ville, jetons de carte) exigent l'étape
« planche LLM image » (Gemini/Nano Banana) du skill `asset-sheet`, non
exécutable ici. Documenté et laissé prêt (prompt émis en B). À réaliser dans un
lot dédié avec accès au modèle image.

## État
- Lot A **livré** : `houseBadgeUrl` + `buildingThumbUrl`, 2 sites câblés. Smoke
  dédié (escarmouche vox-arcana) vert.
- Lot B **livré** : palette `vox-arcana` + `assets/prompts/buildings-vox-arcana-p1/p2.md`.
- Lot C **partiellement livré** : planches LLM fournies par l'utilisateur.
  - **8 habitations** extraites (`sheet_extract.py`, QC 8/8 verte, texte parasite
    éliminé comme specks) → `assets/buildings/vox-arcana/vox-arcana-dwelling-t*.png`.
    Smoke étendu : une habitation peinte + un blason décodés.
  - **5 bâtiments de Maisons** : 1ʳᵉ planche mal alignée (écartée) ; 2ᵉ planche
    (grille 3×2 stricte, prompt durci) extraite proprement (QC 5/5) →
    `assets/buildings/vox-arcana/vox-arcana-house-*.png`. L'indirection blason du
    Lot A (`houseBadgeUrl`/`buildingThumbUrl`) devient inutile ⇒ **supprimée**,
    retour à `buildingUrl` direct (les Maisons ont désormais leur art de bâtiment).
    Les blasons `houses/vox-arcana/` redeviennent inutilisés (comme avant #163).
  - **Fond de ville** `backgrounds/town-vox-arcana.jpg` (PNG→JPEG q85, 197 Ko).
  - **Jetons de carte** héros + ville : planche 2×1 extraite `--tol 68` (le
    panneau gris clair #195 dépassait le fond #162 de +57 > défaut 42) →
    `map/hero-vox-arcana.png` + `map/town-vox-arcana.png`. QC 2/2 verte.
  - Smoke vox-arcana étendu aux 3 (jetons chargés Pixi + fond CSS).
- Lot C **soldé** : plus aucun repli procédural pour vox-arcana.
- Vérif : `lint` + `build` + smoke vox-arcana (2/2 desktop+mobile) verts.

## Décisions
- Blason comme vignette de « Le Choixpeau » : thématiquement juste (le Choixpeau
  assigne la Maison ; on montre son écusson). Confirmé conforme doc 16 §3.1.
