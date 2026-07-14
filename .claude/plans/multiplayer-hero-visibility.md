# Visibilité des héros adverses sur la carte (multi-joueurs)

## Problème signalé
En partie multi-joueurs (humain ou IA), on ne voit pas le héros adverse sur la
carte d'aventure ⇒ impossible de savoir où cliquer pour déclencher un combat
héros-vs-héros. On devrait voir le jeton du héros de chaque joueur/faction.

## Diagnostic
- Moteur OK : `GameState.heroes` contient TOUS les héros (chacun avec `playerId`).
  Détection & déclenchement du combat H-vs-H OK (`movement.ts`, `beginHeroCombat`).
- Bug client unique : `AdventureScene.sync()` construit les sprites à partir de
  `humanHeroes(game)` (filtre `playerId === joueur humain`). Les héros adverses
  n'obtiennent jamais de jeton → invisibles.
- Les villes adverses, elles, sont visibles (elles itèrent sur `game.towns`
  complet avec couleur par propriétaire). Le rendu des héros aurait dû suivre le
  même modèle.

## Correctif (client uniquement, zéro diff moteur)
Dans `AdventureScene.sync()` :
1. Garder `heroes = humanHeroes(game)` UNIQUEMENT pour les `sightings` (vision /
   brouillard) — inchangé.
2. Nouvelle liste de rendu `renderedHeroes` = héros du joueur humain (toujours) +
   les autres héros dont la tuile est **actuellement en vision** (dans un
   `sighting`). Fidélité HoMM : un héros ennemi n'apparaît que sous vision active ;
   hors vision, le brouillard le masque (et on ne le laisse pas « transparaître »
   sous le brouillard semi-transparent des tuiles explorées).
3. Boucle de réconciliation des sprites (`heroIds`, création/destruction/position)
   itère sur `renderedHeroes` au lieu de `heroes`. Couleur déjà correcte
   (`playerColor(game.players, hero.playerId)`).

## Vérification
- [x] typecheck / lint / build (OK)
- [x] Helper pur `isHeroVisibleOnMap` extrait dans `game.ts`
- [x] Surface de test `renderedHeroIds()` exposée (scène → harness `__HEROES_TEST__`)
- [x] Smoke H-VS-H étendu : assertion `renderedHeroIds()` contient le héros
  adverse une fois adjacent/en vision — vert
- [x] Non-régression : démarrage, tap-tap, multi-joueurs — verts
- [x] Zéro diff moteur (client + smoke + plan uniquement), pas de bump
  `CURRENT_SAVE_VERSION`

## Décision de design notée
Fidélité HoMM retenue : un héros adverse n'apparaît que sous **vision active**
(dans un `sighting`), pas simplement sur une tuile explorée — sinon il
« transparaîtrait » sous le brouillard semi-transparent. Il apparaît/disparaît
donc quand il entre/sort du rayon de vision d'un héros ou bâtiment du joueur.
