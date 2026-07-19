# H-ARTEQUIP — panoplies d'artefacts (sets à seuils)

## But
Un artefact peut appartenir à une **panoplie** : équiper ≥ N pièces d'une même
panoplie accorde un bonus supplémentaire (HoMM « artifact set »). Générique,
data-driven, zéro faction, pas de bump save.

## Design (minimal, zéro nouveau catalogue/plumbing)
- `ArtifactDef.set?: { id, pieces, bonus }` — CHAQUE membre porte le MÊME
  descripteur (id de panoplie, seuil, bonus accordé). Ride sur `artifactCatalog`
  déjà câblé partout ⇒ pas de nouveau champ `GameState`/`StartGame`.
- `heroArtifactBonus(hero, catalog)` (signature INCHANGÉE) : après la somme des
  bonus individuels, groupe les artefacts équipés par `set.id`, et pour chaque
  panoplie dont l'effectif ≥ `pieces`, ajoute `set.bonus` UNE fois. Les ~10
  appelants (att/déf/mana/PM/vision/moral/chance) en profitent gratuitement.
- Optionnel ⇒ pas de bump save ; golden = fixtures inline (sans set) ⇒ inchangé.

## Étapes / vérif
1. `content/schemas.ts` : `set` sur `artifactSchema` (réutilise `artifactBonusSchema`). → content
2. `content/loader.ts` : porter `set` dans `buildArtifactCatalog`. → content
3. `engine/hero/types.ts` : `set?` sur `ArtifactDef`. → typecheck
4. `engine/hero/artifacts.ts` : agrégation de panoplie dans `heroArtifactBonus`. → engine
5. `data/core/artifacts.json` : 1 panoplie (2 pièces existantes). → content:check
6. client `HeroInventory.tsx` : indicateur de progression de panoplie (n/seuil ✓). → build+smoke
7. test `hero-artifact-set.test.ts` : bonus au seuil, pas en dessous ; 1 seule fois. → engine
8. docs 02 §1.1 + 08 §2.3 alignées.

## Pipeline complet vert AVANT push (exit réels, pas de pipe tail)
✅ typecheck 5/5 · ✅ lint · ✅ vitest engine 798 (golden+save-shape INCHANGÉS,
hero-artifact-set 3 tests) · ✅ vitest content 138 · ✅ content:check · ✅ garde-fou
faction (status 1) · ✅ garde-fou couleur (status 1) · ✅ build · ✅ bundle
317996 < 819200 · ⏳ smoke.

Commit 40fc6c5 (non-smoke vert). Reste : confirmer smoke, rebaser origin/main,
push, PR draft, CI, merge, resync.
