# Squelette élite → Squelette archer (tir) + asset dédié

**Demande** : revoir les squelettes morts-vivants pour que leur **version évoluée**
(élite, habitation niveau 2) devienne un **archer** doté d'une **attaque à
distance**, comme dans une des versions de la série (HoMM V : *Skeleton* →
*Skeleton Archer*). À traiter « dans son ensemble », y compris le **nouvel asset**
(prompt Gemini).

## Constat (état avant)

| | id | PV | Att | Déf | Dégâts | Vit. | Croiss. | Coût | Capacités |
|---|---|---|---|---|---|---|---|---|---|
| base | `t1-squelette` | 5 | 2 | 2 | 1–2 | 4 | 16 | 28 or | `undead`, `banishable` |
| élite | `t1-squelette-elite` | 7 | 3 | 3 | 1–3 | 5 | 16 | 40 or | `undead`, `banishable` |

- L'élite n'était qu'un squelette « un peu meilleur » (aucune capacité propre) —
  divergence avec la série où l'amélioration du squelette est un **tireur**.
- Le tir est déjà **génériquement** couvert par la capacité `shooter { ammo }`
  (`data/core/abilities.json`, moteur `combat/state-helpers.ts` +
  `combat/actions.ts`) : **aucun code moteur à écrire**.
- La Nécromancie relève `t1-squelette` (**base**, manifeste
  `raiseUndeadOnVictory.unitId`) ⇒ inchangée : on ne relève pas des archers.

## Décisions

1. **Id conservé** (`t1-squelette-elite`) : les ids d'unité sont sérialisés dans
   les sauvegardes (piles d'armée, garnisons) et référencés par
   `buildings.json`/`manifest.json` + le nom de fichier de l'asset. Renommer
   l'id imposerait un bump `CURRENT_SAVE_VERSION` pour un gain nul —
   l'identité de l'unité vit dans les **locales** et l'asset.
2. **Compensation d'équilibrage** : un tireur T1 à 16/semaine est la hausse de
   puissance la plus sensible de la faction (mesuré : **+33 pts** de winrate
   moyen sans bridage). L'archer troque donc la robustesse de l'ancien
   « guerrier » (PV 7→6, Déf 3→2, Vit. 5→4) et **garde les dégâts de la base**
   (1–3 → 1–2) contre la portée, avec un **carquois court** (`ammo: 4`) et un
   premium de coût modéré (40 → 45 or). Jamais **sous** la base sur aucune stat
   (invariant de parité, cf. étape 3).
3. **Parité base → élite** (test `elite-ability-parity`) : `undead` +
   `banishable` conservés, `shooter` ajouté — l'élite reste un sur-ensemble.
4. **Asset** : le PNG actuel montre un squelette **à la lame** ⇒ obsolète.
   Prompt Gemini dédié **image unique** (le sprite doit être remplacé seul, pas
   la planche des 8 déjà validés) + regénération de la planche générée pour
   qu'elle reste cohérente avec les données. Le PNG « guerrier » reste en place
   jusqu'au retour de la génération (repli gracieux, pas d'asset manquant).

## Étapes

1. [x] Données : `shooter { ammo: 4 }` + stats/coût sur
   `data/factions/necropolis/units/t1-squelette-elite.json`
   → vérif : `pnpm content:check` vert, `elite-ability-parity` vert.
2. [x] Locales FR/EN : `Squelette archer` / `Skeleton Archer` + lore réécrit
   (arc d'os, carquois) → vérif : `pnpm content:check` (clés résolues), zéro clé
   orpheline.
3. [x] Test de contenu **faction-agnostique** : toute élite qui gagne `shooter`
   par rapport à sa base déclare des munitions > 0 et ne régresse sur aucune
   stat vis-à-vis de sa base → vérif : test rouge avant / vert après.
4. [x] Doc 04 §3bis : ligne T1 des élites + note de fidélité HoMM
   → vérif : relecture, chiffres identiques aux données.
5. [x] Prompts d'assets : `python3 tools/assets/gen_prompts.py` (planche
   necropolis p1, cellule 8 devient « aiming a ranged weapon ») + prompt
   **image unique** `assets/prompts/units-necropolis-skeleton-archer.md`
   → vérif : diff des prompts limité à la cellule 8, commande d'extraction
   pointant `assets/units/necropolis/`.
