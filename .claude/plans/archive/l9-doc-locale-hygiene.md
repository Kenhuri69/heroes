# Lot L9 — hygiène doc & locales

> Lot 9 du plan `.claude/plans/missing-features-2026-08.md` (**G7**). Aucun code
> de gameplay : on aligne la **source de vérité** (docs) et les locales sur le
> livré, et on re-coche l'inventaire vivant.

## 1. Écarts corrigés (chacun vérifié dans le code)

| Écart | Preuve du livré |
|---|---|
| `ability.resurrectAlly` / `.desc` (« à venir ») dans les locales FR/EN alors que la capacité **n'existe plus** au catalogue | `data/core/abilities.json` (35 ids, sans `resurrectAlly`) ; l'effet passe par `spellcaster` (`combat-spellcaster.test.ts:102`) |
| doc 02 §5.4 : « **32** capacités » puis « **27** » plus bas, et « `resurrectAlly` pas encore interprétée » | comptage du catalogue : **35**, toutes interprétées et **toutes portées** par ≥ 1 unité |
| doc 02 §5.4 : `spellcaster` « UI joueur différée » | `ui/combat.tsx:241-268` (bouton de lancer de la pile active) — plan `cap-cast-ui` archivé |
| doc 03 §4 : Prière de bataille « UI joueur différée » | `ui/combat.tsx:237` (`canHeroRally`) — plan `f-skills-battle-prayer-ui` archivé |
| doc 03 §1 : « catalogue = **27** capacités » | idem : 35 |
| doc 02 §1.2 : « les classes de héros distinctes sont différées » | `config.attributeWeightsByArchetype` livré (H-NAMED.3) — reformulé : profil par **archétype** livré, classes HoMM hors périmètre |
| `game-feature-gaps.md` : 10 items ⬜/🧩 périmés | re-cochés item par item avec leur preuve (NET-RANKED, NET-EMAIL, AS-*, CAP-* reste, NET-SEC.3, NET-FOG partiel, M-GUARDLINK) |

## 2. Vérification

Pas de test à ajouter (aucun comportement ne change). Le pipeline complet est
rejoué quand même : les locales sont chargées par le contenu (`content:check`,
test de résolution des références `@loc:`), une clé retirée à tort casserait
la suite.

- [x] `pnpm typecheck` · `pnpm lint`
- [x] tests moteur / contenu / client
- [x] `pnpm content:check` · garde-fous faction & couleurs
- [x] `pnpm build` + budget bundle
- [x] smoke `@core`
- [x] golden inchangé (aucun fichier moteur touché)

## 3. Journal

- **2026-08-31 — livré**. Une seule surprise : la clé `ability.resurrectAlly`
  n'était plus référencée nulle part (ni données, ni client) — suppression sèche,
  les deux locales restent des JSON valides et la parité FR/EN est conservée.
