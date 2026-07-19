# E4.4b — Sélecteur de héros du combat manuel coop (client)

## Contexte

E4.4a (moteur+IA) livré : le suivi d'actions est par-héros, `CastSpell`/`HeroAttack`
prennent `heroId?` (défaut lead), l'IA fait jouer les héros alliés en auto-combat.
Reste le **combat manuel** : en coop (plusieurs héros du joueur sur son camp),
laisser le joueur **choisir quel héros agit**. Client pur (moteur déjà prêt).

## Design

- Store : `combatActingHeroId: string | null` (héros agissant sélectionné ; `null`
  = lead). `combatSpellTarget` gagne `heroId` (flux ciblage d'hex téléport/board).
- `combat.tsx` : `actingHero` = `combatActingHeroId` résolu, sinon lead. Les gates
  (`canCastSpell`/`canHeroStrike`) et la modale usent d'`actingHero` +
  `heroActionLeftFor(actingHero)`. **Sélecteur** (chips) affiché SEULEMENT si
  `heroesOnSide(playerSide)` du joueur humain compte > 1 héros — chaque chip :
  nom + « a agi » (grisé si plus d'action), clic ⇒ `combatActingHeroId`.
- `SpellBook.tsx` : dispatch `CastSpell` avec `heroId: hero.id` (le composant a
  déjà `hero`) ; téléport ⇒ pose `combatSpellTarget.heroId`.
- `CombatScene.ts` : le tap de ciblage dispatch `CastSpell` avec
  `combatSpellTarget.heroId`.
- `HeroAttackModal` : `heroAttackDamageFor(actingHero)` en préviz + dispatch
  `HeroAttack { heroId }`.
- Reset `combatActingHeroId` à `null` au montage/fin de combat.

## Invariants

Client pur (moteur E4.4a). Mono-héros : `combatActingHeroId` null ⇒ lead ⇒
comportement inchangé (sélecteur masqué). Zéro moteur, pas de bump save.

## Étapes

1. Engine index : exporter `heroesOnSide`/`heroActionLeftFor`/`heroAttackDamageFor` (fait).
2. Store : `combatActingHeroId` + `combatSpellTarget.heroId`.
3. `combat.tsx` : actingHero + sélecteur + gates + props modale.
4. `SpellBook.tsx` + `CombatScene.ts` : threader heroId.
5. `HeroAttackModal` : actingHero.
6. Locales sélecteur. 7. Docs 18 E4 (E4.4b livré ⇒ E4 clos). 8. Vérif.

## Statut

- [x] **LIVRÉ**. Store `combatActingHeroId` + `combatSpellTarget.heroId` (reset aux
      transitions de combat). `combat.tsx` : `actingHero` (sélectionné sinon lead),
      gates via `heroActionLeftFor`, sélecteur de chips (`actingHeroes` = héros du
      joueur sur son camp, > 1). `SpellBook`/`CombatScene`/`HeroAttackModal` threadent
      `heroId` ; préviz `heroAttackDamageFor`. Engine index : `heroesOnSide`/
      `heroActionLeftFor`/`heroAttackDamageFor` exportés. Locale `combat.actingHero`
      + CSS chips. **Client pur** (moteur E4.4a), zéro bump save. **Non smoke-couvert**
      (état coop 2-héros absent du smoke ; non-régression mono-héros vérifiée par le
      smoke sort/frappe existant). Vérif : typecheck ✓, lint ✓, 921 engine + content ✓,
      content:check ✓, garde-fou ✓, build ✓, budget 334 Ko ✓, smoke @core (en cours).
      **E4 clôturé.**
