# Plan — Passe de playtest + zoom initial de la carte d'aventure

## Démarche
Passe de playtest « yeux frais » sur le jeu rendu (skill run/verify) : captures des
écrans clés en desktop + mobile (menu, carte d'aventure, pré-combat, combat, ville)
via une spec Playwright jetable, revue visuelle.

## Constat
- **Menu / combat (desktop + mobile) : excellents** — fond peint, logo crest, grille
  hex, obstacles, file d'initiative, bandeau d'aide ancré, boutons désactivés motivés.
- **Ville** : fonctionnelle, fond plat (I6 « ville = lieu » — gros chantier d'assets,
  hors périmètre).
- **Carte d'aventure (🔴 I1)** : au zoom 1, en début de partie (brouillard + petite
  carte proto), la zone explorée **flotte au milieu du noir** — premier écran peu
  engageant. Portrait héros = cercle gris (I7a, placeholder — noté, séparé).

## Correctif livré (le plus rentable)
- **Zoom initial de la carte d'aventure 1 → 1.6** (`AdventureScene.centerOnHero`,
  const `INITIAL_ADVENTURE_ZOOM`, borné par le zoom max caméra 2×). Le terrain
  remplit la vue au démarrage ; le joueur dézoome librement. Client only, zéro moteur.
- **Vérifié empiriquement** : captures avant/après (desktop + mobile) — le terrain et
  les objets remplissent la vue, le noir recule. `@core` (43 tests, dont tap-tap réel
  via `tileToScreen` qui suit le zoom) vert ; lint + typecheck verts.

## Reste noté (non fait ici)
- I7a portrait héros = cercle gris (placeholder) → repli procédural (badge/initiales)
  ou avatar — lot séparé.
- I6 fond de ville plat → chantier d'assets (doc 12), déféré.

## Suivi
- [x] Playtest captures + revue
- [x] Zoom initial carte d'aventure (vérifié captures + @core)
