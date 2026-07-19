# E4.4a — Actions de héros par-héros en coop (moteur + IA)

## Contexte

Dernier lot coop (doc 18 E4). Aujourd'hui l'action de héros (sort/frappe) est
**par CAMP** : dérivée de `combat.playerSide` → le héros **lead**
(`attackerHeroId`/`defenderHeroId`). En coop, l'armée de l'allié rejoint le camp
mais **son héros n'agit jamais**. E4.4 : chaque héros d'un camp (lead + alliés
coop) dispose de SON action par round, avec SES ressources.

**E4.4a (ce lot)** : moteur (suivi par-héros) + IA (les héros alliés agissent en
auto-combat). **E4.4b (suite)** : sélecteur de héros client pour le combat manuel.
Le client reste inchangé ici : `CastSpell`/`HeroAttack.heroId?` **défaut = lead**
⇒ comportement mono-héros manuel identique.

## Changements

- `combat/types.ts` : `heroCastThisRound`/`heroAttackUsed` : `CombatSideId[]` →
  `string[]` (heroIds). **Golden re-fixé** (forme seule : les valeurs stockées
  passent de `'attacker'` à un heroId ; kills/dégâts/RNG **inchangés**).
- `state-helpers.ts` : `heroesOnSide(combat, side)` (lead + owners de piles
  vivantes) ; `heroActionsUsedBy(combat, heroId)` + `heroActionLeftFor(state,
  combat, heroId)` (par-héros) ; legacy `heroActionsUsed`/`heroActionLeft(side)`
  délèguent au **lead** (client + rétro-compat).
- `damage.ts` : `heroLuckValue(state, hero)` (extrait de `heroLuckOf`).
- `hero-attack.ts` : `heroAttackDamageFor(state, combat, side, hero)` ;
  `heroAttackDamage(side)` = lead (préviz client).
- `hero/index.ts` `castHeroSpell(draft, side, heroId, …)` + `hero-attack.ts`
  `strikeWithHero(draft, side, heroId, …)` : héros agissant explicite (mana/
  pouvoir/chance/attaque + suivi par heroId). `validateCastSpell`/`HeroAttack` :
  héros = `cmd.heroId ?? lead`, validé ∈ `heroesOnSide(playerSide)`.
- `commands.ts` : `CastSpell`/`HeroAttack` gagnent `heroId?`.
- `ai.ts` `maybeHeroAction` : flux du **lead inchangé** (RNG/golden) puis boucle
  des héros ALLIÉS (spell/attaque). Prière de bataille reste lead-only.

## Invariants

Comportement mono-héros **inchangé** (défaut lead) ; par-héros = coop uniquement
(jamais dans le golden). Pas de bump save (mêmes clés `heroCastThisRound`/
`heroAttackUsed`, valeurs = strings ; hors garde CombatStack). Zéro faction.
**Golden re-fixé** (forme). Filet : property (« combat se termine »/déterminisme).

## Étapes (vérif engine suite à chaque palier)

1. types + state-helpers (heroesOnSide, per-hero). 2. damage/hero-attack helpers.
3. castHeroSpell/strikeWithHero heroId + validate + commands + handlers.
4. AI ally loop. 5. Tests coop (allié agit en auto-combat). 6. Golden re-fix. 7. Docs.

## Statut

- [x] **LIVRÉ**. Suivi par-héros (`heroCastThisRound`/`heroAttackUsed` = heroIds ;
      `heroesOnSide`, `heroActionsUsedBy`, `heroActionLeftFor` ; legacy `heroActionLeft`/
      `heroActionsUsed`(side)→lead pour le client). `heroLuckValue` (damage),
      `heroAttackDamageFor` (hero-attack). `castHeroSpell(draft, side, heroId, …)` +
      `strikeWithHero(draft, side, heroId, …)` + validate/handle (héros = `cmd.heroId
      ?? lead`, ∈ `heroesOnSide`). `CastSpell`/`HeroAttack.heroId?`. IA `maybeHeroAction`
      : flux lead inchangé + boucle des alliés (`bestHeroAttackTarget` extrait).
      **Golden inchangé** (les combats du replay ne font pas agir de héros), pas de
      bump save (mêmes clés, valeurs=strings). Tests par-héros mis à jour (side→heroId,
      6 tests) + 1 coop (lead+allié agissent). Vérif : typecheck ✓, lint ✓, **919
      engine** + content ✓, content:check ✓, garde-fou ✓, build ✓, budget 333 Ko ✓,
      smoke @core 33/33 ✓ (2 asserts side→heroId). **E4.4b (client) différé.**
