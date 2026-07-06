# Plan — Lot 5.3 : point d'extension moteur générique `symbiosis`

Ouvrir **un** point d'extension moteur **générique** (`symbiosis`) et l'exercer
en données sur les 6 unités Sylvestres T3/T6/T7. Zéro nom de faction dans
`packages/`. Modèle : `mark`/`consumeMarks`/`demonform`.

## Règle (doc 14 §2)

Une pile portant `symbiosis` accumule un **palier** à chaque **Défense** (tant
qu'elle ne bouge ni n'attaque volontairement), plafonné à `maxStacks`. Chaque
palier ajoute `attackPerRound` à l'attaque effective de frappe et
`defensePerRound` à la défense effective. Un **déplacement** ou une **attaque
volontaire** remet les paliers à 0 (l'attaque consomme le bonus). **La riposte
ne réinitialise pas** (le défenseur enraciné cogne fort en représailles).

## Étapes

1. `data/core/abilities.json` : ajouter `symbiosis` au catalogue.
   → vérif : `content:check` accepte les unités qui la portent.
2. `CombatStack.symbiosisStacks: number` (types.ts) + init `0` (setup.ts).
   → vérif : engine typecheck.
3. `damage.ts` : `symbiosisParams(def)` + `symbiosisAttackBonus` /
   `symbiosisDefenseBonus`, sommés dans strikerAttack / targetDefense.
   → vérif : bonus appliqué dans la frappe.
4. `actions.ts` : incrément dans `applyDefend` (cap `maxStacks`), remise à 0
   dans `applyMove` et à la fin de `applyAttack` (après toutes les frappes,
   donc la riposte du défenseur n'est pas affectée).
   → vérif : tests unitaires.
5. Données : `symbiosis` + params sur les 6 unités T3/T6/T7 Sylvestres.
   → vérif : `content:check` vert, test faction-recruit mis à jour.
6. Tests moteur `combat-symbiosis.test.ts` (6 cas) :
   accumulation+plafond, bonus Att (+ reset après attaque), bonus Déf,
   reset au déplacement, préservation en riposte.
   → vérif : `pnpm --filter @heroes/engine test` vert, **golden inchangé**.
7. Fixtures de test moteur existantes : ajouter `symbiosisStacks: 0` aux
   fabriques de `CombatStack` (8 fichiers).
   → vérif : engine typecheck.
8. Docs : doc 14 (État 5.3 + footnote + lineup), roadmap 09.

## Vérification par lot (obligatoire)

- [x] typecheck 4/4
- [x] tests moteur (289 ✓, golden intact — `symbiosisStacks` transitoire,
      purgé en fin de combat, n'affecte pas l'état sérialisé final)
- [x] tests content (73 ✓, faction-recruit mis à jour pour Symbiose)
- [x] `content:check` (5 paquets valides)
- [x] garde-fou faction (grep CI local : statut 1 = propre)
- [x] build client (JS gzip ~235 Ko, budget < 800 Ko tenu)
- [x] smoke Playwright desktop + mobile (74 ✓)

## Décisions / écarts constatés

- **Golden inchangé** confirmé : `symbiosisStacks` est un champ transitoire de
  combat, remis à `null` avec le reste de `combat` en fin de replay — l'état
  sérialisé final hashé n'en dépend pas. Pas de re-fixe golden.
- **Tests 5.3 initiaux fragiles** : les fixtures d'attaque à `count: 1` mouraient
  à la riposte, terminant le combat (pile/combat purgés) → assertions sur
  `symbiosisStacks` à `undefined`. Corrigé en donnant `count: 100` aux deux
  camps pour que le combat continue.
- **Test faction-recruit 5.2** asserait `abilities: []` sur T3 (Symbiose différée) ;
  mis à jour en 5.3 pour asserter les params `symbiosis` sur T3/T6/T7.
- Équilibrage des paliers vs coût/effectif : déféré au lot **5.4** (`faction:sim`).
