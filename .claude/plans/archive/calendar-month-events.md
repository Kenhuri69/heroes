# Plan — Lot 2.5 (doc 18) : calendrier au mois + semaine d'une unité (A4)

> **Statut** : ✅ livré (2026-07-17).
> Écart couvert : **A4** (doc 18 §2.A) — « effets de calendrier au mois »,
> différés notés doc 02 §2.3. Dernier lot de l'Étape 2 du plan de comblement.

## 0. Objectif & critère de sortie

Deux extensions **data-driven** du calendrier M-CALENDAR :
1. **Événements de mois** persistants (« mois de la peste » ÷2, « mois
   d'abondance » ×1,5) — tirés au RNG seedé à chaque bascule de mois, leur
   facteur module la croissance TOUT le mois (cumulé aux semaines).
2. **« Semaine de X »** ciblant un **`unitId` précis** (au-delà du palier) :
   l'unité est tirée au RNG seedé parmi les unités recrutables du catalogue —
   jamais nommée dans la config core (zéro couplage core → paquet de faction).

**Critère de sortie mesurable** : à la bascule de mois, un événement de mois
est tiré et sa croissance s'applique chaque semaine du mois ; une « semaine de
X » double la croissance de la seule unité tirée ; sans configuration :
comportement et **forme d'état** bit-identiques.

## 1. Invariants (guidelines §8) & décision de forme

- Zéro faction : l'unité ciblée est **tirée** du catalogue (clés triées,
  `growthPerWeek` > 0), jamais écrite en dur dans `data/core/`.
- Déterminisme : tirages au RNG seedé de l'état (comme `rollWeekEvent`).
- **Pas de bump `CURRENT_SAVE_VERSION`** (décision) : les deux nouveaux champs
  d'état `Calendar.monthEventId?` / `Calendar.weekEventUnitId?` sont
  **optionnels et écrits paresseusement** (patron `obelisksVisited`) — jamais
  posés si la config ne les active pas ⇒ une vieille sauvegarde reste un état
  valide (champ absent = tiré à la prochaine bascule), et les fixtures/golden
  (sans calendrier) gardent une forme d'état identique.
- Opt-in par données : `calendar.monthEvents` absent ⇒ aucun tirage de mois ;
  aucun événement `growthUnit` configuré ⇒ aucun ciblage d'unité.

## 2. État des lieux (points d'ancrage vérifiés)

- `adventure/calendar.ts` : `rollWeekEvent` (pondéré, stocke
  `calendar.weekEventId`), `weekGrowthFactor`, `weekGrowthTierFactor`.
- `core/engine.ts` (~`:920`) : bascule de semaine — `WeekStarted` puis
  `rollWeekEvent` AVANT la croissance ; `CalendarEventStarted` émis. Le mois
  (`monthOf`) est calculé mais purement informatif. Pas de tirage au jour 1
  (StartGame) — le mois 1 sera « ordinaire », cohérent avec la semaine 1.
- `town/economy.ts:198-199/244` : les DEUX sites de croissance multiplient
  `weekGrowthFactor × tierFactor` — y cumuler mois + unité.
- Schéma : `gameConfigSchema.calendar` (`schemas.ts:798`).
- Client : toast `CalendarEventStarted` gaté `growthFactor !== 1`
  (`notifications.ts:141`) ; badge de semaine dans la barre (`shell.tsx:1102`),
  même gate — à étendre au ciblage d'unité (nom interpolé).
- Tests : `engine/test/calendar.test.ts` (12 cas, harnais `startedGame` +
  `advanceToWeek2`) — à étendre.

## 3. Étapes

- [ ] a. **Types** (`adventure/config.ts`) : `CalendarEventDef.growthUnit?:
      { factor }` ; `CalendarMonthEventDef { id, weight, growthFactor }` ;
      `calendar?: { events, monthEvents? }`.
- [ ] b. **État** (`core/state.ts`) : `Calendar.monthEventId?: string | null`
      et `Calendar.weekEventUnitId?: string | null` (optionnels, doc du
      choix « pas de bump » au changelog).
- [ ] c. **Moteur** (`adventure/calendar.ts`) : `rollMonthEvent` (pondéré,
      no-op sans `monthEvents`) ; `monthGrowthFactor(state)` ;
      `weekGrowthUnitFactor(state, unitId)` ; `rollWeekEvent` tire l'unité
      ciblée quand l'événement a `growthUnit` (clés triées du catalogue,
      `growthPerWeek` > 0), sinon **efface** le champ (delete — forme minimale).
- [ ] d. **Moteur** (`core/engine.ts`) : à la bascule de semaine, si le MOIS
      change aussi : `rollMonthEvent` + événement `CalendarMonthStarted
      { eventId, month }` (nouveau, `core/events.ts`), AVANT le tirage de
      semaine.
