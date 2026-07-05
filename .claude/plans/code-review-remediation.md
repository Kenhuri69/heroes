# Plan — Remédiation de la revue de code globale (post-4.6)

> **Statut : plan seul — aucune correction appliquée dans ce lot.**
> Revue complète du code produit (Phases 2.0 → 4.6) réalisée le 2026-07-05 sur
> `main` (`ab5ee82`), en quatre passes parallèles : moteur (`packages/engine`,
> 44 fichiers lus), client (`packages/client`, ~5 000 lignes lues),
> contenu/données/CLI (`packages/content`, `packages/tools`, `data/`),
> et transversal (CI, smoke, config monorepo, cohérence docs ↔ code).
> Chaque constat cite fichier:ligne et a été vérifié dans le code ; les deux
> constats critiques du pipeline de contenu ont été **reproduits à l'exécution**.

## Verdict d'ensemble

Le dépôt est en très bon état d'hygiène : `pnpm -r typecheck` 4/4,
`pnpm -r test` **188/188 (engine) + 58/58 (content)**, lint OK,
`content:check` OK, bundle **~195 Ko gzip** (plafond 800 Ko, marge ×4),
**0** TODO/FIXME/`any`/`@ts-ignore`, invariants §8 tenus dans le code
(zéro faction dans le moteur, zéro `Math.random`/`Date.now`, zéro import
rendu, TS strict renforcé). Les problèmes trouvés sont réels mais ciblés :
**5 critiques, ~19 majeurs**, regroupés ci-dessous en 8 lots de remédiation
ordonnés, plus un volet de cadrage du chantier UX/ergonomie (non commencé,
assumé au stade MVP) avec les skills à activer.

---

## 1. Constats — CRITIQUES (5)

| ID | Où | Constat |
|----|----|---------|
| **E1** | `engine/src/combat/setup.ts:141-184` | `beginGuardianCombat` ne refuse pas une armée de héros **vide** (contrairement à `validateStartCombat`). Atteignable par commandes valides (`StartGame` accepte `startingArmy: []`, `GarrisonTransfer` peut vider la dernière pile, puis `MoveHero` sur un gardien) ⇒ boucle IA `defend` et **crash brut** (`Error` après 20 000 itérations dans `combat/ai.ts:247-249`), pas une `EngineError`. |
| **CL1** | `client/src/main.ts:74-98`, `scenes/AdventureScene.ts:42-57` | `AdventureScene` + `camera` créées une seule fois, **jamais détruites ni recréées** : la scène capture la carte du premier lancement (`Tilemap`, `FogOverlay`). « Retour au menu » → nouveau scénario rejoue sur l'ancien terrain. Latent (les 3 scénarios partagent `proto-01`), **garanti cassant dès la 2ᵉ carte**. En prime : `RenderTexture` des chunks et texture de fog jamais libérées, abonnement store et `onTap` jamais retirés. |
| **CL2** | `client/src/input/pointer.ts:12-43`, `scenes/CombatScene.ts:85,91-97` | `onTap` ne retourne pas de fonction de nettoyage et `CombatScene.destroy()` ne retire pas ses listeners : **3 listeners fuités sur `app.stage` à chaque combat**, chacun retenant la scène détruite. Un `tween` en cours (`:441-456`) continue d'écrire sur des `Graphics` détruits. |
| **CO1** | `tools/src/faction-validate.ts:12` | `faction:validate` appelle `loadFactionPack` **sans `coreBuildings`** ⇒ échec « bâtiment inconnu 'fort'/'townHall'… » pour **les 4 factions** (reproduit : `pnpm faction:validate haven` échoue alors que `content:check` passe). L'étape de la checklist doc 06 est inutilisable et la détection de collision avec les ids core est neutralisée. |
| **CO2** | `tools/src/faction-new.ts:17`, `content/src/loader.ts` | **Aucune unicité inter-paquets des ids d'unités** (contrairement aux bâtiments, `loader.ts:375-376`) et le scaffolder code en dur `t1-recruit`, id **déjà pris** par test-faction ⇒ collision garantie : `buildUnitCatalog` (client `game.ts:45`) et la fusion de locales écrasent silencieusement — la classe de bug corrigée en 3.7 pour `faction.name`, toujours ouverte pour les unités. |

## 2. Constats — MAJEURS (par périmètre)

### Moteur (`packages/engine`)

- **E2** — `hero/index.ts:81-101` : les créatures tuées par un **sort** ne passent
  jamais par `recordLoss` ⇒ `casualties` incomplet ⇒ **XP faussée**
  (`combat/turns.ts:129-133`), **Nécromancie sous-évaluée**
  (`faction/effects.ts:69-75`), bilan `CombatEnded` incomplet, plafond de
  soin/résurrection incohérent.
- **E3** — `town/capture.ts:13-22` + `core/engine.ts:169-171` : `CaptureTown`
  quasi sans validation (ni joueur actif, ni héros sur/adjacent à la ville,
  ni hors-combat) — contraire au principe « le moteur ne fait pas confiance
  au client ».
- **E4** — `combat/ai.ts:219`, `ai/town-ai.ts:52` : `localeCompare` sans locale
  explicite ⇒ ordre dépendant de l'ICU de l'hôte, **risque de
  non-déterminisme** des choix IA entre machines (replays, futur serveur).
- **E5** — `combat/damage.ts:182` vs `:283-284` : la résolution approxime
  « tir » différemment de la prévisualisation (`canShoot`) ⇒ pour un tireur
  `noMeleePenalty` au contact, **la prévisualisation ment** (violation
  doc 08 §2.4).
