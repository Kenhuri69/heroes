# Lot F-BUILDEFF.2 — Statue du Jugement (moral de garnison en siège)

Backlog §2.3 (F-BUILDEFF, sous-lot .2). Suite de F-BUILDEFF.1 : deuxième champ
d'aura de bâtiment, cette fois consommé **en combat de siège**. Exemplaire :
**Statue du Jugement** (doc 03 §4 — +1 moral en combat à la garnison et aux
héros visiteurs).

## Portée F-BUILDEFF.2

- **Champ d'aura** `combatMoraleBonus` ajouté à l'effet `heroAura`
  (`town/types.ts`) + au schéma de contenu.
- **Câblage** : dans `moraleOf` (`combat/state-helpers.ts`), le camp
  **défenseur** d'un combat de **ville** (`combat.townId`) reçoit le
  `combatMoraleBonus` des bâtiments construits de la ville — réutilise
  `townBuildingAura` (champ élargi). Le camp attaquant n'en bénéficie pas.
- **Données** : bâtiment **Statue du Jugement** (`data/factions/haven/`,
  `heroAura { combatMoraleBonus: 1 }`) + locales FR/EN.
- **Docs** : doc 03 §4 (Statue livrée), doc 02 §4.1 (champ `combatMoraleBonus`).

## Note de fidélité (doc)

La garnison bénéficie du moral (couvert). Le volet **« héros visiteurs »** (un
héros du propriétaire qui **défend** la ville) est **différé** avec le modèle
« héros défenseur en siège » (aujourd'hui `defenderHeroId` = null en siège,
garnison seule) — noté dans le doc.

## Invariants

- **Zéro faction** (aura opaque via `townBuildingAura`) — garde-fou vert.
- **Aucun bump de sauvegarde** : aura lue à l'exécution depuis `town.buildings`.
- **Golden inchangé** : le combat du golden n'est pas un siège (`townId` = null).

## Vérifs

typecheck · lint · engine+content (nouveau cas : garnison en siège +1 moral avec
la Statue, inchangée sans) · content:check · garde-fou · build · budget · smoke.

## Journal

- branche `claude/f-buildeff-morale` depuis `main` @ merge #237 (F-BUILDEFF.1).
