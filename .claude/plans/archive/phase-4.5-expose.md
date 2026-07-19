# Plan — Phase 4.5 : consumeMarks → effet `expose` (Arcane Hunters)

Sous-lot Alpha (plan 4.1). Micro-lot : **étendre** la capacité générique
`consumeMarks` (ouverte en 4.3) avec un 2ᵉ effet — `expose` (doc 05 §3.1, T2
Familier lié) : consommer 1 charge de Marque pour **priver la cible de sa
riposte** cette attaque. Aucun nouveau système, juste un param déclaratif de
plus sur une capacité existante.

## Design

`consumeMarks` params gagnent `suppressRetaliation?: boolean`. `consumeMarksPlan`
le renvoie. Dans `performStrike`, à la consommation : si `suppressRetaliation`,
`victim.retaliationsLeft = 0` — la riposte (décidée dans `actions.ts` sur
`retaliationsLeft > 0`) est donc annulée pour cette frappe. `estimateDamage`
reflète l'absence de riposte dans la prévisualisation (honnêteté UI).

`damageBonus` reste optionnel (0 par défaut) : `expose` = `{ cost: 1,
suppressRetaliation: true }` (pas de burst) ; `executioner` (T5) inchangé
= `{ cost: 3, damageBonus: 0.4 }`.

## Étapes

1. **Moteur** (`combat/damage.ts`) : `consumeMarksPlan` renvoie aussi
   `suppressRetaliation` ; `performStrike` zéro-te `retaliationsLeft` quand actif ;
   `estimateDamage` : riposte nulle si l'attaque va supprimer la riposte.
2. **Données** : `t2-familier.json` gagne `{ id: 'consumeMarks', params:
   { cost: 1, suppressRetaliation: true } }` (garde `flying`, `mark`).
3. **Test** moteur (`combat-damage.test.ts`) : Familier attaque une cible
   marquée (≥1) ⇒ pas d'event de riposte, 1 charge consommée ; cible non marquée
   ⇒ riposte normale.
4. **Docs** doc 05 « État 4.5 », plan. Vérif, PR.

## Vérification

typecheck, lint, garde-fou, tests moteur+contenu, content:check, smoke, **golden
inchangé** (executioner/unités du golden inchangés ; `suppressRetaliation` absent
= comportement identique). Seul diff moteur = un param générique de plus.

## Écarts

- `pinningShot` (immobilisation, T6) : nécessite un statut « ne peut pas agir »
  (ordre de tour) — lot ultérieur. `devourMarks` (T8) : avec le T8 (4.6).
