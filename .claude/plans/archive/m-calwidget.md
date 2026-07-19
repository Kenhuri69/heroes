# Lot M-CALWIDGET — Calendrier persistant à l'écran

> Différé de **M-CALENDAR** (doc 02 §2.3, ligne « calendrier persistant à
> l'écran ») : le moteur connaît le **mois** (`monthOf`) et l'**événement de
> semaine** actif (`calendar.weekEventId`), mais l'UI n'affiche que
> « Jour N · Semaine W » et ne signale les semaines spéciales que par un
> **toast transitoire**. Ce lot rend le calendrier **persistant** dans la barre
> de statut : mois + semaine + jour, plus un **badge de semaine spéciale**
> quand une croissance ≠ normale est en cours.

## Périmètre — client pur

- **Zéro diff moteur** : réutilise `monthOf`/`weekOf` (déjà exportés) et l'état
  `game.calendar.{day,weekEventId}` + `game.config.calendar.events` (déjà
  sérialisés). **Pas de bump `CURRENT_SAVE_VERSION`, golden inchangé.**
- **Zéro nom de faction** : ids d'événements opaques, lus du catalogue de config.
- **Zone isolée** : `packages/client/src/ui/shell.tsx` (TurnBar), `styles.css`,
  locales core. N'entre pas en collision avec les zones chaudes (héros/taverne,
  combat, F-*, spells).

## Changements

1. `shell.tsx` — `TurnBar` :
   - importer `monthOf` ; lire `game.calendar.weekEventId` + `game.config`.
   - chip `data-testid="calendar"` : `turnBar.calendar` interpolé
     `{ month, week, day }` ⇒ « Mois M · Semaine W · Jour J ».
   - badge `data-testid="week-event"` inline **seulement si** l'événement actif
     a `growthFactor !== 1` (même gating que le toast `notifications.ts`) :
     icône + `calendar.event.<id>.name` (jamais la couleur seule).
2. `data/core/locales/{fr,en}.json` : `turnBar.calendar` mis à jour (ajout du
   mois) ; nouvelle clé `turnBar.weekEvent.aria` (libellé accessible du badge).
3. `styles.css` : classe `.week-event-badge` (tokens `--brass-*`, aucun hex).
4. `docs/02-mechanics.md` §2.3 : « calendrier persistant à l'écran » retiré des
   différés (livré) ; note l'affichage mois + badge de semaine spéciale.

## Vérification

1. `pnpm -r typecheck` ; `pnpm lint` → verts.
2. `pnpm --filter @heroes/engine test` ; `pnpm --filter @heroes/content test`
   → inchangés (aucune modif moteur/contenu).
3. `pnpm --filter @heroes/client build` → bundle < 800 Ko gzip.
4. Garde-fous : « zéro faction » (grep ids `data/factions/index.json`) ;
   « couleurs hors tokens.css ».
5. Smoke Playwright : nouveau cas asserte que le chip calendrier affiche le
   **mois** (déterministe, jour 1 ⇒ « Mois 1 »).
   - **Non couvert par le smoke (dit explicitement)** : le **badge de semaine
     spéciale** ne peut pas être forcé de façon déterministe dans une partie
     fraîche (il exige un passage de semaine + un tirage RNG ≠ normal) ; son
     rendu reflète le gating `growthFactor !== 1` déjà couvert par le toast.

## Journal

- **2026-07-12** — **Livré**. `TurnBar` (shell.tsx) : chip calendrier « Mois M ·
  Semaine W · Jour J » + badge `week-event` persistant (gaté `growthFactor !== 1`).
  `monthOf` re-exporté de `@heroes/engine`. Locales FR/EN (`turnBar.calendar`
  mis à jour + `turnBar.weekEvent.aria`). CSS `.week-event-badge` (tokens laiton).
  Doc 02 §2.3 : différé « calendrier persistant à l'écran » → livré. Smoke étendu
  (chip mois FR+EN au jour 1, absence de badge en début de partie).
  **Vérifs** : typecheck 5/5, lint verts ; engine 595 / content 116 (golden +
  save-shape **inchangés**, aucune modif moteur) ; build gzip ≈ 303 Ko < 800 ;
  garde-fous « zéro faction » + « couleurs hors tokens.css » verts ; smoke
  **168 passed / 2 skipped** (desktop + mobile). Zéro diff moteur/save/golden.
