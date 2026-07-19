# M-CALENDAR — Semaine de ruée (`resourceGrant`)

> Lot atomique du backlog `game-feature-gaps.md` (§2.5, M-CALENDAR). Nouveau
> champ OPTIONNEL générique `CalendarEventDef.resourceGrant { resource, amount }` :
> une semaine spéciale crédite une ressource à **tous les joueurs** au passage de
> semaine. Patron EXACT de `growthTier` (#335) — même point d'extension déclaratif
> sur `CalendarEventDef`.

## Objectif

Un événement de calendrier peut porter `resourceGrant { resource, amount }` : au
tirage hebdomadaire (`rollWeekEvent`), chaque joueur reçoit `amount` de `resource`
(ressource commune). Ex. « Semaine de la Ruée vers l'Or » (+500 or). Feedback via
un événement `CalendarResourceGranted` par joueur (toast humain).

## Invariants

- Zéro faction dans le moteur ni les tests (ids opaques / ressources communes).
- Champ OPTIONNEL sur `CalendarEventDef` (config, non `HeroState`/`CombatStack`)
  ⇒ **pas de bump `CURRENT_SAVE_VERSION`**, ne déclenche pas le garde-fou save-shape.
- La config golden n'a **aucun** `calendar` ⇒ `rollWeekEvent` no-op ⇒ **golden
  inchangé**.
- Pas d'équilibrage de faction ⇒ **pas de `faction:sim`**.
- `exactOptionalPropertyTypes` : `resourceGrant?: {...} | undefined` explicite.

## Étapes

1. `content/schemas.ts` : `resourceGrant` optionnel sur l'event de calendrier
   (`resource: z.enum(COMMON_RESOURCE_IDS)`, `amount` entier positif).
2. `engine/adventure/config.ts` : `CalendarEventDef.resourceGrant?: {...} | undefined`.
3. `engine/core/events.ts` : nouvel event `CalendarResourceGranted { playerId, resource, amount }`.
4. `engine/core/engine.ts` : après `rollWeekEvent`, si `calEvent.resourceGrant`,
   créditer TOUS les joueurs + émettre l'event par joueur.
5. Client `notifications.ts` : toast humain `toast.calendarResource`.
6. Locales FR/EN : `toast.calendarResource` + `calendar.event.gold-rush.name`.
7. `data/core/config.json` : nouvel event `gold-rush` (growthFactor 1,
   `resourceGrant { gold, 500 }`, poids modéré).
8. `calendar.test.ts` : la semaine de ruée crédite chaque joueur + event émis ;
   sans `resourceGrant` aucun crédit.
9. Docs : `docs/02-mechanics.md` §2.3 + backlog M-CALENDAR.

## Pipeline

typecheck · lint · vitest engine (golden + save-shape inchangés) · vitest content
· content:check · garde-fou faction · garde-fou couleur · build · bundle gzip
< 819200 · smoke. (Pas de `faction:sim`.)

## Suivi

- [x] 1 schema · [x] 2 config type · [x] 3 event · [x] 4 engine loop
- [x] 5 client toast · [x] 6 locales · [x] 7 config data · [x] 8 test · [x] 9 docs

## Résultat pipeline (local)

typecheck 5/5 ✓ · lint ✓ · vitest engine 727 (golden + save-shape inchangés) ✓ ·
vitest content 126 ✓ · content:check ✓ · garde-fou faction ✓ · garde-fou couleur ✓
· build ✓ · bundle 312652 o < 819200 ✓ · smoke 101/101 ✓.
