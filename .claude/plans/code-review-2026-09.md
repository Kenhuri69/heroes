# Revue de code complète (2026-09-02) — constats & propositions

> **Demande utilisateur (2026-09-02)** : « lance une revue complète du code de
> l'application et propose toute correction, amélioration que tu trouves
> pertinente. »
>
> Ce document est la **proposition** : rien n'est encore corrigé. Chaque constat a
> été **vérifié dans le code** (`fichier:ligne`), plusieurs **reproduits** par un
> test temporaire ou une mesure. La revue précédente
> (`code-review-2026-08.md`, 7 lots livrés) n'est pas re-signalée. Les lots de
> remédiation sont proposés en §8, à valider avant exécution.

## 0. Méthode & état de référence

- **Périmètre** : `packages/engine` (16,6 k lignes), `packages/content` (4,4 k),
  `packages/client` (14 k), `packages/tools`, `server/` (Worker Cloudflare),
  `data/` (7 paquets, 3 cartes, 21 scénarios, locales), CI, PWA, smoke Playwright.
  Six lectures intégrales par domaine, recoupées par grep des appelants ; les
  points critiques ont été relus une seconde fois par le coordinateur.
- **Baseline (branche `main` 4e1c5a8)** : `typecheck` 5/5 vert · `lint` vert ·
  tests **988 moteur / 176 contenu / 92 client** verts · `content:check` vert ·
  build vert, bundle **371 458 o gzip** (cap 819 200) · `pnpm audit` : 0
  vulnérabilité · 0 `TODO/FIXME`, 0 `any`, 0 `@ts-ignore`, TS strict complet
  (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), invariants moteur
  imposés par ESLint (pas seulement par convention).
- **Sévérités** : P0 = sécurité / perte de données / triche PvP · P1 = règle
  fausse visible en jeu · P2 = cas limite, robustesse · P3 = hygiène, perf,
  duplication.
- **Bilan chiffré** : **2 P0**, **11 P1**, **~30 P2**, **~40 P3**, 25
  améliorations. Aucune régression de la baseline : tout ce qui suit est latent
  ou visible en jeu sans faire échouer un test existant — c'est le signe
  d'angles morts de couverture, listés à chaque lot.

## 1. P0 — sécurité & PvP asynchrone (serveur)

| # | Fichier:ligne | Constat | Scénario | Correctif |
|---|---|---|---|---|
| S1 | `packages/engine/src/net/match.ts:44-64` (consommé par `server/src/worker.ts:589`) | `appendTurn` vérifie « c'est bien son tour » **avant** le lot seulement, puis applique toutes les commandes. Un lot peut franchir `EndTurn` et **jouer le tour de l'adversaire**. | **Reproduit** (deux revues indépendantes) : `appendTurn([StartGame], 'p1', [EndTurn p1, MoveHero(héros de p2), EndTurn p2])` ⇒ `ok: true`. Un tricheur déplace/sacrifie l'armée adverse, dépense son or ; le serveur « autoritaire » accepte. `match.test.ts` ne couvre que le refus hors-tour. | Exiger `currentTurnPlayerId(state) === playerId` avant **chaque** commande ; refuser toute commande après l'`EndTurn` du posteur. Test « lot trans-tour refusé ». |
| S2 | `server/src/worker.ts:266-270` | **Auth fail-open** : sans `RESEND_API_KEY`, `/auth/request` renvoie le lien de vérification dans la réponse **pour n'importe quel e-mail**. Rien dans `wrangler.toml` ni dans `deploy-worker.yml` ne pose ce secret (doc 15 : `wrangler secret put` manuel). | Si le secret n'est pas posé en prod : `POST /auth/request {email: victime}` ⇒ session de la victime ⇒ lecture/écrasement de ses cloud saves, forfaits et coups en son nom. | Renvoyer le lien seulement si une variable explicite `DEV_RETURN_VERIFY_LINK=1` est posée ; sinon `503 e-mail non configuré`. Documenter doc 15 §5.1. Vérifier l'état du secret en prod. |

## 2. P1 — règles fausses visibles en jeu

### 2.1 Moteur

| # | Fichier:ligne | Constat | Scénario | Correctif |
|---|---|---|---|---|
| M1 | `packages/engine/src/town/capture.ts:69-72, 82-87` ; IA `ai/adventure.ts:437-450` | `CaptureTown` ne considère défendue qu'une ville à **garnison** (ou tour). Un **héros ennemi posté sur la ville** est ignoré. | Début de partie : héros humain dans sa ville, garnison vide. Un héros IA adjacent émet `CaptureTown` ⇒ la ville change de main **sans combat**, le héros humain reste sur une ville ennemie. Un humain peut faire de même. Contredit doc 02 §4.1 et H-VS-H. | `validateCaptureTown`/`handleCaptureTown` : héros non allié sur `town.pos` ⇒ `beginHeroCombat` (ou siège garnison + héros visiteur, cf. amélioration A). IA : exclure une ville occupée par un héros. |
| M2 | `packages/engine/src/combat/spell-effect.ts:333-384` ; `combat/turns.ts:453-465` ; mana pleine `combat/setup.ts:209-217` | Les créatures **invoquées** (`summon`) sont reconstruites dans `hero.army` comme des survivants ordinaires. | Sort d'invocation chaque combat ⇒ troupes gratuites, **permanentes et cumulatives** (doublon d'`unitId`, > 7 piles). La mana étant remplie à chaque combat, la boucle est sans coût. HoMM : les invocations disparaissent en fin de bataille. | Champ optionnel `CombatStack.summoned?: true` (patron `stealthed`), exclu de toute reconstruction d'armée (`applyConsequences`, H-vs-H, `handleAbandon`/`handleSurrender`), comme les machines de guerre. Vérifier `save-shape`. |

