# Lot A2f — capacité `poisonSting` (poison / dégâts sur la durée)

Backlog `game-feature-gaps.md` (CAP-ATK) : la **Manticore** (doc 05 §4) applique
un poison qui ronge la cible sur plusieurs rounds. Dernière capacité CAP-ATK
tractable (hors `firstStrike`, dont la sémantique reste à cadrer). Point
d'extension moteur **générique**, data-driven, zéro nom de faction.

## Interprétation retenue

`poisonSting(damagePerRound, rounds)` : sur une **frappe de mêlée qui touche**
(non esquivée, cible survivante — volontaire ou riposte, comme `curseOnHit`),
applique/rafraîchit un **statut de poison** sur la cible. Au **début de chaque
round**, chaque pile portant un statut de poison subit `damagePerRound` dégâts
(plats, cumulés si plusieurs poisons), avant décroissance des statuts. Le poison
peut tuer (fin de combat gérée). Le tir n'applique pas de poison (dard de mêlée).

## Impact save : **bump → v19** (après rebase)

`SpellStatus` gagne `damagePerRound: number` (0 = neutre). Forme sérialisée de
`CombatStack.statuses` modifiée ⇒ bump `CURRENT_SAVE_VERSION` + golden re-fixé
**une fois** (piles golden sans statut ⇒ seul `saveVersion` change) +
`save-shape.test.ts`. **Collision de version** : `main` a avancé pendant le lot
(M-DWELLOWN #207 avait pris v18 = `DwellingObjectDef.ownerId`). Rebase ⇒ A2f
devient **v19**, golden re-fixé `6fa5044c` → **`ce30195f`** (v18→v19), doc 07 §4
alignée (v16/v17/v18/v19, elle était restée à v15 sur `main`).

## Étapes

1. **Type** — `SpellStatus.damagePerRound` (`hero/types.ts`) ; propager
   `damagePerRound: 0` aux 2 sites moteur (curseOnHit `damage.ts`, sorts
   `hero/index.ts`) + littéraux de test.
2. **Moteur** — `poisonStingPlan(def)` (`damage.ts`) ; bloc d'application après
   `curseOnHit` dans `performStrike` (mêlée, non esquivée, cible vivante) ;
   tick de poison au début de round dans `advanceTurn` (`turns.ts`) + event
   `StackPoisoned` (`events.ts`), fin de combat gérée (`checkCombatEnd`).
3. **Données** — `"poisonSting"` dans `abilities.json` (→ 25) ; params sur la
   Manticore… (unité Arcane Hunters/Necropolis selon doc — à confirmer : doc 05
   §4 « Manticore » n'est pas AH ; vérifier la faction porteuse).
4. **Save** — bump `CURRENT_SAVE_VERSION` 17→18 ; save-shape → 18 ; golden re-fix
   (doc 07 §4).
5. **Docs** — doc 02 §5.4 (→ 25 capacités + ligne) ; doc de faction porteuse.
6. **Test** — `combat-poison.test.ts` : poison appliqué à la frappe, tick de
   dégâts au round suivant, expiration après `rounds`, poison mortel.
7. **Vérif complète** — `pnpm test`, typecheck, lint, `content:check`, garde-fou,
   build, smoke.

## Journal

- branche `claude/a2f-poison-sting` créée sur `claude/a2e-taunt` (stack, #208
  non encore mergée).
- Porteur confirmé : **Manticore de Dressage** (T7 AH, doc 05 §214) — l'élite
  (Manticore Royale) ne l'a pas (perte de signature, ligne 238). Params retenus
  (non spécifiés au doc) : `damagePerRound: 6, rounds: 3`, documentés doc 05 §4.
- Type : `SpellStatus.damagePerRound` ajouté ; `damagePerRound: 0` propagé aux 2
  sites moteur + 6 littéraux de test. ✅ typecheck.
- Moteur : `poisonStingPlan` + bloc d'application (mêlée, non esquivée) dans
  `performStrike` ; tick `applyPoisonTicks` au début de round dans `advanceTurn`
  (avant décroissance des statuts) + event `StackPoisoned` ; fin de combat gérée
  via `checkCombatEnd` si un poison vide un camp.
- Save : bump **→ v19** (rebase : main était passé à v18 M-DWELLOWN) ;
  `save-shape` → 19 ; golden re-fixé (`ce30195f`, seul `saveVersion` change) ;
  doc 07 §4 remise à niveau (ajout v16/v17/v18/v19, était restée à 15).
- Données : `poisonSting` dans `abilities.json` (→ 25) ; params sur la Manticore.
- Docs : doc 02 §5.4 (→ 25 + ligne) ; doc 05 (Manticore poison livré).
- Test : `combat-poison.test.ts` (application, 3 ticks + expiration, poison
  mortel clôturant le combat). ✅
- Vérif : `pnpm test` = 464 (engine, +3) + 101 (content) ; typecheck 5/5 ; lint ;
  `content:check` ; garde-fou faction vert ; build 275 Ko gzip < 800. Smoke en
  cours.
