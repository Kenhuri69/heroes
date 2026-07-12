# Lot F-SCHOOLS.7 — École de la Traque : Mue Éphémère (furtivité)

> Backlog `.claude/plans/game-feature-gaps.md` §2.3 F-SCHOOLS.7+.
> Doc source : `docs/05-faction-arcane-hunters.md` §6 (« Mue Éphémère — Une pile
> alliée gagne `stealth` jusqu'à sa prochaine action », cercle 3).

## But (un sous-lot = une mécanique)

5ᵉ des sorts Traque restants : **Mue Éphémère** — nouvelle mécanique de combat
**générique** « furtivité » : une pile alliée devient **inciblable** par l'ennemi
(attaque, tir, sort, frappe de héros) jusqu'à ce qu'elle prenne sa prochaine
action.

## Décisions de conception

- **Générique** : `SpellKind 'stealth'` + champ `CombatStack.stealthed?: boolean`.
  Le moteur ne lit qu'un booléen ; aucune faction.
- **Inciblable** : une pile `stealthed` est exclue de **TOUS** les sites de
  sélection de cible ENNEMIE — centralisé pour ne rien manquer. Sites :
  attaque (`attackableTargets` + validate), tir (`canShootTarget`), sort d'unité
  (validate), sort de héros (validate), frappe de héros (validate), IA (`chooseAction`
  + `maybeHeroAction`). La furtivité n'empêche PAS de bloquer le passage ni de
  menacer (une pile furtive agit et redevient visible).
- **Fin** : `stealthed` retombe quand la pile prend sa prochaine **action réelle**
  (`afterAction`, hors Attendre — patron F-RESON.2).
- **Ciblage du sort** : allié (`spellTargetsEnemy('stealth') = false`), UI existante.
- **Save** : `CombatStack.stealthed` verrouillé par le garde `save-shape`
  (StackKey) ⇒ **bump `CURRENT_SAVE_VERSION` 27→28** + StackKey. Golden re-fixé
  UNE fois SI la forme change le hash (champ optionnel jamais posé dans le golden
  ⇒ attendu inchangé). Doc 07 §4.

## Étapes

1. Engine `combat/types.ts` : `CombatStack.stealthed?`.
2. Engine `hero/types.ts` : `SpellKind += 'stealth'`.
3. Engine `combat/spell-effect.ts` : branche `stealth` (pose `stealthed`).
4. Engine `combat/actions.ts` : `afterAction` retire `stealthed` ; exclusion aux
   sites attaque/tir/sort d'unité.
5. Engine `hero/index.ts` : exclusion sort de héros ; `combat/hero-attack.ts` :
   exclusion frappe de héros ; `combat/ai.ts` : exclusion IA (×2).
6. `core/state.ts` bump 27→28 + commentaire ; `save-shape.test.ts` StackKey +28 ;
   `docs/07` §4.
7. Content `schemas.ts` : `kind += 'stealth'`.
8. Données `data/core/spells.json` : `mue-ephemere` (traque, cercle 3, kind
   stealth) + locales core FR/EN.
9. Doc 05 §6 : note « livré ».
10. Tests : engine (inciblable attaque/tir/sort/héros/IA ; visible après action).
11. Pipeline complet + golden/save-shape re-fixés.

## Journal

- Branche `claude/f-schools-7` créée depuis main (744a28b).
- **Livré.** `SpellKind 'stealth'` + `CombatStack.stealthed?` (bump save **27→28**).
  Exclusion centralisée aux sites de ciblage ennemi : `attackableTargets`,
  `canShootTarget`, validate attaque/sort d'unité/sort de héros/frappe de héros,
  IA (`chooseAction` via `targetable`, `maybeHeroAction`). Furtivité retirée dans
  `afterAction` (hors Attendre). Sort de camp allié (`mue-ephemere`, cercle 3) +
  locales FR/EN. Client : aucun diff (SpellBook cible déjà l'allié via
  `spellTargetsEnemy`). Doc 05 §6 + doc 07 §4.
- Golden re-fixé UNE fois (`2d4de0ae`→`cfa19967`) : **forme seule** — seul
  `saveVersion` (28) change dans l'état haché, `stealthed` jamais posé dans le
  golden. save-shape → 28 + StackKey.
- **Édge documenté** : la furtivité protège du ciblage DIRECT ; les dégâts de
  zone collatéraux (`splash`/`areaAttack`/`breathAttack` d'une frappe sur une
  cible voisine légale) peuvent toucher une pile furtive adjacente — exception
  assumée.
- Vérifs : typecheck 5/5, lint, engine 620 (+5 `combat-stealth`), content 116,
  content:check, garde-fous faction+couleurs verts, build, bundle ~294 Ko gzip
  < 800, smoke 168 passed.
