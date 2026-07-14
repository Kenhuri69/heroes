# H-ARTEQUIP — artefact `bonus.vision` (longue-vue / spyglass)

> Lot du backlog `game-feature-gaps.md` §2.4 H-ARTEQUIP (« ArtifactDef :
> bonus.visionFlat (longue-vue) »). Nouveau champ déclaratif `bonus.vision` :
> un artefact équipé augmente le **rayon de vision** du héros (comme la
> compétence Recherche). Bonus **live-calculé** (jamais sérialisé) ⇒ pas de
> bump save, golden inchangé. Zéro faction moteur, pas de faction:sim.

## Décision de conception

- Le rayon de vision effectif était dupliqué sur **5 sites moteur** + **1 site
  client** sous la forme `config.visionRadius + heroVisionBonus(hero, …)`.
  On DÉDUPLIQUE (esprit R7) via un helper pur **`heroVisionRadius(hero,
  baseRadius, skillCatalog, artifactCatalog)`** = base + bonus Recherche/Maison
  + bonus plat d'artefact. Un seul point ajoute le terme artefact.
- `bonus.vision?: number` s'ajoute à l'agrégat `heroArtifactBonus`
  (`ArtifactBonusTotal.vision`) — mêmes champ optionnel + slot que les autres
  bonus. Non sérialisé (catalogue = données) ⇒ **pas de bump save**.
- Client : le rendu du brouillard « en vision » (`AdventureScene`) passe au même
  helper ⇒ la vision live reste alignée sur la révélation moteur.

## Étapes (chaque étape → vérif)

1. [x] **engine/hero/types.ts** — `ArtifactDef.bonus.vision?: number`.
2. [x] **engine/hero/artifacts.ts** — `ArtifactBonusTotal.vision` + somme.
3. [x] **engine/hero/skills.ts** — helper `heroVisionRadius` (importe
   `heroArtifactBonus`). → verify: typecheck (pas de cycle skills↔artifacts).
4. [x] **engine** : 5 sites de `revealAround` → `heroVisionRadius`
   (movement.ts ×2, core/engine.ts, hero/recruit.ts, hero/index.ts).
5. [x] **engine/index.ts** — export `heroVisionRadius` (garder `heroVisionBonus`).
6. [x] **client/scenes/adventure/AdventureScene.ts** — `sightings.radius` via
   `heroVisionRadius(h, config.visionRadius, game.skillCatalog, game.artifactCatalog)`.
7. [x] **content/schemas.ts** — `artifactBonusSchema.vision` optionnel.
8. [x] **data/core/artifacts.json** — artefact `longue-vue` (`bonus.vision`, slot).
9. [x] **data/core/locales/{fr,en}.json** — `artifact.longue-vue` (+ `.lore`).
10. [x] **test** — `heroArtifactBonus().vision` sommé + `heroVisionRadius`
    inclut le terme artefact ; sans artefact = comportement historique.
11. [x] **docs/02-mechanics.md §1.5** — mention de la longue-vue.

## Vérifs pipeline (avant push)

- [x] `pnpm typecheck` 5/5
- [x] `pnpm lint`
- [x] vitest engine 733 (golden + save-shape INCHANGÉS — bonus live, additif)
- [x] vitest content 126
- [x] `pnpm content:check`
- [x] garde-fou faction (statut grep 1) · couleur CSS (statut 1)
- [x] `pnpm build` + bundle gzip 312889 < 819200
- [x] `pnpm smoke` (101 passed)
- faction:sim : **non requis** (artefacts non équipés en sim).

## Écarts constatés

- Les 2 sites `revealAround` de `movement.ts` avaient une indentation
  différente (6 vs 10 espaces) ⇒ le `replace_all` n'a pris que le premier ;
  second corrigé à la main (typecheck l'a signalé). Aucun impact fonctionnel.

## Journal

- 2026-07-14 — Lot créé, branche `claude/h-artequip-vision` depuis origin/main.
