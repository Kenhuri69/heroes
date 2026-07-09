# Plan — Couleurs de joueur par siège (lot 6.4, enrichissement config de partie)

Suite du lot 6.3 (« Nouvelle partie » configurable). L'utilisateur veut enrichir la
config de partie ; je livre le choix de **couleur par joueur** — **zéro diff moteur**
(la couleur est purement présentation client, cf. investigation).

## État des lieux
- `render/playerColors.ts` : `playerColor(players, playerId)` dérive la couleur de
  l'INDEX du joueur (palette 8 couleurs). Déjà câblé pour villes, mines, minimap.
- Seul le jeton de héros sur la carte utilise une couleur FIXE
  (`AdventureScene.ts:31` `PLAYER_COLOR = 0xc0392b`, utilisé en repli du sprite héros).
- `NewGameScreen` : sièges avec contrôleur + faction, pas de couleur.
- Aucune couleur sur `PlayerState`/`PlayerSetup`/`StartGame` (moteur) → on reste client.

## Décisions
1. Chaque siège choisit une couleur (palette `PLAYER_COLORS`), défaut = couleur d'index.
   Sélection portée dans la config brute (`NewGameSlot.color`).
2. `resolveNewGameConfig` produit `colors: Record<playerId, number>` (clés `player-{i+1}`,
   alignées sur `newGameStartCommand`).
3. Nouvel état client `store.playerColors` (par id de joueur) posé au lancement d'une
   nouvelle partie ; remis à `{}` au retour menu (`navigate('menu')`). Les autres flux
   (scénario/escarmouche/`?seed`) n'y touchent pas ⇒ repli sur la palette d'index.
4. `playerColor` consulte d'abord `store.playerColors[id]`, sinon la palette d'index
   (repli/défaut inchangé). Un seul point de vérité, aucun call-site à changer.
5. `AdventureScene.buildHeroToken(hero, color)` : le jeton de héros honore la couleur
   du joueur (`playerColor(game.players, hero.playerId)`) au lieu de la constante fixe.
6. Hook de test `getPlayerColors` pour assertion smoke.

## Étapes (avec vérif)
1. `store.ts` : champ `playerColors: Record<string, number>` (défaut `{}`). → typecheck.
2. `router.ts` : `navigate('menu')` remet `playerColors` à `{}`. → typecheck.
3. `playerColors.ts` : `playerColor` lit l'override du store en priorité. → typecheck.
4. `game.ts` : `NewGameSlot.color`, `ResolvedNewGame.colors`, résolution. → typecheck.
5. `NewGameScreen.tsx` : sélecteur de couleur par siège (swatches ≥ 44px). → build.
6. `main.ts` : pose `playerColors` avant dispatch ; hook `getPlayerColors`. → build.
7. `AdventureScene.ts` : jeton héros coloré par joueur. → build.
8. `newgame.css` : styles des swatches. → build.
9. Smoke : le test config choisit une couleur ; assert `getPlayerColors` par joueur +
   partie démarre. → `pnpm smoke` (ciblé) + suite.
10. typecheck + lint + build + tests + garde-fou faction.

## Écarts constatés
- Étapes 1→10 faites. `playerColor` lit `appStore.getState().playerColors` (import
  `playerColors.ts → app/store`, acyclique). Aucun call-site à changer.
- Swatches 44×44 (cible tactile doc 08 §4) dans une rangée `overflow-x:auto` par siège.
- `PLAYER_COLOR` fixe d'`AdventureScene` supprimée (orpheline après le passage à
  `playerColor(game.players, hero.playerId)`).
- Hook de test `getPlayerColors` ajouté (assertion smoke : player-1 = vert 0x27ae60).
- Vérifs : typecheck ✅, lint ✅, build ✅ (~103 Ko gzip), garde-fou faction ✅, smoke
  ciblé ✅ (config + couleur, desktop+mobile). Suite complète en cours.
