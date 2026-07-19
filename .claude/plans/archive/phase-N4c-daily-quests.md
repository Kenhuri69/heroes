# Plan — Lot N4c : quêtes journalières en mode libre (doc 13 §4.2/§5.3)

Troisième increment de **N4**. Petites missions « contrats » **générées depuis des
gabarits data-driven**, en **mode libre (escarmouche)**, `kind: daily`. Tirées via
le **RNG seedé de la partie** (déterminisme conservé) → **zéro diff moteur** : le
`StartGame` accepte déjà un champ `quests`, la génération est côté client mais
**déterministe** (RNG PCG32 exporté par `@heroes/engine`, `seedRng`).

## Portée

- **Contenu** : `data/core/daily-templates.json` (+ schéma `dailyTemplatesFile`).
  Conditions de gabarit résolubles sans couplage carte :
  `recruitTier {tier,count}` (→ `ownUnits` de l'unité de tier N de la faction),
  `buildStructure {buildingId}`, `surviveDays {days}`. Récompenses = schéma
  `questReward` existant. Chargé dans `loadContent` → `content.dailyTemplates`.
- **Client** :
  - `app/daily.ts` : `buildDailyQuests(report, humanFactionId, seed, count)` —
    `seedRng(seed)` + `rollRange` tirent `count` gabarits distincts, résolus en
    quêtes concrètes (`QuestState` moteur + métadonnées journal `kind: daily`).
  - `narrative.ts` : `loadFreeModeNarrative(dailyQuests)` — catalogue narratif
    minimal (quêtes seules) pour que les `QuestStarted` peuplent le journal.
  - `skirmishStartCommand(..., quests?)` — embarque le `QuestState`.
  - `main.ts` `startSkirmish` : génère les quêtes, pose la narration, dispatch.
  - `ui/QuestJournal.tsx` : badge « Journalier » pour `kind: daily`.
- **Données** : `daily-templates.json` (~4 gabarits) ; locales fr/en.
- **Smoke** : démarrer une escarmouche → `GameState.quests` contient N quêtes
  journalières **déterministes** (même seed ⇒ mêmes ids) + le journal les affiche
  avec le badge.

## Différé

Rafraîchissement **par jour** en cours de partie : nécessiterait une commande
moteur générique `AddQuests` (dispatch au changement de jour). Hors périmètre
« zéro diff moteur » — noté pour une itération ultérieure. N4c livre la
génération **au démarrage** du mode libre (un lot de contrats par partie).

## Vérification par lot

typecheck 4/4 · moteur (golden **inchangé**) · content + `content:check` ·
garde-fou faction + garde-fou couleurs · build < 800 Ko · smoke desktop + mobile.

## Vérification par lot

- [x] typecheck 4/4
- [x] moteur 321 (golden **inchangé** — génération client + `StartGame.quests` existant)
- [x] content 77 (fixtures loader/scenario dotées de `core/daily-templates.json`) + `content:check`
- [x] garde-fou faction + garde-fou couleurs (grep local : propres)
- [x] lint · build client (254 Ko gzip < 800 Ko)
- [x] smoke desktop + mobile (contrats `daily-*` déterministes + badge journal)

## Décisions / écarts

- **Zéro diff moteur atteint** : `StartGame` accepte déjà `quests` (comme les
  scénarios) ; la génération est côté client mais **déterministe** via le RNG
  PCG32 exporté (`seedRng`/`rollRange`) seedé par le seed de la partie — pas de
  `Math.random`, déterminisme conservé (doc 13 §5.2).
- **Résolution générique** : `recruitTier` → `ownUnits` de l'unité de tier N de la
  faction du joueur (dérivée du manifeste, jamais un id en dur) ; gabarits filtrés
  aux conditions résolubles.
- **Rafraîchissement par jour différé** : nécessiterait une commande moteur
  générique `AddQuests` (dispatch au changement de jour) — hors « zéro diff
  moteur ». N4c livre la génération **au démarrage** du mode libre (un lot de
  contrats déterministes par partie), fidèle au système de gabarits « Contrats ».
- **Journal du mode libre** : `loadFreeModeNarrative` pose un catalogue narratif
  minimal (quêtes seules) pour que les `QuestStarted` peuplent le journal avec le
  `kind: daily` (badge partagé avec `personal`).
- Fixtures de tests content mises à jour (loader/scenario) : `loadContent` exige
  désormais `core/daily-templates.json`.
