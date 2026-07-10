# M-CALENDAR — mois & événements de calendrier (doc 02 §2.3)

> « go next » autonome. Backlog `game-feature-gaps.md` : événements
> hebdomadaires déclaratifs type « semaine de la peste », mois = 4 semaines.

## Conception (data-driven, générique, RNG seedé)
- Les événements vivent dans **`AdventureConfig.calendar.events`** (donc dans
  `data/core/config.json` sous `adventure.calendar`) — **déjà embarqué** par tous
  les `StartGame` via `config`, zéro nouveau paramètre à filer.
- `CalendarEventDef { id, weight, growthFactor }` — `growthFactor` multiplie la
  croissance hebdo (`1` normal, `0.5` peste, `2` abondance). `id` opaque ⇒ locale
  `calendar.event.<id>.name`.
- État : `Calendar.weekEventId: string | null` (id tiré pour la semaine courante).
  **Bump save 19 → 20** (champ ajouté). `monthOf(day)` = `floor((day-1)/28)+1`.
- Tirage : `rollWeekEvent(draft)` (pondéré, `rollRange(draft.rng)`) appelé à la
  bascule de semaine dans `EndTurn`, **avant** `applyWeeklyGrowth`. Émet
  `CalendarEventStarted { eventId, week, month }`. Absent/liste vide ⇒ no-op
  (weekEventId null, facteur 1) ⇒ golden inchangé en comportement.
- `applyWeeklyGrowth` multiplie `added` par `weekGrowthFactor(draft)` (villes +
  habitations de carte). `max(current, …)` conserve la règle « jamais réduire ».
- Client : toast `toast.calendarEvent` au `CalendarEventStarted` **seulement** si
  l'événement a un facteur ≠ 1 (les semaines « normales » ne s'annoncent pas —
  décidé par le facteur, pas un id en dur). Locales FR/EN.

## Vérif
- Tests moteur : tirage déterministe (même graine → même id) ; peste ⇒ croissance
  divisée par 2, abondance ⇒ ×2 ; liste absente ⇒ facteur 1. **Golden re-fixé**
  (forme : `weekEventId` null + `saveVersion` 20 ; simulation inchangée).
- save-shape : version 20. Content 101+ (schéma `calendar` optionnel). Typecheck/
  lint/build. Smoke (non-régression).
- doc 02 §2.3 + backlog.

## Différés
- Événements de **mois** persistants sur 4 semaines, événements ciblant une
  créature précise (« semaine du Griffon »), affichage calendrier persistant
  dans l'UI (au-delà du toast).

## Journal
- Livré. `AdventureConfig.calendar.events` (embarqué via `config`, zéro nouveau
  param `StartGame`), `rollWeekEvent`/`weekGrowthFactor` (`adventure/calendar.ts`),
  `Calendar.weekEventId` (**save 19→20**), `monthOf`, event `CalendarEventStarted`,
  toast client des semaines spéciales (facteur ≠ 1). Data : 4 événements dans
  `config.json` (normal/harvest/bounty/plague). Golden re-fixé `fa1ab89f` (forme :
  champ null + version ; config golden sans calendrier ⇒ no-op, RNG/combat
  inchangés). Vérif : 477 tests moteur (6 M-CALENDAR), content 101, typecheck/
  lint/build, garde-fou « zéro faction » vert, smoke 141 (2 tests de ville
  rendus robustes : lecture de l'événement tiré, recrutement borné au stock).
