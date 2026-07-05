# Plan — Phase 4.3 : capacité générique `consumeMarks` (Arcane Hunters)

Sous-lot Alpha (plan 4.1). **Premier vrai nouveau point d'extension moteur**
de la faction : consommer des charges de Marque pour un effet fort (doc 05
§3.1, `executioner`). Générique (piloté par les données, zéro nom de faction).

## Design

Capacité générique **`consumeMarks`** au catalogue, params
`{ cost: number, damageBonus: number }` : à l'attaque, si la cible porte
≥ `cost` charges de Marque, l'attaquant les **consomme** et cette frappe gagne
`×(1 + damageBonus)`. Threadé dans la formule unique `computeMultiplier` (champ
`markConsumeBonus`) ⇒ la **prévisualisation de dégâts** (`estimateDamage`) le
reflète aussi ; seule la frappe réelle (`performStrike`) **consomme** les
charges (`victim.marks -= cost`) et émet `MarksConsumed`.

C'est la mécanique `executioner` de la Lame du Serment (T5) exprimée
génériquement. Extensible : d'autres effets de consommation (expose =
suppression de riposte, pinningShot = immobilisation) s'ajouteront comme
nouveaux champs de params dans des micro-lots ultérieurs.

## Étapes

1. **Catalogue** : ajouter `consumeMarks` à `data/core/abilities.json`.
2. **Moteur** (`combat/damage.ts`) : helper `consumeMarksPlan(strikerDef,
   victimMarks)` → `{cost,bonus}|null` ; champ `markConsumeBonus` dans
   `MultiplierInput`/`computeMultiplier` ; `performStrike` applique le bonus,
   consomme les charges, émet `MarksConsumed` ; `estimateDamage` applique le
   bonus (sans consommer). Event `MarksConsumed` (`core/events.ts`).
3. **Données** : `t5-lame.json` gagne `{ id: 'consumeMarks', params: { cost: 3,
   damageBonus: 0.4 } }` (garde `mark`).
4. **Test** moteur (`combat-damage.test.ts` ou nouveau) : cible à 3 charges,
   attaquant `consumeMarks(3, 0.4)` ⇒ dégâts ×1,4 supplémentaires, charges
   consommées (−3), event émis ; sous le seuil ⇒ pas de consommation.
5. **Docs** doc 05 « État 4.3 », plan coché. Vérif complète, PR.

## Vérification

typecheck, lint, garde-fou (capacité générique, zéro littéral), tests
moteur+contenu, `content:check`, smoke, **golden inchangé** (les unités du
golden n'ont pas `consumeMarks` ; `markConsumeBonus` défaut 0 ⇒ formule
numériquement identique). Le seul diff moteur est l'ouverture d'un point
générique (doc 06 §5.8).

## Écarts

- Effets de consommation non-dégâts (expose = riposte, pinningShot =
  immobilisation, devourMarks = champ + soin) : micro-lots ultérieurs (params
  additionnels). T5 garde `strikeAndReturn` différé.
