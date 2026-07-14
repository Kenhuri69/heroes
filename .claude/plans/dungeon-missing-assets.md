# Plan — Assets manquants (priorité faction Dungeon)

## Contexte
La faction **Dungeon** (doc 17) est complète côté données (`data/factions/dungeon/`)
mais n'a **aucun asset** : ni unités, ni bâtiments, ni avatars héros. On produit
les visuels via planche LLM image (skill `asset-sheet`, docs/12), puis intégration
au staging `assets/`. Aucune intégration client dans ce périmètre (docs/12 §10).

## DA Dungeon (doc 17 §Couleurs)
Violet sombre, noir, éclats de magenta arcanique ; elfes noirs souterrains,
cultes du serpent, minotaures/hydres/dragons d'ombre.

## Étapes
1. [x] Régénérer les prompts depuis `data/` (`gen_prompts.py`) → planches Dungeon
   créées : `units-dungeon-p1.md` (T1→T7 + assassin), `units-dungeon-p2.md`
   (élites), `buildings-dungeon.md` ; avatars héros p2 resync (dungeon-might/magic).
   → vérif : `ls assets/prompts/ | grep dungeon` ✅
2. [x] Installer deps d'extraction (`PIL/numpy/scipy`). → vérif : import OK ✅
3. [x] Fournir le prompt Gemini enrichi DA pour la planche prioritaire (lignée
   T1→T7). → vérif : prompt posté en chat ✅
4. [x] **Intégrer l'image renvoyée par l'utilisateur** (« image 5 ») :
   `sheet_extract.py` (4×2, side 512, ids row-major) → QC verte obligatoire.
   → vérif : **8/8 PASS, 0 FAIL, exit 0** ✅ (planche QC toute verte).
5. [x] Ranger les PNG validés dans `assets/units/dungeon/`.
   → vérif : 8 PNG présents (t1-eclaireur … t7-dragon-ombre + t1-eclaireur-elite) ✅
6. [x] Commit + push, PR draft #362.

7. [x] **Planche élites p2** intégrée. Planche fournie non conforme (hydre &
   dragon débordant sur 2 cellules + légendes texte) ⇒ QC 4×2 mécaniquement PASS
   mais hydre coupée / dragon absent. Récupération : 4 élites du haut extraites
   proprement (crop rangée sup. 4×1), hydre & dragon **recadrés individuellement**
   puis extraits en 1×1 (keyer fond plat). → vérif : 6/6 sujets propres, têtes
   d'hydre et ailes de dragon intactes, texte retiré ✅ ; 14 PNG dans
   `assets/units/dungeon/` (7 base + 7 élites).

## Reste à produire (planches suivantes, mêmes étapes)
- `buildings-dungeon` (habitations + Puits maudit).
- Avatars héros (`hero-avatars-p2` : dungeon-might/magic ; + Raelag/Shadya si planche dédiée).

## Notes / écarts
- Le générateur laisse la palette générique (« muted heroic fantasy palette
  matching the faction lore ») ; j'injecte manuellement la DA Dungeon dans le
  prompt collé, sans éditer le `.md` (fichier généré, ne pas éditer à la main).
- « image 5 » = image que l'utilisateur retient de la génération Gemini ; à
  fournir en upload (je ne peux pas la récupérer depuis Gemini).
