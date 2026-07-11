# Lot H-NAMED.1 — roster de héros nommés data-driven

Backlog §2.3 (A5 / H-NAMED, « reste L » découpé). Une **tranche** existait déjà
(champs `HeroState.name`/`specialtyId`/`specialtyEffects`, 1 héros de départ inline
dans `config`). Ce sous-lot livre le **roster data-driven par faction** — le vrai
cœur de H-NAMED — en suivant le **patron `houseCatalog` (16.1)** : mécanisme moteur
+ données d'abord, câblage client (sélection/taverne) différé à H-NAMED.2.

## Portée H-NAMED.1

- **Contenu** : `heroSchema` (id, nom+bio `@loc:`, attributs de départ, spécialité
  de signature = `{id, ...heroEffectFields}`, `startingSkills`, `startingSpells`) +
  `heroCatalogSchema` (`heroes.json`). Déclaré par `manifest.heroRoster` (chemin,
  comme `story`). Loader : charge si déclaré, **cross-valide** (compétences ∈ pool
  connu, sorts ∈ catalogue, nom/bio localisés fr+en, ids uniques). Export
  `buildHeroRoster(report)` → `Record<heroId, {factionId, name, attributes,
  specialtyId, specialtyEffects, startingSkills, startingSpells}>`.
- **Moteur** : `hero/types.ts` `ResolvedHeroDef` ; `PlayerSetup.startingHeroId` +
  `StartGame.heroRoster` ; le handler `StartGame` résout l'identité à la création
  (nom/attributs/spécialité/compétences/sorts) — les champs explicites du
  `PlayerSetup` (report de campagne) **priment** via `??`/`||`.
- **Données** : `data/factions/haven/heroes.json` — **Aldric** (Might, spécialité
  *Meneur* +1 moral, Commandement/Armure) & **Séraphine** (Magic, *Liturgiste*
  −15 % mana, Sagesse, sorts de Lumière) + noms/bio FR/EN + `manifest.heroRoster`.
- **Docs** : doc 02 §1.1/§1.2, doc 03 §5.

## Différés (H-NAMED.2+ / M-TAVERN)

Profil de **gain d'attribut par classe** (Might/Magic — reste global) ;
**spécialités conditionnelles** du doc (+vitesse Griffons / Soin +50 % — rendues
par des spécialités exprimables) ; **pool/taverne** (recrutement, M-TAVERN) ;
**câblage client** (sélection de héros nommé à « Nouvelle partie »).

## Invariants

- **Zéro faction** dans le moteur (roster = ids/effets opaques) — garde-fou vert.
- **Aucun bump de save** : l'identité vit sur des champs `HeroState` existants
  (name/attributes/specialtyId/specialtyEffects/skills/spells) ; `heroRoster` est
  un catalogue `StartGame`-only (non stocké dans l'état, comme `houseCatalog`).
- **Golden inchangé** : la résolution ne s'active qu'avec `startingHeroId` (le
  golden ne le pose pas).

## Vérifs

typecheck · lint · engine (résolution + précédence scénario) + content (roster
valide, refs inconnues rejetées, nom non localisé) · content:check · garde-fou ·
build · budget · smoke.

## Journal

- branche `claude/h-named-roster` depuis `main` @ merge #250 (F-ELITEVOX).
