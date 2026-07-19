# M-VISIT — Fabrique de machines de guerre (`grantWarMachine`)

> Lot atomique du backlog `game-feature-gaps.md` (§2.5, M-VISIT). Un nouveau
> variant `VisitableEffect` **générique** : un lieu visitable donne une machine
> de guerre (baliste/catapulte) au héros visiteur. Patron EXACT du sanctuaire de
> sort `learnSpell` (#333) et de la cabane `grantSkill`.

## Objectif

Fouler un lieu visitable de type « Fabrique de machines de guerre » ajoute une
machine de guerre (`machineId`, catalogue `core/war-machines.json`) à
`hero.warMachines`, **idempotent** (déjà possédée ⇒ visite consommée sans gain).
Champ `warMachines` déjà sérialisé (save v6) ⇒ **pas de bump save**.

## Invariants

- Zéro faction dans le moteur ni les tests (ids opaques uniquement).
- Champ déjà sérialisé ⇒ pas de bump `CURRENT_SAVE_VERSION`.
- Aucun visitable dans le golden replay ⇒ **golden inchangé**.
- N'exerce pas l'équilibrage de faction ⇒ **pas de `faction:sim`**.

## Étapes

1. **Moteur — `adventure/map.ts`** : ajouter le variant à l'union
   `VisitableEffect` : `{ kind: 'grantWarMachine'; machineId: string }`.
   → verif : typecheck.
2. **Moteur — `adventure/visitable.ts`** : handler dans `visitBonus` — ajout
   idempotent à `hero.warMachines` (amount 1 sinon 0). → verif : test moteur.
3. **Contenu — `content/schemas.ts`** : variant Zod
   `z.object({ kind: z.literal('grantWarMachine'), machineId: idSchema })`.
   → verif : content test.
4. **Contenu — `content/loader.ts`** : ajouter le variant à l'union
   `ResolvedMapObject` (effet visitable). → verif : typecheck.
5. **Client** : `ui/MapObjectCard.tsx` (ligne `effectGrantWarMachine` via
   `resolveUnitName`), `app/notifications.ts` (toast `bonusWarMachine`, 0 ⇒ null),
   `render/mapObjects.ts` (teinte + silhouette procédurale distincte).
   → verif : typecheck + build.
6. **Locales** FR/EN : `mapCard.effectGrantWarMachine`, `toast.bonusWarMachine`.
7. **Données** : `data/maps/proto-01.map.json` — un visitable `fabrique-1` sur
   une tuile grass libre (9,5) donnant `ballista`. → verif : `content:check`.
8. **Test** `map-visitables.test.ts` : grant + idempotent + visite consommée
   (ids opaques `test-machine`). → verif : vitest engine.
9. **Docs** : `docs/02-mechanics.md` §2.2 + backlog M-VISIT.

## Pipeline de sortie

typecheck · lint · vitest engine (golden + save-shape INCHANGÉS) · vitest content
· content:check · garde-fou faction · garde-fou couleur · build · bundle gzip
< 819200 · smoke. (Pas de `faction:sim`.)

## Suivi

- [x] 1 map.ts union
- [x] 2 visitable.ts handler
- [x] 3 schemas.ts variant Zod
- [x] 4 loader.ts union ResolvedMapObject
- [x] 5 client (card/toast/render)
- [x] 6 locales FR/EN
- [x] 7 proto-01 data
- [x] 8 test moteur
- [x] 9 docs

## Résultat pipeline (local)

typecheck 5/5 ✓ · lint ✓ · vitest engine 724 (golden + save-shape inchangés) ✓ ·
vitest content 126 ✓ · content:check ✓ · garde-fou faction ✓ · garde-fou couleur ✓
· build ✓ · bundle 312448 o < 819200 ✓ · smoke en cours.
