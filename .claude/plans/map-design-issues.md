# Revue des cartes générées — problèmes & plan de correction

Constats issus d'une revue en jeu (captures mobile, cartes aléatoires « Nouvelle
partie ») recoupés avec le code. Quatre problèmes distincts, chacun avec sa
cause racine identifiée et son lot de correction. Zéro diff moteur attendu :
tout se joue dans `@heroes/content` (mapgen), le client (rendu/palette) et les
données/assets.

## Constats (avec cause racine)

### P1 — « Villes neutres » sans asset : en réalité des gardiens sans sprite

Ce qui ressemble à une ville neutre réduite à un drapeau grisé est le **repli
procédural du gardien** (`buildGuardian`, `packages/client/src/render/mapObjects.ts:345`) :
un fanion gris sur mât, affiché tant que le sprite de l'unité n'est pas résolu.

Causes racines :
- La palette de gardiens des cartes aléatoires est **toutes les unités connues**
  (`resolveGeneratedMap`, `packages/client/src/app/content.ts:77` →
  `knownUnitIds`), y compris :
  - `test-faction` (présente dans `data/factions/index.json` de prod, 1 seul PNG) ;
  - `sylvan-court` (**aucun** dossier `assets/units/sylvan-court/`).
  Un gardien tiré de ces unités reste un fanion gris pour toujours.
- Par ailleurs, `generateMap` ne produit **aucune vraie ville neutre**
  (aucun objet `type: 'town'`), alors que `newGameStartCommand` sait les
  instancier (`packages/client/src/app/game.ts:884`). Le joueur s'attend à en
  rencontrer (cf. capture : drapeaux interprétés comme des villes).

### P2 — Lieux inaccessibles (poches fermées par montagnes/eau)

`generateMap` (`packages/content/src/mapgen.ts`) force la franchissabilité de la
tuile de chaque objet et une poche 3×3 aux départs, mais **aucun contrôle de
connexité globale** n'existe : le bruit d'élévation peut fermer une cuvette par
des montagnes/rochers/eau, avec objets (voire départ) injoignables. Les rivières
« aident la connexité » sans la garantir.

### P3 — Mines/objets rendus « au milieu de 4 cases »

Les objets ramassables et les mines passent par `placeSprite`
(`mapObjects.ts:27`) : ancre **centrée** (0.5, 0.5) au centre de la boîte de
contenu. En projection iso (losange 64×32), un sprite ~64 px centré déborde sur
les 4 losanges voisins → impossible de lire quelle case occupe l'objet. Les
villes, gardiens et props de relief ont déjà été corrigés en « base centrée »
(`anchor(0.5, 1)` posé au centre du losange — cf. commentaires dans
`townsLayer.ts:72` et `mapObjects.ts:363`) ; les mines/ressources/coffres/
artefacts/lieux de bonus, non.

Problème connexe (constat utilisateur) : la **mine capturable et le tas de
ressource ramassable partagent le même asset** — `buildMine` réutilise
`buildResourcePile` (`mapObjects.ts:284-289`), qui charge `mines/mine-<res>`
dans les deux cas. Seul le fanion distingue les deux objets, alors qu'ils ont
des gameplay opposés (bâtiment permanent à capturer vs objet consommé au
passage). Il faut une **famille d'assets dédiée aux tas ramassables**, l'asset
de mine restant exclusif aux mines.

### P4 — Pas de progression des gardiens autour du départ

`generateMap` place les gardiens de champ sur des tuiles **uniformément
aléatoires** (`mapgen.ts:457-467`) avec un comptage global
(`randBetween(2,4) × areaFactor`). Le tier est gradué par la profondeur
(`depthAt`) mais rien ne garantit des gardiens **faibles et nombreux près de
chaque départ** : on peut n'avoir qu'un gardien moyen proche puis un fort
lointain (constat en jeu). De plus le jitter `randBetween(-1,1)` s'applique à
l'index dans la liste d'unités triée par tier (~40 unités), pas au tier — près
d'un départ il peut faire sauter plusieurs tiers d'un coup si la palette est
dense.

---

## Plan de correction étape par étape

Chaque lot est indépendamment livrable (PR atomique), avec critère de
vérification. Ordre proposé = impact joueur décroissant.

### Lot 1 — Palette de gardiens saine (fin des drapeaux gris) — ✅ livré

1. [x] Dans `resolveGeneratedMap` (client), **filtrer la palette de gardiens**
   aux unités dont le sprite existe (`unitSpriteUrl` non-undefined) —
   déterministe à build donné, zéro diff moteur/contenu. Repli sur la palette
   complète si AUCUN art n'est présent (build sans assets).
   → vérif : pas d'infra de test unitaire client (le registre d'assets dépend
   de `import.meta.glob` Vite) ⇒ vérifié par typecheck + build + smoke.
