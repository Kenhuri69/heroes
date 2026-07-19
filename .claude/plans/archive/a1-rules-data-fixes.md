# Lot A1 — Correctifs de règles & données + DOC-*

Backlog : `.claude/plans/game-feature-gaps.md` §4 piste A, ligne A1.
Périmètre : **C-LOS**, **C-BADLUCK**, **CAP-DATAFIX**, **DOC-07 / DOC-SKILLS /
DOC-AUDIO / DOC-STATS**. Bugs de règles + hygiène données/docs, avant les
points d'extension moteur (A2+). Branche `claude/a1-rules-data-fixes`.

Décisions design pré-tranchées applicables (mission 2026-07-10) :
- **C-LOS** : ligne de vue bloquée par les **obstacles uniquement** (pas les
  piles) ; **tir interdit si bloqué** (pas de malus). Doc 02 §5 mise à jour.
- **DOC-STATS / CAP-DATAFIX** : pour les **stats**, les données équilibrées
  `faction:sim` font foi ⇒ amender les tables des docs ; pour les **capacités
  manquantes**, les docs font foi ⇒ les ajouter aux données.

## Étapes & vérifications

### C-LOS — ligne de vue des tireurs
1. `combat/hex.ts` : ajouter `hexLine(a,b)` (linedraw cubique, nudge epsilon
   déterministe). → verif : test unitaire `hexLine`.
2. `combat/actions.ts` : `hasLineOfSight(combat, from, to)` (obstacle strict
   entre from et to bloque ; piles ignorées) + `canShootTarget(state, stackId,
   targetId)` = `canShoot && LoS`. Brancher dans `attackableTargets`,
   `validateCombatAction` (attaque), `applyAttack` (décision ranged par cible).
   → verif : tests moteur (tir bloqué ⇒ mêlée forcée / hors portée).
3. `combat/damage.ts` : `estimateDamage` décide ranged via `canShootTarget`.
4. `combat/ai.ts` : génération de candidats LoS-aware (tireur bloqué ⇒ candidats
   mêlée), pas de `from:null` sur cible bloquée. → verif : property IA reste verte.
5. Client `scenes/combat/CombatScene.ts` : `handleAttackTap` utilise
   `canShootTarget`. → verif : smoke combat.
6. Doc 02 §5.2/§5.4 : documenter la LoS (obstacles bloquent, tir interdit).

### C-BADLUCK — malchance & bornes de chance
1. `combat/damage.ts` : `heroLuckOf` borné **[-3,3]** ; jet unique interprété
   good/bad ⇒ ×2 / ×0,5 ; event `StackAttacked.unlucky`.
2. `core/events.ts` : champ `unlucky: boolean`.
3. Client `CombatScene.ts` : `spawnDamageNumber` affiche un marqueur malchance.
4. Doc 02 §5.3 : bornes [-3,+3], jet de malchance ⇒ demi-dégâts.
   → verif : test dégâts (luck négative ⇒ ×0,5) ; golden re-fixé si le combat
   gardien change (LoS).

### CAP-DATAFIX (capacités : docs font foi)
- `data/factions/arcane-hunters/units/t6-chasseresse.json` : `shooter` +
  `noMeleePenalty` (doc 05 §4 `shooter(8, noMeleePenalty)`).
- `data/factions/vox-arcana/units/t4-idole.json` : `shooter` + `noMeleePenalty`
  (doc 16 §4 `shooter(10, noMeleePenalty)`).
  → verif : `content:check`.

### DOC-STATS (stats : données font foi ⇒ amender docs)
- doc 04 §3 : Cavalier funeste Vit. 9 → **10** (données).
- doc 16 §4 : rangée Vox alignées sur les données (T1 coût, T2 coût+munitions,
  T3 PV/Déf/coût, T4 PV/Att/coût/munitions, T5 PV/Att/Dégâts/coût, T7 PV/coût) ;
  Idole `shooter(7, noMeleePenalty)` ; Avatar : réconcilier `flying`+
  `noRetaliation` (présents en données, balance figée) → **noter au doc**
  (choix conservateur : ne pas nerfer un T8 livré/équilibré ; contradiction
  doc↔données tranchée côté données par prudence, signalée ici).

### DOC hygiène
- DOC-07 : doc 07 §5 « superseded by doc 15 » + §4 copie de sécurité réalignée.
- DOC-SKILLS : doc 02 §1.3 note R5 : pool 12→**13** (Sagesse livrée).
- DOC-AUDIO : doc 12 §6bis/§6ter : `render/audio.ts` → `app/audio.ts`.

### Vérifs transverses (guidelines §4/§7)
- [x] typecheck 5/5 · [x] lint · [x] tests moteur (420, +19 : `combat-los`, `combat-luck`)
- [x] `content:check` · [x] garde-fou « zéro faction dans le moteur »
- [x] golden **inchangé** ⇒ aucun re-fix (LoS n'altère pas le combat gardien golden)
- [x] budget bundle < 800 Ko gzip (~272 Ko JS gzip) · [x] smoke Playwright (134 passed)
- [x] Pas de bump `CURRENT_SAVE_VERSION` (aucun champ d'état sérialisé ajouté).

## Journal
- Création branche + plan.
- Implémenté C-LOS : `hexLine` (hex.ts) + `hasLineOfSight`/`canShootTarget`
  (actions.ts), branchés dans `attackableTargets`, `validateCombatAction`,
  `applyAttack`, `estimateDamage` (damage.ts), `chooseAction` (ai.ts) et le
  client (`CombatScene.handleAttackTap`). Décision : obstacles seuls bloquants,
  tir interdit si bloqué ⇒ mêlée forcée.
- Implémenté C-BADLUCK : `heroLuckOf` borné [-3,3] ; jet unique interprété
  chance/malchance (×2 / ×0,5) ; event `StackAttacked.unlucky` (events.ts) +
  marqueur `⚑` client. Tests `combat-luck` (config `luckChancePerPoint=1` pour
  un déclenchement déterministe).
- CAP-DATAFIX : `noMeleePenalty` ajouté à Chasseresse (AH) et Idole (Vox).
- DOC-STATS : doc 04 Cavalier funeste Vit.→10 ; table Vox doc 16 §4 réalignée sur
  données `faction:sim` (+ note d'arbitrage Avatar flying/noRetaliation).
- DOC-07 : §5 marqué superseded par doc 15 ; §4 backup/version 14 réalignés.
  DOC-SKILLS : note R5 corrigée (pool 13, Sagesse). DOC-AUDIO : `app/audio.ts`.
- Golden test resté vert sans re-fix (surprise agréable : la graine du combat
  gardien golden n'a pas d'obstacle sur la ligne de tir de l'archer).
- Toutes vérifs vertes. Reste : commit + push + PR draft.