### 2.2 Serveur / déploiement

| # | Fichier:ligne | Constat | Scénario | Correctif |
|---|---|---|---|---|
| S3 | `server/src/worker.ts:265, 104` + `packages/client/src/ui/OnlinePanel.tsx:199-203, 380-385` | Le lien du **vrai e-mail** pointe sur `GET /auth/verify?token=…`, qui **consomme** le jeton et affiche du JSON brut ; le client attend que l'utilisateur **colle le jeton**. | L'utilisateur clique le lien ⇒ page JSON ; revient coller le jeton ⇒ `401 jeton invalide` (déjà utilisé). Le parcours e-mail réel ne connecte jamais. | Lien vers l'app (`${APP_ORIGIN}/heroes/?auth=<token>`) et `verify` au boot ; ou `/auth/verify` répond une page HTML qui redirige avec la session. |
| S4 | `server/src/worker.ts:582-595` | Chaque `POST /moves` rejoue **tout** le journal **deux fois** (`appendTurn` puis `replayCommands(result.commands)` pour l'issue). O(n) croissant. | **Mesuré** : carte 64² (preset en ligne), 20 rounds vides ⇒ 42 ms/POST (Node rapide) — au-delà des 10 ms CPU du plan Workers gratuit revendiqué « 0 € ». Partie réelle bien plus lourde ⇒ requêtes tuées, PvP infinissable. | (1) `appendTurn` renvoie l'état final ⇒ supprimer le 2ᵉ rejeu ; (2) snapshot serveur (`matches.snapshot`) et rejeu du seul lot posté ; (3) mesurer en prod (`wrangler tail`). |
| S5 | `server/src/worker.ts:515-527` (join), `:426-437` (matchmaking) | **Course sur le siège** : `SELECT` siège libre puis `UPDATE … WHERE match_id=? AND seat=?` sans `AND profile_id IS NULL` ni contrôle de `meta.changes`. | Deux joueurs rejoignent simultanément : le 2ᵉ écrase le 1ᵉʳ, tous deux reçoivent `200 {seat:1}`, l'un joue dans le vide (`403` aux coups), un siège reste vide sur une partie `active`. | `UPDATE … AND profile_id IS NULL` + `meta.changes === 1` sinon 409 ; grouper avec l'`UPDATE matches` en `DB.batch()`. |
| S6 | `.github/workflows/deploy-worker.yml:22-24` | Filtre `paths: server/**` alors que le bundle Worker embarque `@heroes/engine`. Le client, lui, est redéployé à chaque push sur `main`. | Vérifié dans l'historique : moteur modifié le 2026-09-01, dernier déclencheur Worker le 2026-08-31. Toute règle moteur changée fait **diverger client et serveur** : coups légaux rejetés `422`, ou acceptés avec un autre état (Elo sur un autre règlement). | Ajouter `packages/engine/**` + `pnpm-lock.yaml` aux `paths` (ou déployer depuis `deploy.yml`). Exposer `GET /version` (hash de commit) comparé par le client. |

### 2.3 Client

| # | Fichier:ligne | Constat | Scénario | Correctif |
|---|---|---|---|---|
| C1 | `packages/client/src/app/save.ts:93-99` | `saveGame` résout au `onsuccess` de la **requête** `put`, pas au `complete` de la **transaction**. | IndexedDB signale le dépassement de quota au **commit** (Firefox notamment) : la requête réussit, la transaction `abort`. Toast « Sauvegardé », aucun `SaveFailed` — la perte silencieuse que le lot 3.9 devait éliminer. | Attendre `tx.oncomplete` ; rejeter sur `tx.onabort`/`tx.onerror`. Test unitaire avec `fake-indexeddb`. |
| C2 | `packages/client/src/main.ts:230-247` (`ensureScenes`) + 4 chemins de chargement (`save.ts:117,166,195`, `online-match.ts:30`) | Charger en cours de partie une sauvegarde d'une **autre carte** ne reconstruit pas `AdventureScene` (créée seulement si `!camera` ; tilemap/brouillard/props construits depuis la carte capturée au constructeur). | Options → Charger, import `.heroes`, cloud pull, ou `AiFailureNotice → restoreLatestSave` ⇒ terrain de l'ancienne carte + entités de la nouvelle ; dimensions différentes ⇒ brouillard hors bornes, picking faux. Il n'existe pas de « Retour menu » en jeu : c'est LE chemin pour changer de partie. | Mémoriser la référence `game.map` de la scène et `teardownScenes()` si elle change ; passer tout chargement par un point commun (cf. C3). |
| R1 | `packages/client/src/scenes/combat/CombatScene.ts:1819, 1825, 1923` | Libellés **français en dur** sur le canvas : `'maudit'`, `'peur'`, `'esquive'`. | En locale EN, ces mots flottent sur les jetons. Régression du critère « 0 chaîne en dur » (3.6) ; l'audit i18n ne balaye pas les `Text` Pixi de `scenes/`. | `t('combat.fx.cursed'/'feared'/'dodged')` + clés FR/EN ; étendre le grep d'audit i18n aux `.ts` de `scenes/`. |
| R2 | `CombatScene.ts:943-962` (`syncStacks`), `:1037`, `:959` + `app/dispatch.ts:93-113` | **État appliqué avant l'animation** : `dispatch` fait `setState` (⇒ `sync`) puis `emit`. `handleCombatAction` enchaîne tous les tours IA jusqu'à la prochaine pile humaine dans la même commande. | À chaque action humaine, les piles IA **téléportent** à leur case finale puis sont ramenées à `from` pour rejouer la marche ; le badge d'effectif de la cible montre déjà le résultat ; l'anneau doré est déjà sur la pile suivante. `animatingIds` ne protège que la pile en cours d'animation, pas celles en file. | Couche de présentation « pilotée par la file » : `syncStacks` ne touche pas les piles référencées par le lot d'événements ; position/effectif/anneau appliqués au moment de l'animation (M). |

### 2.4 Données

| # | Fichier:ligne | Constat | Scénario | Correctif |
|---|---|---|---|---|
| D1 | `data/factions/{arcane-hunters,necropolis,sylvan-court,vox-arcana,dungeon}/locales/*.json` ; `client/app/i18n.ts:224` ; `ui/shell.tsx:1058`, `ui/TownScreen.tsx:766` | **26** `specialtyEffect.id` de héros nommés, **11** clés `hero.specialty.<id>.name/.desc` : **15 héros** affichent l'**id brut** (« voix-du-honmoon », « maitre-de-chasse », « poison-certain »…) au tiroir héros et à la Taverne, en FR et EN. `content:check` (`content-check.ts:139`) ne vérifie que `spell/skill/artifact/building`. | Recompté par le coordinateur (`jq` sur `data/factions/*/heroes/*.json` vs locales). | Ajouter les ~30 clés manquantes ; étendre `checkPackNameKeys` (`loader.ts:328`) : tout héros avec `specialtyEffect` ⇒ `hero.specialty.<id>.name` fr+en exigé. |

## 3. P2 — cas limites & robustesse

### 3.1 Moteur (combat, ville, héros)

- **M3** `combat/reinforce.ts:72, 104-126` + `turns.ts:456-464` — la pile de renfort est toujours une unité déjà commandée (validation), et la reconstruction mappe 1:1 ⇒ **deux entrées du même `unitId`** dans `hero.army`, 8 piles si le héros en avait 7. `GarrisonTransfer`/`TransferBetweenHeroes` fusionnent par `find` (1ʳᵉ entrée). Aucune assertion post-combat dans `combat-reinforcements.test.ts`.
- **M4** `combat/leave.ts:457-459, 472-474` — coop : `AbandonCombat`/`Surrender` reconstruisent l'armée du **lead** depuis toutes les piles du camp sans `ownerHeroId` ⇒ le lead récupère les piles de l'allié, l'allié (vidé à l'engagement) reste à `[]`. `applyConsequences` route correctement ; `leave.ts` non. Aucun cas coop dans `combat-leave.test.ts`.
- **M5** `combat/damage.ts:648` vs `:932-947` vs `actions.ts:511-515` — `expose` (`consumeMarks.suppressRetaliation`) : la résolution met `retaliationsLeft = 0` mais `canRetaliate` accepte `unlimitedRetaliation` **même à 0** ; la préviz annule la riposte dès `willExpose` ⇒ **préviz ≠ résolution** contre un Griffon marqué. Effet secondaire : la cible perd aussi sa riposte pour les attaques suivantes du round (doc 05 §3.1 : « cette attaque »).
- **M6** `combat/damage.ts:917-928` — `estimateDamage` ne modélise qu'**une** frappe ; `applyAttack` en fait deux pour `doubleAttack` (Minotaure, Loup argenté) ⇒ dégâts/kills annoncés ≈ moitié du réel (doc 08 §2.4 : préviz = résolution).
- **M7** `combat/hero-attack.ts:189-195` — la frappe du héros n'appelle pas `absorbShield` : la Barrière du Honmoon est ignorée par ce seul chemin de dégâts (les 3 autres l'absorbent).
- **M8** `combat/turns.ts:61-72` vs `death.ts:52-73` — mort par **poison** : `StackDied` + splice sans alimenter `graveyard` ⇒ `resurrectFull` ne peut plus relever la pile, contrairement à une mort identique par frappe. Contredit le commentaire « mort centralisée ».
- **M9** `combat/spell-effect.ts:38-50, 58-78` — les sorts hostiles de **zone/chaîne** touchent des piles `spellImmune`/`stealthed` autres que le centre (Boule de feu sur la tour de tir `spellImmune` adjacente ; Chaîne d'éclairs rebondit sur une pile furtive). Doc 02 §5.4 : « inciblable par un sort hostile ».
- **M10** `hero/recruit.ts:336` — `RecruitHero` pose le héros sur `town.pos` **sans vérifier l'occupant** ; cas courant : le héros du joueur est en visite ⇒ deux héros superposés (`heroesAt.find` n'en cible qu'un en H-vs-H). `landingTileFor` existe (`hero/index.ts:182-194`).

### 3.2 Moteur (cœur, aventure, IA, réseau)

- **M11** `core/engine.ts:284-305` vs `adventure/grail.ts:14-20` — `Dig` n'exige pas que la tuile du Graal soit **révélée** (`grailRevealedTo`) ; seule l'IA se l'impose. Le client masque le bouton, mais en PvP async un client modifié marche sur `map.grailPos` (embarqué dans `StartGame`) et `Dig` est accepté par la re-simulation ⇒ Graal sans obélisque.
- **M12** `core/engine.ts:687` (+ `:670-681`) — `StartGame` **aliase** `cmd.quests` (et catalogues) dans le draft ; `evaluateQuests` dans le même `produce` mute puis gèle l'objet **commande** de l'appelant. **Reproduit** : quête satisfaite d'emblée ⇒ `cmd.quests.quests[0].status === 'completed'`, `Object.isFrozen(cmd.quests)`. Un second `apply` de la même commande démarre sans `QuestAdvanced`. Le commentaire l.664-668 ne protège que `map`.
- **M13** `ai/adventure.ts:453-475` + `:529-531` — l'exploration IA cible **une** tuile (BFS sans `blocked`) puis `findPath(..., blocked)` échoue sans repli ⇒ **héros IA figé définitivement**. **Reproduit** : carte 15×15 ouverte, gardien sous brouillard en (7,1) ⇒ 3 jours sans bouger, 1700 PM intacts, trois directions libres. La propriété « IA vs IA se termine » ne le détecte pas (cap de jours).
- **M14** `ai/adventure.ts:233, 279` — l'IA « voit » les héros ennemis sur toute tuile **jamais explorée** (bit permanent) ; l'humain ne les voit qu'en **vision courante** (`isHeroVisibleOnMap`). Asymétrie d'information : `threatAt` et la chasse H-vs-H ciblent un héros à 30 tuiles.

### 3.3 Client (couche applicative)

- **C3** `save.ts:117,166,195`, `online-match.ts:30-35`, `router.ts:66-74`, `daily-refresh.ts:48-65` — l'état client **par partie** n'est purgé que par `navigate('menu')`, jamais par les chemins de chargement : (a) chapitre de campagne actif → Charger une escarmouche ⇒ la victoire d'escarmouche **fait avancer la campagne** (`campaign.ts:137-152`, rejoue B13) ; (b) escarmouche armée → Charger une campagne ⇒ `refreshDailiesForCurrentDay` injecte des contrats journaliers **dans la campagne** ; (c) `playerColors`/`turnAck` de la partie précédente conservés.
- **C4** `autosave.ts:16-26` — l'autosave écrit le slot `auto` **aussi pendant un match PvP en ligne** ; « Continuer » recharge le match comme partie locale (`HandoffOverlay`, siège adverse jouable hors ligne) et écrase la sauvegarde locale précédente.
- **C5** `cutscene.ts:49-57` — le `setState({cutsceneActive:false, dialogue:null, dialogueQueue:[]})` final est inconditionnel même quand la boucle a `break` sur perte du jeton ⇒ coupe la cinématique/le dialogue d'ouverture du **nouveau** scénario.
- **C6** `notifications.ts:341-350`, `ui/Journal.tsx:14-21` — **hot-seat : fuite d'information via le journal** partagé (revenus, recrutements, sorts, artefacts du joueur 1 lisibles par le joueur 2). B11/B34 ont fermé carte/mini-carte/fond, pas le journal.
- **C7** `ui/MenuScreen.tsx:74`, `ui/OptionsPanel.tsx:95` — « Continuer »/« Charger » : `void restore…()` sans `.catch`, `false` ignoré ⇒ IndexedDB indisponible ou gzip corrompu = le clic **ne fait rien**, unhandled rejection. `AiFailureNotice` (shell.tsx:523-528) fait pourtant les deux.

### 3.4 Client (scènes, rendu)

- **R3** `main.ts:275-284` + `dispatch.ts:96-113` — **le coup fatal n'est jamais animé** : `ensureScenes` (abonné avant la scène) détruit `CombatScene` pendant le `setState` de fin de combat, **avant** `eventBus.emit` ⇒ pas de projectile/fondu/secousse, coupure sèche vers `CombatResultScreen`.
- **R4** `render/tilemap.ts:85, 101`, `render/waterSheen.ts:44` — seuil d'aplatissement en **px CSS**, texture allouée à `resolution` (≤ 2) puis arrondie pow2 sans clamp `MAX_TEXTURE_SIZE` : carte Moyenne 36² sur mobile DPR 2 ⇒ **8192×4096 RGBA ≈ 128 Mo** (×2 voile d'eau, ×2 au `switchLevel`) ; échec/tuile noire sur GPU à 4096 max.
- **R5** `scenes/adventure/AdventureScene.ts:425-436`, `render/mapObjects.ts:98-134`, `render/townsLayer.ts:31-50` — objets et villes rendus **même sur tuiles inexplorées** ; ils dépassent leur losange ⇒ tête du gardien / donjon ennemi **pointe au-dessus du voile** à la frontière du brouillard (U-5 corrigé pour les props seulement). La mini-carte filtre par `explored` : incohérence.
- **R6** `render/fog.ts:55-70` — `FogOverlay.update` **retessèle toute la carte** (O(W×H) `poly().fill()`) à chaque changement de `sighting`, donc à chaque pas de héros : 262 144 polygones sur 512² pour un disque de vision qui touche ~1 chunk.
- **R7** `CombatScene.ts:1653-1690` — préviz d'attaque affichée pour une cible **non attaquable** (`attackableTargets` n'est utilisé que pour la surbrillance) ⇒ « 12–18 dégâts, 2 morts » puis toast d'erreur moteur au 2ᵉ tap.

