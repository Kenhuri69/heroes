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

## Correctif 2 — portrait de héros (I7a)
Le grand portrait du tiroir héros (toujours visible) était un **cercle gris nu**
quand aucun avatar dédié n'existe (test-faction, factions sans avatar). Remplacé
par un **repli procédural** : médaillon serti de laiton portant l'**initiale**
dorée du héros (résolue via `resolveHeroName`), mêmes dimensions que l'avatar réel
(aucun saut de mise en page). Générique sans nom ⇒ juste le médaillon serti.
- `shell.tsx` : contenu du `fallback` de l'`AssetImg` du tiroir.
- `styles.css` : `.hero-portrait-placeholder` (dégradé radial + anneau laiton) +
  `.hero-portrait-initial` — **tokens `var(--…)` uniquement** (garde-fou couleur OK).
- **Vérifié** : capture (médaillon « A » pour Aldric) ; garde couleur, lint,
  typecheck verts ; smokes I7 + E7 verts (le `.hero-portrait-avatar/-mini` du
  HeroStrip intact).

## Reste noté (non fait ici)
- Repli mini du HeroStrip (28px) encore gris nu — moins proéminent, laissé tel quel.
- I6 fond de ville plat → chantier d'assets (doc 12), déféré.

## Suivi
- [x] Playtest captures + revue
- [x] Zoom initial carte d'aventure (vérifié captures + @core)
- [x] Portrait héros — repli procédural à initiale (vérifié capture + smokes)
