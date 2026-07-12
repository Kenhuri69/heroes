# Lot C-SIEGE2.7a — défense tour-seule (garnison vide)

> Complète la tour de tir (C-SIEGE2.5). Aujourd'hui une ville à garnison **vide**
> est prise **sans combat** — même un Château (Fort ≥ 3) doté d'une tour. Désormais
> une ville qui **fait apparaître une tour** se défend seule : l'assaillant doit
> la détruire. Backlog §2.1 (C-SIEGE2.7a), doc 02 §5. Zéro faction, pas de bump save.

## Spec

- `handleCaptureTown` ouvre un **siège** si `garnison > 0` **OU** si une tour de
  siège apparaîtrait (`wouldSpawnSiegeTower(fortLevel, catalog)` = Fort ≥ 3 ET
  unité `arrow-tower` au catalogue). Sinon capture immédiate (inchangé).
- `validateCaptureTown` : une armée **vide** est refusée dès qu'il y a une défense
  (garnison **ou** tour) — un héros sans troupe ne prend pas un Château tour-défendu.
- La tour seule = pile défenseur atteignable (derrière la porte) ⇒ destructible,
  **pas de stalemate** ; à sa chute le camp défenseur est vide ⇒ capture (flux
  `applyConsequences` inchangé).

## Changements

- `combat/setup.ts` : exporte `wouldSpawnSiegeTower(fortLevel, catalog)` (réutilisé
  par `buildTowerStack`).
- `town/capture.ts` : condition de siège et garde d'armée vide élargies à la tour.
- Doc 02 §5 + backlog.

## Vérification

- tests moteur `town-siege` : Fort 3 + garnison vide + armée ⇒ siège (défenseur =
  tour) puis capture ; Fort 3 + garnison vide + armée vide ⇒ `invalidArmy` ; Fort 2
  garnison vide ⇒ capture immédiate (inchangé). typecheck 5/5 · lint · golden +
  save-shape **inchangés** · content · garde-fous · build + bundle · smoke.

## Journal

- 2026-07-12 — Plan créé, branche `claude/c-siege2-tower-only` depuis origin/main.
- 2026-07-12 — Implémenté : `wouldSpawnSiegeTower` exporté (réutilisé par
  `buildTowerStack`) ; `capture.ts` élargit condition de siège + garde armée vide.
- 2026-07-12 — Vérif verte : typecheck 5/5 · lint · engine 683/683 (golden +
  save-shape **inchangés**, aucun bump) · content 125/125 · content:check ·
  garde-fous faction/couleur · build · bundle gzip 300 Ko < 800 Ko.