### 3.5 Serveur

- **S7** `worker.ts:62-64` — bornage de body **après lecture complète**, en unités UTF-16 : 100 Mo alloués avant le 413 ; « 4 Mo » laisse passer ~8-12 Mo d'UTF-8.
- **S8** `worker.ts:456-464, 363-377, 591-598` — écritures multi-statements sans `DB.batch()` : partie `open` sans siège si le 2ᵉ INSERT échoue ; copie N-1 de save écrasée **avant** l'upsert ; Elo partiellement appliqué.
- **S9** `worker.ts:415-424` — les parties `open` **n'expirent jamais** ; `matchmaking` prend la plus ancienne ⇒ lobbies zombies choisis en priorité, invisibles (`LIMIT 50`).
- **S10** `worker.ts:275-279` — usage unique du magic-link **non atomique** (`SELECT` puis `UPDATE`) ⇒ deux `verify` simultanés = deux sessions.
- **S11** `worker.ts:248-260, 293` — e-mail ni validé ni normalisé : `A@x.com`/`a@x.com` ⇒ deux profils, deux jeux de saves.
- **S12** `worker.ts:618-621` — `fail(500, e.message)` **fuit les internes** (SQL D1, moteur) ; double `POST /moves` ⇒ 500 avec le SQL au lieu de 409.
- **S13** `worker.ts:453-454` — `setup` non validé (seul `players.length`) : `StartGame` invalide stocké et appariable ⇒ `422` pour tous ensuite ; un siège `ai` n'est jamais joué ⇒ partie bloquée.

