# H-ARTEQUIP.2+ — Artefact d’immunité aux statuts néfastes d’armée

Backlog game-feature-gaps.md « H-ARTEQUIP.2+ reste » : effets déclaratifs
restants, dont « immunité/résistance aux STATUTS d’armée ». Miroir statut de
`armyMagicResistance` (qui atténue les DÉGÂTS de sort). Doc 02 §1.1.

## Constat
`armyMagicResistance` protège des dégâts de sort mais rien ne protège des
DEBUFFS/silences ennemis. Point d’extension générique : `ArtifactDef.
grantsStatusImmune` (booléen), un hook unique là où les statuts de sort sont
posés (spell-effect else-branch buff/debuff/silence).

## Étapes (patron effet d’artefact déclaratif)
1. engine/hero/types: `ArtifactDef.grantsStatusImmune?: boolean`.
2. engine/combat/damage: helper pur `heroGrantsStatusImmune(state,combat,side)`
   (miroir `heroArmyMagicResistance`), exporté.
3. engine/combat/spell-effect: dans la branche buff/debuff/silence, NE PAS
   poser un statut HOSTILE (`spellTargetsEnemy`) sur une pile dont le héros
   accorde l’immunité. Buffs alliés inchangés. Import spellTargetsEnemy +
   heroGrantsStatusImmune. Pas d’event neuf (skip silencieux, comme la
   résistance) ⇒ golden inchangé.
4. content/schemas: `grantsStatusImmune: z.boolean().optional()`.
5. content/loader buildArtifactCatalog: PROPAGER le champ + TEST régression
   (leçon #379/#380 : un champ non propagé est mort en jeu réel).
6. data/core/artifacts.json: Talisman de constance (slot ring) + locales fr/en
   (artifact.<id> + .lore).
7. Unit test moteur: debuff hostile NON posé sur armée immunisée ; buff allié
   posé ; armée non dotée toujours affectée.
8. doc 02 §1.1 ; backlog: cet item ✅ + C-SPELLUI ✅.

## Portée
Effet OPTIONNEL sur ArtifactDef ⇒ save-shape non déclenché (pas de bump).
Helper/hook purs, no-op sans artefact doté ⇒ golden inchangé. Zéro faction.

## Statut
Étapes 1-8 implémentées. Non-smoke vert (typecheck·lint·engine 819 golden+save-shape inchangés·content 67·content:check·gardes 1/1·build·bundle 319Ko·unit statut 3/3). Smoke en cours (non-régression).
