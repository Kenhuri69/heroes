# B3 — Renforts en combat (doc 18 Étape 5, signature MMHO)

Arbitrage utilisateur (2026-07) : **implémenter** (option a — fidélité MMHO,
opt-in PvE). Mécanique clivante (P3) : elle assouplit « armée engagée = armée
risquée » ⇒ strictement **opt-in par config** et **PvE only**.

## Décisions de design

- **Commande top-level `CallReinforcements { unitId, count }`** (patron `HeroAttack`,
  hors `CombatActionInput` qui est par pile). Routée dans `engine.ts` (validate +
  handler). Nouveau module `combat/reinforce.ts` (comme `leave.ts`/`hero-attack.ts`).
- **Opt-in** : `config.combat.reinforcements?: { maxCallsPerCombat, maxUnitsPerCall,
  costMultiplier }`. Absent ⇒ commande refusée (`reinforcementsUnavailable`),
  **golden/fixtures épargnés** (patron `heroAttack?`/`suddenDeath?`).
- **PvE only** : gate `combat.defenderHeroId === null` (exclut hero-vs-hero) ET
  `combat.heroId` non-null (exclut l'arène). Siège/gardien = PvE ⇒ autorisés.
- **Source** : `unitId` doit être une unité **déjà dans l'armée du héros**
  (`playerHero.army`) — on renforce ses propres rangs. Coût = `scaleCost(recruitCost,
  count × costMultiplier)`, débité au joueur (`canAffordCost`/`spendCost`,
  faction-aware). `recruitCost` absent ⇒ unité non renforçable.
- **Insertion** : patron `summon` (slot unique, 1er hex libre ligne arrière du
  `playerSide`), mais **`acted: true`** ⇒ le renfort se déploie et n'agit qu'au
  **round suivant** (anti-abus « renfort + charge immédiate »).
- **Cap** : `combat.reinforcementsUsed?: number` (lazy optional sur `CombatState`,
  **pas de bump** — précédent `heroRallyUsed?`). Incrémenté à chaque appel ; refus
  au-delà de `maxCallsPerCombat`. `count` borné à `maxUnitsPerCall`.
- **Événement** `ReinforcementsCalled { side, stackId, unitId, count }` (non haché).

## Étapes (§0 critères)

1. [ ] Config `reinforcements?` (config.ts) + schéma Zod (schemas.ts).
2. [ ] Commande `CallReinforcements` (commands.ts) + code d'erreur + événement (events.ts).
3. [ ] `combat/reinforce.ts` : validate (opt-in, PvE, armée, cap, count, coût) +
       handler (insertion stack `acted:true`, débit, incrément, event). Champ lazy
       `reinforcementsUsed?` sur CombatState (types.ts).
4. [ ] Enregistrement engine.ts (import, GAME_OVER_BLOCKED, validate, handler).
5. [ ] Tests `combat-reinforcements.test.ts` : succès (pile ajoutée, or débité,
       event, acted:true) ; refus config absente / hero-vs-hero / cap atteint /
       count > max / or insuffisant / unité hors armée.
6. [ ] Client : bouton « Renforts » en combat (UI d'appel) — gaté opt-in + PvE.
7. [ ] Docs 02 §5 (mécanique renforts) + doc 18 B3 (cochée, décision « retenue »).
8. [ ] Vérif complète (golden inchangé, pas de bump, garde-fous, smoke).

## Statut — MOTEUR (B3.1) LIVRÉ

- [x] 1 Config `reinforcements?` + schéma Zod.
- [x] 2 Commande `CallReinforcements` + code `reinforcementsUnavailable` + événement `ReinforcementsCalled`.
- [x] 3 `combat/reinforce.ts` (validate PvE/opt-in/armée/cap/count/coût/plateau + handler
      insertion `acted:true`, débit `scaleCost`, incrément lazy). Champ `reinforcementsUsed?` (types.ts).
- [x] 4 Enregistrement engine.ts + combat/index.ts.
- [x] 5 7 tests `combat-reinforcements.test.ts` (succès + 6 refus). Engine 897, golden intact.
- [x] 6 **Client (B3.2) LIVRÉ** : helper moteur pur `canCallReinforcements` (gate hors
      unité/effectif) exporté ; bouton « Renforts » (secondary actions, visible si
      `config.combat.reinforcements`) + `ReinforcementsModal` (sélection unité de
      l'armée + effectif borné `maxUnitsPerCall`, coût prévisualisé `scaleCost`) ⇒
      `dispatch(CallReinforcements)` ; raison de désactivation `combat.reason.reinforcements`.
      Config **activée globalement** en PvE (`config.json` : 2 appels, ×2 coût).
      Locales `combat.reinforcements*` FR/EN. CSS `.reinforcements-confirm`.
      Vérif : typecheck ✓, lint ✓, 897 engine (golden intact) ✓, content:check ✓,
      i18n ✓, garde-fou vert, build ✓, budget 336 Ko ✓, smoke @core 26/26 ✓.
      **Non smoke-couvert** : le clic d'appel exige un combat PvE avec armée costée +
      or (état non déterministe dans le smoke) ⇒ logique couverte par unitaires + gate mirroré.
- [x] 7 Docs 02 §5 + doc 18 B3 (retenue, moteur livré).
- [x] 8 Vérif : typecheck, tests, (lint/content/build/smoke en cours).

Golden épargné (config absente des fixtures ⇒ commande no-op sur le replay), pas de bump save.
La feature reste **dormante** tant qu'un scénario/mode n'active pas `config.combat.reinforcements`
(pas de UI encore). Enablement data + UI = lot B3.2.
