# Lot M-CALENDAR — Semaine ciblant une créature (growthTier)

> Comble le différé M-CALENDAR (backlog §2.5 « semaine ciblant une créature ») :
> une **« Semaine de X »** qui décuple la croissance hebdo d'un **palier (tier)**
> d'unités précis, en plus du facteur global. Champ déclaratif générique
> `CalendarEventDef.growthTier { tier, factor }` (tier = nombre opaque, jamais de
> faction). Réutilise le mécanisme M-CALENDAR (RNG seedé, `weekEventId` déjà
> stocké save v20) ⇒ **aucun champ d'état neuf, pas de bump save, golden inchangé**.
> Doc 02 §2.3.

## Mécanique (générique, zéro faction)

- `CalendarEventDef.growthTier?: { tier: number; factor: number }` — quand
  l'événement de la semaine le porte, les habitations dont l'unité est de ce
  `tier` (`CombatUnitDef.tier`) grossissent × `factor` EN PLUS du `growthFactor`
  global. Absent ⇒ semaine ordinaire (comportement inchangé).
- Helper pur `weekGrowthTierFactor(state, tier)` (calendar.ts) — 1 si l'événement
  ne cible pas ce tier. Consommé par `weeklyGrowthOf` (villes, partagé avec l'UI
  de recrutement T-GROWTHUI) et la boucle d'habitations hors ville.

## Changements

- `packages/engine/src/adventure/config.ts` : `growthTier?` sur `CalendarEventDef`.
- `packages/engine/src/adventure/calendar.ts` : `weekGrowthTierFactor`.
- `packages/engine/src/town/economy.ts` : facteur tier dans `weeklyGrowthOf` +
  boucle habitations.
- `packages/content/src/schemas.ts` : champ `growthTier` (tier ≥ 1, factor > 0).
- `data/core/config.json` : événement `recruits` (tier 1 ×2) ; locales FR/EN.
- doc 02 §2.3 (note État) ; backlog `game-feature-gaps.md` M-CALENDAR.

## Vérification

- test moteur `calendar.test.ts` : une semaine `growthTier {tier:1, factor:2}`
  double la croissance d'une unité T1 (18 vs 9) ; une semaine ciblant un AUTRE
  tier laisse la croissance normale (9). (ids OPAQUES.)
- typecheck 5/5 · lint · engine (golden + save-shape **inchangés**) · content ·
  content:check · garde-fous faction/couleur · build + bundle < 800 Ko · smoke.

## Journal

- 2026-07-13 — Plan créé, branche `claude/m-calendar-creature-week` depuis
  origin/main (après merges #330/#331/#333/#334).
- 2026-07-13 — Implémenté : `growthTier?` (config type — `| undefined` explicite pour
  `exactOptionalPropertyTypes`), helper `weekGrowthTierFactor`, facteur tier dans
  `weeklyGrowthOf` + boucle habitations, schéma content, événement `recruits` +
  locales, doc 02 §2.3 + backlog.
- 2026-07-13 — Vérif : typecheck 5/5 (client exigeait `| undefined` explicite sur
  l'optionnel, aligné sur `guardianReward`) · lint · engine 717/717 (dont calendar
  +2 ; golden + save-shape **inchangés**) · content 126/126 · content:check ·
  garde-fous faction/couleur · build · bundle gzip 311 Ko < 800 Ko. Smoke en cours.
