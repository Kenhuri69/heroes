# Test instable « confort : aide « ? » »

> Relevé au lot `deps-major-upgrade.md` : le test échouait aussi sur `main`
> (4 sur 6 en isolé). Hors `@core`, donc hors CI de PR, mais lancé sur `main`.

## 1. Constat

- Le test donne le focus clavier au document en cliquant aux coordonnées écran
  de la tuile du héros (3,3). Juste après `openGame`, la caméra n'est pas
  toujours centrée : ce point tombe alors sous la barre du haut, sur le bouton
  Options. Le clic ouvre Options, et `?` est ignoré (raccourcis hors carte).
- Instrumenté : sur 12 passages à 4 workers, 3 ouvraient `options-panel` au clic.
- Défaut du test seul : le jeu se comporte comme prévu (un clic sur Options
  ouvre Options).

## 2. Correctif

- `focusMap` attend que `elementFromPoint` sur la tuile renvoie le canevas avant
  de cliquer. Aucun changement de code du jeu.

## 3. Étapes

1. [x] Diagnostic (spec de débogage jetable, non commitée)
2. [ ] Correctif du test ; passages répétés en parallèle
3. [ ] Playwright complet

## 4. Journal

- 2026-10-28 : plan ouvert, cause trouvée.
