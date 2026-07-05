# Plan — Identification + création des nouveaux assets manquants

> **Statut** : staging uniquement, **zéro intégration client** (décision
> utilisateur : « ne cherche pas à la connecter au source du jeu tout de
> suite »). Cadre : `docs/12-assets-style-guide.md` + skills `asset-procedural`
> / `asset-sheet` + `.claude/plans/game-assets-generation.md`.

## 1. Inventaire — éléments demandant la création d'asset (croisé `data/` ↔ `assets/`)

| Famille | Élément | Mode | État |
|---|---|---|---|
| UI ressources | **`res-sulfur`** (ressource commune du moteur `RESOURCE_IDS`, keyResource necropolis, `mine-sulfur` existe) | **P** | **MANQUANT** → produire |
| UI ressources | **`res-mercury`** (ressource commune du moteur, keyResource arcane-hunters, `mine-mercury` existe) | **P** | **MANQUANT** → produire |
| Tuiles terrain | grass/swamp/water/mountain + route | P | ✅ complet (4 terrains config, déterministe) |
| UI stats/divers | attack…morale, xp, day | P | ✅ complet |
| Mines | 8 ressources | L1 | ✅ produit |
| Artefacts | 4 | L1 | ✅ produit |
| Bâtiments | core + haven + necropolis + arcane-hunters | L1 | ✅ produit |
| **Unités** | haven (7), necropolis (7), arcane-hunters (8), test-faction | **L1** | ❌ aucun PNG (prompts seuls) |
| **Avatars héros** | ~8 archétypes might/magic × factions | **L1** | ❌ aucun PNG (prompt seul) |
| **Fonds d'ambiance** | menu / ville / combat | **L2** | ❌ aucun PNG (prompt seul) |
| **Logo** | master | **L2** | ❌ aucun PNG (prompt seul) |

Constat annexe : les `assets/prompts/*.md` committés étaient **périmés** vs
`gen_prompts.py` + données (noms mieux localisés, renommage réel « Cercle de la
Vigile » → « Cercle du Vigile ») → rafraîchir.

## 2. Stratégie appliquée par mode

- **P (procédural)** — productible entièrement par script maintenant :
  ajouter `sulfur` + `mercury` dans `gen_ui_icons.py`, regénérer.
- **L1 / L2 (planche / pièce LLM image)** — la production des pixels passe par
  un **LLM image externe** (Gemini/Nano Banana, étape manuelle du pipeline
  projet, cf. game-assets-generation §5bis « session dédiée »). Étape
  autonome réalisable ici : **rafraîchir les prompts depuis les données** pour
  que les planches soient prêtes à produire. La génération des pixels
  elle-même est remontée à l'utilisateur (choix de l'outil image).

## 3. Étapes

- [x] Ajouter `res-sulfur` + `res-mercury` à `gen_ui_icons.py` (style Règle P,
      lisibles 16 px, distincts de gold/ore/crystal/mana) → preview OK.
- [x] Regénérer les icônes UI → 18 icônes × 5 mipmaps, re-run déterministe
      (hash run1 == run2 ✅).
- [x] Rafraîchir les prompts (`gen_prompts.py`) → drift limité aux noms
      localisés (artifacts + buildings hors core), cohérent.
- [x] Commit + push + PR draft #56. Aucun code client touché → smoke inchangé.
- [x] Reporter l'inventaire L1/L2 et demander à l'utilisateur comment produire
      les pixels → **décision : l'utilisateur génère les planches dans Gemini**,
      j'extrais au retour (sheet_extract.py + QC + rangement staging).

## 4bis. Garde-fou marge (ajouté en cours de prod)
Le LLM cadrait trop serré → ailes/armes rognées par l'anti-bave. Constante
`MARGIN_GUARD` ajoutée à `gen_prompts.py` (`_sheet_file`, partagée par toutes
les planches ; absente des pièces uniques bg/logo). Prompts regénérés.

## 4ter. Progression production
- [x] **Haven** (T1→T7) : planche regénérée avec marge → extraction **7/7 PASS**
      (0 FAIL), rangée dans `assets/units/haven/` (512² RGBA). Texte/grille
      parasites Gemini retirés comme specks.
- [x] **Necropolis** (T1→T7) : extraction 7/7 PASS. Le Dragon d'os (t7)
      débordait cellule 7→8 (aile droite coupée à la découpe grille) → repris
      via crop manuel bas-droite + `sheet_extract --cols 1 --rows 1` (dragon
      complet). Rangé dans `assets/units/necropolis/`.
- [x] **Arcane Hunters** (T1→T8) : extraction 8/8 PASS (garde-fou marge OK,
      bleed_removed 0, ailés t2/t7/t8 complets). `assets/units/arcane-hunters/`.
- [ ] test-faction (unités)
- [ ] Avatars de héros
- [ ] Fonds, logo (L2)

## 5. Suite (en attente des planches utilisateur)
Prompts prêts à coller (chacun avec sa commande d'extraction dans le .md) :
`assets/prompts/units-{haven,necropolis,arcane-hunters,test-faction}.md`,
`hero-avatars.md`. Pièces L2 : `backgrounds.md`, `logo.md` (détourage/placement
direct via process_sprite.py au retour). Au retour d'une planche : lancer la
commande `sheet_extract.py` inscrite, contrôler le QC (vert=PASS), ranger dans
`assets/units/<faction>/` ou `assets/heroes/`. Jamais committer un FAIL.

## 4. Écarts / décisions
- Les familles L1/L2 (unités, avatars, fonds, logo) ne sont pas productibles
  sans outil image ; on prépare (prompts) sans forcer une génération
  low-fidelity qui échouerait la porte QC de `sheet_extract.py`.
