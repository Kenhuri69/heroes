# Plan — Lot 3.1 (doc 18) : perks structurels Might / Magic (C1)

> **Statut** : ✅ livré (2026-07-17). Écart de décision noté au §6 (bump v33).
> Écart couvert : **C1** (doc 18 §2.C) — signature MMHO : classe **Might** =
> slot d'armée supplémentaire ; classe **Magic** = 2 actions de héros par round.
> Premier lot de l'Étape 3 (différenciation & contenu, équilibrage requis).

## 0. Objectif & critère de sortie

Deux effets déclaratifs **génériques** ajoutés au pot commun `SkillRankEffect`
(`armySlotsBonus`, `heroActionsPerRound`), portés par l'**archétype** du héros
via données (`config.hero.archetypeEffects` — clés opaques, **aucun
`if (archetype)` en dur**). Un héros nommé Might a 8 slots d'armée ; un héros
nommé Magic frappe ET lance un sort dans le même round.

**Critère de sortie mesurable** : split d'armée jusqu'à 8 piles pour un héros
Might (9ᵉ refusée) ; sort + frappe dans le même round pour un héros Magic
(3ᵉ action refusée) ; héros générique/sans effet : comportements historiques
(7 piles, 1 action) bit-identiques ; `faction:sim` sans nouveau déséquilibre.

## 1. Invariants (guidelines §8) & décisions

- Zéro faction/archétype en dur : le moteur agrège des champs numériques
  (`sumHeroEffectField`), l'association archétype → effets vit en données.
- **Pas de bump `CURRENT_SAVE_VERSION`** : `HeroState.archetypeEffects?` est
  optionnel **écrit paresseusement** (patron calendrier lot 2.5) — posé
  uniquement quand le roster + la config le fournissent. Les compteurs
  d'action (`heroCastThisRound`/`heroAttackUsed: CombatSideId[]`) gardent leur
  forme : on compte les OCCURRENCES au lieu de tester l'appartenance
  (doublons de side = actions multiples — sérialisation inchangée).
- La garnison de ville reste à 7 (le perk est un trait de héros).
- Équilibrage : passage `faction:sim` avant PR (attendu : inchangé — les
  héros du sim sont génériques, sans rosterId ⇒ sans archétype ; à confirmer
  et noter).

## 2. État des lieux (points d'ancrage vérifiés)

- Archétype : `ResolvedHeroDef.archetype?` (roster), lu via `hero.rosterId`
  (`adventure/experience.ts:20` pour la pondération d'attributs). Les héros
  génériques n'en ont pas.
- Effets par héros : `hero.houseEffects` + `hero.specialtyEffects` agrégés par
  `sumHeroEffectField` (`hero/skills.ts:62`) — y ajouter
  `hero.archetypeEffects ?? []`.
- Cap d'armée héros (7) — sites : `visitable.ts:127` (habitation, const
  exportée), `triggers.ts:40` (grantArmy), `hero/index.ts:420` (SplitStack),
  `hero/transfer.ts:38` (TransferBetweenHeroes), `faction/effects.ts:178`
  (relève de morts-vivants), `quest/evaluate.ts:73` (récompense de quête),
  `ai/adventure.ts:118` (visite d'habitation IA). `combat/setup.ts:193` =
  validation de l'ARÈNE (armées synthétiques) — hors périmètre ;
  `town/recruit.ts` = garnison — inchangé.
- Action de héros/round : `heroCastThisRound`/`heroAttackUsed` par **side** ;
  validations `includes` dans `hero/index.ts:57-62` (sort),
  `combat/hero-attack.ts:52-55` (frappe), IA `combat/ai.ts`
  (maybeHeroAction), client `ui/combat.tsx:128-143` (désactivation boutons).
- Création de héros : `core/engine.ts:648` (StartGame, pose `houseEffects`) et
  `hero/recruit.ts:99/118` (RecruitHero).
- Schéma : vocabulaire d'effets aux DEUX sites (`schemas.ts:137/558`) ;
  config héros (`attributeWeightsByArchetype`, ~`:720`).
- Client : bandeau d'armée et HeroSwap **mappent** `hero.army` (aucun « 7 »
  en dur) ⇒ le 8ᵉ slot se rend sans diff UI.

## 3. Étapes

- [ ] a. **Types** : `SkillRankEffect.armySlotsBonus?` /
      `heroActionsPerRound?` (numériques ⇒ inclus d'office dans
      `NumericEffectField`) ; `HeroState.archetypeEffects?: SkillRankEffect[]`
      (note « sans bump » au changelog) ;
      `HeroProgressionConfig.archetypeEffects?: Record<string,
      SkillRankEffect[]>`.
