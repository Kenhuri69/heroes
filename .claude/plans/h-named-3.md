# Lot H-NAMED.3 — profil de gain d'attributs par classe/archétype

> Branche `claude/h-named-3` (repart de `origin/main`). Doc source : **doc 02 §1.2**
> (« profil global unique `30/30/20/20` ; les classes distinctes — ex. Nécromancien
> 15/15/30/40 — sont différées »). Backlog : différé noté doc 02 §1.1/§1.2.

## Objectif

À la montée de niveau, le tirage d'attribut suit un **profil déclaratif par
archétype de héros** (`might` / `magic`) au lieu du profil global unique de
`config.json`. Générique, data-driven, **zéro faction moteur**.

- Might (guerriers) favorise Attaque/Défense ; Magic (mages) favorise Pouvoir/
  Savoir (esprit des exemples doc : Chevalier de la mort 30/25/20/25,
  Nécromancien 15/15/30/40).
- Repli : un héros **sans archétype connu** (héros générique, vieux save) garde
  le **profil global** `attributeWeights` — comportement historique préservé.

## Point d'extension (générique, data-driven)

1. `config.hero.attributeWeightsByArchetype?: { might?: {...}; magic?: {...} }`
   (OPTIONNEL) — moteur (`HeroProgressionConfig`) + schéma contenu + `config.json`.
2. `ResolvedHeroDef.archetype?: 'might' | 'magic'` (OPTIONNEL) — le roster de
   héros (`GameState.heroRoster`, déjà persisté v25) porte l'archétype ;
   `buildHeroRoster` (contenu) le renseigne depuis `heroIdentitySchema.archetype`
   (déjà présent).
3. `grantXp` (`adventure/experience.ts`) : les poids utilisés =
   `config.attributeWeightsByArchetype?.[roster[hero.rosterId]?.archetype]`
   sinon `config.attributeWeights`. Appliqué au tirage auto (IA) ET à la paire
   proposée (humain).

## Save / golden

- Les 2 champs sont **OPTIONNELS** et **absents des fixtures de test** (testConfig
  sans `attributeWeightsByArchetype` ; heroRoster de golden/save-shape vide ou
  sans archétype) ⇒ **golden inchangé, save-shape inchangé, PAS de bump**
  `CURRENT_SAVE_VERSION` (même patron que `HeroSkillDef.factionId?` — « vieilles
  saves gracieuses »). Un vieux save sans archétype ⇒ repli global. À VÉRIFIER
  (si un test change, bump justifié).
- Aucune dépendance rendu ; RNG seedé inchangé (mêmes fonctions, poids différents).

## Étapes / vérif

1. Moteur : type `HeroProgressionConfig.attributeWeightsByArchetype?` +
   `ResolvedHeroDef.archetype?` + sélection dans `grantXp` (helper local
   `attributeWeightsFor(config, hero, roster)`).
2. Contenu : schéma config `attributeWeightsByArchetype` (optionnel) ;
   `buildHeroRoster` renseigne `archetype`. content:check vert.
3. Données : `data/core/config.json` — `attributeWeightsByArchetype` might/magic.
4. Tests moteur : un héros `might` biaise Att/Déf, un héros `magic` biaise Pou/Sav
   (statistique déterministe sur N niveaux, seed fixe) ; un héros SANS archétype
   garde le profil global. Golden + save-shape inchangés (relancer).
5. Smoke : la zone modifiée est un biais RNG moteur pur ; couverture = tests
   unitaires. Suite smoke complète relancée (non-régression). Noté (guideline §7).
6. Vérifs complètes : typecheck, lint, engine, content, content:check, build
   (< 800 Ko), garde-fous faction+couleurs, smoke complet. Doc 02 §1.1/§1.2 MAJ.

## Journal

- Plan créé ; exploration : `grantXp`/`rollAttribute`/`rollAttributePair`
  (`experience.ts`), `HeroProgressionConfig` (config.ts:113), `config.json` hero,
  schéma config contenu (schemas.ts:610), `ResolvedHeroDef` (hero/types.ts),
  `buildHeroRoster` (loader.ts:755), `heroRoster` persisté (state.ts v25).
- **Livré** : `HeroProgressionConfig.attributeWeightsByArchetype?` + `ResolvedHeroDef.archetype?`
  (optionnels, `| undefined` explicite = bridge exactOptional côté client) ; helper
  `attributeWeightsFor` dans `grantXp` (sélection via `heroRoster[rosterId].archetype`,
  repli global), appliqué au tirage IA ET à la paire humaine ; schéma config contenu
  `.optional()` ; `buildHeroRoster` renseigne `archetype` ; `config.json` might
  35/30/15/20, magic 15/15/35/35.
- Tests : `hero-attribute-profile.test.ts` (3 cas : might→Att/Déf seuls, magic→Pou/Sav
  seuls, sans archétype→repli global). **Golden + save-shape INCHANGÉS ⇒ pas de bump**
  (champs optionnels absents des fixtures — design confirmé).
- Vérifs vertes : typecheck 5/5, lint, engine **645**, content **119**, content:check
  (12 scénarios), build **295 Ko** gzip, garde-fous faction+couleurs, smoke complet.
  Doc 02 §1.1/§1.2 MAJ.
