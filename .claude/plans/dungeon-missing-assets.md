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
4. [ ] **Intégrer l'image renvoyée par l'utilisateur** (« image 5 ») :
   `sheet_extract.py` (4×2, side 512, ids row-major) → QC verte obligatoire.
   → vérif : planche `--qc` toute verte, sortie code 0.
5. [ ] Ranger les PNG validés dans `assets/units/dungeon/`.
   → vérif : `ls assets/units/dungeon/` = 8 PNG.
6. [ ] Commit + push, PR draft.

## Notes / écarts
- Le générateur laisse la palette générique (« muted heroic fantasy palette
  matching the faction lore ») ; j'injecte manuellement la DA Dungeon dans le
  prompt collé, sans éditer le `.md` (fichier généré, ne pas éditer à la main).
- « image 5 » = image que l'utilisateur retient de la génération Gemini ; à
  fournir en upload (je ne peux pas la récupérer depuis Gemini).