2. [x] `test-faction` **reste** dans `data/factions/index.json` : elle est
   câblée dans la config de départ (`config.newGame.startingHero`), proto-01 et
   le smoke — la retirer casserait la partie par défaut. Le filtre du point 1
   l'écarte déjà des cartes aléatoires.
3. [x] Repli visuel du gardien durci : silhouette de créature (ombre + torse +
   tête cornue, yeux jaunes) au lieu du fanion gris pris pour une ville.
4. [ ] (Suivi, hors lot) Générer les planches d'unités `sylvan-court` via le
   skill `asset-sheet` pour compléter `assets/units/`.

### Lot 2 — Ancrage iso des objets de carte (mine sur SA case) — ✅ livré

1. [x] `placeSprite` passe en « base centrée » (`anchor(0.5, 1)`), base posée un
   quart de losange sous le centre (ces assets embarquent leur socle iso, qui
   recouvre ainsi le losange de la case) — s'applique à tous les objets peints :
   mines, tas, coffres, artefacts, lieux de bonus, camps.
2. [x] `groundDiamond()` : losange de sol discret sous CHAQUE objet de carte
   (posé par `buildObject`), matérialise la case exacte à viser.
3. [x] Visuels mine / tas séparés : résolveur `resourcePileUrl`
   (`resources/pile-<res>`, préchargé PixiJS) pour les tas ramassables ;
   `buildMine` garde `mines/mine-<res>` en exclusivité, avec un repli procédural
   de bâtiment (distinct du losange du tas).
4. [ ] (Suivi, hors lot) Générer les PNG des tas (`gold/wood/ore/crystal/gems`)
   dans `assets/resources/`.
   → vérif : typecheck/lint/build + smoke complet (les tests existants « appui
   long sur la mine » et « assets sans 404 » couvrent la zone).

### Lot 3 — Connexité garantie de la carte générée — ✅ livré

1. [x] Flood-fill 8 directions depuis le premier départ, après le placement de
   tous les objets (l'A* du jeu autorise le pas diagonal sans blocage de coin :
   le flood-fill 8 dir reflète exactement l'atteignabilité réelle).
2. [x] Pour chaque départ/objet hors composante : corridor creusé en pas
   8 directions vers la tuile de la composante la plus proche (balayage
   déterministe), tuiles bloquantes → terrain de base, puis fusion de la poche
   dans la composante (`grow`). Jamais de relocalisation silencieuse.
3. [x] Garde finale implicite : chaque cible passe par `connect` (no-op si déjà
   dans la composante).
   → vérif : property test « chaque départ et chaque objet est atteignable
   depuis le 1er départ » (12 graines × {24²/2 joueurs, 48²/3 joueurs}) ; les
   tests de déterminisme existants passent inchangés ; cartes du dépôt non
   affectées (elles ne passent pas par `generateMap`).

### Lot 4 — Gradient de gardiens autour des départs

1. Stratifier le placement : répartir le budget de gardiens par **anneaux de
   profondeur** (ex. 40 % en zone proche `depth < 0.35`, 35 % en zone médiane,
   25 % en zone profonde), en échantillonnant les tuiles DANS l'anneau visé
   plutôt qu'uniformément.
2. Garantir un minimum par départ : ≥ 2–3 gardiens de tier 1–2 dans l'anneau
   proche de **chaque** position de départ.
3. Borner le tier par la profondeur : plafond de tier croissant avec `depth`
   (fini le tier élevé collé au départ via jitter) ; appliquer le jitter au
   **tier** puis choisir une unité de ce tier, pas à l'index brut de la liste.
   → vérif : test statistique déterministe (graines fixes) : pour chaque départ,
   compter les gardiens par anneau/tier — minimums respectés, aucun gardien
   au-dessus du plafond de tier de son anneau.

### Lot 5 (option, après 1–4) — Vraies villes neutres générées

1. Émettre dans `generateMap` 1–2 objets `type: 'town'` en zone médiane/profonde
   (faction tirée de la palette des paquets chargés, garnison graduée par la
   profondeur) — `newGameStartCommand` les instancie déjà, et le rendu
   `townsLayer` a l'asset `map/town-<faction>` + repli donjon.
   → vérif : test mapgen (villes présentes, garnison > 0, tuile franchissable,
   connexité lot 3) + capture : château neutre visible avec liseré « assiégeable ».

## Suivi

- [ ] Lot 1 — palette gardiens + repli visuel
- [ ] Lot 2 — ancrage iso des objets
- [ ] Lot 3 — connexité (flood-fill + corridors)
- [ ] Lot 4 — gradient de gardiens par anneaux
- [ ] Lot 5 — villes neutres générées (option)
