# C-SPELLUI.2 — Zone d’effet listée dans la prévisualisation

Backlog game-feature-gaps.md « C-SPELLUI » (2e sous-lot). Doc 08 §2.3/§2.4.
La préviz agrège déjà les NOMBRES de la zone (estimateSpell), mais rien
n’indique QUELLES piles / combien un sort de zone (splash/all/chaîne) touche.

## Constat
`spellTargets`/`chainTargets` (engine/combat/spell-effect) sont la source pure
des piles affectées mais ne sont PAS exportées. Le grimoire ne montre que la
cible centrale (TargetList) + les nombres agrégés (spell-preview).

## Étapes
1. Engine: helper pur exporté `spellAffectedStacks(state, spellId, centerId)` —
   splash/all via spellTargets, chaîne via chainTargets (sort damage+chain),
   [] si pas de combat/ids invalides. Pur ⇒ golden inchangé, pas de bump save.
   → verif: unit test moteur (splash multi-piles, chaîne, all, mono-cible).
2. Export dans engine/index.ts.
3. Client SpellBook: sur cible choisie, si sort de zone (area||chain), afficher
   `spell-zone` (piles touchées + compte) sous la préviz. Mono-cible ⇒ rien.
4. Locales fr/en (spellbook.zone / spellbook.zoneCount). CSS.
5. Smoke: sort mono-cible existant ⇒ PAS de spell-zone (négatif, non-régression).
   Le cas multi-piles positif est couvert par le unit test moteur (scénario
   smoke = 1 pile gardien, héros sans sort de zone).
6. Doc 08 §2.3 : note zone listée.

## Portée
Helper moteur PUR (déterministe, pas dans le replay) ⇒ golden inchangé,
save-shape inchangé (aucun champ neuf sur HeroState/CombatStack). Zéro faction.

## Statut
Étapes 1-6 implémentées. Non-smoke vert (typecheck·lint·engine 815 golden+save-shape inchangés·content·content:check·gardes 1/1·build·bundle 319Ko·unit zone 5/5). Smoke en cours.
