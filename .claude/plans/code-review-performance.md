# Revue de code — bugs & performance (juillet 2026) : constats + plan de correction

> **Statut : plan proposé — aucune correction appliquée dans cette PR.**
> Revue complète du code (~20 500 lignes TS : moteur, client, contenu, tools,
> données, service worker) menée par 5 passes parallèles ciblées, chaque constat
> étayé par un scénario de défaillance concret ou un coût mesurable. Les trois
> P0 ont été re-vérifiés à la main dans le code avant rédaction. Les plans
> `code-review-remediation.md` (R1–R8) et `code-doc-coherence-remediation.md`
> (A–E) étant livrés, tous les constats ci-dessous sont **nouveaux**.

## Synthèse

| Sévérité | Bugs | Performance |
|---|---|---|
| **P0** (cassant / exploitable) | 3 | — |
| **P1** (majeur) | 13 | 4 |
| **P2** (mineur / latent) | 26 | 7 |

Chaque lot ci-dessous = une PR atomique, vérifiée par : `typecheck` + `lint` +
tests unitaires (cas ajoutés **dans le même commit**, skill `test-authoring`) +
golden replay (re-fix signalé quand attendu) + garde-fou « zéro faction dans le
moteur » + budget bundle + smoke headless (guidelines §7).

---

## Constats détaillés

### P0 — cassants ou exploitables

**B1. `StartGame` mute sa propre commande (`cmd.map`) — format de replay corrompu**
`packages/engine/src/core/engine.ts:505` + `adventure/triggers.ts` — `draft.map = cmd.map`
**sans copie** (contrairement à `towns`/`growthGroups`). Immer ne proxifie pas un objet
fraîchement assigné au draft : `fireDayTriggers` écrit `trig.fired = true` **dans l'objet
de l'appelant**, puis l'`autoFreeze` gèle `cmd.map`. Prouvé par test : après
`apply(StartGame)`, `cmd.map.triggers[0].fired === true` et `Object.isFrozen(cmd.map)`.
Or la commande EST le format de replay (doc 07 §3) et le backend re-simule le journal
(doc 15) : re-simulation divergente (trigger jour 1 déjà consommé), carte de scénario
en cache pré-consommée côté client.

**B2. Marché : boucle d'échange auto-rentable dès 6 marchés — duplication infinie de ressources**
`packages/engine/src/town/market.ts:48` + `data/core/config.json` — `tradeQuote` ne
rejette que `gold↔gold`. Le troc passe par `sellRate × factor² / buyRate` = `f²/2` :
avec `perMarketBonus 0.1` / `maxMarketFactor 2`, ratio > 1 dès f ≥ 1.42 (6 marchés →
1.125, 11 → 2). Deux vecteurs : échange d'une ressource **contre elle-même**
(`give === receive`, non interdit) ET aller-retour `bois→or→bois` (même ratio).
Aucune limite d'échanges par tour ⇒ ressources puis or illimités en boucle de commandes.

**B3. Softlock : sauvegarde prise pendant un relais IA → partie figée à jamais au chargement**
`packages/client/src/app/autosave.ts:12` + `dispatch.ts:158` + `save.ts:108` —
l'autosave écrit le slot `auto` à **chaque** `TurnEnded`, y compris ceux émis par les
`AiTurn` (chaque tour IA se conclut par un `EndTurn` moteur). `restoreSavedGame` fait
`setState` + `GameLoaded` mais ne relance **jamais** `runAiLoop` (privé à `dispatch.ts`).
Charger une sauvegarde où `currentPlayer` est une IA (fermeture d'onglet pendant le
relais, ou simple « Continuer » après un « Fin de tour ») ⇒ toutes les entrées humaines
ignorées, aucun recours. Le save manuel pendant le relais produit le même état.

### P1 — moteur

**B4. Ledger de pertes jamais décrémenté à la résurrection — sur-résurrection au-delà de l'effectif initial**
`combat/state-helpers.ts:369` (`recordLoss` addition seule) + `spell-effect.ts` /
`damage.ts` (lifeDrain) / `death.ts` (rebirth). Le plafond `maxCount = count + lostSoFar`
compte **deux fois** une créature ressuscitée puis retuée : pile de 10 → 15 possibles,
surplus conservé après combat. Effets dérivés : XP et Nécromancie gonflés (pertes
re-tuées comptées 2×), `tryRebirth` indexé par `(side, unitId)` agrège les pertes d'une
autre pile du même type, bilan de fin de combat faux.

**B5. `raiseUndeadOnVictory` lit les pertes du camp `'defender'` en dur — faux quand le vainqueur est défenseur (H-VS-H)** *(confirmé indépendamment par 2 passes)*
`faction/effects.ts:146` appelé depuis `combat/turns.ts:272`. En victoire défensive
héros-vs-héros, la Nécromancie compte **ses propres pertes** au lieu de celles de
l'attaquant vaincu : un nécro tout-mort-vivant ne relève rien. À trancher au passage :
`gainFactionResourceOnVictory` accordé au défenseur-vainqueur alors que
`faction/types.ts:29` dit « en tant qu'attaquant ».

**B6. Obstacles aléatoires sur la porte du rempart — siège insoluble, `MAX_AI_ITERATIONS` en auto-combat**
`combat/setup.ts:147` — `drawObstacles` tire dans les colonnes 3..11, qui incluent
`SIEGE_WALL_COL = 11` (porte = rangées 4-5). Deux obstacles sur la porte ⇒ aucune unité
terrestre attaquante ne franchit jamais le rempart : partie humaine bloquée (seule issue
la fuite), `AutoCombat`/IA-vs-IA jette après 20 000 itérations. ~0,25 % des sièges.

