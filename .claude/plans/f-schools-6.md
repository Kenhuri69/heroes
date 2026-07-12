# Lot F-SCHOOLS.6 — École de la Traque : Heure de la Curée (noRetaliation conditionnel)

> Backlog `.claude/plans/game-feature-gaps.md` §2.3 F-SCHOOLS.6+.
> Doc source : `docs/05-faction-arcane-hunters.md` §6 (« Heure de la Curée — 1
> round : toutes les unités alliées gagnent `noRetaliation` contre les cibles
> marquées », cercle 5).

## But (un sous-lot = une mécanique)

4ᵉ des sorts Traque restants : **Heure de la Curée** — nouvelle mécanique de
combat **générique** « suppression de riposte conditionnelle par camp » : pendant
N round(s), les attaques du camp du lanceur contre une pile **marquée** n'essuient
aucune riposte. Réutilise Marques + le gate `noRetaliation` existant.

## Décisions de conception

- **Générique** : nouveau `SpellKind 'rally'` + champ **optionnel**
  `CombatState.markedNoRetaliation?: { side, roundsLeft }`. Le moteur ne lit
  qu'un `CombatSideId` opaque ; aucune faction. Champ **optionnel** ⇒ vieilles
  saves gracieuses (**pas de bump `CURRENT_SAVE_VERSION`**, golden inchangé — le
  golden ne lance pas Curée) et **zéro churn** des littéraux `CombatState` (tests
  + setup n'ont pas à le fournir).
- **Effet** : `rally` estampille `combat.markedNoRetaliation = { side, roundsLeft
  = max(1, base) }`. Décrément au passage de round (comme les statuts), retiré à 0.
- **Gate riposte** : dans `applyAttack`, la riposte est supprimée si
  `markedNoRetaliation.side === attaquant.side && cible.marks > 0`. Miroir dans
  `estimateAttack` (préviz).
- **Ciblage** : sort de camp ALLIÉ (cast sur un allié quelconque, effet global au
  camp). `spellTargetsEnemy('rally') = false`.
- **Dédup client** : exporter `spellTargetsEnemy` du paquet `@heroes/engine` ; le
  `SpellBook` calcule `friendly = !spellTargetsEnemy(kind)` (au lieu de
  `heal||buff` — sinon `rally` ciblerait l'ennemi dans l'UI).

## Étapes

1. Engine `combat/types.ts` : `CombatState.markedNoRetaliation?`.
2. Engine `hero/types.ts` : `SpellKind += 'rally'`.
3. Engine `hero/spells.ts` : `spellTargetsEnemy` inchangé (rally = allié).
4. Engine `combat/spell-effect.ts` : branche `rally` (estampille le champ).
5. Engine `combat/turns.ts` : décrément au passage de round.
6. Engine `combat/actions.ts` : gate riposte (Curée).
7. Engine `combat/damage.ts` : miroir préviz `estimateAttack`.
8. Engine `index.ts` : exporter `spellTargetsEnemy`.
9. Content `schemas.ts` : `kind += 'rally'`.
10. Données `data/core/spells.json` : `heure-de-la-curee` (traque, cercle 5, kind
    rally, base 1) + locales core FR/EN.
11. Client `SpellBook.tsx` : `friendly = !spellTargetsEnemy(kind)`.
12. Doc 05 §6 : note « livré ».
13. Tests : engine (riposte supprimée vs marquée du bon camp ; conservée hors
    Curée / cible non marquée / autre camp ; expiration).
14. Pipeline complet.

## Journal

- Branche `claude/f-schools-6` créée depuis main (aa914d1).
- **Livré.** `SpellKind 'rally'` + champ **optionnel** `CombatState.markedNoRetaliation`.
  Branche `rally` (estampille le champ), décrément au passage de round (turns.ts),
  gate riposte dans `applyAttack` + miroir préviz `estimateAttack`. `spellTargetsEnemy`
  exporté et consommé par le `SpellBook` client (`friendly = !spellTargetsEnemy(kind)`).
  Données : `heure-de-la-curee` (cercle 5, base=rounds) + locales FR/EN. Doc 05 §6.
- Champ **optionnel** ⇒ **pas de bump save, golden inchangé** (le golden ne lance
  pas Curée ; combats sans Curée l'omettent) ; **zéro churn** des littéraux
  CombatState (tests + setup).
- Vérifs : typecheck 5/5, lint, engine 615 (+6 `combat-curee`), content 116,
  content:check, garde-fous faction+couleurs verts, build, bundle ~294 Ko gzip
  < 800, smoke 168 passed.
