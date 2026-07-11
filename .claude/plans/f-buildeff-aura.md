# Lot F-BUILDEFF.1 — aura de bâtiment au héros présent (Écuries)

Backlog §2.3 (F-BUILDEFF 🕳️ L). **Décision utilisateur : découper en sous-lots
F-BUILDEFF.x.** Ce lot livre la **1re tranche** : un effet de bâtiment générique
`heroAura` appliqué au héros du **propriétaire présent sur la ville** (option B,
cohérente avec F-HOUSES), consommé aux points de code qui **connaissent déjà la
ville**. Exemplaire concret : **Écuries** (doc 03 §4 — +mouvement/jour aux héros
qui commencent leur tour dans la ville).

## Portée F-BUILDEFF.1

- **Effet générique** `{ type: 'heroAura'; movementBonusFlat?: number }`
  (`town/types.ts`) — aura de présence pour le héros du propriétaire sur la
  tuile de la ville. Extensible : les sous-lots suivants ajouteront des champs
  (moral/chance en combat, etc.) + leur câblage.
- **Point d'interprétation** `townBuildingAura(state, playerId, pos, field)`
  (`town/economy.ts`) — somme le champ d'aura des bâtiments **construits** de la
  ville que le joueur possède ET où il se tient. Jumeau bâtiment de
  `townHouseField` ; jamais un nom de faction.
- **Câblage** : `movementBonusFlat` ajouté (plat, après le bonus % Logistique)
  dans `heroDailyMovement` (`core/engine.ts`) — appelé au début de tour, quand
  `hero.pos` est connu.
- **Données** : bâtiment **Écuries** (`data/factions/haven/buildings.json`) +
  locales FR/EN.
- **Docs** : doc 02 §4.1 (effet générique d'aura), doc 03 §4 (Écuries livré).

## Différés (sous-lots F-BUILDEFF.x suivants, notés)

- **Statue du Jugement** (+moral garnison/visiteur **en combat**) → threading du
  moral de ville dans le combat de siège (F-BUILDEFF.2).
- **Cloître** (apprentissage de sort au visiteur + régén mana) → surface guilde/
  sorts (F-BUILDEFF.3).
- Modif ressource de faction, passifs de Cercles AH, +XP/+rang → sous-lots
  ultérieurs.

## Invariants

- **Zéro faction** dans le moteur (`townBuildingAura` opaque) — garde-fou vert.
- **Aucun bump de sauvegarde** : l'aura est lue à l'exécution depuis
  `town.buildings` (déjà sauvegardé) ; pas de nouveau champ d'état.
- **Golden inchangé** : le golden n'a pas de bâtiment `heroAura`.

## Vérifications (§4/§7)

typecheck · lint · engine+content tests (nouveau `building-aura.test.ts` :
mouvement majoré si héros du propriétaire sur la ville, pas sinon) · content:check
· garde-fou faction · build · budget bundle · smoke.

## Journal

- branche `claude/f-buildeff-aura` depuis `main` @ merge #235 (F-HOUSES).