**B7. IA : capturer une ville sans garnison mais Fort ≥ 3 ouvre un siège jamais résolu — tour IA orphelin**
`ai/adventure.ts:213/288` vs `town/capture.ts:81`. `pickAdjacentCapturableTown` ne teste
que la garnison alors que `handleCaptureTown` déclenche aussi un siège si tour de tir
(fort ≥ 3). Contrairement au chemin de déplacement, `captureTown` n'auto-résout pas :
`AiTurn` sort par la garde `if (draft.combat) return` **sans `EndTurn`**, `runAiLoop`
s'arrête sur `game.combat` → combat IA laissé à l'écran du joueur humain.

**B8. Siège repoussé : la tour de tir (`arrow-tower`) est réécrite dans la garnison de la ville**
`combat/turns.ts:357` — la reconstruction de garnison ne filtre pas la pile de tour
injectée par `buildTowerStack` (slot 99), contrairement aux armées de héros qui filtrent
`warMachines`. Cumulatif à chaque siège repoussé ; la tour occupe un slot, est
transférable au héros, et se duplique au siège suivant.

**B9. Téléport par monolithe : tuile de sortie jamais vérifiée — deux héros superposés**
`adventure/movement.ts:96` — `hero.pos = exit.pos` sans test d'occupation. Deux héros
(même ennemis, sans combat) finissent sur la même tuile : viole l'invariant « un héros
par tuile » (occupant = premier `heroes.find`, ciblage H-VS-H, rendu).

**B10. Commandes sans contrôle de propriété/tour — triche possible en hot-seat et PvP async**
(a) `ChooseSkill`/`ChooseAttribute` (`hero/index.ts:127`) : aucun contrôle
`hero.playerId === currentPlayer` — le joueur B consomme la montée de niveau du héros
adverse en choisissant l'option la plus faible. (b) `GarrisonTransfer`
(`town/transfer.ts:16`) : pas de contrôle du joueur actif — réorganiser garnison↔héros
pendant le tour adverse. Le serveur PvP ne fait que rejouer `validate` (doc 15) : ces
trous sont exploitables en ligne.

### P1 — client & outillage

**B11. Héros ennemis invisibles sur la carte, mais révélés sous brouillard en mini-carte** *(confirmé par 2 passes)*
`scenes/adventure/AdventureScene.ts:166` ne réconcilie que `humanHeroes(game)` : les
héros IA/adverses n'ont **aucun sprite** — ils bloquent le pathfinding et déclenchent
des combats H-VS-H depuis une case visuellement vide. Symétriquement `ui/MiniMap.tsx:78`
dessine `game.heroes`/`game.towns` **sans filtre d'exploration** : fuite d'information
temps réel (grave en hot-seat).

**B12. UI de combat : mana/sorts/gating lus sur le PREMIER héros du joueur, pas le héros au combat**
`ui/combat.tsx:47`, `SpellBook.tsx:124/182/208` — `heroes.find(h => h.playerId === humanId)`
alors que le moteur résout par `combat.attackerHeroId`/`defenderHeroId`. Avec plusieurs
héros (Taverne), le grimoire affiche les sorts/mana du mauvais héros ⇒ boutons grisés à
tort ou rejets moteur en toast.

**B13. Progression de campagne corrompue : `activeChapter` non réinitialisé hors victoire**
`app/campaign.ts:137` + `ui/OutcomeOverlay.tsx:22` — perdre un chapitre (ou retourner au
menu) puis gagner une escarmouche fait avancer `chaptersDone` à tort ET capture le héros
d'escarmouche comme `heroCarry` du chapitre suivant. Aggravé : `OutcomeOverlay.backToMenu`
contourne `navigate('menu')` (seul reset de `turnAck`/`playerColors`).

**B14. `HeroSwap.giveAll` boucle sur un snapshot immuable périmé — erreur systématique, artefacts jamais transférés**
`ui/HeroSwap.tsx:45` — la boucle `while` lit `game` capturé (immuable via Immer) : elle
ne se termine que par l'exception `invalidTransfer`, le `catch` affiche une erreur et la
boucle artefacts n'est jamais atteinte.

**B15. `pointercancel` jamais géré — pan et tap définitivement cassés après une annulation tactile**
`render/camera.ts:55` + `input/pointer.ts:21` — Pixi 8 n'enregistre aucun listener DOM
`pointercancel` (vérifié dans les sources 8.19). Après rotation d'écran / notification /
palm rejection : pointeur fantôme dans `Camera.pointers` (drag traité comme pinch figé)
et compteur `onTap` jamais redescendu à 0 ⇒ **tous les taps ignorés** jusqu'au
rechargement. Violation directe du principe touch-first (§8.4).

**B16. `faction:validate` échoue à tort sur tout paquet doté de héros nommés (vérifié en exécution)**
`tools/faction-validate.ts:17` — `loadFactionPack` reçoit `coreSkills`/`coreSpells`
vides : 14 fausses erreurs sur haven (`compétence de départ inconnue 'leadership'`…),
idem necropolis/vox-arcana/sylvan-court. La commande du workflow « nouvelle faction »
(doc 06 §5.2) est inutilisable.

### P1 — performance

