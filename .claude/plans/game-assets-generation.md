# Plan — Génération des assets du jeu (préparation)

> **Statut** : phase de préparation — outillage + règles, **zéro intégration
> dans le code du jeu** (décision utilisateur : on ne touche pas au code
> d'origine pour brancher les images tout de suite).
>
> Référence méthodologique : le projet **Hogwarth** (`kenhuri69/hogwarth`),
> qui a validé en production un double pipeline **procédural (Python/Pillow)**
> vs **planche LLM + extraction QC** (`IMG_STYLE.md`,
> `tools/ICON_SHEET_PROCEDURE.md`, `tools/sheet_extract.py`,
> `tools/process_monster_png.py`, `tools/icon_factory.py`).
>
> Source de vérité du style : `docs/12-assets-style-guide.md` (créé dans ce lot).

---

## 1. Inventaire des familles d'assets & règle de génération

Trois modes, hérités de Hogwarth :

- **P — Procédural** : script Python/Pillow déterministe (seed fixe), committé,
  regénérable à l'identique. Pour les assets nombreux, systématiques, où la
  cohérence prime sur la singularité.
- **L1 — Planche LLM** : une grille N×M générée par un LLM image (Gemini /
  Nano Banana / Copilot) à partir d'un **prompt personnalisé par planche**
  dérivé des données du jeu, puis découpée/détourée/validée par
  `tools/assets/sheet_extract.py` (porte QC, exit 1 si échec).
- **L2 — Pièce unique LLM** : une image unique haute-touche (logo, fonds),
  éventuellement post-traitée.

| Famille | Volume estimé | Mode | Détail |
|---|---|---|---|
| **Tuiles de terrain** (grass, swamp, water, mountain, route) | ~13 PNG 64² tileables | **P** | `gen_tiles.py` — 3 variantes/terrain + route. Le client rend en 64 px (`TILE_SIZE = 64`). |
| **Icônes globales UI** (ressources or/bois/minerai/cristal/gemmes/essence, stats héros, mana, PM, XP, chance, moral, jour) | ~16 icônes × 5 mipmaps | **P** | `gen_ui_icons.py` — style unifié, retouches fréquentes. |
| **Icônes d'artefacts** | 4 actuels, ~40 à terme | **L1** | Planche fond gris clair → `sheet_extract.py`. Halo de rareté/cartouche procédural différé (lot intégration). |
| **Unités militaires** (sprite combat + carte) | 7-8/faction × 4 paquets ≈ 24 | **L1** | Une planche par faction (Règle A du guide : 512² painterly, fond transparent après détourage). Post-traitement `process_sprite.py`. |
| **Avatars de héros** | ~8 (2 archétypes might/magic × 4 factions) | **L1** | Règle B : buste painterly 256² (≠ Hogwarth qui fait du photoréaliste — ici tout le jeu reste painterly HoMM). |
| **Bâtiments de ville** (6 communs + 7-8/faction) | ~30 | **L1** | Une planche par faction + une planche « communs ». Vignettes pour l'écran de ville (liste), pas encore la vue de ville peinte (Beta). |
| **Fonds d'ambiance** (menu, écran de ville par faction, toile de fond combat par terrain) | ~8-10 | **L2** | Pièces uniques 1920×1080, zones sûres UI définies dans le guide. |
| **Logo du jeu** | 1 + déclinaisons | **L2** + P | Pièce unique LLM ; déclinaisons favicon/PWA par script (différé au lot intégration). |
| **Mines de ressources** (objets de carte) | 8 (une par ressource des manifestes) | **L1** | Planche `mines.md` dérivée de l'union startingResources + keyResources + factionResources ; silhouette lisible à 64 px. |
| **Objets de carte** (tas de ressources, gardiens, ville sur carte) | ~10 | P d'abord, L1 ensuite | Les pictos actuels du client suffisent pour l'instant ; planche L1 quand les tuiles seront intégrées. |

**Pont données → prompts** : `gen_prompts.py` lit `data/` (manifestes de
faction, unités, artefacts, bâtiments, locales FR/EN) et **génère les prompts
de planche personnalisés** dans `assets/prompts/*.md` — chaque fichier contient
la grille, l'ordre row-major des ids, le prompt prêt à coller, et la commande
`sheet_extract.py` exacte à lancer au retour. Une nouvelle faction = relancer
le script, zéro rédaction manuelle.

## 2. Arborescence (staging, hors code du jeu)

```
assets/                    ← STAGING versionné, non référencé par le client
  README.md                  garde-fou « pas d'intégration »
  prompts/                   prompts de planche générés (gen_prompts.py)
  tiles/                     tuiles procédurales (gen_tiles.py) + _preview.png
  ui/                        icônes UI procédurales (gen_ui_icons.py) + _preview.png
  raster_src/                sujets détourés issus des planches (sheet_extract.py)
  units/<faction>/           sprites finaux 512² (process_sprite.py)
  heroes/                    avatars 256²
  artifacts/                 icônes artefacts détourées
  buildings/<faction>/       vignettes bâtiments
  backgrounds/               fonds d'ambiance
  logo/                      logo + déclinaisons
tools/assets/              ← outillage Python (indépendant de packages/tools TS)
  requirements.txt           pillow, numpy, scipy (+ rembg optionnel, à la demande)
  gen_tiles.py               P — tuiles terrain tileables
  gen_ui_icons.py            P — icônes UI + mipmaps
  gen_prompts.py             pont données → prompts de planche
  sheet_extract.py           L1 — découpe + détourage + porte QC (porté de Hogwarth)
  process_sprite.py          L1 — détourage rembg d'une image unique + QC (porté de Hogwarth)
```

## 3. Skills

**Créées dans ce lot** (`.claude/skills/`) :
- `asset-sheet` : workflow complet planche LLM → extraction QC → staging
  (unités, artefacts, bâtiments, avatars). Encapsule les règles A/B/C du guide.
- `asset-procedural` : régénérer tuiles / icônes UI, ajouter un terrain ou une
  icône (recette dans le script, seed fixe, preview obligatoire).

**À activer plus tard** (définies, non créées — attendre le lot intégration) :
- `asset-integrate` : branchement client (loader Pixi, `Assets.load`,
  lazy-loading), garde du **budget bundle < 800 Ko gzip** (les PNG devront être
  chargés hors bundle initial ou le budget CI révisé), mise à jour du smoke.
- `add-faction-assets` : orchestration complète pour une nouvelle faction
  (gen_prompts → planches → extraction → staging), à la façon de la checklist
  `docs/06-modularity.md`.

## 4. Leçons Hogwarth reprises telles quelles

1. **Deux familles de règles à ne jamais confondre** (sprites painterly
   transparents vs portraits opaques) — repris en Règles A/B/C/D/E distinctes.
2. **Fond de planche PLAT et CLAIR (`#c8c8c8`)** — un fond sombre rend les
   sujets sombres indétourables (erreur historique Hogwarth, à ne pas refaire).
3. **Porte QC bloquante** : `sheet_extract.py` sort en code 1 si un id échoue ;
   on ne committe jamais un FAIL, on regénère la planche.
4. **Anti-bave** : tout composant touchant le bord de cellule est supprimé ;
   centrage sur le sujet nettoyé uniquement.
5. **Pas d'ombre au sol, pas de cadre, pas de texte** dans les images générées
   (ajoutés par le moteur/pipeline le cas échéant).
6. `rembg` u2net pour sujets opaques, `birefnet-general` pour translucides
   (fantômes Necropolis !) — dépendance lourde installée **à la demande**.
7. **Silhouette lisible à la taille d'affichage réelle** (unité ≈ 48-72 px dans
   l'arène hex, tuile 64 px, icône 16 px).
8. Suffix universel de prompt : `no text, no watermark, no signature,
   no border frame, no ground line`.

## 5. Étapes du lot courant

- [x] Étudier Hogwarth (IMG_STYLE.md, ICON_SHEET_PROCEDURE.md, skills,
      gen_*/icon_factory/sheet_extract/process_monster_png) → vérif : règles
      extraites et consignées ci-dessus.
- [x] Inventorier les besoins Heroes depuis `data/` et le client (terrains,
      lineups, artefacts, bâtiments, TILE_SIZE) → vérif : tableau §1.
- [x] Rédiger `docs/12-assets-style-guide.md` (Règles P/A/B/C/D/E, palettes
      par faction, prompts-types, critères QC) → vérif : relecture croisée
      avec IMG_STYLE.md, aucune contradiction avec docs/03-05.
- [x] Porter `sheet_extract.py` + `process_sprite.py` (chemins/­docs adaptés)
      → vérif : `--help` fonctionne, QC inchangée.
- [x] Écrire `gen_tiles.py` → vérif : exécution OK, 13 PNG 64² + preview,
      re-run = octets identiques (déterminisme).
- [x] Écrire `gen_ui_icons.py` → vérif : exécution OK, 16 icônes × 5 tailles
      + preview, déterminisme.
- [x] Écrire `gen_prompts.py` → vérif : exécution OK, un .md par planche avec
      ids/grille/commande exacte ; noms FR/EN résolus depuis les locales.
- [x] Créer les skills `asset-sheet` et `asset-procedural` → vérif : format
      SKILL.md conforme (frontmatter name/description).
- [x] Commit + push + PR draft → vérif : CI verte (aucun code du jeu touché,
      le smoke existant ne doit pas bouger). **Fait — PR #31 mergée.**

## 5bis. Lot 2 — planches Gemini « à découper par 8 » (villes / mines / artefacts)

- [x] `gen_prompts.py` : 8 sujets max par planche (grille 4×2, éclatement
      `-p1/-p2` au-delà — cible Gemini) → vérif : buildings-arcane-hunters
      éclaté en 2 planches, familles ≤ 8 inchangées.
- [x] Nouvelle famille **mines** : planche dérivée de l'union des ressources
      des manifestes (8 mines : gold/wood/ore/crystal/gems/mercury/essence/
      sulfur) → vérif : `assets/prompts/mines.md` généré avec la commande
      d'extraction exacte.
- [x] Guide (docs/12 §4) + README staging + plan mis à jour.
- [ ] **Production** (nouvelle session dédiée) : générer les planches dans
      Gemini, extraire (QC verte), ranger dans `assets/`, une PR par lot de
      planches validées → vérif : `sheet_extract` exit 0 sur chaque planche.
  - [x] `buildings-core` → 6/6 PASS, `assets/buildings/core/`.
  - [x] `buildings-haven` → 7/7 PASS, `assets/buildings/haven/` (Gemini a
        rempli 8 cellules avec un doublon sacré en cellule 6 : remap
        row-major avec id jetable pour la cellule 6, t6→cellule 7 griffon,
        t7→cellule 8 ange).
  - [x] `buildings-necropolis` → 7/7 PASS, `assets/buildings/necropolis/`
        (légendes texte parasites ajoutées par Gemini retirées comme specks
        via `--min-area`).
  - [x] `buildings-arcane-hunters-p1` → 8/8 PASS (T1-T8),
        `assets/buildings/arcane-hunters/` (légendes texte retirées via
        `--min-area`).
  - [ ] `buildings-arcane-hunters-p2`
  - [ ] `mines`
  - [ ] `artifacts`

## 6. Écarts / décisions notées en cours de route

- **Avatars héros painterly, pas photoréalistes** : divergence assumée avec la
  Règle B de Hogwarth — Heroes est 100 % painterly (cohérence HoMM), le
  photoréalisme jurerait avec les sprites d'unités.
- **Aucun héros nommé dans les données actuelles** (`startingHero` = stats
  seules) : les prompts d'avatars couvrent des archétypes par faction ; les
  héros nommés (différés depuis 3.3/3.4) réutiliseront le même pipeline.
- **Budget bundle < 800 Ko gzip** : les PNG ne rentreront jamais dans le budget
  actuel → l'intégration devra passer par du chargement différé (hors bundle)
  et/ou une révision du garde-fou CI. Risque tracé, à traiter au lot
  intégration, pas maintenant.
- `dechecker_png.py` / `defringe_png.py` / `icon_factory.py` (cadre + halo de
  rareté) de Hogwarth **non portés** pour l'instant : on ne les portera que
  quand le besoin se présentera (YAGNI, guidelines §2).
- Test navigateur (guidelines §7) : lot purement outillage + docs + staging,
  aucun code exécuté par le client n'est modifié — le smoke existant couvre la
  non-régression ; les scripts sont vérifiés par exécution directe.