- [ ] e. **Croissance** (`town/economy.ts`, 2 sites) : × `monthGrowthFactor`
      × `weekGrowthUnitFactor(unitId)`.
- [ ] f. **Schéma** (`content/schemas.ts`) : `growthUnit` + `monthEvents`.
- [ ] g. **Données** (`data/core/config.json`) : événement de semaine
      `unit-week` (`growthUnit.factor 2`) + `monthEvents` (ordinaire 12 /
      abondance 1,5 ×2 / peste 0,5 ×2).
- [ ] h. **Client** : toast + badge de la « semaine de X » (nom d'unité
      interpolé via `weekEventUnitId`) ; toast `CalendarMonthStarted` (gaté
      facteur ≠ 1, comme la semaine). Clés FR/EN (`calendar.event.unit-week.*`,
      `calendar.month.<id>.*`, `toast.calendarMonth`).
- [ ] i. **Doc** : `docs/02-mechanics.md` §2.3 — mois + semaine d'unité, les
      différés A4 sont comblés.
- [ ] j. **Tests** (`calendar.test.ts` étendu — unitaires, pas de smoke) :
      tirage de mois à la bascule (jour 28→29) + persistance du facteur tout
      le mois + re-tirage au mois suivant ; peste ÷2 appliquée à la croissance ;
      semaine d'unité : unité tirée du catalogue + croissance ×2 pour ELLE
      seule ; sans config : `calendar` sans champs nouveaux (forme identique).
- [ ] k. **Vérifs standard** : typecheck, lint, moteur (golden inchangé),
      contenu, `content:check`, garde-fou faction, budget, smoke `@core`.

## 4. Hors périmètre

- « Mois des créatures » façon HoMM3 avec APPARITION de piles sur la carte
  (spawn) — mécanique distincte, non demandée par l'audit.
- Badge d'UI dédié au mois (le toast + journal suffisent — même niveau de
  feedback que la ruée/savoir) ; à réévaluer au playtest.
- Ciblage d'unité par ÉVÉNEMENT DE MOIS (semaine seulement, comme l'audit).

## 5. Risques

| Risque | Mitigation |
|---|---|
| Forme d'état qui dérive (golden/saves) | champs optionnels écrits paresseusement, jamais posés sans config ; test « forme identique » dédié |
| Séquence RNG des parties existantes déplacée | le tirage de mois ne consomme le RNG QUE si `monthEvents` est configuré ; le tirage d'unité QUE si l'événement tiré a `growthUnit` (les configs existantes n'en ont pas ⇒ séquence inchangée jusqu'à l'ajout des données — qui accompagne ce lot, comme tout ajout d'événement pondéré) |
| Catalogue sans unité recrutable (arène/fixtures) | `growthUnit` sans candidat ⇒ pas de ciblage (champ effacé), facteur 1 |
| Badge/toast avec clé manquante | clés FR/EN livrées dans le même commit (audit parité) |

## 6. Suivi

- [x] Plan rédigé (2026-07-17)
- [x] a→i implémentés — types + état optionnel paresseux (note « sans bump »
      au changelog v32), `weightedPick` factorisé semaine/mois,
      `rollMonthEvent`/`monthGrowthFactor`/`weekGrowthUnitFactor`, tirage
      d'unité dans `rollWeekEvent` (delete si non ciblé — forme minimale),
      bascule de mois dans `engine.ts` + `CalendarMonthStarted`, 2 sites de
      croissance cumulent mois × unité, schéma Zod, données (`unit-week` +
      3 événements de mois), toasts + badge (nom d'unité interpolé), clés
      FR/EN, doc 02 §2.3.
- [x] j tests verts — `calendar.test.ts` +3 cas (15/15) : mois tiré/persistant/
      re-tiré (56 jours, croissance 9→4 sous peste mensuelle), forme d'état
      inchangée sans config (`'monthEventId' in calendar === false`), semaine
      d'unité (tirage catalogue + ×2 strictement ciblé).
- [x] k vérifs — typecheck ✅ lint ✅ moteur 855/855 (golden inchangé — la
      fixture replay n'a pas de calendrier) ✅ contenu 148/148 ✅
      `content:check` ✅ garde-fou faction ✅ budget 328 Ko/800 Ko ✅ smoke
      `@core` 19/19 **+ 6 smokes sensibles au calendrier** (caravane,
      quotidiennes, rafraîchissement, événements temporaires, autosave, fin de
      tour) ✅ — le décalage de séquence RNG des semaines (nouvel événement
      pondéré) ne casse aucune assertion.
