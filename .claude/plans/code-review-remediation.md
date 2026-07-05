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

### Lot R1 — Correctifs moteur (E1–E5 + mineurs moteur associés)
- [ ] E1 : refuser l'engagement d'un gardien avec armée vide (validation
      `MoveHero`/`beginGuardianCombat`) → test : commande refusée en
      `EngineError`, property « jamais de crash brut ».
- [ ] E2 : `recordLoss` dans la branche `damage` de `handleCastSpell` → test :
      XP et `raiseUndeadOnVictory` comptent les kills par sort.
- [ ] E3 : valider `CaptureTown` (joueur actif, héros sur la tuile, hors
      combat) → tests de rejet.
- [ ] E4 : remplacer `localeCompare` par comparaison par code units → golden
      replay inchangé.
- [ ] E5 : propager le `ranged` calculé par `applyAttack` à `performStrike` →
      test comparant `estimateDamage`/résolution pour tireur `noMeleePenalty`
      au contact.
- [ ] Mineurs : skip des joueurs éliminés, plafond de croissance
      non-réducteur, `defending` après le test de skip, contrainte de camp
      des sorts, tirage RNG agrégé O(1).
- Vérif : `pnpm -r test` vert, golden replay re-fixé si besoin (bump
  justifié dans la PR), garde-fou faction vert.

### Lot R2 — Cycle de vie & canal d'erreurs client (CL1, CL2, CL3, CL6, CL8)
- [ ] `AdventureScene.destroy()` (unsubscribe + `destroy({children,texture})`)
      et recréation scène+caméra au retour menu / changement de carte.
- [ ] `onTap` retourne un unsubscribe (symétrie `eventBus.on`) ; appel dans
      `CombatScene.destroy()` ; garde `destroyed` dans le tween.
- [ ] Canal d'erreur unifié store→toast i18n (pattern `SaveFailed`) ; purge
      des `catch {}` périmés ; mapping `err.code` → `t('townError.<code>')` ;
      catch de bootstrap/startScenario → écran/toast d'erreur.
- Vérif : smoke étendu — une action invalide affiche un toast (pas de
  silence) ; enchaîner menu → partie → menu → partie sans erreur console ;
  test manuel fuite (2 combats, listeners stables).

### Lot R3 — Identité du joueur humain (CL4, CL5 + `ownerPlayerId` loader)
- [ ] Dériver l'id humain de `players.find(p => p.controller === 'human')`
      au `StartGame`, stocké dans `AppState` ; supprimer les 17 usages en dur
      + le doublon `loader.ts:494` ; modale de compétence sur
      `find(h => h.playerId === humanId && pending.length > 0)`.
- Vérif : scénario de test dont l'humain n'est pas `player-1` ni premier
  héros → HUD complet, montée de niveau fonctionnelle.

### Lot R4 — i18n contenu (CO5, CO6, CO7 + replis toasts)
- [ ] Ajouter les ~27 clés `spell.*`/`skill.*`/`artifact.*` FR/EN dans les
      locales core ; clés `building.<id>` pour les 22 dwellings via locales
      de paquet (ou champ `name` branché — trancher et supprimer l'autre) ;
      déplacer `factionResource.essence` dans le paquet arcane-hunters ;
      repli commun `buildingName` dans `i18n.ts`.
- [ ] Étendre `content:check` : présence obligatoire des clés de nom pour
      tout sort/compétence/artefact/bâtiment chargé, parité FR/EN.
- Vérif : audit « 0 id brut à l'écran » rejoué (grep + smoke FR/EN).

### Lot R5 — Pipeline contenu & CLI (CO1, CO2, CO3, CO4, CO8, CO9)
- [ ] CO1 : `faction:validate` charge `core/buildings.json` → les 4 factions
      passent ; test CLI.
- [ ] CO2 : unicité globale des `unit.id` dans `loadContent` (rejet du paquet
      en collision) ; scaffolder → `t1-<factionId>-…` ; renommer l'unité de
      test-faction si besoin.
- [ ] CO3 : cross-check `nativeTerrain ∈ config.adventure.terrains` ;
      corriger test-faction (`plains`) et arcane-hunters (`mistmoor`) — noter
      l'impact équilibrage dans la PR.
- [ ] CO4 : retirer `wisdom`/`leadership` du pool ou les brancher ; donner un
      effet réel au rang 1 des `magic-*` (mise à jour doc 02 §1.3 dans le
      même commit — docs source de vérité).
- [ ] CO8 : valider `startingTown` (bounds/franchissable/collision) et
      `townId`/`heroId` des objectifs.
- [ ] CO9 : les refs de `config.newGame` vers un paquet rejeté deviennent des
      erreurs rapportées, pas un throw.
- Vérif : `content:check` + tests loader couvrant chaque nouveau rejet.

### Lot R6 — Durcissement CI & tests (T1, T2, T3)
- [ ] Garde-fou faction : motif dérivé de `data/factions/index.json`
      (`jq -r '.factions | join("|")'`), extensions élargies, test explicite
      du code retour grep (`exit 1` seulement).
- [ ] Remplacer `--if-present` par la liste explicite des packages testés ;
      décider d'un socle de tests client (au minimum les helpers purs
      extraits au lot R7).
- [ ] Smoke : parcours **défaite** (overlay + retour menu) ; écran de ville
      piloté **par les boutons** (Construire/Recruter via l'UI) ;
      `forbidOnly: !!process.env.CI` + `retries` CI dans Playwright.
- Vérif : CI rouge si on introduit volontairement (branche jetable) un id de
  5ᵉ faction dans le moteur / un `test.only` / une régression bouton ville.

### Lot R7 — Dette & duplication (E6, CL9 + mineurs)
- [ ] Helper moteur partagé `advanceHeroAlongPath` (humain + IA).
- [ ] Exposer en helpers purs `@heroes/engine` : coût scalé, statut de
      prérequis, dwellings→unités, `attackableTargets`, `bestMeleeOrigin` —
      consommés par `TownScreen`/`CombatScene` (supprime CL9) ; tests
      unitaires directs (couvre aussi `combat/hex.ts`, sans test aujourd'hui).
- [ ] Mineurs : classe `.btn` partagée, `SPEEDS` factorisé, gestion Échap en
      pile, code mort (`selectedHeroId`, `hovered`, `town/unit-economy.ts`),
      toast victoire/défaite par `combat.playerSide`.
- Vérif : `pnpm -r test` + smoke verts, zéro régression golden.

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
