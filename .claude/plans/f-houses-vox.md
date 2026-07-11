# Lot F-HOUSES — effets de Maison Vox conformes au doc 16

Backlog §2.3 (F-HOUSES 🧩/📄 M). Les 5 Maisons Vox (doc 16 §3.1) portent des
effets qui **divergent** du doc car le vocabulaire d'effets actuel est
**hero-scoped** (`SkillRankEffect`, agrégé dans `hero/skills.ts`). Décision
utilisateur pré-actée : **étendre le moteur pour des effets de Maison
town-scoped** conformes au doc.

## Profils doc 16 §3.1 (cible) vs vocabulaire actuel

| Maison | Bonus doc | Exprimable aujourd'hui ? |
|---|---|---|
| Le Lion | +2 Attaque mêlée, +1 Moral | Moral oui (`moraleBonus`) ; **+2 Attaque plate** non (palette = `meleeDamagePct`) |
| Le Serpent | +250 or/jour ; accès malédictions | or/jour oui (`goldPerDay`) ; **accès sorts** non |
| L'Aigle | +25 % mana max ; −15 % coût sort | coût mana oui (`manaCostReductionPct`) ; **mana max %** non |
| Le Blaireau | **+20 % croissance hebdo**, **+2 Déf garnison** | **town-scoped** — non exprimable |
| Venari | **+50 % Résonance**, buffs Scène +1 Pouvoir | **resource/spell-scoped** — non exprimable |

## ✅ Question de conception — TRANCHÉE : option **B** (le plus proche du doc)

`houseAllegiance` est une propriété **du HÉROS** (`hero.houseId`/`houseEffects`).
Or « +20 % croissance hebdo / +2 Déf garnison » est **town-scoped**. Comment un
effet de Maison **par héros** atteint-il une **ville par joueur** ?

**Décision utilisateur : B — « on reste toujours le plus proche de la
documentation ».** La Maison s'applique à la ville **où le héros du propriétaire
se tient** (`hero.pos === town.pos`) — fidèle à « le héros apporte sa Maison » ;
effet **intermittent** par conception (le héros doit être là).

- ~~A — la Maison du héros s'applique aux villes possédées par son joueur~~
- **B (retenu)** — la Maison s'applique à la ville **où le héros se tient**.
- ~~C — v1 hero-scoped seulement~~

## Design retenu (option B)

Point d'interprétation unique : `townHouseField(heroes, ownerPlayerId, townPos,
field)` (`hero/skills.ts`) somme les effets de Maison/spécialité des héros du
**propriétaire** présents **sur la tuile** de la ville — jumeau town-scoped de
`sumHouseField`, jamais un nom de faction.

- Vocabulaire d'effets étendu de 2 champs **town-scoped** : `garrisonGrowthPct`,
  `garrisonDefense` (`SkillRankEffect` + `heroEffectFields` du schéma).
- `garrisonGrowthPct` → replié dans le multiplicateur de `applyWeeklyGrowth`.
- `garrisonDefense` → ajouté au bonus « murs » du siège (`handleCaptureTown`).
- Données : **Le Blaireau** passe de `armorReductionPct:8` (placeholder) à
  `{ garrisonGrowthPct:20, garrisonDefense:2 }` — conforme au doc 16 §3.1. Les 4
  autres Maisons gardent leur profil exprimable (Lion mêlée+moral, Serpent
  or/jour, Aigle coût mana, Venari tir+chance) ; effets non exprimables (+2 Att
  plate, accès sorts, mana max %, Résonance, Scène +1 Pouvoir) restent **différés**.
- **Aucun bump de sauvegarde** : `houseEffects` (v10) porte déjà les effets ; les
  2 nouveaux champs sont des clés optionnelles imbriquées. Golden **inchangé**
  (le héros du golden n'a pas de Maison).

## Contexte session

Livré cette session (marathon) : **A2e/A2f/A2g/A2h** (capacités de combat),
**F-BONUS**, **F-SKILLS** + correctifs garde-fou. F-HOUSES est une **extension
moteur multi-surface** (croissance de ville, défense de garnison, ressource de
faction) avec la question de propagation ci-dessus ⇒ **checkpoint** avant
exécution (choix A/B/C), et/ou reprise en **session fraîche** (contexte propre =
meilleure qualité pour un lot d'extension moteur).

## Journal

- branche `claude/f-houses-vox` depuis `main` @ 3532729.
