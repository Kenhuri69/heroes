# Lot H-ARTEQUIP.2 — Artefact enseignant un sort (grantsSpell)

> Première tranche de H-ARTEQUIP.2 (backlog §2.4 « effets spéciaux déclaratifs :
> …, +sorts ») : un artefact qui **enseigne un sort** tant qu'il est équipé
> (« Chapeau du sorcier »/« Spellbinder's Hat » HoMM). Champ déclaratif générique
> `ArtifactDef.grantsSpell` + helper partagé `heroKnownSpellIds` (union sorts
> appris ∪ sorts d'artefacts). **`hero.spells` jamais muté ⇒ pas de bump save,
> golden inchangé.** Doc 02 §1.1.

## Mécanique (générique, zéro faction)

- `ArtifactDef.grantsSpell?: string` — sort castable tant que l'artefact est dans
  un slot équipé ; retiré de l'ensemble castable dès le déséquipement.
- Helper pur `heroKnownSpellIds(hero, artifactCatalog)` = `hero.spells` ∪
  `grantsSpell` des artefacts équipés (sans doublon). **Source unique** consommée
  par les 6 sites de « sorts connus » (validation combat + aventure, IA, grimoire
  combat, grimoire aventure, gate `canCastSpell`).
- `spellId` opaque, cross-validé au chargement (`grantsSpell` ∈ sorts communs).

## Changements

- `packages/engine/src/hero/types.ts` : `grantsSpell?` sur `ArtifactDef`.
- `packages/engine/src/hero/artifacts.ts` : helper `heroKnownSpellIds` ; `index.ts`
  (engine) l'exporte.
- `packages/engine/src/hero/index.ts` : `validateCastSpell` + `validateCastAdventureSpell`
  via le helper. `combat/ai.ts` : `chooseHeroSpell` via le helper.
- `packages/content/src/schemas.ts` : champ `grantsSpell` ; `loader.ts` :
  `buildArtifactCatalog` le porte + cross-validation core.
- `packages/client/src/ui/{SpellBook,combat}.tsx`, `AdventureSpellbook.tsx` : union.
- `data/core/artifacts.json` : `grimoire-arcanique` (grantsSpell `boule-de-feu`) +
  locales FR/EN ; `data/maps/proto-01.map.json` : `artifact-grimoire` (6,5).
- doc 02 §1.1 (note État) ; backlog `game-feature-gaps.md` H-ARTEQUIP.

## Vérification

- test moteur `hero-artifact-spell.test.ts` : union `heroKnownSpellIds` (dont
  dédup + artefact sans sort) ; sort d'artefact castable (validate null) ;
  déséquipé ⇒ `spellNotKnown`. (ids OPAQUES.)
- typecheck 5/5 · lint · engine (golden + save-shape **inchangés**) · content ·
  content:check (proto-01 + cross-valid) · garde-fous faction/couleur · build +
  bundle < 800 Ko · smoke.

## Journal

- 2026-07-13 — Plan créé, branche `claude/h-artequip-grant-spell` depuis origin/main
  (après merges #330 dispel, #331 chaîne, #333 cabane).
- 2026-07-13 — Implémenté : `grantsSpell` (`ArtifactDef` + schéma + loader porté &
  cross-validé), helper `heroKnownSpellIds` (exporté), 6 sites de « sorts connus »
  routés (validate combat/aventure, IA, SpellBook, AdventureSpellbook, canCastSpell),
  artefact `grimoire-arcanique` + locales, proto-01 `artifact-grimoire`, doc 02 §1.1
  + backlog.
- 2026-07-13 — Vérif : typecheck 5/5 · lint · engine 715/715 (dont
  `hero-artifact-spell` ; golden + save-shape **inchangés**) · content 126/126 ·
  content:check (proto-01 + cross-valid grantsSpell) · garde-fous faction/couleur ·
  build · bundle gzip 311 Ko < 800 Ko. Smoke en cours.
