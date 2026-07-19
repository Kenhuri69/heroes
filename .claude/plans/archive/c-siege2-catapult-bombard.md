# Lot C-SIEGE2.6 — bombardement tour-par-tour de la catapulte

> Enrichit la catapulte (C-SIEGE2.2) : au-delà de la brèche initiale au montage,
> elle **érode le rempart round après round**. Backlog §2.1 (C-SIEGE2.6), doc 02 §5.
> Additif (ne touche pas au comportement .2), zéro faction, pas de bump save.

## Spec

- Les segments de mur gagnent des **PV** quand un assaillant porte une catapulte
  (`siegeBreaker`) : nouveau champ **optionnel** `CombatState.siegeWallHp`
  (`"col,row" → PV`), initialisé au montage pour les segments restants (après la
  brèche .2). Absent sans catapulte ⇒ murs indestructibles (comportement .1/.2
  inchangé) ⇒ pas de bump save (`CombatState` hors garde save-shape), golden
  inchangé (aucun siège dans le golden).
- **Au début de chaque round** (`advanceTurn`, après incrément du round) : si un
  assaillant `siegeBreaker` est **encore vivant** et qu'il reste un segment à PV,
  la catapulte **bombarde** le segment intact le plus proche du centre de la porte
  (élargissement contigu, déterministe) : dégâts = tirage RNG seedé des dégâts de
  la catapulte. PV ≤ 0 ⇒ le segment est **retiré** de `siegeWalls` (l'hex s'ouvre)
  et de `siegeWallHp` ; événement `WallBombarded { col, row, destroyed }`.
- Un seul tir/round. Catapulte détruite ⇒ plus de bombardement. La catapulte
  **agit toujours** comme pile (le bombardement est un effet de round, pas son tour).

## Changements

- `combat/types.ts` : `CombatState.siegeWallHp?: Record<string, number>`.
- `core/events.ts` : `WallBombarded { col, row, destroyed }`.
- `combat/setup.ts` : `SIEGE_WALL_HP`, init `siegeWallHp` si `breached`.
- `combat/turns.ts` : bombardement au début de round (helper `bombardWalls`).
- `client/CombatScene.ts` : `WallBombarded` ⇒ redraw du plateau (le mur détruit
  s'ouvre visuellement).
- Doc 02 §5 (état v2 .6) + backlog.

## Vérification

- tests moteur `town-siege` : avec catapulte, un segment est détruit sur quelques
  rounds (`siegeWalls` rétrécit, event émis) ; sans catapulte, `siegeWallHp`
  absent + murs intacts ; auto-combat avec catapulte se termine. typecheck 5/5 ·
  lint · golden + save-shape **inchangés** · content · garde-fous · build +
  bundle · smoke.

## Journal

- 2026-07-12 — Plan créé, branche `claude/c-siege2-catapult-bombard` depuis origin/main.
- 2026-07-12 — Implémenté : `siegeWallHp` optionnel (types/setup), event
  `WallBombarded`, `bombardWalls` en début de round (`advanceTurn`, dégâts RNG
  seedés, ciblage proche-porte, retrait du segment à 0 PV), redraw client.
- 2026-07-12 — Additif : ne touche pas la brèche de montage .2 (test .2 vert) ;
  `siegeWallHp` absent sans catapulte ⇒ murs indestructibles inchangés.
- 2026-07-12 — Vérif verte : typecheck 5/5 · lint · engine 680/680 (golden +
  save-shape **inchangés**, aucun bump) · content 125/125 · content:check ·
  garde-fous faction/couleur · build · bundle gzip 300 Ko < 800 Ko.
