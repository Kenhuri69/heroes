# Lot H-NAMED.1 — héros nommés jouables (gameplay sur `heroIdentitySchema`)

Backlog §2.3 (A5 / H-NAMED, « reste L » découpé). **Rework** (décision utilisateur) :
une session parallèle a mergé sur main la **couche identité** des héros nommés (doc 16
État 16.9 — `heroIdentitySchema`, `manifest.heroes:[ids]`, `heroes/<id>.json`,
avatar/bio/archetype/origine, **inerte moteur**). Plutôt qu'un système parallèle
(`heroes.json`/`heroRoster`), on **étend** cette couche : la **résolution moteur**
(le trou réel) se branche dessus.

## Portée H-NAMED.1

- **Contenu** : `heroIdentitySchema` gagne des **champs gameplay OPTIONNELS** —
  `attributes`, `specialtyEffect` (`{id, ...heroEffectFields}`), `startingSkills`,
  `startingSpells`. Une fiche **avec `attributes`** est jouée ; sans, elle reste
  identity-only (16.9). Loader : cross-valide compétences/sorts (∈ catalogues) dans
  la boucle héros existante. Export `buildHeroRoster(report)` → `Record<heroId,
  {factionId, name, attributes, specialtyId, specialtyEffects, startingSkills,
  startingSpells}>`, **ne retenant que les fiches gameplay** (attributs présents).
- **Moteur** : `ResolvedHeroDef` (`hero/types.ts`) ; `PlayerSetup.startingHeroId` +
  `StartGame.heroRoster` ; le handler `StartGame` résout l'identité à la création,
  les champs explicites du `PlayerSetup` (report de campagne) priment.
- **Données** : `data/factions/haven/heroes/{aldric,seraphine}.json` — identité 16.9
  **+ gameplay** (Aldric Might *Meneur* +1 moral, Commandement/Armure ; Séraphine
  Magic *Liturgiste* −15 % mana, Sagesse, sorts de Lumière) + `manifest.heroes` +
  locales (nom/bio/desc de spécialité). Les 5 héros Vox restent identity-only.
- **Docs** : doc 02 §1.1/§1.2, doc 03 §5.

## Réconciliation / test

`hero-identity.test.ts` (16.9) supposait que le 1er paquet à héros contient canon
+ original ; désormais Haven (100 % original) précède Vox ⇒ le test agrège sur
**tous** les paquets (invariant du format préservé, sans id littéral — garde-fou).

## Différés (H-NAMED.2+ / M-TAVERN)

Profil de **gain d'attribut par classe** (reste global) ; **spécialités
conditionnelles** ; **pool/taverne** ; **câblage client** (sélection de héros nommé).

## Invariants

- **Zéro faction** moteur (roster = ids/effets opaques) — garde-fou vert.
- **Aucun bump de save** : identité sur des champs `HeroState` existants ;
  `heroRoster` = catalogue `StartGame`-only (comme `houseCatalog`).
- **Golden inchangé** : résolution active seulement si `startingHeroId` posé.

## Journal

- Rework de #253 (approche `heroes.json` en collision avec 16.9) ⇒ branche
  `claude/h-named-roster-v2` depuis `main` @ 6057881 (16.9 + C-HEROSPRITE #252).