- **E6** — `core/engine.ts:335-387` vs `ai/adventure.ts:190-239` : logique
  `MoveHero` (PM, interception, ramassage, brouillard) **intégralement
  dupliquée** humain/IA — le calcul le plus sensible du moteur en double.

### Client (`packages/client`)

- **CL3** — `CombatScene.ts:255-283`, `combat.tsx:38-47`, `SpellBook.tsx:63-70`,
  `SkillChoice.tsx:15-17` : `catch {}` périmés (« moteur non implémenté »)
  qui **avalent les vraies erreurs de validation** ; `SpellBook` ferme même le
  livre comme si le sort était parti. Aucun feedback utilisateur.
- **CL4** — `shell.tsx:32` : modale de choix de compétence branchée sur
  `heroes[0]` au lieu du héros du joueur (`PLAYER_ID`) — montée de niveau
  bloquée ou choix d'un héros IA affiché si l'humain n'est pas premier.
- **CL5** — `game.ts:35` (+17 usages, + doublon `loader.ts:494` côté content) :
  `PLAYER_ID = 'player-1'` en dur, convention jamais validée — un scénario
  nommant autrement son joueur humain rend le HUD vide sans erreur.
- **CL6** — `TownScreen.tsx:194-344` : messages d'erreur moteur affichés
  **bruts** (`${err.code}: ${err.message}`), non localisés — trou dans
  l'audit i18n 3.6.
- **CL7** — `CombatScene.ts:101-111` : plateau réduit **sans borne minimale**
  ⇒ hexes ≈ 27 px sur écran 360 px, pas de pinch-zoom en combat —
  **violation touch-first** (cibles ≥ 44 px, §8.4 / doc 08 §1).
- **CL8** — `main.ts:134-140,177` : échecs de bootstrap / `startScenario` /
  `startNewGame` non catchés ⇒ **page vide silencieuse** en cas d'échec de
  fetch/validation.
- **CL9** — `TownScreen.tsx:34-71` et `CombatScene.ts:190-197,307-326` :
  règles moteur **réimplémentées côté client** (coûts scalés, prérequis de
  construction, dwellings→unités ; éligibilité d'attaque, choix de l'hex
  d'origine de mêlée) — divergence affichage/validation garantie à terme.

### Contenu / données / CLI

- **CO3** — `schemas.ts:93` : `nativeTerrain` jamais cross-checké contre
  `config.adventure.terrains` ⇒ `plains` (test-faction) et `mistmoor`
  (arcane-hunters) ne matchent jamais : **bonus de terrain natif mort pour
  2 factions sur 4** (déséquilibre silencieux ; le scaffolder propage
  `plains`).
- **CO4** — `data/core/skills.json` : compétences **sans effet** proposables à
  la montée de niveau — `wisdom` (aucun consommateur), rang 1 des 4
  `magic-*` (`spellCircleUnlock` no-op, tous les sorts déjà connus),
  `leadership` (`moraleBonus` calculé mais non branché,
  `hero/skills.ts:49-52`).
- **CO5** — locales core : **aucune clé `spell.<id>` / `skill.<id>` /
  `artifact.<id>`** alors que le client les résout (`i18n.ts:75-91`) ⇒ ids
  bruts à l'écran (« trait-de-feu », « logistics »…). Idem **CO6** pour les
  22 dwellings de faction (`building.<id>` introuvable, champ `name` du
  schéma bâtiment mort) et **CO7** `factionResource.essence` localisée dans
  les locales **core** (couplage core→faction, contraire à doc 06).
- **CO8** — `loader.ts:686-695` : validation scénario incomplète
  (`startingTown` ni en-bounds ni sur tuile franchissable ;
  `captureTown.townId` / `defeatHero.heroId` opaques) — un typo passe
  `content:check` et rend l'objectif **jamais satisfiable**.
- **CO9** — `loader.ts:159-174` : si un paquet est rejeté gracieusement mais
  que `config.newGame.startingArmy` référence une de ses unités,
  `loadContent` **throw** ⇒ une régression dans un seul paquet casse le boot
  complet.

### Transversal (CI / tests / docs)

- **T1** — `ci.yml:32-34` : garde-fou « zéro faction dans le moteur » = grep
  sur **liste d'IDs en dur** — une 5ᵉ faction ne serait pas gardée ; seuls
  `*.ts(x)` scannés ; `! grep` passe au vert aussi sur erreur grep (exit 2).
- **T2** — `package.json:15` racine : `pnpm -r --if-present test` ⇒ client et
  tools **silencieusement sautés** (zéro test unitaire client) ; un package
  qui perd son script `test` reste vert.
- **T3** — smoke : la **défaite** n'a aucune couverture (seule la victoire,
  `smoke.spec.ts:671-706`) ; le test « ville » pilote le moteur via
  `__HEROES_TEST__.dispatch()` **sans jamais cliquer les boutons** de
  `TownScreen` (`:464-510`) ; `playwright.config.ts` sans
  `forbidOnly: !!process.env.CI` ni `retries` CI.