- [ ] b. **Agrégation** : `sumHeroEffectField` somme aussi
      `archetypeEffects` ; helpers exportés `heroArmyCap(hero)` (= 7 + bonus)
      et `heroActionsAllowed(state, combat, side)` / `heroActionsUsed(combat,
      side)` (comptage d'occurrences).
- [ ] c. **Création** : StartGame + RecruitHero posent `archetypeEffects`
      (paresseux : roster.archetype présent ET config non vide).
- [ ] d. **Cap d'armée** : les 7 sites héros consomment `heroArmyCap(hero)`
      (suppression des 3 consts locales dupliquées + 2 littéraux).
- [ ] e. **Actions de héros** : validations sort/frappe + IA passent au
      comptage (`used < allowed`) ; client `combat.tsx` consomme le helper
      moteur exporté (patron R7).
- [ ] f. **Schéma + données** : vocabulaire aux 2 sites +
      `hero.archetypeEffects` (schéma) ; `config.json → hero.archetypeEffects
      { might: [{armySlotsBonus:1}], magic: [{heroActionsPerRound:1}] }`.
- [ ] g. **Doc** : `docs/02-mechanics.md` §1.2 (archétypes — perks
      structurels) ; §5.6 (action de héros : « une action × (1+bonus) »).
- [ ] h. **Tests** (`hero-archetype-perks.test.ts`, unitaires — pas de smoke,
      aucune surface UI nouvelle) : création (posé pour roster might,
      absent pour générique — forme) ; split 8ᵉ pile OK / 9ᵉ refusée ;
      grantArmy 8ᵉ via trigger ; Magic : sort + frappe même round, 3ᵉ action
      refusée ; sans effet : 2ᵉ action refusée (régression).
- [ ] i. **Équilibrage** : `faction:sim` (duel/gate) — résultat noté ici.
- [ ] j. **Vérifs standard** : typecheck, lint, moteur (golden inchangé —
      fixtures sans roster/archetypeEffects), contenu, `content:check`,
      garde-fou faction, budget, smoke `@core`.

## 4. Hors périmètre

- Ré-équilibrage des rosters existants (chaque héros nommé garde son
  archétype actuel ; le tuning fin attend un playtest).
- Perk de MULTI-sorts différents par round pour les unités `spellcaster`
  (unité ≠ héros) ; respec / choix d'archétype en partie.
- UI dédiée « fiche d'archétype » (le tiroir héros montre déjà la spécialité ;
  les perks se voient en jeu).

## 5. Risques

| Risque | Mitigation |
|---|---|
| Golden/saves | champ paresseux + comptage sur forme inchangée ; fixtures sans archétype ⇒ bit-identique |
| Un site de cap oublié (armée > cap incohérente) | inventaire §2 exhaustif (grep `MAX_ARMY_STACKS`/`army.length`) ; helper unique |
| Blowout d'équilibrage | `faction:sim` avant PR + valeurs modestes (+1 slot / +1 action) |
| IA : boucle d'actions de héros infinie | `heroActionsUsed` croît à chaque push ; la garde `used < allowed` borne strictement |

## 6. Suivi

- [x] Plan rédigé (2026-07-17)
- [x] a→g implémentés. **Écart de décision** : le « pas de bump » du §1 était
      intenable — le garde-fou de COMPILATION `save-shape.test.ts` verrouille
      `keyof HeroState` et impose le bump sur tout champ de héros (précédent
      `rosterId` v25→26). ⇒ **`CURRENT_SAVE_VERSION` 32→33** (champ optionnel
      paresseux conservé), golden **re-fixé forme seule** (`04cb6e08` →
      `d2f06bdb`, toutes les assertions de valeurs vertes — seul `saveVersion`
      change dans l'état sérialisé). Second écart : pont zod → moteur
      `SkillRankEffectInput` + `sanitizeEffect` (exactOptionalPropertyTypes) et
      schéma des perks **volontairement plat** (pas de `conditional`/
      `startingArmyBonus` — l'apanage des spécialités).
- [x] h tests verts — `hero-archetype-perks.test.ts` (5 cas) : création
      (posé pour Might, ABSENT pour générique — forme), cap 8 (split 8ᵉ OK,
      9ᵉ refusée), régression cap 7 générique, 2 frappes de héros même round
      (3ᵉ refusée), régression 1 action sans perk. `heroActionLeft` partagé
      moteur (validations sort/frappe + IA sort + IA frappe) et client
      (boutons — helper exporté, patron R7).
- [x] i sim noté — `faction:sim` : **6 déséquilibres béants = la base
      documentée** (plan cap-content-wiring), classements duel/attrition/
      gauntlet identiques ; les héros du sim sont génériques (sans rosterId)
      ⇒ perks sans effet sur le sim, comme attendu. Exit 1 préexistant (gate
      de béance, hors CI).
- [x] j vérifs — typecheck ✅ lint ✅ moteur 860/860 ✅ contenu 148/148 ✅
      `content:check` ✅ garde-fou faction ✅ (corrigé une fixture
      `test-faction` → `fixture-faction`) budget 329 Ko/800 Ko ✅ smoke
      `@core` 19/19 ✅.
