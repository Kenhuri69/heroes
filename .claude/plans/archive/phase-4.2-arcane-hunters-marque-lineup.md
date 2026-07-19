# Plan — Phase 4.2 : Arcane Hunters — Marque + lineup (data-only)

Sous-lot 4.2 du plan Alpha (`phase-4.1`). But : rendre la faction **jouable via
sa signature** (Marque du Chasseur) avec son lineup.

## Découverte majeure

Le **point d'extension (1)** prévu au cadrage (Marque déclarative) **existe
déjà, générique**, depuis le lot combat 2.4 :
- `CombatStack.marks` (0–3), event `MarkApplied` ;
- capacité générique `mark` (au catalogue `data/core/abilities.json`) : à
  l'attaque, applique +1 charge à la cible, plafonnée à `rules.marksMax` ;
- `combat/damage.ts` : `mult *= 1 + rules.markBonusPerStack * targetMarks`
  (config `markBonusPerStack: 0.08`, `marksMax: 3`) — **tout attaquant** gagne
  le bonus contre une cible marquée, sans aucun nom de faction.

⇒ **La signature ne demande AUCUN diff moteur** : 4.2 est **data-only**, comme
Haven (3.3). C'est un résultat fort pour le test de modularité #3 (le moteur
était déjà assez générique). Écart assumé vs doc 05 §3.1 : le bonus de Marque
est universel (tout attaquant), pas réservé aux Hunters/sorts de Traque —
simplification générique déjà en place ; un raffinement « bonus conditionnel à
l'attaquant » serait un point d'extension ultérieur si nécessaire.

## Périmètre 4.2 : T1–T7

`tiers` peut rester 8 (seule contrainte : `unit.tier ≤ tiers`). On livre le
lineup **T1–T7** jouable maintenant ; **T8** (Pénitent) est reporté en **4.6**
car il dépend de : coût en **Essence** (ressource de faction non branchée avant
4.4), capacité **demonform** (module stateful, 4.6), croissance partagée
**apex** T7/T8. `sharedGrowthGroups` reste `{}` jusqu'à 4.6.

Capacités : seules celles du catalogue (`flying, shooter, noRetaliation, mark,
undead, doubleAttack`) sont posées. Les capacités exotiques de doc 05 (swarm,
expose, executioner, pinningShot, poisonSting, strikeAndReturn, spellcaster,
magicResistance, areaAttack) sont **différées** (4.3+) — documenté, comportement
non-crash (l'unité combat sans sa capacité spéciale en attendant).

| Tier | Unité | Stats (PV/A/D/dég/vit) | Croiss | Coût | Capacités **posées** (différées) |
|---|---|---|---|---|---|
| 1 | Élève de Sombreveille | 5/3/2/1-3/5 | 12 | 35 or | `mark` (swarm) |
| 2 | Familier lié | 9/4/3/2-3/8 | 9 | 90 or | `flying`,`mark` (expose) |
| 3 | Préfet de Cercle | 17/6/6/3-6/5 | 7 | 170 or +1 mercure | `shooter(10)`,`mark` |
| 4 | Bibliothécaire Errant | 34/7/10/5-8/4 | 5 | 340 or | `mark` (spellcaster, magicResistance) |
| 5 | Lame du Serment | 40/12/8/8-12/8 | 3 | 620 or +1 mercure | `mark` (strikeAndReturn, executioner) |
| 6 | Chasseresse de l'Abîme | 62/15/11/11-17/9 | 2 | 1200 or +2 mercure | `shooter(8)`,`mark` (pinningShot) |
| 7 | Manticore de Dressage | 130/18/16/24-36/11 | 1 | 2600 or +2 mercure +1 gemme | `flying`,`noRetaliation`,`mark` (poisonSting) |

## Étapes

1. **Données** (data-only) : units T2–T7 (`units/*.json`), `buildings.json`
   dwellings T2–T7 (chaîne de prérequis, coûts mercure/gemmes), `manifest.json`
   (units + town.buildings + town.dwellings T1–T7), locales fr/en (noms d'unités).
2. **Test** faction-agnostique (`packages/content/test/`) : recrute le lineup
   complet du paquet **identifié par propriété** (faction native `mistmoor`, ≥ 7
   tiers, ≥ 6 unités portant `mark`) ; combat : une pile Hunter attaque, la cible
   reçoit une charge, l'attaque suivante inflige + de dégâts (bonus de Marque).
3. **Docs** : doc 05 « État 4.2 », plan coché. **Vérif** : typecheck, lint,
   garde-fou, tests, content:check, smoke (inchangé, lineup non joué en smoke),
   golden inchangé (aucun diff moteur). PR.

## Vérification

`pnpm content:check` (lineup complet résolu), `faction:validate arcane-hunters`,
tests moteur+contenu, garde-fou vert (test par propriété, zéro littéral).

## Écarts

- T8 + apex + Essence : 4.6/4.4. Capacités exotiques : 4.3+. Bâtiments spéciaux
  (Contrats, Amphithéâtre, Cercles) : 4.4/4.5. Assets : Beta.