6. [x] Équilibrage : `pnpm faction:sim` avant/après **+ lecture ad hoc**
   (le sim n'oppose que les unités de base ⇒ aveugle aux élites)
   → vérif : pas de **nouvelle** béance (> 80 %) introduite — cf. mesures.
7. [x] Non-régression : `pnpm typecheck` ✓, `pnpm lint` ✓, `pnpm test` ✓
   (935 moteur + 165 contenu + 74 client ; **golden inchangé** comme prévu),
   `pnpm build` ✓, smoke `@core` desktop ✓ (43 tests).
   ⚠️ Le smoke ne recrute pas d'élite T1 morte-vivante : la couverture réelle de
   ce changement est l'unitaire de contenu (étape 3) + les tests de recrutement
   existants, pas le navigateur.

## Écarts / notes

- **Golden replay** : inchangé — le replay golden n'utilise que des unités
  synthétiques, jamais les unités de faction (précédent : lots
  `cap-content-wiring` et `faction-balance-pass-2`).
- **Pas de bump `CURRENT_SAVE_VERSION`** : aucune forme d'état ne change (seule
  la table de contenu chargée depuis `data/` évolue).
- **Zéro diff moteur / client** : le tir, les munitions et l'affichage des
  capacités sont déjà génériques.
- Étape 3 : l'ancien élite étant **plus robuste** que le nouvel archer, le test
  n'ancre que le rapport **base → élite** (le seul invariant documenté) ; la
  régression volontaire par rapport à l'ancien élite est un choix
  d'équilibrage, pas une violation.
- **Asset** : `gen_prompts.py` a aussi révélé une **dérive préexistante** des
  prompts générés (artefacts, bâtiments core, machines de guerre, planches
  bâtiments de la faction éclatées en p1/p2 depuis un lot antérieur) — **revertée**
  (§3 des guidelines) : seule la cellule 8 de `units-necropolis-p1.md` est
  committée. Le PNG lui-même reste **à générer** par l'utilisateur (prompt
  `assets/prompts/units-necropolis-skeleton-archer.md`, image unique, extraction
  QC) ; l'ancien sprite « guerrier » tient la place d'ici là.
- Constat **hors périmètre** (non corrigé, signalé) : la colonne « Capacités »
  du tableau des élites (doc 04 §3bis) est périmée pour T2/T4/T5/T6 — les
  données portent bien `curseOnHit`, `lifeDrain`, `areaAttack`, `charge` sur les
  élites (invariant `elite-ability-parity` livré depuis), alors que la note
  « les élites perdent les capacités actives de leur base » dit l'inverse.

### Mesures d'équilibrage

**`pnpm faction:sim` : identique au bit près avant/après** — 1 béance au duel
(`arcane-hunters vs dungeon` 85 %, préexistante), 14 à surveiller, gauntlet
inchangé. Raison : `valueArmy()` construit les armées depuis
`manifest.town.dwellings`, c'est-à-dire les unités **de base** ⇒ **le sim est
structurellement aveugle aux unités élites**. Le gate CI n'a donc rien à dire
sur ce lot (constat d'outillage à remonter ; l'étendre aux élites = un lot
`faction-sim` à part entière, hors périmètre ici).

**Lecture ad hoc** (script jetable, non committé — `simulateAutoCombat` sur
armée complète 7 tiers, budget 4000 or/tier, 60×2 graines, T1 substitué,
adversaires en armée de base) :

| Variante T1 de la Nécropole | Moyenne | Pire duel |
|---|---|---|
| base `t1-squelette` (28 or) — reproduit `faction:sim` (72,5 / 42,5 / 29,2 / 74,2 / 60,8) | **55,8 %** | 74,2 % |
| élite héritée « guerrier » mêlée (40 or) | **49,7 %** | 73,3 % |
| élite archer **non bridée** (1–3 dégâts, 6 tirs, 50 or) | **83,0 %** | **94,2 %** ✗ |
| élite archer **retenue** (1–2 dégâts, 4 tirs, 45 or) | **57,0 %** | 77,5 % ✓ |

⇒ la version retenue reste dans la bande de la base et de l'ancienne élite,
aucun duel > 80 %, tout en offrant une vraie option de jeu (portée).
Variantes écartées mesurées au passage : `1–2 / 3 tirs / 45 or` = 46,3 %
(en-dessous de l'ancienne élite), `1–2 / 6 tirs / 60 or` = 46,7 % (le coût
achète moins de corps sans supprimer la dominance), `1–3 / 2 tirs / 50 or`
= 39,3 % (trop punitif).
