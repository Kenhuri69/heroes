# Lot C-SIEGE2.5 — tour de tir (arrow tower)

> Dernière pièce iconique de siège v2. Une ville **très fortifiée** (Fort ≥ 3,
> Château) défend avec une **tour de tir** : une pile tireuse **immobile** côté
> défenseur, plantée derrière la porte. Backlog §2.1 (C-SIEGE2.5), doc 02 §5.

## Spec

- La tour = unité générique `arrow-tower` (données `war-machines.json`, marqueurs
  `warMachine` + `shooter` + **`immobile`**). La capacité générique `immobile`
  fait renvoyer `reachableHexes` vide ⇒ la tour ne bouge jamais, elle tire ou
  attend (le schéma d'unité impose vitesse ≥ 1, d'où le marqueur plutôt que
  vitesse 0). Jamais vendue (absente de tout `warMachineVendor`) : elle n'apparaît
  **que** posée par le siège.
- `beginTownCombat` : si `fortLevel ≥ 3`, ajoute UNE pile tour au camp défenseur
  à `(SIEGE_WALL_COL + 1, porte)` — **derrière la porte**, donc **atteignable**
  par l'assaillant qui franchit la porte ⇒ **pas de stalemate** ; hors zone
  d'obstacles (col > COMBAT_COLS-4) et hors colonne de douve ⇒ aucune collision ;
  aucune modification du rempart.
- La tour compte comme pile défenseur (le combat ne se termine que si elle tombe
  aussi) ; `warMachine` ⇒ exclue du moral/pertes comme les autres machines.
- **Nécromancie** : `raiseUndeadOnVictory` exclut `warMachine` (une tour de
  pierre ne se relève pas en squelettes) — correctif générique.
- Garnison **vide** ⇒ capture immédiate inchangée (pas de combat, donc pas de
  tour) : hors périmètre (défense tour-seule = ultérieur).

## Changements

- `data/core/war-machines.json` : unité `arrow-tower` (shooter ammo, vitesse 0,
  `warMachine`, coût nominal — jamais dépensé).
- `data/core/locales/{fr,en}.json` : `warMachine.arrow-tower.name`.
- `combat/setup.ts` : `SIEGE_TOWER_MIN_FORT = 3`, `SIEGE_TOWER_UNIT`,
  construction + ajout de la pile tour (helper `buildTowerStack`).
- `faction/effects.ts` : exclut `warMachine` du décompte de relève.
- Doc 02 §5 (état v2 .5) + backlog.

## Vérification

- tests moteur `town-siege` : Fort 3 ⇒ pile tour défenseur (tireur, immobile,
  atteignable) ; Fort 2 ⇒ aucune tour ; auto-combat Fort 3 se termine (pas de
  stalemate). typecheck 5/5 · lint · golden + save-shape **inchangés** (tour =
  pile dans `stacks`, aucun champ neuf ⇒ pas de bump) · content + content:check
  · garde-fous faction/couleur · build + bundle · smoke non régressé.

## Journal

- 2026-07-12 — Plan créé, branche `claude/c-siege2-arrow-tower` depuis origin/main.
- 2026-07-12 — Implémenté data (unité `arrow-tower`) + locales + setup (pile tour)
  + exclusion `warMachine` de la Nécromancie + tests.
- 2026-07-12 — **content:check a rejeté vitesse 0** (schéma d'unité : vitesse > 0).
  Bascule sur vitesse 1 + **capacité générique `immobile`** (`reachableHexes`
  renvoie vide) — point d'extension propre, faction-agnostique. Le marqueur
  d'une machine de guerre échappe à la validation croisée des capacités (comme
  `warMachine`/`siegeBreaker`).
- 2026-07-12 — Vérif verte : typecheck 5/5 · lint · engine 678/678 (golden +
  save-shape **inchangés**, aucun bump) · content 125/125 · content:check ·
  garde-fous faction/couleur · build · bundle gzip 299 Ko < 800 Ko.