**F1. Scène d'aventure resynchronisée en entier (brouillard O(W×H)) à chaque `setState`, même purement UI**
`AdventureScene.ts:108` (`appStore.subscribe(() => this.sync())` sans dirty-check) +
`render/fog.ts:28`. Chaque toast (apparition ET disparition), ligne de journal, tick
`aiTurn` retessèle ~65 000 losanges × N sources de vision sur 256², plus `objects.sync`/
`towns.sync` ; `dispatch` fait 2 `setState` par commande ⇒ tout ×2. Le `Graphics` de
brouillard plein-carte n'est ni chunké ni culé (contredit le chunking de `Tilemap`).
Même schéma côté `CombatScene.sync` (recalcule `reachableHexes`+`attackableTargets` à
chaque setState quelconque).

**F2. `performStrike` : O(effectif) tirages RNG en BigInt par frappe**
`combat/damage.ts:421` + `core/rng.ts` — une pile de centaines de squelettes = des
centaines de tirages BigInt **par frappe** (BigInt ≈ 10-50× l'arithmétique double).
Point chaud dominant de l'auto-combat et des simulations IA-vs-IA.

**F3. Tout l'auto-combat s'exécute sous proxy Immer**
`core/engine.ts:124` (`produce`) englobe `runAutoCombat` (jusqu'à 20 000 itérations) :
chaque lecture/écriture du hot loop traverse les traps de Proxy (surcoût ×5-20).

**F4. Autosave : `stableStringify` (copie profonde + tri récursif) + gzip à CHAQUE tour IA**
`app/autosave.ts` + `core/serialize.ts:6` — même cause que B3 : N écritures par relais
(concurrentes sur le même slot), chacune payant le tri profond de tout l'état (65 k
tuiles terrain/route/explored × joueurs en 256²) sur le thread principal, en plein
pacing IA. `stableStringify` n'est utile qu'au hachage/golden.

### P2 — moteur (bugs)

**B17.** Double anéantissement au tick de poison : défenseur mort déclaré vainqueur, gardien réécrit à `count: 0` laissé sur la carte (combat fantôme sans fin au garde-fou d'itérations) — `combat/turns.ts:190/348`.
**B18.** Préviz de riposte incomplète vs résolution : `demonBonus`, `eliteDamagePct`, `swarm` omis (`damage.ts:848`) — viole préviz = résolution (doc 08 §2.4).
**B19.** Attaque de mêlée avec `from` dans la douve : `moatDamage` jamais appliqué (`actions.ts:454` mute `pos` sans passer par `applyMove`) — contournement systématique de la douve (joueur ET IA génèrent ces candidats).
**B20.** « Attendre » pendant un tour bonus de moral fait perdre le tour ET l'attente (`actions.ts:316/384`).
**B21.** Fuite/reddition/abandon ne réécrivent pas les survivants du gardien / de la garnison (asymétrie avec la défaite normale) — `combat/leave.ts:86`. Décision de règle à trancher + documenter.
**B22.** `UpgradeUnits` : différentiel de coût limité aux 7 ressources core — l'essence/résonance n'est jamais facturée (upgrade t8-penitent→elite : 32 essence/unité escamotées) — `town/upgrade.ts:49`.
**B23.** Récompense de contrat de chasse créditée sans le cap de ressource de faction (`town/hunt-contract.ts:74`, contourne `creditFactionResource`).
**B24.** `houseChoice` (Choixpeau) : (a) écrasable via une 2ᵉ ville (exclusivité par ville, pas par joueur) — viole « choix unique et irréversible » (doc 16 §3.1) ; (b) héros recrutés après coup naissent sans Maison — `town/build.ts:125`, `hero/recruit.ts:96`.
**B25.** Capture de ville : `sharedGrowthChoice` (et `builtToday`) hérités de l'ancien propriétaire — `town/capture.ts:86`.
**B26.** Alliances incomplètes : la capture en passant des mines/habitations ignore `areAllies` (un allié détourne le revenu de son allié) ET l'IA cible activement les mines de son coéquipier — `adventure/movement.ts:126`, `ai/adventure.ts:103`.
**B27.** Joueurs éliminés jamais sautés dans la rotation des tours (`core/engine.ts:792`) ; un humain éliminé en hot-seat est re-sollicité chaque jour pour un tour vide ; `evaluateOutcome` n'évalue que le premier humain.
**B28.** `StartGame` accepte deux sièges avec le même `startingHeroId` (deux héros vivants au même `rosterId` — invariant M-TAVERN.4 violé dès le départ) — `core/engine.ts:174`.
**B29.** Héros recruté à la Taverne : 0 PM le jour du recrutement (mana rechargée, PM oubliés — asymétrie avec `StartGame`) — `hero/recruit.ts:81`.
**B30.** IA : cible du butin `guardedBy` qu'elle ne peut pas ramasser (PM du jour gaspillés en boucle, priorité 1) — `ai/adventure.ts:95`.
**B31.** IA : triche sous brouillard — cibles/forces lues hors zone explorée (`pickResourceTarget`/`pickGuardianTarget`/`pickEnemyHeroTarget` n'utilisent jamais `player.explored`). Décision : filtrer OU documenter la triche assumée.
**B32.** Changelog de `CURRENT_SAVE_VERSION` désynchronisé : v29 non documentée, doc 07 dit « 22 », CLAUDE.md « 8 » (violation §8.6).
**B33.** *(latent)* `placeSide` : collision de spawn dès 11 piles d'un camp (`setup.ts:22`) — inatteignable aujourd'hui (max 9), aucun garde-fou le jour où une machine est ajoutée en données.

### P2 — client (bugs)

**B34.** Hot-seat : le brouillard du joueur suivant transparaît sous l'overlay « passez l'appareil » (voile 60 %, fog resynchronisé dès `EndTurn` alors que la caméra attend `turnAck`) — `AdventureScene.ts:156`, `ui/HandoffOverlay.tsx:30`.
**B35.** État narratif non réinitialisé entre modes : barks/quêtes/journal de l'ancienne campagne rejoués en « Nouvelle partie »/« Continuer » — `main.ts:248`, `app/narrative.ts:20`.
**B36.** Rejets non catchés dans `handleTap` (MoveHero/CaptureTown) : unhandled rejections muettes ; `tryCaptureTownAt` cible même une ville alliée (rejet moteur avalé, zéro feedback) — `AdventureScene.ts:109/312/396`.
**B37.** Réglages non persistés : `fontScale` (engagement a11y du MVP) et `confirmEndTurn` perdus à chaque rechargement — `ui/OptionsPanel.tsx:38`.
**B38.** Popups dégâts/kills affichés sur l'ATTAQUANT et fondu de mort escamoté sur le coup fatal (`syncStacks` détruit le jeton avant que la file d'animations ne le traite) — `CombatScene.ts:288/861/1001`.
**B39.** Historique navigateur : une entrée pour deux modales (retour Android quitte la page), entrée fantôme après fermeture au bouton × — `ui/shell.tsx:167`.
**B40.** Grimoire héros : cibles mortes/furtives non filtrées (parité avec `UnitSpellModal` absente) — `ui/SpellBook.tsx:263`.
**B41.** Tours IA gelés quand l'onglet est masqué (`yieldToPaint` = rAF pur) — `app/dispatch.ts:119`.
**B42.** `pullCloudSave` : issue `notStarted` affichée « incompatible » — `ui/OptionsPanel.tsx:91`.
**B43.** Habitation capturée : drapeau de propriétaire recouvert par le sprite chargé en async (`withMapProp` ajoute en dernier enfant) — `render/mapObjects.ts:284`.
**B44.** Tri de profondeur du héros figé sur la case d'ARRIVÉE pendant le tween de déplacement (passe derrière/devant les props en chemin) — `AdventureScene.ts:204`.
**B45.** `AdventureScene.destroy({texture: true})` détruit des textures PARTAGÉES du cache `Assets` (état invalide servi à la partie suivante ; `CombatScene` fait correct) — `AdventureScene.ts:152`.
**B46.** Service worker : (a) skew code neuf / JSON de contenu périmés (stale-while-revalidate) pendant toute la 1ʳᵉ session post-déploiement — paquets rejetés par Zod ; (b) cache `heroes-cache-v1` jamais versionné ni élagué (croissance non bornée) ; (c) `networkFirst` sert un 404/500 transitoire au lieu du repli cache — `data/sw.js:6/27/47/65`.

### P2 — contenu & validation (latents, données actuelles saines — vérifié par script)

**B47.** `content:check` ne passe pas `knownArtifactIds` à `loadMap` : un artefact inconnu passerait la CI puis casserait au boot du client (garde-fou inversé) — `tools/content-check.ts:118`.
**B48.** Références non cross-validées : `visitable.effect.spellId/skillId/machineId`, `town.garrison[].unitId`, tout le contenu de `scenario.quests` (récompenses, dialogues, cutscenes) — un typo passe la validation et casse en jeu (`hero.spells.push(id)` sans lookup) — `content/loader.ts:1037/1195`.
**B49.** Prérequis de bâtiments : aucune détection de cycle (`A requiert B, B requiert A` = contenu mort silencieux) — `content/loader.ts:599`.

### P2 — performance

**F5.** `advanceHeroAlongPath` : ~6 balayages linéaires de `map.objects` par pas, sous proxys Immer (O(pas × objets), cartes ≤ 256² à ~milliers d'objets, partagé humain/IA) ; `validatePath` refait les mêmes scans — `adventure/movement.ts:55-166`.
**F6.** `roamGuardians` : O(gardiens × 8 × (héros+villes+objets)) à chaque bascule de jour, dans le chemin déjà chargé d'`EndTurn` — `adventure/roam.ts:39`.
**F7.** IA d'aventure : `findPath` sans budget de PM (une cible proche inatteignable épuise l'A* de toute la composante, ~65 k tuiles) ; 3 pickers = 3 vagues d'A* par cible + recopies `[...blocked, ...guardianPos]` par appel ; `nearestUnexploredTile` = BFS pleine carte + A* pour avancer d'UN pas — `adventure/path.ts:41`, `ai/adventure.ts:227-333`.
**F8.** IA de combat : `estimateDamage` recalculé par hex d'origine (≤ 6× par cible alors qu'il n'en dépend pas), `heroAttackOf`/`heroDefenseOf` recalculés à chaque frappe — `combat/ai.ts:171-330`.
**F9.** `Tilemap` : ~65 000 sprites (+ Graphics de repli) instanciés d'un bloc au chargement sur 256², culling par simple `visible` (tout le scene-graph retenu) — `render/tilemap.ts:66`.
**F10.** `TerrainProps` : churn destroy/create de sprites à chaque frontière de chunk pendant le pan + `sortDirty` ⇒ re-tri complet de la couche entités — `render/terrainProps.ts:91`.
**F11.** Sérialisation : `stableStringify` (tri récursif) utilisé pour les sauvegardes alors que seul le hachage/golden en a besoin — `core/serialize.ts:6` (couplé à F4).

### Vérifié sain (non exhaustif, pour mémoire)

Picking iso `isoWorldToTile` = inverse exact de la projection (recalculé à la main) ;
PCG32 conforme, zéro `Math.random`/`Date.now` moteur ; A* admissible/déterministe ;
mapgen 100 % déterministe, connexité garantie ; cycle de vie des scènes (abonnements/
listeners/tickers) correct hors B45 ; `content:check` vert et **zéro incohérence dans
les données actuelles** (cross-check scripté des ids) ; garde `readSaveVersion` OK.

---

## Plan de correction (lots = PR atomiques)

### Lot 1 — P0 moteur : replay & économie `→ branche claude/fix-p0-replay-market`
1. **B1** : cloner la carte à l'embarquement de `StartGame` (`triggers`, `objects`, `road`,
   comme `towns`). → vérif : test unitaire « `apply(StartGame)` ne mute pas `cmd.map` et
   ne le gèle pas » ; re-simulation du même journal ⇒ hash identique ; golden inchangé
   (contenu d'état identique).
2. **B2** : rejeter `give === receive` dans `validateTradeResources` ET garantir
   l'aller-retour non rentable : garde-fou de contenu `sellRate × maxMarketFactor² ≤ buyRate`
   au chargement de `config` + ajuster `maxMarketFactor` 2 → 1.4 en données.
   → vérif : test « troc même ressource rejeté » + property « aucune séquence
   vente/achat n'augmente la valeur or totale » à facteur max ; doc 02 (marché) alignée.

### Lot 2 — P0 client : cycle sauvegarde / relais IA `→ claude/fix-p0-save-ai-loop`
3. **B3 + F4 (même racine)** : (a) n'autosauver qu'au retour de la main à un humain
   (une écriture par relais) ; (b) exporter la relance de boucle IA et l'appeler après
   `GameLoaded` dans `restoreSavedGame`/import/pull cloud (si `currentPlayer` est une IA).
   → vérif : test client « charger un état `currentPlayer = IA` ⇒ la boucle reprend et
   rend la main » + smoke « save/continue pendant relais IA » ; une seule écriture
   IndexedDB par relais observée.
4. **F11** : `JSON.stringify` brut pour les sauvegardes, `stableStringify` réservé au
   hachage/golden. → vérif : round-trip save/load, golden inchangé.

### Lot 3 — P1 combat `→ claude/fix-combat-p1`
5. **B4** : décrémenter le ledger des créatures relevées (résurrection/lifeDrain/rebirth)
   + indexer le plafond de rebirth par pile. → vérif : test « ressusciter → retuer →
   ressusciter ne dépasse jamais l'effectif initial » ; XP/Nécromancie comptés une fois.
6. **B5** : passer le camp perdant (`otherSide(winner)`) à `applyFactionVictoryEffects`
   (+ trancher `gainFactionResourceOnVictory` défenseur : accorder, et corriger le
   commentaire de `faction/types.ts`). → vérif : test H-VS-H victoire défensive nécro.
7. **B6** : exclure colonnes rempart/douve/porte de `drawObstacles` quand `fortLevel ≥ 1`.
   → vérif : test property « la porte n'est jamais obstruée » sur 1 000 seeds.
8. **B8** : filtrer les piles `warMachine` de la réécriture de garnison post-siège.
   → vérif : test « siège repoussé ⇒ garnison sans arrow-tower ».
9. **B17** : trancher le double anéantissement (vainqueur = camp ayant porté le coup) +
   retirer un gardien à 0 + filtrer `count > 0`. → vérif : test poison mutuel.
   Golden : re-fix possible (forme des événements), à constater.

### Lot 4 — P1 moteur aventure/commandes `→ claude/fix-engine-p1`
10. **B7** : dans `captureTown` (IA), auto-résoudre le combat ouvert (`runAutoCombat`)
    comme le fait le chemin de déplacement. → vérif : test « IA capture ville fort 3
    sans garnison ⇒ AiTurn se termine par EndTurn ».
11. **B9** : occupation de la sortie de monolithe (ennemi ⇒ combat ; allié/soi ⇒ pas de
    téléport). → vérif : test des 3 cas.
12. **B10** : contrôles `currentPlayer` sur `ChooseSkill`/`ChooseAttribute`/
    `GarrisonTransfer` (patron `validateReorderArmy`). → vérif : tests de rejet hors tour.

### Lot 5 — P1 client `→ claude/fix-client-p1` (découpable en 2 PR si gros)
13. **B11** : rendre tous les héros en vision/zone explorée du joueur actif (jeton teinté
    `playerColor`) + filtrer la mini-carte par `explored`/vision. → vérif : smoke « héros
    IA visible en zone explorée » + test hot-seat mini-carte.
14. **B12** : résoudre le héros de combat via `combat.attackerHeroId`/`defenderHeroId`
    dans `combat.tsx`/`SpellBook.tsx`. → vérif : test UI avec 2 héros.
15. **B13** : reset `activeChapter` dans `navigate('menu')` + démarrage de tout mode
    non-campagne ; `OutcomeOverlay.backToMenu` passe par `navigate()`. → vérif : test
    « défaite de chapitre puis victoire d'escarmouche ⇒ progression intacte ».
16. **B14** : `giveAll` relit `appStore.getState().game` à chaque itération, sortie
    propre, boucle artefacts atteinte. → vérif : test transfert complet piles+artefacts.
17. **B15** : listener DOM `pointercancel` purgeant `Camera.pointers`/`downId`/compteur
    tap. → vérif : test unitaire input simulant cancel ; smoke mobile.
18. **B16** : `faction-validate.ts` charge et transmet `core/spells.json`+`skills.json`.
    → vérif : `pnpm faction:validate haven|necropolis|vox-arcana|sylvan-court` vert.

### Lot 6 — Performance client (rendu) `→ claude/perf-client-render`
19. **F1** : (a) early-return de `sync()` si `game`/`selectedHeroId`/`turnAck` inchangés
    (sélecteur zustand) — idem `CombatScene` ; (b) fusionner les 2 `setState` de
    `dispatch` ; (c) brouillard chunké 16² + redraw uniquement si `explored`/`sightings`
    changent. → vérif : compteur de rebuilds en test (1 toast ⇒ 0 rebuild) ; smoke
    anti-gel existant ; profil manuel 128² avant/après consigné dans ce plan.
20. **F9 + F10** : chunks de `Tilemap` construits paresseusement (patron
    `TerrainProps.updateVisibility`) ou bakés en texture par chunk ; pool de sprites pour
    `TerrainProps`. → vérif : heap/temps de chargement mesurés sur 256², smoke inchangé.

### Lot 7 — Performance moteur `→ claude/perf-engine` (2 PR : 7a sans golden, 7b avec)
21. **7a — F5 + F6** : index `Map<tileIndex, …>` (objets, héros) construit par commande
    pour `advanceHeroAlongPath`/`validatePath` ; `Set` de tuiles occupées quotidien pour
    `roamGuardians`. Résultats identiques ⇒ golden inchangé. → vérif : golden vert sans
    re-fix + bench micro (mouvement 40 pas sur carte 256² dense) consigné.
22. **7a — F7** : `maxCost = movementPoints` dans `findPath` (équivalent en décision :
    les chemins au-delà du budget sont déjà rejetés par `totalPathCost`) ; mutualiser un
    Dijkstra borné par héros IA ; suivre le chemin d'exploration complet au lieu d'un pas.
    ⚠ tout écart de décision IA casse le golden — si le Dijkstra change l'ordre des
    choix, basculer ce point en 7b. → vérif : golden + property « IA vs IA se termine »
    + durée d'`AiTurn` mesurée.
23. **7a — F8** : mémoïser `estimateDamage` par cible dans `chooseAction` (le résultat ne
    dépend pas de `from`) + `heroAttackOf`/`heroDefenseOf` par camp et par combat.
    → vérif : golden inchangé (mêmes décisions), bench auto-combat.
24. **7b — F2 + F3** *(golden re-fixé une fois, à annoncer avant merge)* : plafonner les
    jets de dégâts par frappe (patron HoMM : `min(count, 10)` jets × échelle) et/ou PCG32
    en arithmétique 32 bits (`Math.imul`) ; sortir le sous-arbre combat du draft Immer
    pour `AutoCombat`/`AiTurn` (clone plat entrée/sortie). → vérif : distribution des
    dégâts testée (bornes min/max préservées), re-fix golden documenté, bench
    auto-combat/IA-vs-IA avant/après consigné.

### Lot 8 — P2 moteur (règles) `→ claude/fix-engine-p2` (découpable)
25. **B19** (douve sur `applyAttack`), **B20** (wait en tour bonus), **B18** (préviz
    riposte complète), **B22** (coût d'upgrade = union des clés), **B23** (cap contrat de
    chasse), **B25** (`sharedGrowthChoice` reset à la capture), **B28** (doublon
    `startingHeroId` rejeté), **B29** (PM du héros recruté = `heroDailyMovement`),
    **B27** (rotation saute les éliminés + `evaluateOutcome` multi-humains).
    → vérif : un test unitaire par point ; golden à surveiller (B27/B29 changent des états).
26. **Décisions de design à trancher PENDANT le lot** (doc mise à jour dans le même
    commit, §8.6) : **B21** (la fuite réécrit-elle les survivants du gardien ?
    recommandation : oui, symétrie avec la défaite), **B24** (Choixpeau : verrou par
    joueur + héritage aux recrues — recommandation : les deux), **B26** (alliés :
    mines/habitations non capturables entre alliés + IA alignée), **B31** (IA &
    brouillard : recommandation : filtrer par `explored`, c'est le contrat annoncé),
    **B30** (IA ignore le butin gardé), **B32** (changelog v29 + doc 07 + CLAUDE.md).

### Lot 9 — P2 client (UX/robustesse) `→ claude/fix-client-p2` (découpable)
27. **B34** (voile de handoff opaque ou fog gelé jusqu'à `turnAck`), **B35** (purge
    narrative/quêtes/journal au démarrage de partie — point commun), **B36** (try/catch +
    toast dans `handleTap`, exclure alliés de `tryCaptureTownAt`), **B37** (persister
    `fontScale`/`confirmEndTurn`), **B38** (différer la destruction des jetons morts à
    `animateDeath`), **B39** (une entrée d'historique par modale + back compensatoire),
    **B40** (filtre cibles du grimoire = `UnitSpellModal`), **B41** (repli `setTimeout` si
    `document.hidden`), **B42** (3 messages `pullCloudSave`), **B43** (`addChildAt(sprite,
    0)` dans `withMapProp`), **B44** (zIndex interpolé dans `tweenTo`), **B45**
    (`destroy({children:true})` sans `texture`).
    → vérif : test unitaire ou smoke ciblé par point (skill test-authoring : niveau le
    moins cher qui couvre).

### Lot 10 — Contenu/validation & PWA `→ claude/fix-content-validation`
28. **B47** (passer `knownArtifactIds`), **B48** (cross-valider visitable/garnisons/
    quêtes/dialogues), **B49** (DFS anti-cycles de prérequis). → vérif : fixtures
    invalides rejetées par `content:check`, données actuelles toujours vertes.
29. **B46** : version de cache injectée au build + purge à l'`activate`, network-first
    sur les JSON de contenu, repli cache si `!fresh.ok`. → vérif : smoke offline existant
    + scénario « déploiement ⇒ pas de mélange code/données ».
30. **B33** : garde-fou `placeSide` (assert ou étalement) — 3 lignes, avec ce lot.

### Ordre recommandé & dépendances
- **Lots 1–2 d'abord** (P0 ; le lot 2 ferme aussi F4/F11).
- Lots 3, 4, 5 indépendants entre eux — parallélisables.
- Lot 7b (golden re-fixé) **isolé et en dernier du volet moteur**, pour ne pas masquer
  une régression des lots 3/4/8 sous un re-fix.
- Lots 8/9 découpables librement ; chaque décision de design de l'étape 26 met à jour la
  doc `docs/0X-*.md` concernée dans le même commit.

### Suivi
- [x] Lot 1 — P0 replay & marché (B1, B2). Livré : B1 = `structuredClone(cmd.map)`
  à `StartGame` + test d'immutabilité/re-simulation (`triggers.test.ts`) ; B2 =
  rejet `give === receive` (helper + validate), garde-fou de schéma
  `sellRate × maxMarketFactor² ≤ buyRate`, `maxMarketFactor` 2 → 1.4 en données,
  tests moteur (troc même-ressource, property aller-retour jamais rentable aux
  valeurs livrées) + test de schéma contenu, doc 02 alignée. Golden inchangé.
  Écart vs plan : néant. Noté au passage (hors lot) : `cmd.quests` partage
  l'aliasing de B1 mais sans mutation dans le même `produce` (copy-on-write
  Immer ensuite) — seul l'autoFreeze gèle l'objet appelant ; à traiter si un
  jour des quêtes s'évaluent pendant `StartGame`.
- [x] Lot 2 — P0 save/relais IA (B3, F4, F11). Livré : autosave gaté sur
  « la main revient à un humain » (une écriture par relais, plus de snapshot
  `currentPlayer = IA` produit par l'autosave) ; `installAiResume()` — tout
  `GameLoaded` (restore/import/cloud) relance la boucle IA si la main est à
  une IA (guérit aussi les sauvegardes existantes) ; `serializeState` =
  `JSON.stringify` brut, `stableStringify` réservé à `hashState` (golden
  inchangé). Couverture : hook de test `importAiTurnSave` + smoke desktop
  « sauvegarde dont la main est à une IA ⇒ la boucle reprend » ; smokes
  autosave/save-load existants verts. Écart vs plan : la relance passe par un
  listener `GameLoaded` (installé au bootstrap) plutôt qu'un appel direct dans
  `restoreSavedGame` — évite un import circulaire save ↔ dispatch et couvre
  les trois chemins de chargement d'un coup.
- [x] Lot 3 — P1 combat (B4–B6, B8, B17). Livré : **B4** — ledger double
  (agrégé `_losses` + par pile `_stackLosses`), `recordLoss(combat, stack, n)`
  + `recordRevive` décrémentant les deux à toute relève (soin/Prière,
  lifeDrain, devourMarks, rebirth) ; plafonds de résurrection ET de
  renaissance désormais INTRA-pile (le doc « intra-pile » devient vrai) ;
  préviz `estimateHeroRally` alignée. **B5** — `applyFactionVictoryEffects`
  prend `loserSide` (= `otherSide(winner)` en H-VS-H) ; décision : le gain de
  ressource de faction reste accordé au défenseur-vainqueur, commentaire de
  `faction/types.ts` corrigé. **B6** — `drawObstacles(maxCol)` : en siège avec
  Fort, obstacles strictement à gauche de la douve (plus jamais sur la porte).
  **B8** — la réécriture de garnison post-siège exclut les piles `warMachine`.
  **B17** — décision : anéantissement mutuel ⇒ défenseur déclaré vainqueur
  (convention documentée en code), mais gardien à 0 RETIRÉ de la carte (plus
  de combat fantôme insoluble) ; somme des survivants filtrée `count > 0`.
  Tests : 5 nouveaux cas (par bug) + 1 property 100 seeds « porte jamais
  condamnée » ; anciens tests re-signés (`recordLoss` par pile). Golden
  INCHANGÉ (aucun siège à Fort dans le replay). Écart vs plan : B17 tranché
  « défenseur vainqueur + retrait du gardien » plutôt que « vainqueur = camp
  ayant porté le coup » (ambigu sous tick de poison simultané).
- [x] Lot 4 — P1 aventure/commandes (B7, B9, B10). Livré : **B7** —
  `captureTown` (IA) auto-résout le siège ouvert (`runAutoCombat`), le contrat
  « AiTurn = tour complet » tient même contre une ville tour-défendue à
  garnison vide. **B9** — occupation de la sortie de monolithe : ennemi ⇒
  combat d'interception à travers le portail (le héros reste sur l'entrée) ;
  allié/soi ⇒ passage bloqué, déplacement interrompu. **B10** — contrôles
  `currentPlayer` sur `ChooseSkill`/`ChooseAttribute` (`notYourHero`) et
  `GarrisonTransfer` (`notYourTown`). Tests : 1 cas B7 (IA vs ville Fort 3
  vide), 2 cas B9 (ennemi/allié), 3 cas B10 (rejets hors tour) ; fixtures de
  tests existantes dotées du joueur propriétaire (états réalistes). Golden
  inchangé, moteur 758/758, smoke @core 19/19 (lot moteur pur — suite
  complète au merge sur main).
- [x] Lot 5 — P1 client (B11–B16). Livré : **B11** — écart constaté : la
  moitié « carte » (héros adverses rendus en vision, `isHeroVisibleOnMap` +
  hook smoke `renderedHeroIds`) avait été corrigée sur main entre la revue et
  ce lot ; restait la MINI-CARTE — pastilles de villes filtrées par
  `explored`, héros par le même `isHeroVisibleOnMap`, sources de vision
  extraites en helper partagé `visionSightings` (scène + mini-carte, leçon
  CL9). **B12** — l'UI de combat (mana/grimoire/gating) résout le héros LIÉ
  au combat (`attackerHeroId`/`defenderHeroId` selon `playerSide`, comme le
  moteur) ; arène ⇒ boutons héros cachés. **B13** — `navigate('menu')` remet
  aussi `activeChapter: null` ; `OutcomeOverlay.backToMenu` passe par
  `navigate()` (fin des résidus `turnAck`/`playerColors`/campagne). **B14** —
  `HeroSwap.giveAll` relit `appStore.getState()` à chaque itération (piles ET
  artefacts transférés, plus d'erreur systématique). **B15** — listener DOM
  `pointercancel` (Pixi 8 ne le délivre pas) purgeant `Camera.pointers` et
  les compteurs tap/appui long. **B16** — `faction:validate` charge et passe
  `core/spells.json` + `core/skills.json` ; vérifié en exécution : les 7
  paquets valident. Couverture : smoke UX-HEROSWAP étendu à « Tout donner »
  (B14) ; B12/B13/B15 et la mini-carte vérifiés par typecheck + suite smoke
  complète (pas de smoke dédié — mise en scène multi-héros/pointercancel/
  2 parties complètes disproportionnée, dit explicitement §7).
- [x] Lot 6 — perf rendu (F1, F9, F10). Livré : **F1** — (a) dirty-check des
  `sync()` des deux scènes (Adventure : refs `game`/`selectedHeroId`/`turnAck` ;
  Combat : refs `game`/`combatSpellTarget` — les changements de sélection
  internes appellent déjà `redrawBoard()` directement) ⇒ un toast/tick aiTurn
  ne resynchronise plus rien ; (b) `dispatch` fait UN setState par commande
  (fusion des flags pré-combat/bilan avec `game`) ; (c) brouillard : mémo
  (référence `explored` + contenu `sightings`) — plus de retessellation
  O(W×H) hors mouvement — ET découpage en chunks 16² culés au viewport
  (`fog.updateVisibility` branché sur `cullTilemap`). **F9** — chunks de
  `Tilemap` construits paresseusement à leur première entrée dans le viewport
  sur les grandes cartes culées (patron `TerrainProps`) ; petites cartes
  inchangées (aplaties en une texture). **F10** — pool de sprites pour
  `TerrainProps` (plus de destroy/create par frontière de chunk en pan).
  Mesure : smoke @perf (carte ×4 throttlée, rendu logiciel CI) **7,9 → 10,8
  fps** (+37 %). Vérif : @core 19/19, @perf 2/2, suite complète verte.
- [x] Lot 7a — perf moteur sans golden (F5–F8). Livré (uniquement les
  optimisations NEUTRES en décision — golden vert sans re-fix) : **F5** —
  index par tuile (objets/héros/villes + Set d'ids pour `guardedBy`)
  construits une fois par commande dans `advanceHeroAlongPath`, tenus à jour
  au ramassage ; buckets en ordre de tableau ⇒ mêmes départages. **F6** —
  `roamGuardians` : occupation précalculée en COMPTEURS par tuile (pas un
  Set : deux objets peuvent partager une tuile), mise à jour au fil des pas.
  **F7** — `findPath(maxCost)` : l'A* abandonne les nœuds au-delà du budget
  de PM — passé par les 3 pickers IA (qui rejettent déjà cost > PM ⇒
  équivalent en décision) ; une cible proche inatteignable n'épuise plus la
  composante. **F8** — `estimateDamage` mémoïsé PAR CIBLE dans le choix
  d'action (le résultat ne dépend pas de `from`). **Bench consigné** (carte
  200², ~2 300 objets, 10 répétitions) : mouvement 150 pas **13 979 → 507 ms
  (×27,6)** ; `roamGuardians` **203 → 121 ms**. Écarts vs plan : Dijkstra
  mutualisé + « suivre le chemin d'exploration complet » NON retenus en 7a
  (chemins optimaux à égalité pouvant différer ⇒ écarts de décision ⇒ golden)
  — reportés en 7b si souhaité ; mémo `heroAttackOf`/`heroDefenseOf`
  (résolution, pas préviz) aussi laissé à 7b. `validatePath` non indexé
  (une passe par commande humaine, hors boucle IA). Golden inchangé,
  758/758, @core 19/19.
- [ ] Lot 7b — perf moteur avec re-fix golden (F2, F3)
- [ ] Lot 8 — P2 moteur + décisions design (B18–B32)
- [ ] Lot 9 — P2 client (B34–B45)
- [ ] Lot 10 — contenu/validation & PWA (B33, B46–B49)
