# Lot N-DAILYREFRESH — Rafraîchissement quotidien des quêtes journalières

> Backlog : `game-feature-gaps.md` §2.8 (N-DAILYREFRESH). Doc : **doc 13 §4.2/§5.2/§5.3**
> (N4c : contrats journaliers rejouables). Branche `claude/cities-screen-ux-wemh1n`
> (repart de `main`). Zone quête = **isolée** de la churn hero/tavern parallèle.

## Constat

Les quêtes journalières du mode libre (`app/daily.ts`) sont instanciées **une
seule fois** au `StartGame` d'escarmouche (embarquées dans `QuestState`). Il
manque le **rafraîchissement par jour** — noté doc 09 comme « nécessiterait une
commande `AddQuests` ».

## Spec

- **Moteur** : commande **générique** `AddQuests { quests: QuestDef[] }` — ajoute
  des quêtes en cours de partie (crée `state.quests` si absent), **idempotente**
  (une déf dont l'id existe déjà est ignorée), émet `QuestStarted` par ajout.
  Défs **opaques** (le moteur ne connaît ni texte ni dialogue). Validée : partie
  démarrée ; bloquée après `outcome` (`GAME_OVER_BLOCKED`).
- **Pas de nouveau champ d'état** (`state.quests` = `QuestState | null` déjà
  sérialisé) ⇒ **pas de bump save**. Commande **absente du golden** ⇒ golden
  inchangé.
- **Client** : `buildDailyQuests` gagne un `idPrefix` optionnel (jour-scopé). Un
  module `app/daily-refresh.ts` (armé au démarrage d'escarmouche avec
  report/faction/seed) génère, **après chaque fin de tour humain** (le jour a
  avancé), les contrats du **nouveau jour** — seed déterministe `seed + day` —
  et dispatch `AddQuests` + ajoute leurs métas au journal. Hors escarmouche
  (scénario/campagne) : désarmé ⇒ no-op.

## Étapes / vérif

1. Engine : `AddQuests` (commande + handler `quest/add.ts` + câblage engine.ts +
   test `quest-add.test.ts`) → `pnpm --filter @heroes/engine test`.
2. `daily.ts` : param `idPrefix` (défaut '' ⇒ ids jour-1 inchangés).
3. `daily-refresh.ts` (arm/disarm/refresh) + `narrative.ts` append métas.
4. Câblage : `main.ts` arme au skirmish / désarme sinon ; `end-turn.ts` déclenche
   le refresh après résolution de `EndTurn`.
5. Smoke : escarmouche → fin de tour → un contrat `daily-d2-*` apparaît (state +
   journal).
6. Vérifs : typecheck 5/5, lint, engine, content, build (< 800 Ko), garde-fous
   zéro-faction + couleurs, smoke. Golden + save-shape inchangés (pas de bump).
7. Doc 13 §4.2 : noter le refresh livré (retire « différé »). Backlog ✅.

## Journal

- plan créé ; explo faite (quest/types, evaluateQuests, daily.ts, eventBus,
  end-turn.ts, narrative.ts). Zone quête isolée.
- **Livré** : moteur `AddQuests` (commande + `quest/add.ts` + câblage engine.ts +
  `GAME_OVER_BLOCKED` + test `quest-add.test.ts`) ; client `daily.ts` (param
  `idPrefix`), `daily-refresh.ts` (arm/disarm/refresh, seed `seed+jour`),
  `narrative.ts` (`appendFreeModeQuests`), `main.ts` (arme au skirmish / désarme
  scénario+campagne+newgame), `end-turn.ts` (`endHumanTurn` déclenche le refresh
  après résolution). Smoke : fin de tour ⇒ `daily-d2-*` ajoutés.
- Choix : refresh déclenché au point de sortie **fin de tour humain** (dispatch
  résolu = IA jouées, jour avancé) plutôt qu'au `DayStarted` (émis mid-dispatch
  dans la boucle IA ⇒ re-entrance). Déterministe et replay-safe (défs embarquées
  dans la commande). Non ré-armé après restore (comme la génération initiale).
- Vérifs vertes : typecheck 5/5, lint, engine **582** (+4 `quest-add`, golden +
  save-shape inchangés), content **114**, build (JS gzip ≈ 292 Ko < 800),
  garde-fous zéro-faction + couleurs, smoke **166 passed** (+2 N-DAILYREFRESH).
  **Pas de bump save, golden inchangé.**
