# Plan — Phase 4.10 : demonform (T8 Pénitent) — Arcane Hunters

Sous-lot Alpha (plan 4.1). Dernière grande capacité de signature : `demonform`
(doc 05 §4, T8). Capacité **stateful** générique (état par pile sérialisable),
inline dans le moteur — comme `mark`/`consumeMarks`, sans registre de module JS.

## Périmètre (borné)

**Auto-transformation** : la pile démarre en **forme humaine**
(`magicResistance` contre les sorts) et **bascule en forme démon à sa première
attaque** (perd la résistance, gagne `+damageBonus` aux dégâts). Simplification
assumée vs doc 05 : la bascule est **automatique** (pas un choix de timing
actif) et l'**`areaAttack(cône)`** est différée. L'identité « résistant d'abord,
dévastateur ensuite » est conservée.

## Design

- Capacité `demonform` params `{ damageBonus, magicResistance }` (au catalogue).
- `CombatStack.transformed: boolean` (départ `false`).
- `performStrike` : si l'attaquant porte `demonform` et `!transformed`, on bascule
  (`transformed = true`, event `StackTransformed`) ; si `transformed`, cette
  frappe (et les suivantes) gagne `×(1+damageBonus)` (champ `demonBonus` dans
  `computeMultiplier`).
- Dégâts de sort : une cible `demonform` **non transformée** applique
  `magicResistance` (déjà paramètre de `spellDamageAmount`) — halve les dégâts
  de sort en forme humaine.
- Données : `t8-penitent` gagne `demonform { damageBonus: 0.5, magicResistance:
  0.5 }` (garde `mark`). `abilities.json` += `demonform`.

## Étapes

1. Moteur : `CombatStack.transformed` (types + setup + factories de test) ; event
   `StackTransformed` ; bascule + bonus dégâts dans `performStrike`/
   `computeMultiplier` ; `magicResistance` de la cible dans `handleCastSpell`.
2. Données : catalogue + t8. 3. Tests moteur : bascule à la 1ère frappe
   (event + +50 % dégâts) ; sort sur forme humaine = moitié dégâts, sur forme
   démon = plein ; pas de re-bascule. 4. Docs, vérif, PR.

## Vérification

typecheck, lint, garde-fou, tests moteur+contenu, content:check, smoke, budget.
**Golden inchangé** (combat null en fin de golden ; branches inertes hors
`demonform`). Seul diff moteur = une capacité stateful générique.

## Écarts

- `areaAttack(cône)` du démon : lot ultérieur (attaque multi-cibles = nouvelle
  surface). Choix de timing **actif** de la bascule (action de combat + UI +
  IA) : différé — bascule auto au MVP. `devourMarks` (T8) : idem, ultérieur.
