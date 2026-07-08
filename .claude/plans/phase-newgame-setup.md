# Plan — Écran de configuration « Nouvelle partie » + génération de carte à progression

Demande utilisateur : sur « Nouvelle partie », pouvoir choisir **faction**, **taille
de carte**, **nombre de joueurs** (IA ou humain en hot-seat), **quantité de
ressources** (bas/riche), et effectuer un **tirage aléatoire** de la carte et des
ressources. Chaque paramètre peut rester en « Aléatoire ». La génération de carte
pouvant prendre du temps ⇒ **UX de chargement avec avancée**.

## État des lieux (exploration)

- Le menu « Nouvelle partie » émet `heroes:new-game` → `startNewGame(Date.now())`
  (solo, carte proto-01, dotation `config.newGame`).
- Il existe déjà `SkirmishScreen` (2 joueurs : faction/adversaire/difficulté/carte
  aléatoire) + `skirmishStartCommand` (synthétise 2 joueurs, villes, objectifs).
- `generateMap(id, seed, opts)` (`@heroes/content`) : PRNG mulberry32 déterministe,
  produit un `MapFile` valide par construction — **mais 2 positions de départ fixes**.
- `resolveGeneratedMap(report, seed)` génère + revalide via `loadMap`.
- Le moteur applique `StartGame` : héros i placé à `map.startPositions[i]`. Aucune
  faction en dur (invariant §8). RNG seedé côté client dispo (`seedRng`/`rollRange`).
- Aucun changement de forme d'état ⇒ **pas de bump `CURRENT_SAVE_VERSION`**.

## Décisions

1. « Nouvelle partie » ouvre désormais une **modale de configuration** `NewGameScreen`
   (repointée sur `openModal({kind:'newgame'})`), au lieu de démarrer directement.
   L'ancien `startNewGame`/`newGameCommand` est CONSERVÉ (chemin `?seed=` du smoke, `#arena`).
2. Paramètres, chacun avec option **Aléatoire** (résolue déterministiquement depuis le
   seed au lancement) :
   - Nombre de joueurs : 2 / 3 / 4 (structure l'UI ⇒ pas d'« Aléatoire », arbitrage noté).
   - Par slot : contrôleur Humain / IA / Fermé + faction (liste + « Aléatoire »). ≥ 1 humain.
   - Taille de carte : Petite (24²) / Moyenne (36²) / Grande (48²) / Aléatoire.
   - Ressources : Bas / Standard / Riche / Aléatoire (échelle stock de départ + densité carte).
   - Difficulté IA : Facile / Normale / Difficile / Aléatoire.
   - Graine : affichée + bouton « 🎲 » (reproductibilité), éditable.
3. `generateMap` étendu : `startPositionCount` (N départs répartis en anneau, distincts,
   franchissables), `resourceMultiplier` + densité proportionnelle à l'aire (cartes plus
   grandes = plus d'objets). Défauts inchangés ⇒ 2 départs, densité base 24².
4. Nouveau constructeur `newGameStartCommand` (game.ts) : généralise skirmish à N sièges,
   réutilise `factionT1`/`DIFFICULTY_TUNING`/`SKIRMISH_BASE_ARMY`. IA mise à l'échelle,
   humains à la base. Objectifs eliminate/defeatHero. Villes neutres de la carte reprises.
5. UX chargement : état `loading:{label,progress}` dans le store + `LoadingOverlay` ; le
   handler `main.ts` échelonne les étapes (préparation → carte → positionnement →
   initialisation) avec `requestAnimationFrame` entre chaque pour que la barre se peigne.

## Étapes (avec vérif)

1. `mapgen.ts` : `startPositionCount` + anneau N départs + `resourceMultiplier` + densité
   ∝ aire. → vérif : `pnpm --filter @heroes/content test` (test étendu N départs).
2. `content.ts` : `resolveGeneratedMap(report, seed, opts?)` passe-plat. → typecheck.
3. `game.ts` : `NewGameSetupConfig` + `newGameStartCommand`. → typecheck.
4. `store.ts` (+`loading`), `router.ts` (`kind:'newgame'`). → typecheck.
5. `NewGameScreen.tsx` + `LoadingOverlay.tsx` + wiring `shell.tsx` + `MenuScreen.tsx`. → build.
6. `main.ts` : listener `heroes:start-newgame`, résolution des « Aléatoire » (seed),
   flux échelonné avec overlay. → build.
7. Locales `newgame.*` FR/EN (parité). → audit i18n (0 chaîne en dur).
8. `smoke.spec.ts` : adapter les 2 clics `menu-new-game` (→ écran → lancer) + nouveau test
   (choix 3 joueurs + taille + ressources + aléatoire → partie démarre). → `pnpm smoke`.
9. Typecheck + lint + tests + build + smoke + garde-fou « zéro faction dans le moteur ».

## Écarts constatés / décisions en cours de route
- Étapes 1→9 réalisées. `resolveNewGameConfig` (pure, testable) placée dans `game.ts`
  plutôt que `main.ts` (résolution des « Aléatoire » depuis le seed via RNG moteur).
- Nombre de joueurs laissé explicite (2/3/4) — pas d'option « Aléatoire » (structure l'UI) ;
  le siège 0 est toujours l'humain local (≥ 1 humain garanti).
- `startNewGame`/`newGameCommand` (solo) conservés : encore utilisés par le chemin `?seed`
  du smoke et `#arena`. Seul le listener DOM `heroes:new-game` (devenu orphelin) est retiré.
- Densité d'objets de carte mise à l'échelle par l'aire (grandes cartes peuplées) EN PLUS
  du réglage bas/riche — nécessaire pour que Grande ne soit pas vide.
- Vérifs passées : content test (N départs + densité), typecheck, lint, build (bundle gzip
  ~261 Ko < 800 Ko), garde-fou « zéro faction » vert, smoke complète (117 passed ; l'unique
  échec « préviz de chemin » mobile est un flake préexistant du chemin `?seed=42`/proto-01,
  non touché — repasse en isolation et couvert par `retries:2` en CI).
