# Plan — Phase 4.8 : consumeMarks → effet `pinningShot` (Arcane Hunters)

Sous-lot Alpha (plan 4.1). Complète la famille `consumeMarks` (4.3 executioner,
4.5 expose) avec un 3ᵉ effet — `pinningShot` (doc 05 §3.1, T6 Chasseresse de
l'Abîme) : consommer des charges de Marque pour **immobiliser** la cible
(saute son/ses prochain(s) tour(s)). Générique, un param de plus.

## Design

`consumeMarks` params gagnent `immobilizeRounds?: number`. `consumeMarksPlan`
le renvoie. À la frappe (`performStrike`), à la consommation :
`victim.immobilizedRounds = max(victim.immobilizedRounds, immobilizeRounds)`.

Nouveau champ `CombatStack.immobilizedRounds: number` (comme `marks`). Dans
`advanceTurn`, quand la pile immobilisée devient active : on **saute son tour**
(même patron que le malus de moral — `acted = true`, `continue`), on décrémente
`immobilizedRounds`, on émet `StackImmobilized`. Golden inchangé (combat = null
dans l'état final du golden ; le champ n'apparaît qu'en combat).

« Les volants tombent » (doc 05) : simplifié — une pile immobilisée ne bouge
pas de toute façon (documenté).

## Étapes

1. **Moteur** : `CombatStack.immobilizedRounds` (`combat/types.ts`) + init 0
   (`combat/setup.ts`, helper `stack` des tests). `consumeMarksPlan` renvoie
   `immobilizeRounds` ; `performStrike` l'applique. `advanceTurn` saute une pile
   immobilisée (décrémente, event `StackImmobilized`). Event dans `core/events.ts`.
2. **Données** : `t6-chasseresse.json` gagne `{ id: 'consumeMarks', params:
   { cost: 2, immobilizeRounds: 1 } }` (garde `shooter`, `mark`).
3. **Test** moteur (`combat-damage.test.ts` + `combat-ai`/turns) : cible marquée
   (≥2) ⇒ `immobilizedRounds = 1`, 2 charges consommées ; `advanceTurn` saute la
   pile immobilisée (event `StackImmobilized`, `immobilizedRounds` décrémenté).
4. **Docs** doc 05 « État 4.8 », plan. Vérif, PR.

## Vérification

typecheck, lint, garde-fou, tests moteur+contenu, content:check, smoke, budget.
**Golden inchangé** (combat null en fin de golden). Seul diff moteur = un param
générique + un champ de pile + un skip de tour générique.

## Écarts

- `devourMarks` (T8, consomme toutes les Marques du champ + soin) : avec le
  `demonform` du T8 (lot ultérieur). Grounding explicite des volants : simplifié
  (immobilisation couvre).
