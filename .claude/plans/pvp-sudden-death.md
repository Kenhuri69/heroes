# Plan — Lot 4.1 (doc 18) : mort subite PvP (B4)

> **Statut** : ✅ livré (2026-07-17).
> Écart couvert : **B4** (doc 18 §2.B) — « MMHO Sudden Death : au-delà d'un
> délai, l'équipe avec le plus d'unités gagne. Manque : règle déclarative
> `combat.suddenDeath { round, resolution }` (résolution : camp au plus fort
> `armyStrength` restant). Moteur générique (config opt-in, activée par le
> mode en ligne) ». Premier lot de l'Étape 4.

## 0. Objectif & critère de sortie

Un combat dont la config porte `combat.suddenDeath: { round: N, resolution:
'strongestArmy' }` est **résolu de force à l'atteinte du round N** : le camp
au plus fort `armyStrength` restant est déclaré vainqueur (égalité ⇒
défenseur, convention B17) et les conséquences NORMALES de fin de combat
s'appliquent (armée reconstruite, gardien/ville/héros, XP, effets de
faction). Config absente ⇒ aucune borne (comportement historique,
golden/replay intacts). En **mode en ligne**, la règle est activée par les
données (`combat.suddenDeathOnline` de `config.json`, copiée dans le
`StartGame` du match par le client).

**Critères mesurables** (unitaires moteur) :
- `suddenDeath.round = 2` : à la bascule vers le round 2, combat terminé,
  vainqueur = camp le plus fort restant, événements `CombatSuddenDeath` +
  `CombatEnded`, conséquences appliquées (gardien retiré si l'attaquant
  gagne ; héros retiré si le défenseur gagne) ;
- la résolution lit la force **restante** (un camp initialement plus fort
  mais saigné peut perdre) ;
- égalité stricte ⇒ défenseur vainqueur ;
- config absente ⇒ le round passe la borne sans rien déclencher.

## 1. Périmètre & décisions

- **Résolution = défaite normale du camp le plus faible** : on réutilise la
  fin de combat standard (extraction de `finishCombat(draft, events,
  winner)` depuis `checkCombatEnd`) — pas de demi-régime « remnants » : la
  mort subite TRANCHE (fidélité MMHO « the team with most units wins »).
- **Déclenchement à la bascule de round** (`advanceTurn`, juste après
  `combat.round += 1`) : rounds 1..N-1 joués normalement, le round N ne
  démarre pas. Auto-combat (`AutoCombat`/`AiTurn`, y compris la
  re-simulation serveur PvP) passe par `advanceTurn` ⇒ couvert gratuitement.
- **`resolution: 'strongestArmy'`** : union à un seul membre (extensible),
  validée par le schéma ; la force d'un camp = `armyStrength` des piles
  vivantes (machines de guerre incluses — elles comptent dans la force).
- **Événement `CombatSuddenDeath { round, winner }`** (événements non
  hachés ⇒ golden insensible) — observabilité tests/UI future.
- **Activation en ligne SANS notion de « en ligne » dans le moteur** : le
  moteur ne lit que `combat.suddenDeath`. La donnée `combat.suddenDeathOnline`
  (config.json, schéma validé, transitée telle quelle par le loader) est
  copiée vers `combat.suddenDeath` par le CLIENT au moment de créer un match
  en ligne (`main.ts`, `raw.online` — le `StartGame` devient le `setup` du
  match et la règle vaut pour les DEUX joueurs et la re-simulation serveur).
  Parties locales/PvE : jamais activée.
- **Pas de bump `CURRENT_SAVE_VERSION`** : la config est déjà sérialisée
  dans l'état (`GameState.config`), champ optionnel ; `CombatState` ne gagne
  aucun champ.

## 2. État des lieux (points d'ancrage vérifiés)

- Bascule de round : `combat/turns.ts advanceTurn` (`:193` `combat.round += 1`).
- Fin de combat : `checkCombatEnd` (`:262-291`) — corps à factoriser en
  `finishCombat(winner)` (mêmes conséquences).
- `armyStrength(army, catalog)` : `core/power.ts:9` (exporté).
- Convention égalité/défenseur : B17 (`combat-guardian.test.ts:100`).
- Config combat : `adventure/config.ts CombatRulesConfig` (idiome
  `rangePenalty?`/`heroAttack?`) ; schéma : `content/src/schemas.ts` (bloc
  combat) ; transit loader → `AdventureConfig`.
- Création de match en ligne : `client/src/main.ts:304` (`raw.online` ⇒
  `createMatch(raw.seed, command)` — `command` = `StartGame` complet).

## 3. Étapes

- [x] a. **Moteur** : `CombatRulesConfig.suddenDeath?` + `suddenDeathOnline?`
      (`SuddenDeathConfig`) ; extraction `finishCombat(draft, combat, winner,
      events)` partagée avec `checkCombatEnd` ; check de mort subite dans
      `advanceTurn` (après `round += 1`, avant poison/statuts) ; événement
      `CombatSuddenDeath { round, winner }` (non haché).
- [x] b. **Contenu** : `suddenDeathSchema` (round int ≥ 2, `resolution`
      littéral `strongestArmy`) posé sur les deux clés du bloc combat ;
      `config.json` : `suddenDeathOnline { round: 20 }`.
- [x] c. **Client** : `main.ts` (seul chemin `createMatch`) — copie
      `suddenDeathOnline` → `suddenDeath` dans le `StartGame` du match.
- [x] d. **Tests moteur** (`test/combat-sudden-death.test.ts`, 5 tests) :
      victoire attaquant avec conséquences (gardien retiré, armée intacte),
      victoire défenseur (héros retiré), force RESTANTE (attaquant saigné
      perd), égalité ⇒ défenseur, config absente ⇒ aucune borne (30 rounds).
- [x] e. **Docs** : doc 02 §5.5 (règle complète + activation en ligne).
      Doc 15 non touchée (le levier déterministe y est déjà décrit ; la
      borne est une config de partie, pas une mécanique serveur).
- [x] f. **Vérifs** : typecheck ✅ lint ✅ moteur **871/871** (+5, golden
      inchangé) ✅ contenu 152/152 ✅ `content:check` ✅ garde-fou faction ✅
      budget 330 Ko/800 Ko ✅ smoke `@core` 19/19 ✅. Pas de bump
      `CURRENT_SAVE_VERSION` (config déjà sérialisée, champ optionnel).

## 4. Hors périmètre

- UI d'annonce en combat (bandeau « mort subite au round N ») — l'événement
  existe, l'habillage viendra avec l'UX en ligne ; décompte « par équipe »
  avec alliances (le combat est 1v1 par construction) ; lot 4.2 (Elo).

## 5. Risques

| Risque | Mitigation |
|---|---|
| Dérive du golden/replay | opt-in : config absente ⇒ branche jamais prise ; test explicite |
| Sémantique du round N ambiguë | documentée : rounds 1..N-1 joués, le round N ne démarre pas (check APRÈS incrément, AVANT poison/statuts) |
| Égalité de force | défenseur vainqueur (convention B17), testé |
| Le moteur « connaît » le mode en ligne | non : il ne lit que `suddenDeath` ; le gating en ligne est client + données |

## 6. Suivi

- [x] Plan rédigé (2026-07-17)
- [x] a→f livrés (2026-07-17) — voir coches du §3. Décisions notables :
      machines de guerre comptées dans la force (piles vivantes comme les
      autres) ; le check précède poison/statuts du nouveau round (le round N
      ne démarre pas du tout) ; `suddenDeathOnline` transite par le type
      moteur mais n'est JAMAIS lu par lui (gating 100 % client + données).
