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

## ❓ Question de conception ouverte (à trancher)

`houseAllegiance` est une propriété **du HÉROS** (`hero.houseId`/`houseEffects`).
Or « +20 % croissance hebdo / +2 Déf garnison » est **town-scoped**. Comment un
effet de Maison **par héros** atteint-il une **ville par joueur** ?

- **A** — la Maison du héros s'applique aux villes **possédées par son joueur**
  (agrégée sur les héros du joueur ; simple mais un joueur multi-héros multi-Maison
  cumule).
- **B** — la Maison s'applique à la ville **où le héros est présent/en garnison**
  (fidèle « le héros apporte sa Maison » ; plus de plomberie, effet intermittent).
- **C** — v1 **hero-scoped seulement** : livrer les effets exprimables au niveau
  héros (Lion moral, Serpent or/jour, Aigle coût mana), **différer** les
  town-scoped (Blaireau) + resource/spell (Venari, Serpent access, Aigle manaMax,
  Lion +2 Att) en réconciliant le doc/données ; plus petit, sans nouvelle
  propagation héros→ville.

## Contexte session

Livré cette session (marathon) : **A2e/A2f/A2g/A2h** (capacités de combat),
**F-BONUS**, **F-SKILLS** + correctifs garde-fou. F-HOUSES est une **extension
moteur multi-surface** (croissance de ville, défense de garnison, ressource de
faction) avec la question de propagation ci-dessus ⇒ **checkpoint** avant
exécution (choix A/B/C), et/ou reprise en **session fraîche** (contexte propre =
meilleure qualité pour un lot d'extension moteur).

## Journal

- branche `claude/f-houses-vox` depuis `main` @ 3532729.