- **T4** — **CLAUDE.md en retard de 5 lots** : annonce « 4.1 livrée » alors que
  4.2→4.6 sont mergées (#21–#25) ; mentionne le bump save 1→2 mais pas la v3
  (4.4). Divergences docs annexes : doc 06 §5 référence
  `docs/asset-conventions.md` (inexistant) et `pnpm faction:sim` (inexistant) ;
  doc 07 §4 « via `idb` » (API brute utilisée) et « journal de commandes »
  non implémenté ; 4 plans anciens avec cases méta non cochées.

## 3. Mineurs retenus (traités opportunistement dans les lots)

Moteur : rotation `EndTurn` ne saute pas les joueurs `eliminated` (3+ joueurs) ;
plafond de croissance pouvant **réduire** un stock de scénario
(`town/economy.ts:48-50`) ; `defending` retiré avant le test de skip moral
(`turns.ts:71-80`) ; sorts lançables sur son propre camp sans contrainte
(`hero/index.ts:50-52`) ; tirage RNG **par créature** en O(count)
(`damage.ts:166-169`) ; itération `Object.keys(town.buildings)` à l'ordre
non verrouillé post save/load ; IA : `maxAffordableCount` ignore les
ressources de faction ; module `town/unit-economy.ts` devenu redondant.
Client : `selectedHeroId` mort ; `hovered` d'hexgrid jamais alimenté ;
toast `building.<id>` sans repli ; victoire/défaite de toast déduite de
`winner === 'attacker'` (cassera au 1er combat défensif) ; fog reconstruit
entièrement à chaque `setState` ; `user-scalable=no` (WCAG 1.4.4) ; recette
bouton CSS copiée ~8× ; `SPEEDS` dupliqué ; 2 listeners Échap concurrents
(ferme toute la pile de modales) ; Sauvegarder/Charger sans feedback ; pan
caméra non borné. Contenu : doublons d'ids non interdits dans les index ;
2 objets de carte sur la même tuile possibles ; `abilities[].params`
sur-permissif ; `icon` arcane-hunters vers fichier inexistant ; helpers
d'unicité dupliqués dans le loader ; largeur de rangée en UTF-16 vs points
de code. CI : actions épinglées par tag (pas SHA), pas de cache Playwright,
pas de `concurrency`/`timeout-minutes` ; `__HEROES_TEST__` exposé en prod.

---

## 4. Lots de remédiation (ordonnés)

> Un lot = une PR. Chaque correctif de règle s'accompagne de son test **dans
> le même commit** (guideline §7) ; les lots touchant le client passent le
> smoke headless. Cocher ici au fil de l'eau (plan vivant, §5).

### Lot R1 — Correctifs moteur (E1–E5 + mineurs moteur associés) ✅
- [x] E1 : refuser l'engagement d'un gardien avec armée vide (validation
      `MoveHero`) → test : commande refusée en `EngineError`, jamais de crash
      brut (`r1-remediation.test.ts`).
- [x] E2 : `recordLoss` dans la branche `damage` de `handleCastSpell` → test :
      les kills par sort alimentent `collectCasualties` (XP / Nécromancie).
- [x] E3 : valider `CaptureTown` (hors combat, joueur actif, héros sur ou
      adjacent à la ville) → tests de rejet (`town-capture.test.ts`).
- [x] E4 : remplacer `localeCompare` (combat/ai.ts + ai/town-ai.ts) par une
      comparaison par unités de code → golden replay inchangé.
- [x] E5 : propager le `ranged` calculé par `applyAttack` à `performStrike`
      (champ `StrikeParams.ranged`) → test : pour un tireur `noMeleePenalty` au
      contact, résolution == `estimateDamage` (bonus mêlée, pas tir).
- [x] Mineurs traités : plafond de croissance non-réducteur, `defending` levé
      seulement quand la pile prend réellement son tour, contrainte de camp
      des sorts (dégâts/debuff/marque → adverse ; soin/buff → allié).
- [ ] **Reportés hors R1** (décision de périmètre, pas des correctifs purs) :
  - *skip des joueurs éliminés* dans la rotation `EndTurn` — interagit avec la
    bascule jour/semaine et l'économie ; mérite son propre lot + test à 3+
    joueurs (aujourd'hui sans impact : un scénario 2 joueurs se termine à
    l'élimination via `evaluateOutcome`).
  - *tirage RNG agrégé O(1)* — remplacer N tirages par créature par un seul
    change la DISTRIBUTION des dégâts (somme de N dés ≠ 1 dé) et donc
    l'équilibrage + le golden : c'est un choix de design, pas une optimisation
    neutre. Le modèle « 1 dé par créature » est le modèle HoMM fidèle ; conservé.
- Vérif : `pnpm -r test` vert (264), golden replay **inchangé** (aucun sort ni
  compétence dans son combat, branches de skip jamais atteintes), garde-fou
  faction vert, lint + build + 40 smoke verts.

### Lot R2 — Cycle de vie & canal d'erreurs client (CL1, CL2, CL3, CL6, CL8)
> **R2a livré** (CL1 + CL2 + CL8 — cycle de vie & sûreté au crash). Restent
> CL3 (`catch {}` périmés qui avalent les erreurs de validation) et CL6
> (erreurs moteur brutes/non localisées) → **R2b (canal d'erreurs)**.
- [x] `AdventureScene.destroy()` (unsubscribe store + tap, `destroy({children,
      texture})`) + `Camera.destroy()` ; `teardownScenes()` au retour menu /
      changement de carte dans `main.ts` (scène+caméra recréées à la partie
      suivante) ; gardes `destroyed` dans `sync`/`handleTap`/tween.
- [x] `onTap` retourne un unsubscribe (symétrie `eventBus.on`) ; stocké et
      appelé dans `CombatScene.destroy()` **et** `AdventureScene.destroy()` —
      plus de listeners `app.stage` fuités par scène recréée.
- [x] CL8 : `bootstrap().catch()` → bandeau d'erreur bilingue (i18n peut être
      absente) ; `startNewGame`/`startScenario` → toast i18n
      (`toast.newGameFailed`/`toast.scenarioFailed`) au lieu d'une promesse
      rejetée perdue (page muette).
- [x] **R2b** (CL3 + CL6) : `dispatch` lève une `EngineError` structurée aussi
      pour les rejets de `validate` ; helper `commandErrorMessage(err)` (i18n)
      mappe `err.detail.code` → `cmdError.<code>` (repli générique). Les `catch
      {}` périmés (combat.tsx, SpellBook, SkillChoice, CombatScene move/attack)
      surfacent désormais un toast localisé — **SpellBook garde le livre ouvert**
      sur rejet (avant : fermé comme si le sort était parti). `TownScreen`
      affiche le message localisé (CL6) au lieu de `${err.code}: ${err.message}`.
      Clés `cmdError.*` fr/en. Smoke : « fort » inabordable ⇒ bandeau ville
      localisé (« Ressources insuffisantes »).
- Vérif : smoke **menu → partie → menu → partie** (R2a) + **construction
  refusée ⇒ erreur localisée** (R2b) ; 42 smoke verts. **R2 terminé.**

### Lot R3 — Identité du joueur humain (CL4, CL5 + `ownerPlayerId` loader) ✅
- [x] Sélecteur PUR `humanPlayerId(state)` dans le moteur (dérive du contrôleur
      `'human'`, `null` si aucun) ; exporté, testé (humain nommé 'blue' ≠
      player-1 → dérivé correctement ; IA-vs-IA → null). Client : helper
      `humanId(game)` (repli `PLAYER_ID` hors partie) ; **17 usages en dur
      remplacés** (combat.tsx, shell.tsx ×6, TownScreen, AdventureScene ×3).
- [x] CL4 : la modale de compétence vise `heroes.find(h => h.playerId ===
      humanId && pendingSkillChoices.length > 0)` (avant : `heroes[0]`, qui
      pouvait être un héros IA).
- [ ] **Reporté** : le doublon `loader.ts:494` (`ownerPlayerId: 'player-1'`
      dans `resolveStartingTowns`) est propre à la NOUVELLE PARTIE (dont
      l'humain est toujours `player-1`, cf. `newGameCommand`/game.ts:165) — il
      est correct, pas un bug ; le centraliser est un refactor cosmétique
      différé (aucun changement de comportement).
- Vérif : sélecteur testé (moteur, 210 tests) ; les 3 scénarios livrés
  (humain = `player-1`) ⇒ `humanId` renvoie `player-1` ⇒ **zéro régression**
  (42 smoke verts). Un scénario dont l'humain n'est pas `player-1` ni premier
  héros → HUD complet, montée de niveau fonctionnelle.

### Lot R4 — i18n contenu (CO5, CO6, CO7 + replis toasts)
> **R4a livré** (CO5 — noms sort/compétence/artefact). Restent CO6 (noms de
> bâtiments/dwellings via locales de paquet) et CO7 (`factionResource.essence`
> à déplacer dans le paquet) → **R4b**.
- [x] CO5 : 28 clés `spell.*`/`skill.*`/`artifact.*` fr **et** en dans les
      locales core (sorts/compétences/artefacts affichaient leur id brut).
      `content:check` étendu : `checkCoreNameKeys(report)` exige la présence
      fr+en pour tout sort/compétence/artefact chargé (testé). Smoke : le livre
      de sorts affiche « Éclair magique » (pas `eclair-magique`).
- [x] **R4b** (CO6 + CO7) : résolveurs `resolveBuildingName`/
      `resolveFactionResourceName` (i18n.ts) qui retombent sur les locales de
      PAQUET après le core (`resolveCoreOrPack`) ; 6 bâtiments communs nommés
      (core), 27 dwellings/Cercles nommés dans les locales de paquet (dérivés
      du nom d'unité + noms de Cercles) ; `factionResource.essence` déplacé
      core → paquet arcane-hunters (découplage doc 06). `content:check` étendu :
      `checkCoreNameKeys` couvre les bâtiments communs, nouveau
      `checkPackNameKeys` exige `building.<id>` + `factionResource.<id>` fr+en
      par paquet (2 tests). **Décision** : clés `building.<id>` (pas le champ
      `name` du schéma, laissé optionnel inutilisé — l'`Omit` moteur l'empêche
      d'atteindre le client). Smoke : l'onglet Construire affiche « Guilde des
      mages ».
- Vérif : audit « 0 id brut à l'écran » (content:check exhaustif + smoke sort
  « Éclair magique » + smoke ville « Guilde des mages »). **R4 terminé.**

### Lot R5 — Pipeline contenu & CLI (CO1, CO2, CO3, CO4, CO8, CO9)
> **R5a livré** (CO1 + CO2, outillage faction cassé). **R5b livré** (CO3 + CO8,
> complétude de validation contenu). Restent **CO4** (compétences sans effet →
> lot « skills » dédié, reprend aussi la dette Commandement/moral) et **CO9**
> (résilience au boot) — lot suivant.
- [x] CO1 : `faction:validate` charge `core/buildings.json` → les 4 factions
      passent (vérifié CLI) ; régression au niveau `loadFactionPack`
      (avec/sans `coreBuildings`) dans `loader.test.ts`.
- [x] CO2 : unicité GLOBALE des `unit.id` entre paquets dans `loadContent`
      (throw `PackError` listant les doublons) ; scaffolder `faction:new` →
      `t1-<id>-recruit` (plus de collision avec le paquet de test) ; test de
      collision inter-paquets + scaffold→validate vérifié.
- [x] CO3 : cross-check `nativeTerrain ∈ config.adventure.terrains` dans
      `loadContent` (throw) ; données corrigées — test-faction `plains`→`grass`,
      arcane-hunters `mistmoor`→`swamp` (réalise « lande brumeuse » ; doc 05
      annotée) ; défaut du scaffolder `plains`→`grass`. **Impact équilibrage** :
      les unités arcane-hunters gagnent enfin +1 vitesse / +1 moral sur tuile
      `swamp` (comme Necropolis) ; test-faction sur `grass` — bonus auparavant
      morts. Test loader du rejet.
- [x] CO4 (lot « skills » dédié) : **Commandement/`leadership` branché** au
      moral de pile (`moraleOf` prend l'état, ajoute `heroMorale` du héros du
      camp) — dette de la session résorbée ; **`wisdom` retirée du pool** (effet
      `learnCircle` sans consommateur, apprentissage de sorts différé) ; les 4
      `magic-*` donnent un effet réel **dès le rang 1** (−5/10/20 % coût mana ;
      `spellCircleUnlock` no-op retiré des données) ; doc 02 §1.3 mise à jour
      (même commit). Golden inchangé (héros du golden sans compétence). Tests :
      Commandement rang 2 → +2 moral de pile.
- [x] CO8 : `loadScenario` valide la ville de départ (bounds + tuile
      franchissable) et les objectifs opaques (`captureTown.townId` ∈ villes du
      scénario, `defeatHero.heroId` ∈ `hero-<playerId>`). 4 tests de rejet.
- [x] CO9 : les règles croisées de `config.newGame` (armée/artefacts/ville de
      départ) sont **rapportées** dans `LoadReport.configErrors`, plus levées —
      un paquet rejeté gracieusement ne casse plus tout le boot (menu + contenu
      valide restent chargeables ; « Nouvelle partie » échoue proprement au
      moteur). `content:check` échoue toujours dessus (CI). 3 tests loader.
- Vérif : `content:check` + tests loader/scénario couvrant chaque nouveau rejet.
- **R5 terminé.**

### Lot R6 — Durcissement CI & tests (T1, T2, T3) ✅
- [x] Garde-fou faction : motif dérivé de `data/factions/index.json`
      (`jq -r '.factions | map("\b"+.+"\b") | join("|")'`), extensions
      élargies (`.js/.cjs/.mjs/.json` en plus de `.ts(x)`,
      `--exclude-dir=dist,node_modules`), et **gestion explicite du code retour
      grep** : 0 = id trouvé ⇒ `exit 1`, 1 = propre ⇒ succès, >1 = erreur
      d'exécution ⇒ `exit 1` (le `! grep` d'origine passait au vert sur erreur).
- [x] Remplacer `--if-present` par la liste explicite
      (`--filter @heroes/engine --filter @heroes/content`) : un package testé
      qui perd son script `test` fait désormais échouer la CI au lieu d'être
      sauté silencieusement. Socle de tests client **différé au lot R7** (il
      dépend des helpers purs à extraire ; le client n'a pas encore de logique
      pure isolée à tester unitairement).
- [x] `forbidOnly: !!process.env.CI` + `retries: process.env.CI ? 2 : 0` dans
      `playwright.config.ts`.
- **Différé** : smoke **défaite** (overlay + retour menu) — nécessite un
  scénario perdant dédié ; l'overlay est le composant partagé victoire/défaite
  déjà couvert côté victoire (`smoke.spec.ts:699`), le gain de couverture ne
  justifie pas un scénario bespoke dans ce lot d'outillage. Reporté au chantier
  UX/scénarios. Écran de ville **par les boutons** : déjà couvert depuis R2b
  (clic « Construire » → toast d'erreur, `smoke.spec.ts:521`) et R4b (assertion
  sur `town-panel-build`) — la préoccupation T3 « piloté sans cliquer » ne tient
  plus.
- Vérif : garde faction testée localement (arbre propre ⇒ statut 1/succès ;
  `const x='haven'` injecté dans `packages/engine/` ⇒ statut 0/échec, puis
  nettoyé) ; `pnpm test` explicite lance bien engine (210) + content (70) ;
  typecheck/lint/content:check/42 smoke verts.

### Lot R7 — Dette & duplication (E6, CL9 + mineurs) — scindé en a/b/c

#### R7a — E6 : helper moteur partagé `advanceHeroAlongPath` ✅
- [x] Extrait dans `adventure/movement.ts` (nouveau module feuille) la boucle
      de pas d'un héros, jusqu'ici **dupliquée verbatim** entre le handler
      `MoveHero` (`core/engine.ts`, joueur humain) et l'IA d'aventure
      (`ai/adventure.ts`). Seule divergence — la résolution du combat de
      gardien — injectée via `AdvanceOptions.onGuardianEngaged` : le humain le
      laisse indéfini (combat interactif, `draft.combat` posé), l'IA y passe
      `() => runAutoCombat(draft, events)` (résolution immédiate déterministe).
- [x] Orphelins nettoyés (imports `beginGuardianCombat`/`ResourceId` dans
      `engine.ts`, `beginGuardianCombat`/`samePos`/`revealAround`/
      `heroVisionBonus`/`ResourceId` dans `ai/adventure.ts`).
- Vérif : **golden inchangé** (`golden-replay` vert, hash `be72de4b`),
  déterminisme IA vs IA vert, 210 tests moteur, lint, typecheck, 42 smoke.
  Pas de nouveau test : la boucle est déjà couverte de bout en bout par
  `golden-replay` (déplacement humain + gardien) et `ai-adventure` (pas IA).

#### R7b — CL9 : helpers purs `@heroes/engine` (à faire)
- [ ] Exposer/extraire en helpers purs : coût scalé (`scaleCost` — réconcilier
      le skip `if (amount)` du moteur vs client), statut de prérequis
      (`buildStatus`/`missingRequirements` factorisés de `validateBuildStructure`),
      dwellings→unités (`builtDwellings` liste — réconcilier multi-niveaux vs
      `builtLevelOf` top-level), `attackableTargets` (écrit 3× : validateur, IA,
      client), candidats de mêlée (`meleeOriginsFor` — garder la *politique* de
      sélection séparée : client = plus proche, IA = scoré) — consommés par
      `TownScreen`/`CombatScene`. Élargir `engine/src/index.ts` + `town/index.ts`.
- [ ] Tests unitaires directs des helpers + couverture de `combat/hex.ts`
      (aucun test dédié aujourd'hui).
- Vérif : `pnpm test` + smoke verts, golden inchangé.

#### R7c — Mineurs (à faire)
- [ ] Classe `.btn` partagée (5 boutons gris quasi identiques + variantes
      menu/rouge/active dupliquées), `SPEEDS`/`COMBAT_SPEEDS` factorisé en un
      export, hook `useEscapeKey` partagé (TownScreen + OptionsPanel — pas de
      « pile » : 2 handlers qui ne coexistent pas, over-engineering évité), code
      mort (`selectedHeroId` écrit jamais lu ; branche `hovered` de `hexgrid`
      jamais alimentée par `CombatScene`), toast victoire/défaite par
      `combat.playerSide` au lieu de `'attacker'` en dur.
      NB : `town/unit-economy.ts` **n'est pas mort** (consommé par recruit/
      economy/town-ai) — retiré de la liste.
- Vérif : smoke verts, golden inchangé.

### Lot R8 — Documentation & mémoire projet (T4)
- [ ] CLAUDE.md : état 4.2→4.6, save v3.
- [ ] doc 06 : retirer/mettre au futur `asset-conventions.md` et
      `faction:sim` ; reformuler la promesse §5.8 au niveau de ce que la CI
      fait réellement (post-R6).
- [ ] doc 07 : annoter IndexedDB brut + journal de commandes différé.
- [ ] Cocher les 4 cases méta des anciens plans.
- Vérif : relecture croisée docs ↔ code des affirmations modifiées.

**Priorités** : R1 et R5 (CO1/CO2) d'abord — crash moteur atteignable et
outillage de faction cassé ; puis R2 (fuites + erreurs silencieuses),
R3/R4, R6, R7, R8. CL7 (combat mobile < 44 px) est volontairement traité
dans le chantier UX ci-dessous (§5, U1) car il demande une vraie décision
d'interaction (zoom/pan en combat), pas un patch.

---

## 5. Chantier UX / ergonomie — cadrage & skills à activer

### 5.1 État des lieux (revue client + doc 08)

Socle sain pour un MVP : séparation canvas Pixi / UI DOM, tap-tap avec
prévisualisations obligatoires, tiroir héros mobile, modales cohérentes,
toasts `aria-live`, badges non chromatiques, 3 crans de police, i18n
structurée. Les manques structurels, dans l'ordre où ils contraindront le
redesign :

- **U1 — Combat mobile** : pas de zoom/pan en combat, hexes sous 44 px
  (constat CL7) ; « paysage recommandé » ne remplace pas une mise en page
  portrait pensée (doc 08 §2.4).
- **U2 — Routeur d'écrans** : menu ⇄ carte ⇄ combat sont des bascules ad hoc
  dans `main.ts` (cause racine de CL1/CL2) ; prérequis à tout écran futur
  (ville peinte, écran héros plein, journal, multi-héros).
- **U3 — Feedback utilisateur** : canal d'erreur unifié (lot R2) + feedback
  **positif** (sauvegarde réussie, recrutement, sélection) et **journal
  d'événements** consultable (doc 08 §3, différé au MVP).
- **U4 — Multi-héros / multi-villes** : l'UI suppose 1 héros + 1ʳᵉ ville
  (`firstOwnedTown`) ; le doc 08 §2.1 prévoit 8 portraits + liste de villes.
- **U5 — Vue de ville peinte + DA « gouache stylisée »** (doc 08 §5) : jalon
  Beta ; aujourd'hui placeholders teintés. À préparer : moodboards, palette
  et langage de formes par faction (définis dans le paquet de faction),
  spritesheets lisibles à 64 px.
- **U6 — Écrans manquants** du doc 08 : fiche héros complète (poupée typée
  par slot, transfert entre héros), marché/guilde, fin de partie avec stats
  et graphique de puissance, options daltonisme.

Méthode proposée : une passe **audit ergonomique** outillée (parcours
mobiles réels via le smoke + captures) → wireframes/maquettes → itérations
par écran, chaque écran étant son propre plan `.claude/plans/ux-<écran>.md`.
Toute décision d'interaction met à jour `docs/08-ui-ux.md` dans le même
commit (docs = source de vérité).

### 5.2 Skills / plugins à activer (constaté sur ce compte)

**Disponibles mais non activés — à activer pour le chantier UX :**

| Quoi | Type | Usage prévu |
|------|------|-------------|
| `design` | Plugin (marketplace *knowledge-work-plugins*) | Travail de design produit : critique d'écrans, principes d'ergonomie, préparation des specs UX (U1–U4, U6). |
| `figma` | Plugin (marketplace *knowledge-work-plugins*) | Si les maquettes se font dans Figma : lire/synchroniser les frames, extraire specs et mesures vers `docs/08-ui-ux.md`. |
| `canvas-design` | Skill Anthropic (claude.ai, non activée) | Production visuelle statique (PNG/PDF) : moodboards DA « gouache stylisée », explorations de palettes/langage de formes par faction, posters de référence (U5). |

**Déjà disponibles dans le harnais (rien à installer) — à mobiliser :**

- `artifact-design` + Artifacts : **maquettes HTML interactives** (wireframes
  cliquables desktop/mobile, thème clair/sombre) partageables avant
  d'implémenter — l'outil principal pour U1/U4/U6.
- `dataviz` : le graphique de puissance de l'écran de fin de partie (doc 08
  §2.5) et d'éventuels tableaux de bord d'équilibrage.
- `run` + Playwright/Chromium préinstallé : captures d'écran systématiques
  des parcours mobiles (viewport 360×640, 3 crans de police) pour l'audit U1.
- `code-review`, `simplify`, `verify`, `security-review` : boucle qualité des
  lots R1–R8.

**Skill projet à créer** (dans `.claude/skills/`, versionnée avec le dépôt) :

- [ ] `ux-audit` : checklist exécutable dérivée du doc 08 (cibles ≥ 44 px,
      parité appui long/hover, pile de modales ≤ 2, jamais couleur seule,
      prévisualisation avant action irréversible, 3 crans de police) +
      procédure de captures Playwright par écran/viewport. Elle rend l'audit
      répétable à chaque lot UX au lieu d'un one-shot.

### 5.3 Ordre suggéré du chantier UX (après R2/R3)

1. Créer la skill `ux-audit` + première passe de captures (état de référence).
2. U2 (routeur d'écrans) — technique, débloque le reste.
3. U1 (combat mobile : min-scale 44 px + pan/pinch du plateau) — corrige CL7.
4. U3 (feedback positif + journal), puis U4, U6.
5. U5 (DA / ville peinte) — jalon Beta, avec `canvas-design` + plugin `design`.

---

## Journal du plan

- **2026-07-05** — Création : revue 4 volets terminée, constats consolidés,
  lots R1–R8 définis, volet UX cadré. Aucune correction appliquée (demande
  explicite : plan seul).
- **2026-07-05** — **Lot R1 livré** : E1–E5 + 3 mineurs corrigés, chacun avec
  son test (`r1-remediation.test.ts`, +`town-capture.test.ts`). 2 mineurs
  reportés avec justification (skip éliminés = interaction rotation/économie ;
  RNG agrégé = changement d'équilibrage, non neutre). Golden inchangé
  (`be72de4b`). Vérif complète verte (264 tests, lint, content:check, build
  61,8 Ko gzip, 40 smoke). Prochain : R5 (CO1/CO2 — outillage faction) puis R2.
- **2026-07-05** — **Lot R5a livré** (CO1 + CO2, outillage faction cassé) :
  `faction:validate` charge désormais les bâtiments communs (les 4 factions
  passent, échouaient toutes), unicité globale des ids d'unités entre paquets
  (throw sur collision, même classe de bug que 3.7), scaffolder préfixe l'id
  d'unité par la faction. Tests loader CO1 + CO2 ; scaffold→validate vérifié.
  Vérif verte (266 tests, lint, content:check, build 61,9 Ko, 40 smoke, garde
  faction vert). Reste R5b : CO3 (nativeTerrain), CO4 (compétences sans effet),
  CO8 (validation scénario/startingTown), CO9 (refs vers paquet rejeté).
- **2026-07-05** — **Lot R5b livré** (CO3 + CO8) : cross-check du terrain natif
  (données arcane-hunters `mistmoor`→`swamp`, test-faction `plains`→`grass`,
  scaffolder + doc 05) et validation complète des scénarios (ville de départ
  bounds/franchissable + objectifs `captureTown`/`defeatHero` non opaques).
  +5 tests contenu (271 total). Vérif verte (lint, content:check, build
  62,2 Ko, 40 smoke, garde faction vert). Reste : CO4 → lot « skills » dédié
  (avec la dette Commandement/moral), CO9 → lot de résilience au boot.
- **2026-07-05** — **Lot R4b livré (CO6 + CO7) → R4 terminé** : noms de
  bâtiments et de ressources de faction. Résolveurs client retombant sur les
  locales de paquet ; 6 bâtiments communs + 27 dwellings/Cercles nommés ;
  `factionResource.essence` déplacé dans le paquet arcane-hunters ;
  `content:check` étendu (`checkPackNameKeys`, +2 tests). Smoke ville « Guilde
  des mages ». Vérif verte (280 tests, lint, content:check exhaustif, build,
  42 smoke, garde faction vert). **R4 complet.** Reste : R6 (CI/tests), R7
  (dette/duplication), R8 (docs) ; chantier UX §5.
- **2026-07-05** — **Lot R4a livré (CO5)** : noms localisés de contenu. 28 clés
  `spell.*`/`skill.*`/`artifact.*` fr+en (l'UI affichait les ids bruts) ;
  validateur exporté `checkCoreNameKeys` branché dans `content:check` (exige la
  parité fr+en, testé). Smoke : livre de sorts « Éclair magique ». Vérif verte
  (278 tests, lint, content:check, build, 42 smoke, garde faction vert). Reste
  R4b : CO6 (noms de bâtiments via locales de paquet) + CO7 (déplacer
  `factionResource.essence` dans le paquet).
- **2026-07-05** — **Lot R3 livré (CL4 + CL5)** : identité du joueur humain.
  Sélecteur pur `humanPlayerId(state)` (moteur, dérive du contrôleur, testé) ;
  helper client `humanId(game)` ; 17 usages `PLAYER_ID` en dur remplacés ; la
  modale de compétence vise le héros HUMAIN avec choix en attente (plus
  `heroes[0]`). Doublon `loader.ts:494` laissé (correct pour la nouvelle
  partie, refactor cosmétique différé). Golden inchangé, zéro régression
  (scénarios en `player-1`). Vérif verte (276 tests, lint, typecheck 4/4,
  content:check, build, 42 smoke, garde faction vert). Reste : R4 (i18n
  contenu), R6 (CI/tests), R7 (dette/duplication), R8 (docs) ; chantier UX §5.
- **2026-07-05** — **Lot R2b livré (CL3 + CL6) → R2 terminé** : canal
  d'erreurs client. `dispatch` lève une `EngineError` structurée aussi pour les
  rejets `validate` ; `commandErrorMessage` mappe le code → `cmdError.<code>`
  (fr/en). Les `catch {}` périmés (combat.tsx, SpellBook, SkillChoice,
  CombatScene) surfacent un toast localisé au lieu d'avaler l'erreur (SpellBook
  garde le livre ouvert sur rejet) ; `TownScreen` affiche le message localisé.
  Smoke « construction refusée ⇒ erreur localisée ». Vérif verte (274 tests,
  lint, typecheck 4/4, content:check, build, 42 smoke, garde faction vert).
  **R2 complet.** Reste : R3 (identité joueur), R4 (i18n contenu), R6 (CI/
  tests), R7 (dette/duplication), R8 (docs) ; chantier UX §5.
- **2026-07-05** — **Lot R2a livré (CL1 + CL2 + CL8)** : cycle de vie des
  scènes client. `AdventureScene`/`Camera`/`CombatScene` ont un `destroy()`
  complet (désabonnements store + tap, textures libérées) ; `main.ts` détruit
  et recrée scène+caméra au retour menu (fin de la scène « collée » à la 1ʳᵉ
  carte + fuites de listeners/RenderTexture) ; `onTap` renvoie un unsubscribe ;
  échecs bootstrap/nouvelle-partie/scénario surfacés (bandeau + toasts i18n) au
  lieu d'une page muette. Smoke étendu menu→partie→menu→partie. Vérif verte
  (274 tests, lint, typecheck 4/4, content:check, build 62 Ko, 40 smoke, garde
  faction vert). Reste R2b : CL3 (`catch{}` périmés) + CL6 (erreurs localisées).
- **2026-07-05** — **CO9 livré → R5 terminé** : les règles croisées
  `config.newGame` sont rapportées (`LoadReport.configErrors`) au lieu d'être
  levées ; un paquet rejeté ne casse plus le boot ; `content:check` échoue
  toujours dessus (CI). 3 tests loader. Vérif verte (274 tests, lint,
  content:check, build, 40 smoke, garde faction vert). **R5 (pipeline contenu
  & CLI) complet** : CO1–CO4, CO8, CO9. Prochain : R2 (cycle de vie & erreurs
  client).
- **2026-07-05** — **Lot « skills » livré (CO4 + dette Commandement)** :
  Commandement enfin branché au moral de pile (`moraleOf` prend l'état complet
  et ajoute `heroMorale` du héros du camp) ; `wisdom` retirée du pool (effet
  mort) ; `magic-*` utiles dès le rang 1 (−5/10/20 % mana, no-op de cercle
  retiré) ; doc 02 §1.3 à jour. Golden inchangé (`be72de4b`). Vérif verte
  (273 tests dont +2 Commandement, lint, content:check, build, 40 smoke, garde
  faction vert). Reste du plan : CO9 (résilience boot) ; R2 (cycle de vie
  client), R3 (identité joueur), R4 (i18n contenu), R6 (CI/tests), R7 (dette/
  duplication), R8 (docs) ; chantier UX §5.
- **2026-07-05** — **R6 livré (durcissement CI & tests, T1/T2/T3)** : garde-fou
  faction dérivé de `data/factions/index.json` (`jq`, motif `\b…\b`), scan
  élargi (`.js/.cjs/.mjs/.json`, exclusions `dist`/`node_modules`) et surtout
  **statut grep géré explicitement** (0 ⇒ échec, 1 ⇒ succès, >1 ⇒ échec ; le
  `! grep` d'origine masquait les erreurs d'exécution) ; script `test` racine
  passé de `--if-present` à la liste explicite engine+content (un package qui
  perd son `test` casse désormais la CI) ; `forbidOnly`/`retries` CI dans
  Playwright. Différés avec justification : smoke défaite (scénario perdant
  dédié, overlay déjà couvert côté victoire) ; ville « par les boutons » (déjà
  couverte par les smokes R2b/R4b) ; socle de tests client (dépend des helpers
  purs R7). Vérif verte : garde faction OK sur arbre propre + rouge sur id
  injecté (nettoyé), `pnpm test` = 210 engine + 70 content, lint, typecheck 4/4,
  content:check, build, 42 smoke. Golden inchangé (aucun code moteur touché).
  Reste : R7 (dette/duplication), R8 (docs) ; chantier UX §5.
- **2026-07-05** — **R7a livré (E6 : `advanceHeroAlongPath` partagé)** : la
  boucle de pas d'un héros (décompte PM, interception gardien, ramassage,
  brouillard), jusqu'ici copiée à l'identique entre le handler `MoveHero`
  (humain) et l'IA d'aventure, vit désormais dans un module feuille unique
  `adventure/movement.ts`. La seule divergence (résolution du combat de gardien :
  interactif côté humain, `runAutoCombat` côté IA) passe par un callback
  `onGuardianEngaged`. Extraction **behavior-preserving** : golden vert
  (`be72de4b`), déterminisme IA vs IA vert, 210 tests, lint/typecheck/42 smoke.
  R7 scindé en a (E6, fait) / b (CL9 helpers) / c (mineurs). Reste : R7b, R7c,
  R8 (docs) ; chantier UX §5.