### 3.6 Contenu & outillage

- **D2** `tools/faction-sim.ts:41` — le duel se joue sur `grass`, terrain **natif** de Haven et Vox (+1 vitesse/+1 moral dans tous leurs duels). `balance.test.ts` choisit un terrain neutre ; le sim (seul gate d'équilibrage) non ⇒ la passe 2 a été calibrée sur une mesure **biaisée**.
- **D3** `data/core/locales/{fr,en}.json:906-909` vs `factions/arcane-hunters/locales` — 4 clés `building.arcane-hunters-circle-*` dupliquées dans le **core** avec des valeurs **divergentes** ; `resolveCoreOrPack` lit le core d'abord ⇒ valeurs du paquet mortes, le core « connaît » une faction (doc 06).
- **D4** `data/core/config.json` `newGame.startingArmy` — mélange `t1-recruit` (test-faction) et `t1-eleve` (AH) ⇒ deux `groupId` ⇒ **−1 moral** dès le 1ᵉʳ combat de la partie rapide.
- **D5** `schemas.ts:1261` vs `loader.ts:1098, 1590` — la couche (`level`) d'un trigger `visit` est **perdue** à la résolution ; `teleport.to` n'a pas de `level`. Latent (aucune carte livrée ne l'exerce) mais le schéma promet ce que le loader ne tient pas.
- **D6** `schemas.ts:1541-1542` vs `loader.ts:1399-1437` — `startingArtifacts` des joueurs de scénario **pas** cross-validés (le commentaire l'affirme).
- **D7** `loader.ts:161-185`, `data/core/abilities.json` — capacités des **machines de guerre** et des **créatures invoquées** jamais validées contre le catalogue ; `warMachine`, `siegeBreaker`, `immobile` (lus par le moteur) **absents** du catalogue (9 capacités hors catalogue).

## 4. P3 — hygiène, perf, duplication (synthèse)

**Moteur** : `heroForSide` défini 5× (`state-helpers.ts:488` a déjà `sideLeadHeroId`) ; `killsFromDamage` réimplémenté inline ×2 ; `hasAdjacentEnemy` exporté sans appelant ; `sumHouseField` alias trivial · `ai/town-ai.ts:41-50` copie locale de `maxAffordableCount` **ignorant `factionResources`** ⇒ l'IA ne recrute quasi jamais ses T8 · `ai/adventure.ts:127` l'IA ignore les artefacts au sol dès 10 slots pleins (le sac existe depuis le lot 4) · `:506-509` commentaire « id le plus petit » ≠ code · `engine.ts:882` + `shipyard.ts:74` bateau en double **même id** sur une tuile · `hero/recruit.ts:21` un héros re-recruté après sa mort hérite des `visits` consommées de son prédécesseur · `quest/evaluate.ts:222-224` récompense `units` perdue en silence si armée pleine · doc 14 vs `actions.ts:407-409` : Symbiose incrémente sur Défendre seul, la doc dit « ou reste en place ».

**Client** : deux autosaves en vol peuvent s'écrire **dans le désordre** (gzip async) · `startgame-parity.test.ts:41` ne voit pas les spreads conditionnels (`specialtyCatalog`/`startingName` seulement dans `newGameCommand`) ; bloc « villes neutres » dupliqué ×4 dans `game.ts` · double émission `heroes:start-newgame` (double-tap) ⇒ deux générations · `recordOnlineTurn` laisse fuir l'exception ⇒ toast « commande refusée » trompeur · `net.ts` sans normalisation d'URL ni timeout · `telemetry.ts:96-101` `localStorage.getItem` sync à chaque `setState` · concaténation de fragments traduits (`notifications.ts:83-93`) · `new Audio(url)` par SFX sans plafond · `destroy()` sans `{children:true}` sur des conteneurs composites (`CombatScene.ts:444,943,1753,2142`, `AdventureScene.ts:481,495,341`) · `placeCurtainIso`/`placeTowerIso` sans clé de génération · couleurs en dur dans du **TSX** (`FactionBadge.tsx:20`, `OutcomeOverlay.tsx:113,170`, `MiniMap.tsx:24-40`, `main.ts:267`) — le garde-fou CI ne grep que `*.css` · textes canvas à taille px fixe ignorant les 3 crans (`CombatScene.ts:1166,1984,1999,2044`, `pathPreview.ts:54`) · modales de combat sans `Escape` ni bouton retour Android · éditeur de carte : cellules 28 px et **4 terrains sur 13** (les autres réécrits en `grass`) · aucun bornage du pan caméra en aventure · `CombatScene.sync()` branche `!combat` quasi morte.

**Contenu** : `heroSkills` inconnu non rejeté · `grailPos` ni borné ni testé franchissable · `speaker`/`choices.next` des dialogues non cross-validés · gardien de champ **adjacent** à un départ (`mapgen.ts:681-695`, mesuré : 13 zombies élite collés au départ) · coffre souterrain `xp` indépendant de l'or (`:938-949`) vs doc 02 · `startingTown.level` de scénario accepté mais ignoré · Sylvan `nativeTerrain: water` = bonus natif **de facto mort** (aucun combat sur l'eau) · `factionResources[].icon` champ requis, mort, fichiers inexistants · `map:gen` CLI n'envoie pas les mêmes options que le client (carte différente à graine égale) · assets manquants : 5 icônes d'artefacts, 2 vignettes, 1 sprite (repli procédural OK).

**Infra** : `tests/smoke.spec.ts` (4 822 lignes) **jamais typechecké** (aucun tsconfig ne l'inclut) · `json()` du Worker sans `Cache-Control: no-store`/`nosniff`/`Vary: Origin` (réponse `/auth/verify` cachable) · actions GitHub épinglées par tag mutable, secret interpolé dans le shell (`deploy-worker.yml:51`), pas de `typecheck` avant `wrangler deploy` · garde-fou faction omet `*.css`/`*.html` et `server/` · manifest PWA `purpose: "any maskable"` sur la même icône · `sw.js:88-106` `networkFirst` sans timeout (écran noir en « lie-fi ») · `schema.sql:44` commentaire `status` omet `abandoned` ; `MAX_BODY_BYTES` 256 Ko vs `StartGame` 64² ≈ 150-180 Ko · dépendances : majeures disponibles (immer 11, vitest 4, vite 8, eslint 10, TS 7) — à planifier, aucune vulnérabilité.

## 5. Améliorations (hors bugs)

| Coût | Proposition |
|---|---|
| **S** | Helper pur `rebuildArmyFromSurvivors(combat, side, ownerId)` (fusion par `unitId`, exclusion machines/invoqués) partagé par `applyConsequences`, H-vs-H, `handleAbandon`, `handleSurrender` — 4 copies aujourd'hui, 3 divergentes (ferme M2/M3/M4 structurellement). |
| **S** | Test property moteur « après tout `CombatEnded`, aucun héros n'a de doublon d'`unitId` ni > `heroArmyCap` piles » ; « après tout `StartGame`/tour IA, `map.objects` sans id en double ». |
| **S** | `enterLoadedGame(state)` : point de purge unique pour Continuer/Charger/import/cloud/match (narration, campagne, couleurs, `turnAck`, daily-refresh, cutscene) + démontage de scène si `game.map` change (ferme C2/C3/C5). |
| **M** | `saveGame` : `tx.oncomplete` + file coalescée + `onblocked` ; test `fake-indexeddb`. |
| **M** | Couche de présentation combat « pilotée par la file » (`presented: Map<id,{pos,count}>`) ; `main.ts` attend `queue` avant `destroy` (ferme R2/R3). |
| **S/M** | Brouillard incrémental par chunk (dirty-set des chunks touchés par l'ancien/nouveau disque de vision). |
| **S** | Budget texture explicite `fitsInTexture(extentCss, resolution, maxSize)` partagé Tilemap/voile d'eau, `MAX_TEXTURE_SIZE` lu au boot ; smoke `@mobile` DPR 2 carte Moyenne. |
| **M** | Harnais de test du Worker (`vitest` + `@cloudflare/vitest-pool-workers`, D1 mémoire, `schema.sql`) — le lot 6 précédent notait déjà « aucun harnais ⇒ gardes non testées » ; S1/S5/S10 sont exactement des cas qu'il fixerait. |
| **S** | Hasher les jetons au repos (`sessions.id`, `auth_tokens.token` → SHA-256). |
| **M** | Snapshot d'état par partie (`matches.snapshot`, `snapshot_seq`) : `POST /moves` ne rejoue que le lot ; `GET /matches/:id` sert l'état aux clients lents. |
| **S** | `appendTurn` renvoie `{ ok, commands, state }` (supprime le 2ᵉ rejeu). |
| **S** | `content:check` : parité FR/EN de **toutes** les clés + `@loc:` des fichiers core ; garde « aucune clé core ne contient un id de `factions/index.json` » ; `heroSkills ⊆ coreSkills` ; refs `speaker`/`choices.next`/`startingArtifacts` ; `grailPos` franchissable. |
| **M** | `mapgen.test.ts` : assertion d'**atteignabilité** BFS (départs, objets, Graal, couche 1 via monolithes) — `loadMap` ne la vérifie pas. |
| **M** | Typage des `params` de capacités (`z.record(z.unknown())` → union discriminée par `id`, au moins `shooter`/`spellcaster`/`consumeMarks`/`barrier`). |
| **S** | `faction:sim --terrain neutre|natif` ; `map:gen` et client partagent `mapGenOptionsFromReport`. |
| **S** | `findPath` renvoie le coût (`totalPathCost` re-marche chaque chemin dans 6 pickers IA) ; `validatePath` indexé par tuile comme le handler (F5). |
| **M** | Report de campagne avec **sac** (`PlayerSetup.startingBackpack`) — aujourd'hui tronqué à 10 slots. |
| **L** | L'IA n'assiège jamais une ville à garnison (`ai/adventure.ts:445`) : une créature en garnison la rend inattaquable — plafond de difficulté actuel. |
| **L** | Siège avec héros visiteur (garnison + armée du héros, `defenderHeroId` non null) — fidélité HoMM, résout M1 structurellement. |
| **S** | Garde-fous CI élargis : couleurs en dur dans `ui/**/*.tsx`/`main.ts` ; chaînes lettrées dans les `Text` de `scenes/` ; `destroy()` nu (règle ESLint ciblée) ; faction grep sur `*.css`/`*.html`/`server/` ; `tsconfig` racine incluant `tests/` + typecheck. |
| **S** | Lint moteur étendu : `no-restricted-globals` `navigator`/`localStorage`/`fetch`/`crypto`/`setTimeout` ; `server/src` interdit d'importer autre chose que `@heroes/engine`. |
| **S** | Sécurité Worker : `no-store`/`nosniff`/`Vary`, e-mail normalisé, 500 opaques + 409 sur UNIQUE, `Content-Length` avant lecture. |
| **S** | Actions GitHub épinglées par SHA + Dependabot ; secret via `env:`. |
| **S** | Hook `useEscape(onClose)` (écrit 6× dans `shell.tsx`) appliqué aux modales de combat. |
| **S** | Pool d'`Audio` par SFX ; `telemetryEnabled` lu du store. |

## 6. Non-retenu (vérifié conforme — pour ne pas re-vérifier)

Moteur : gates « hors combat » de tous les validateurs ; butin de gardien lu pré-combat ; RNG (aucun `Math.random`/`Date`, clés triées avant tirage, `weightedPick` sans consommation à vide) ; couche `level` respectée par `samePos`/`isAdjacent`/`tileIndex`/A\*/gardiens ; chemin `structuredClone` (F3) identique au chemin Immer ; arrondi du seuil de moral exact en IEEE 754 ; mana pleine à chaque combat = design documenté (doc 02 §1.4) ; ordre d'initiative, `firstStrike`, riposte, LoS murs, F2 √(N/rolls), pénalité de portée : conformes doc 02 §5.
Client : brouillard/mini-carte/fond opaques au passage d'appareil (B34) ; picking iso inverse exact ; culling des chunks sans off-by-one ; listeners/tickers symétriques ; préviz combat 100 % moteur (`estimateDamage`, `heroActionLeftFor`, `roundActionOrder`) ; cibles tactiles ≥ 44 px partout (sauf éditeur) ; aucun `innerHTML` ; 0 clé `t('…')` manquante FR/EN, parité 0/0.
Contenu : élite ≥ base (46 paires, 0 écart), `shooter.ammo > 0`, `@loc:` 0 non résolu, `generateMap` déterministe et atteignable sur 20 configurations (12²→128², souterrain, densités 0→2), `faction-new` conforme au schéma.
Infra : IDOR saves filtré par `profile_id`, 100 % SQL paramétré, entropie/expiration des jetons, rate-limit `/auth/request`, CORS `*` sans credentials, SW : invalidation, scope, backend jamais intercepté ; smoke : `forbidOnly`/`retries`, 2 seuls `waitForTimeout` justifiés, `--grep` correctement quoté, `\b` de grep fonctionne avec les tirets.

## 7. Angles morts de couverture révélés

- `match.test.ts` : lot trans-tour (S1). Aucun harnais Worker (S2→S13).
- `combat-reinforcements.test.ts` sans assertion post-combat ; `combat-leave.test.ts` sans coop ; `combat-poison.test.ts` sans cimetière ; aucun test « summon puis victoire ».
- Aucun test « `apply(StartGame)` ne mute pas `cmd` », « un gardien ne fige pas l'exploration IA », « `Dig` non révélé ⇒ refus », « `CaptureTown` sur ville occupée par un héros ».
- Client : aucun test IndexedDB (`fake-indexeddb`) ; parité `StartGame` textuelle (spreads conditionnels invisibles) ; audit i18n aveugle aux `Text` Pixi ; garde-fou couleurs aveugle au TSX.
- Contenu : `content:check` ne couvre pas spécialités, machines, invocations, `startingArtifacts` de scénario, dialogues, `grailPos`.

## 8. Lots de remédiation proposés (à valider)

Ordre = risque décroissant. Chaque lot = 1 PR atomique, vérifiée (typecheck, lint,
golden **inchangé sauf justification**, tests, garde-fous, budget, smoke `@core`).

| Lot | Contenu | Bump save ? | Coût |
|---|---|---|---|
| **R1 — PvP & auth (P0)** | S1 (garde par commande + test), S2 (fail-closed), S5 (siège atomique + batch), S10 (usage unique atomique), S6 (paths deploy-worker) | non | S |
| **R2 — Règles de combat/ville** | M1, M2 (`summoned`, à confirmer sans bump : champ optionnel absent des saves existantes), M3/M4 via `rebuildArmyFromSurvivors`, M7, M8, M9, M10 + test property « armée saine après combat » | M2 : champ optionnel ⇒ **pas de bump** attendu, à vérifier avec `save-shape` | M |
| **R3 — Préviz = résolution** | M5, M6, R7 (+ doc 02/05 alignées) | non | S |
| **R4 — Cœur & IA** | M11, M12, M13, M14, `town-ai` faction-aware, artefacts au sol IA, bateau doublon | non | M |
| **R5 — Sauvegarde & chargement client** | C1 (+ `fake-indexeddb`), C2/C3/C5 via `enterLoadedGame`, C4, C7, file d'autosave | non | M |
| **R6 — Combat : présentation** | R1 (i18n), R2/R3 (file de présentation), R5 (entités sous brouillard), R4 (budget texture), R6 (brouillard incrémental) | non | M/L |
| **R7 — Contenu & outillage** | D1 (30 clés + garde), D2, D3, D4, D5, D6, D7 + `content:check` étendu, gardien adjacent au départ, coffre souterrain | non | S/M |
| **R8 — Serveur : robustesse** | S3 (parcours e-mail), S4 (état renvoyé + snapshot), S7, S8, S9, S11, S12, S13, en-têtes, harnais Worker | schéma D1 : `ALTER TABLE ADD COLUMN` | M/L |
| **R9 — CI, lint, hygiène** | tsconfig `tests/`, garde-fous élargis, SHA + Dependabot, P3 client/moteur (dedup, `destroy({children})`, Escape, éditeur, pan clamp), PWA (manifest, SW timeout), C6 journal hot-seat | non | S/M |
| **R10 — Docs** | doc 02 (§4.1 siège avec héros, §5 préviz), doc 05 §3.1, doc 14 (Symbiose, terrain natif), doc 15 (§5.1 auth, §10 secret), CLAUDE.md (mémo) | — | S |

**Hors périmètre proposé** (décisions de design à trancher, pas des bugs) : mana
pleine à chaque combat ; `CallReinforcements` hors budget « 1 action de héros » ;
poison vs bouclier ; l'IA n'assiège pas les villes à garnison ; siège avec héros
visiteur ; mise à jour des dépendances majeures.

## Journal

- 2026-09-02 : revue livrée, aucun correctif appliqué ; en attente du choix des
  lots à lancer.
- 2026-09-02 : **« lance dans l'ordre logique »** ⇒ exécution R1 → R10. **Écart au
  plan** : la session est contrainte à la branche `claude/code-review-complete-uf9ilf`
  ⇒ chaque lot = un **commit atomique vérifié** sur la PR #547 (pas une PR par lot).
- [x] **R1 livré** — S1 garde par commande dans `appendTurn` (+ test « lot qui
  franchit `EndTurn` refusé ») ; S2 auth **fail-closed** (`DEV_RETURN_VERIFY_LINK=1`
  requis pour renvoyer le lien, sinon 503 ; garde placée AVANT l'insertion du
  jeton) ; S5 `claimSeat` atomique (`AND profile_id IS NULL` + `meta.changes === 1`,
  matchmaking + join) ; S10 usage unique atomique du magic-link ; S6 `paths` de
  `deploy-worker.yml` étendus à `packages/engine/**` + lockfile ; doc 15 §5.1/§10
  alignée. Vérif : typecheck 5/5, lint, `match.test` 6/6. Le Worker n'a toujours
  pas de harnais (R8) ⇒ S2/S5/S10 vérifiés par relecture SQL seulement.
- [x] **R2 livré** — helper partagé `combat/army-rebuild.ts` (`rebuildArmyFromSurvivors`
  : fusion par `unitId`, exclusion machines + **invocations**, routage par
  propriétaire) consommé par victoire, H-vs-H, abandon et reddition (M2/M3/M4).
  **Décision M2** : les invocations sont identifiées par **dérivation**
  (`summonedUnitIds` = `spell.summon.unit.id` du catalogue) plutôt que par un
  champ `CombatStack.summoned` ⇒ **aucun bump `CURRENT_SAVE_VERSION`** (la
  convention v28/v35 bumpe même pour un champ optionnel — évité). M1 : ville
  sans garnison/tour occupée par un héros non allié ⇒ `beginHeroCombat` (siège
  garnison + héros visiteur toujours différé ; le héros présent continue de
  renforcer le mur, F-HOUSES intact) + IA exclut ces villes. M7 `absorbShield`
  sur la frappe du héros ; M8 poison ⇒ `handleStackDeath` (cimetière) ; M9
  `hostileSpellSkip` partagé préviz/résolution (zone/chaîne épargnent
  immunes/furtives) ; M10 `hero/landing.ts` (`landingTileFor` extrait, tuile de
  ville = occupation seule, voisines franchissables) réutilisé par le portail et
  le recrutement. 8 tests ajoutés (un par constat). Vérif : typecheck, lint,
  **1000 tests moteur (+12), golden inchangé**, contenu 176, client 92.
- [x] **R3 livré** — M5 : `performStrike` renvoie `suppressedRetaliation` et ne
  met plus `retaliationsLeft = 0` ; `applyAttack` le consomme ⇒ `expose` vaut
  aussi contre `unlimitedRetaliation` (préviz = résolution) et ne prive plus la
  cible de riposte contre les attaquants suivants (test existant ajusté 0→1,
  2 tests ajoutés). M6 : `estimateDamage` modélise les 2 frappes de
  `doubleAttack` (kills séquentiels, riposte sur les survivants de la 1ʳᵉ frappe,
  tir borné par les munitions) et renvoie `strikes` ; le client affiche
  « (2 frappes) » (`combat.damageStrikes`). R7 : `handleAttackTap` refuse la
  préviz d'une cible absente d'`attackableTargets` (toast
  `combat.reason.unreachable`). Docs 02 §5.4 / 05 §3.1 alignées. Vérif : typecheck,
  lint, **1002 tests moteur**, golden inchangé, contenu/client verts, `content:check`.
