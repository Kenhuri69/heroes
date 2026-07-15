# H-ARTEQUIP.2+ — Artefact d’immunité de CIBLAGE aux sorts d’armée

Backlog « H-ARTEQUIP.2+ reste » : `grantsSpellImmune` — l’armée du héros devient
INCIBLABLE par les sorts hostiles ennemis (miroir de `grantsStatusImmune`/
`armyMagicResistance`). Doc 02 §1.1. Multi-sites : dé-risqué par un prédicat
partagé remplaçant `isSpellImmune(catalog,unitId)` aux ~6 sites.

## Constat
`isSpellImmune(catalog, unitId)` (immunité d’UNITÉ, CAP-SPELLIMMUNE) est appelé
à 6 endroits (validate hero+unit, IA ×2, client ×2). Aucun ne considère une
immunité d’ARMÉE (artefact). Prédicat partagé = source unique.

## Étapes
1. engine/hero/types: `ArtifactDef.grantsSpellImmune?: boolean`.
2. engine/combat/state-helpers: `isStackSpellImmune(state,combat,stack)` =
   immunité unité OU héros du camp doté (heroForSide inline). Exporté.
3. Remplacer les 6 appels `isSpellImmune(catalog,unitId)` par
   `isStackSpellImmune(state,combat,stack)` : actions.ts, hero/index.ts,
   ai.ts ×2, combat.tsx, SpellBook.tsx. Comportement identique sans artefact
   doté ⇒ golden inchangé.
4. content/schemas + loader (propagation + test régression).
5. data: Sceau de l’intouchable (slot neck) + locales fr/en.
6. Unit test moteur: cast hostile refusé sur armée dotée (validate + IA ignore),
   buff allié OK, armée non dotée ciblable.
7. doc 02 §1.1 ; backlog.

## Portée
Effet OPTIONNEL dérivé de l’équipement ⇒ pas de bump save ; prédicat no-op sans
artefact doté ⇒ golden inchangé. Zéro faction. Couverture smoke partielle
(scénario par défaut n’équipe pas l’artefact) — assumée, engine unit test couvre.

## Statut
Étapes 1-7 implémentées. Non-smoke vert (typecheck·lint·engine 822 golden+save-shape inchangés·content 144·content:check·gardes 1/1·build·bundle 319Ko·unit spell-immune 3/3). Smoke en cours.
