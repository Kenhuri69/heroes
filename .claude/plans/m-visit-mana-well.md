# M-VISIT — Puits de magie (`restoreMana`)

> Lot atomique du backlog `game-feature-gaps.md` (§2.5, M-VISIT). Variant
> `VisitableEffect` **générique** `restoreMana` : un puits de magie restaure la
> mana du héros visiteur à son maximum. Patron EXACT de `learnSpell` /
> `grantSkill` / `grantWarMachine`.

## Objectif

Fouler un **puits de magie** restaure `hero.mana` à `hero.manaMax` (classique
« Magic Well » HoMM — utile mid-tour après une dépense de mana en combat, la
mana ne se rechargeant qu'au changement de jour). `hero.mana` déjà sérialisé ⇒
**pas de bump save**. Amount = mana réellement restaurée (0 si déjà pleine).

## Invariants

- Zéro faction dans le moteur ni les tests (ids opaques).
- Champ déjà sérialisé ⇒ pas de bump `CURRENT_SAVE_VERSION`.
- Aucun visitable dans le golden replay ⇒ **golden inchangé**.
- Pas d'équilibrage de faction ⇒ **pas de `faction:sim`**.

## Étapes

1. `adventure/map.ts` : variant `{ kind: 'restoreMana' }` (aucun paramètre).
2. `adventure/visitable.ts` : handler — `amount = manaMax - mana`, `hero.mana = manaMax`.
3. `content/schemas.ts` : `z.object({ kind: z.literal('restoreMana') })`.
4. `content/loader.ts` : union `ResolvedMapObject`.
5. Client : `MapObjectCard` (ligne `effectRestoreMana`), `notifications`
   (toast `bonusMana`, 0 ⇒ null), `render/mapObjects` (teinte + silhouette puits).
6. Locales FR/EN : `mapCard.effectRestoreMana`, `toast.bonusMana`.
7. `data/maps/proto-01.map.json` : `puits-1` sur une tuile grass libre,
   `frequency: oncePerHeroPerWeek`.
8. `map-visitables.test.ts` : restaure la mana dépensée + no-op si pleine.
9. Docs : `docs/02-mechanics.md` §2.2 + backlog M-VISIT.

## Pipeline

typecheck · lint · vitest engine (golden + save-shape inchangés) · vitest content
· content:check · garde-fou faction · garde-fou couleur · build · bundle gzip
< 819200 · smoke. (Pas de `faction:sim`.)

## Suivi

- [x] 1 map.ts · [x] 2 visitable.ts · [x] 3 schemas.ts · [x] 4 loader.ts
- [x] 5 client · [x] 6 locales · [x] 7 proto-01 · [x] 8 test · [x] 9 docs

## Résultat pipeline (local)

typecheck 5/5 ✓ · lint ✓ · vitest engine 725 (golden + save-shape inchangés) ✓ ·
vitest content 126 ✓ · content:check ✓ · garde-fou faction ✓ · garde-fou couleur ✓
· build ✓ · bundle 312587 o < 819200 ✓ · smoke 101/101 ✓.
