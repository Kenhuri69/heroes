# Lot H-ARTEQUIP — Artefact de mouvement (bonus.movementFlat)

> Livre le différé **explicite** du doc 02 §1.5 (« les artefacts ne donnent pas
> de points de mouvement — différés ») : un artefact « bottes de vitesse » qui
> **ajoute des points de mouvement quotidiens** au héros. Champ déclaratif
> `ArtifactDef.bonus.movementFlat`, sommé dans `heroArtifactBonus` et ajouté dans
> `heroDailyMovement` (miroir du `movementBonusFlat` d'aura de bâtiment,
> F-BUILDEFF.1). **Bonus dérivé live ⇒ pas de bump save, golden inchangé.**

## Mécanique (générique, zéro faction)

- `ArtifactDef.bonus.movementFlat?: number` — PM quotidiens plats ajoutés tant que
  l'artefact est équipé.
- `heroArtifactBonus` agrège `movementFlat` (comme attack/defense/…).
- `heroDailyMovement` : `+ heroArtifactBonus(...).movementFlat` après le facteur
  Logistique et l'aura de bâtiment.

## Changements

- `packages/engine/src/hero/types.ts` : `movementFlat?` sur `ArtifactDef.bonus`.
- `packages/engine/src/hero/artifacts.ts` : `movementFlat` dans `ArtifactBonusTotal`
  + somme.
- `packages/engine/src/core/engine.ts` : `heroDailyMovement` ajoute le bonus artefact.
- `packages/content/src/schemas.ts` : `movementFlat` dans `artifactBonusSchema`.
- `data/core/artifacts.json` : `bottes-de-sept-lieues` (movementFlat 300, slot feet)
  + locales FR/EN ; `data/maps/proto-01.map.json` : objet artefact.
- doc 02 §1.5 (lever le différé) ; backlog `game-feature-gaps.md` H-ARTEQUIP.

## Vérification

- test moteur `hero-artifact-movement.test.ts` : PM quotidiens = base + movementFlat
  d'un artefact équipé ; 0 sans l'artefact ; cumul de deux artefacts. (ids OPAQUES.)
- typecheck 5/5 · lint · engine (golden + save-shape **inchangés**) · content ·
  content:check · garde-fous faction/couleur · build + bundle < 800 Ko · smoke.

## Journal

- 2026-07-13 — Plan créé, branche `claude/h-artequip-movement` depuis origin/main
  (après merges #330/#331/#333/#334/#335).
- 2026-07-13 — Implémenté : `bonus.movementFlat` (type + schéma), agrégat
  `heroArtifactBonus`, ajout dans `heroDailyMovement`, artefact `bottes-de-sept-lieues`
  + locales, proto-01 `artifact-bottes`, doc 02 §1.5 (différé levé) + backlog.
- 2026-07-13 — Vérif : typecheck 5/5 · lint · engine 719/719 (dont
  `hero-artifact-movement` +2 ; golden + save-shape **inchangés**) · content 126/126 ·
  content:check (proto-01) · garde-fous faction/couleur · build · bundle gzip 311 Ko
  < 800 Ko. Smoke en cours.
