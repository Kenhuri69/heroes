@.claude/guidelines.md

# Heroes — Mémoire Projet

Recréation navigateur du gameplay de *Might & Magic: Heroes Online* :
exploration par héros sur carte d'aventure, gestion de villes, armées et
combats tactiques tour par tour sur grille hexagonale.
Cible desktop + mobile (touch-first), architecture data-driven modulaire.

> ✅ **Jalon MVP atteint** (doc 01 §5) : partie complète jouable de bout en bout
> (desktop + mobile) — carte, villes, combat hex, héros (sorts/compétences/
> artefacts), **2 factions** (Haven, Necropolis) + une faction de test, 3
> scénarios solo avec **IA d'aventure**, conditions de victoire/défaite,
> sauvegarde IndexedDB. Critères de sortie tenus : 3ᵉ faction sans diff moteur
> (garde-fou CI), budget bundle < 800 Ko gzip, anti-gel throttling ×4
> (arène + carte), accessibilité (3 crans de police, motifs de bannières,
> cibles ≥ 44px), i18n FR/EN complète. Détail des sous-phases 3.x ci-dessous.
>
> 🚧 **Historique : Phase 2 — implémentation** (plan :
> `docs/10-plan-phase-2-implementation.md`). La Phase 2.0 (bootstrap) est
> livrée : monorepo pnpm + TS strict, client PixiJS 8 (damier pan/zoom
> touch-first), smoke test Playwright, CI + déploiement continu sur
> https://kenhuri69.github.io/heroes/ . Phase 2.1 livrée : cœur du moteur pur
> (`GameState`, commandes, RNG PCG32, golden replay). Phase 2.2 livrée :
> pipeline de contenu data-driven (schémas Zod, loader, CLI faction:new /
> faction:validate / content:check, paquets arcane-hunters + test-faction
> chargés dans le navigateur). Phase 2.3 livrée : carte d'aventure jouable
> (carte JSON proto-01 32×32, A* 8 directions avec coûts terrain/route/
> diagonale, tap-tap + prévisualisation chemin avec jours, brouillard 2 états,
> ramassage de ressources, fin de tour, sauvegarde/rechargement IndexedDB).
> Phase 2.4 livrée : arène de combat hex (moteur `engine/combat` — vagues
> d'initiative, riposte, dégâts doc 02 §5.3, moral/chance, 6 capacités, IA
> heuristique + auto-combat déterministe ; scène Pixi + UI avec
> prévisualisation de dégâts ; gardiens neutres sur la carte, interception ⇒
> combat ⇒ pertes appliquées ; testable seule via `/#arena`).
> Phase 2.5 livrée : boucle jouable complète — menu principal
> (Continuer/Nouvelle partie/Options), i18n FR/EN (locales core +
> paquets), sauvegarde IndexedDB gzip avec autosave fin de tour et
> export/import `.heroes`, XP/niveau du héros (attributs), passe mobile
> (tiroir héros, bandeau armée, overlay paysage), toasts, budget bundle
> < 800 Ko gzip vérifié en CI. **Sortie de Phase 2 atteinte.**
>
> 🚧 **Phase MVP en cours** (plan : `docs/11-plan-mvp-implementation.md`,
> découpage 3.x). Phase 3.1 livrée : villes & town building (moteur
> `engine/town` — construire 1/jour, recruter, croissance hebdo, revenu
> quotidien, garnison, capture ; schéma `building` data-driven + ville de
> départ sur proto-01 ; écran de ville liste avec onglets Construire/
> Recruter/Garnison ; l'armée du héros grossit depuis la ville).
> Phase 3.2 livrée : héros — sorts, compétences & artefacts (moteur
> `engine/hero` — 10 sorts cercles 1–3 lançables en combat via `CastSpell`
> (dégâts/soin/buff/debuff, statuts temporaires, mana = Savoir × 10 +
> artefacts, 1 sort/round, prévisualisation sans RNG) ; attributs héros
> Attaque/Défense + Chance/Moral enfin branchés dans les dégâts ; 13
> compétences data-driven à effets déclaratifs (Logistique = PM, Recherche
> = vision, Économie = or/jour, Chance/mêlée/tir/armure/coût mana en combat ;
> Commandement/moral reporté) avec choix à la montée de niveau (`ChooseSkill`,
> 2 propositions, cap rang 3) ; 4 artefacts à bonus cumulés sur 10 slots ;
> UI livre de sorts combat + tiroir héros (compétences/inventaire) + modale
> de choix ; héros de départ doté en données (`config.newGame.startingHero`).
> Phase 3.3 livrée : faction **Haven** 100 % données (`data/factions/haven/` —
> lineup T1–T7 aux stats doc 03, arbre d'habitations 7 dwellings + prérequis,
> manifeste, ressources Cristal/Gemmes, locales FR/EN), **zéro diff moteur/
> client** (critère de modularité doc 11 prouvé : une faction = données pures +
> un test de recrutement). Capacités spéciales / bonus de faction / héros
> nommés différés (moteur MVP à 6 capacités ; points d'extension ouverts plus
> tard, cf. doc 03 « État 3.3 »).
> Phase 3.5 livrée : **scénarios & IA d'aventure** — conditions de victoire/
> défaite déclaratives (`engine/scenario` : eliminateAllEnemies/captureTown/
> defeatHero/surviveDays, élimination de joueur, `GameState.outcome` +
> `GameEnded`, no-op hors scénario) ; **IA d'aventure** déterministe
> (`engine/ai` + commande `AiTurn` : explore/ramasse/attaque/capture/construit/
> recrute, heuristique gloutonne, property « IA vs IA se termine ») ; 3
> scénarios solo data-driven (`data/scenarios/`) ; client : sélection de
> scénario, boucle de pilotage des tours IA, overlay victoire/défaite ; smoke
> « gagner un scénario contre l'IA ». Triggers de carte + scaling différés.
> Phase 3.6 livrée : **finitions & jalon MVP** — accessibilité (3 crans de
> police propagés partout via `rem`, composant `FactionBadge` à motifs
> déterministes non chromatiques, cibles tactiles ≥ 44px), audit i18n (0
> chaîne en dur, parité FR/EN), smoke anti-gel étendu à la carte d'aventure,
> test d'équilibrage grossier Haven/Necropolis (pas de déséquilibre béant à
> valeur égale). Vue de ville peinte + assets finaux = Beta. **Sortie MVP.**
> Phase 3.4 livrée : faction **Necropolis** + **Nécromancie** — le **test de
> modularité n°1**. Faction 100 % données (`data/factions/necropolis/`, lineup
> T1–T7 toutes `undead`) ET ouverture d'**UN** point d'extension moteur
> **générique** : l'effet de faction déclaratif `raiseUndeadOnVictory`
> (`engine/faction`), interprété à la fin d'un combat gagné (relève un % des PV
> vivants ennemis tués en squelettes, plafonné), piloté par le manifeste via
> `factionCatalog`/`hero.factionId` — **zéro `if (faction === …)` dans le
> moteur**. Scaling par compétence/bâtiment, capacités spéciales et héros
> nommés différés (cf. doc 04 « État 3.4 »).
>
> 🔧 **Durcissement post-MVP** (choix utilisateur ; plans `.claude/plans/
> phase-3.7-*` et `-3.8-*`). 3.7 livrée : correction du nom de faction (clé
> locale unique `@loc:faction.<id>.name` par paquet — évite la collision à la
> fusion des locales ; scaffolder `faction:new` corrigé) + couverture save/load
> d'un état de scénario (champs 3.4/3.5). 3.8 livrée : **garde de version de
> sauvegarde** — `CURRENT_SAVE_VERSION` (source de vérité moteur, bump 1→2 pour
> la forme 3.4/3.5) + `readSaveVersion` ; le chargement (IndexedDB + import
> `.heroes`) rejette proprement une sauvegarde d'une autre version au lieu
> d'adopter un état malformé (doc 07 §4). Zéro faction dans le moteur (garde-fou
> vert), golden re-fixé. 3.9 livrée : **échecs de sauvegarde surfacés** — signal
> `SaveFailed` (autosave + save manuel) → toast d'erreur i18n, plus de perte de
> données silencieuse (navigation privée/quota).
>
> 🚀 **Alpha — faction Arcane Hunters** (roadmap doc 09 ; plans `.claude/plans/
> phase-4.*`). 4.1 : cadrage (doc 05) — 3ᵉ faction complète, **test de
> modularité #3**. Sous-lots **4.2→4.10 livrés**, chacun ouvrant **un** point
> d'extension moteur **générique** + les données qui l'exercent, garde-fou
> « zéro faction dans le moteur » maintenu : 4.2 lineup T1–T7 + Marque ;
> 4.3/4.5/4.8 capacité générique `consumeMarks` (executioner / `expose`
> suppression de riposte / `pinningShot` immobilisation) ; 4.4/4.6 ressource de
> faction **Essence** (gain post-victoire puis dépense) + T8 Pénitent
> recrutable ; 4.7 **Cercles** (choix de bâtiment exclusif `exclusiveGroup`) ;
> 4.9 **École de la Traque** (school `traque`, sort `applyMarks`, Entraves) ;
> 4.10 **demonform** (T8, transformation stateful + `magicResistance`) ; **4.20
> croissance partagée « apex »** (`sharedGrowthGroups` déclaré + câblé : T7/T8
> partagent 1 croissance/sem, destinataire au choix du joueur via
> `ChooseSharedGrowth` ; point d'extension générique `GameState.growthGroups` +
> `TownState.sharedGrowthChoice` — clôt le Lot B de `phase-4-reverify`, dernier
> vrai trou de l'Alpha AH). Depuis, la forme de sauvegarde a continué d'évoluer :
> la valeur courante de `CURRENT_SAVE_VERSION` et son changelog par version
> vivent dans `engine/core/state.ts` (source de vérité — ne pas dupliquer la
> valeur ici, revue 2026-07 B32 : les copies en dur dérivaient).
> Systèmes livrés depuis (voir docs à jour) : upgrades d'unités (habitation
> niveau 2), **marché** ressource↔or, **machines de guerre** (Forge), **contrats
> de chasse**, **hot-seat** (2 humains/appareil), **quêtes & campagnes** (N1→N3c :
> prologue + campagnes Haven/Necropolis, report de héros, cutscenes, choix de
> dialogue), objets de carte (mines/coffres/artefacts/lieux de bonus, ramassés
> en passant), 4ᵉ maison **Sylvan Court** en données.
>
> 🩹 **Remédiation revue de code** (plan `.claude/plans/code-review-remediation.md`,
> lots R1–R8). Livrés : R1 (garde-fous de crash moteur), R5 (résilience du
> pipeline de contenu + CLI de faction), R2 (cycle de vie des scènes client +
> erreurs surfacées, plus de page muette), R3 (identité du joueur humain via
> `humanPlayerId`, plus de `'player-1'` en dur), R4 (noms localisés du contenu),
> R6 (durcissement CI : garde-fou faction dérivé de `data/factions/index.json`,
> tests explicites, `forbidOnly`/`retries` Playwright), R7 (dette & duplication :
> `advanceHeroAlongPath` partagé humain/IA ; helpers purs `@heroes/engine`
> consommés par le client — coût/prérequis/dwellings de ville, `attackableTargets`/
> `meleeOriginsFor` de combat ; mineurs). R8 : cette mise à jour docs.
>
> 🧭 **Remédiation cohérence code ↔ doc** (plan `.claude/plans/code-doc-coherence-remediation.md`,
> lots A→E). Issue d'une revue complète : Lots **A/B** (bugs moteur P0/P1 corrigés,
> golden re-fixé une fois), **C** (client), **D** (arbitrages design appliqués
> code ou données : stock d'upgrade, Capitole unique `uniquePerPlayer`, prérequis
> Château `fort@3`, ramassage en passant, `SpellSchool` = chaîne opaque, table des
> élites documentée…), **E** (remise à niveau documentaire : docs 01/02/06/07 +
> factions 03/04/05/14 + narratif 13 + ce fichier + hygiène des commentaires
> moteur, tous alignés sur le livré). Sous-lots découpés en PR atomiques, chacun
> vérifié (typecheck, lint, golden, tests, garde-fous, budget, smoke).
>
> 🎨 **Intégration des assets** (doc 12 §10) : le client consomme les PNG du
> staging `assets/` via un registre auto-découvert (`import.meta.glob ?url`,
> `assetsInlineLimit: 0` → hors bundle JS, budget < 800 Ko gzip tenu), avec repli
> procédural gracieux. Surfaces branchées : tuiles de terrain, mines/objets de
> carte, vignettes de bâtiments, icônes d'artefacts, icônes de ressources.
> Les docs `docs/0X-*.md` restent la source de vérité du design ; le code doit
> s'y conformer.
>
> 🎥 **Fidélité HoMM Online** (plan `.claude/plans/homm-online-divergence-remediation.md`,
> revue de captures du jeu d'origine). Deux lots livrés (décision utilisateur) sans
> toucher au moteur : **A1 — rendu isométrique** de la carte d'aventure
> (`render/projection.ts` : losange 2:1 façon HO ; grille moteur **carrée**
> inchangée, seule la projection de rendu + le picking `tileToScreen` deviennent
> iso ; **tuiles-losanges texturées** `assets/tiles/iso/` dérivées par `gen_tiles.py`
> sur repli gouache, tilemap mise en cache, tri de profondeur, brouillard/rivage/
> chemin projetés) ;
> **B1 — file de chantier** dans l'écran de ville (bandeau « Chantier du jour »
> libre/occupé + temps en **jours**, jamais en secondes — habillage de la règle
> « 1 construction/jour », zéro churn moteur/sauvegarde). **Lot 1 combat livré** :
> **écran pré-combat + Auto-Battle** (`PreBattleScreen`, puissances comparées via
> `armyStrength` réutilisé, Combattre/Auto-Battle — pur overlay client, zéro
> moteur). La **file d'initiative** en combat (lot M1) et les **popups dégâts/kills**
> (lot UXD-4, avec polish « kills proéminents » façon capture 4) existaient déjà
> ⇒ les 3 divergences de combat des captures sont couvertes. Divergences
> délibérées confirmées hors périmètre : MMO temps réel, premium/pay-to-win
> (doc 01 §3-4).
>
> 🌐 **Beta — en ligne & PWA** (roadmap doc 09 Phase 3). Backend **déployé et en
> ligne** (lots 7.1→7.6, doc 15) : Worker Cloudflare `heroes` sur
> `https://heroes.kenhuri.workers.dev` (D1 `heroes` branchée ; déploiement en CI
> via `deploy-worker.yml`, wrangler par **pnpm**, sous-domaine workers.dev
> enregistré par l'API Cloudflare, token en secret GitHub), client republié avec
> `VITE_BACKEND_URL` ⇒ bouton « En ligne » (auth magic-link, cloud saves, PvP
> async) actif. Lot **8.1 — PWA hors-ligne** ✅ : coquille installable (manifeste
> `data/manifest.webmanifest` + icônes générées sans dépendance) et **service
> worker offline-first** `data/sw.js` *hand-rolled* (navigation network-first
> repli cache, `/assets/` hashés cache-first, JSON de contenu
> stale-while-revalidate ; enregistré en PROD only) — hors budget bundle ; smoke :
> réseau coupé ⇒ l'app démarre depuis le cache.
>
> 🎲 **Écran « Nouvelle partie » configurable** (doc 09, lot 6.3 ; plan
> `.claude/plans/phase-newgame-setup.md`). « Nouvelle partie » ouvre désormais une
> modale de configuration (`NewGameScreen`) : faction par joueur, **2–4 joueurs**
> (humain hot-seat / IA), taille de carte (Petite 24² / Moyenne 36² / Grande 48²),
> quantité de ressources (Bas / Standard / Riche — échelle du stock de départ +
> densité d'objets de la carte), difficulté IA et graine reproductible. **Chaque
> paramètre peut rester sur « Aléatoire »**, tiré déterministiquement depuis la
> graine (RNG seedé moteur, jamais `Math.random`). `generateMap` étendu (option
> `startPositionCount` ⇒ N départs répartis en anneau ; `resourceMultiplier` +
> densité ∝ aire) ; `resolveGeneratedMap` prend ces options ; commande
> N-joueurs `newGameStartCommand` (généralise `skirmishStartCommand`). La
> génération pouvant durer, un **overlay de chargement à barre de progression**
> (`LoadingOverlay`, état `store.loading`) affiche l'avancée par étapes. **Zéro
> diff moteur** (données + client uniquement ; garde-fou « zéro faction » vert,
> pas de bump `CURRENT_SAVE_VERSION`). Lot **6.4 — couleur par joueur** : chaque
> siège choisit sa couleur (palette partagée) ; `store.playerColors` (id → couleur,
> remis à zéro au retour menu) consulté en priorité par `render/playerColors.ts`,
> le jeton de héros de la carte honore enfin la couleur du joueur. Couleur purement
> présentation client ⇒ zéro diff moteur. Lot **6.5 — quantités de carte par
> catégorie** (plan `.claude/plans/phase-newgame-content-density.md`) : quatre
> curseurs indépendants à « Nouvelle partie » — **Gardiens**, **Mines**,
> **Bâtiments événement**, **Ressources & artefacts** — à 5 crans
> (`Aucun ×0` / `Rare ×0.5` / `Standard ×1` / `Abondant ×2` / `Aléatoire` seedé).
> `generateMap` gagne `guardianDensity`/`mineDensity`/`eventBuildingDensity`/
> `pickupDensity` (défaut ×1, **superposés** au réglage global bas/riche) ;
> défaut « Standard » partout ⇒ carte identique à graine égale (helper `scaledCat`,
> facteur 1 ≡ `scaled`). « Aucun gardien » retire aussi les sentinelles (carte
> pacifique). Résolution seedée en fin de `resolveNewGameConfig` (séquence RNG des
> autres tirages inchangée). **Zéro diff moteur, pas de bump `CURRENT_SAVE_VERSION`**
> (options jetées après génération) ; données + client uniquement. Lot
> **alliances/équipes** (doc 02 §6 ;
> plan `.claude/plans/phase-newgame-teams.md`) : **lot moteur** — `PlayerState.team`
> (save v12→**v13**), helper générique `areAllies` (`0` = sans alliance ⇒ FFA
> inchangé). Deux alliés ne s'assiègent pas (`validateCaptureTown` + IA) et
> partagent la victoire (`eliminateAllEnemies` compte l'allié comme non-ennemi) ;
> golden re-fixé (forme seule). Sélecteur d'équipe par siège à « Nouvelle partie ».
>
> 🗺️ **Extension carte** (plan `.claude/plans/phase-map-tiles-expansion.md`).
> Cinq lots, **zéro diff moteur** (données + client + assets ; garde-fou « zéro
> faction » vert, pas de bump `CURRENT_SAVE_VERSION`) : **1** — 7 nouveaux terrains
> data-driven (`dirt/sand/forest/rough/snow/river` franchissable`/rocks`, les 4
> existants inchangés = golden stable) + recettes procédurales `gen_tiles.py` +
> nuances de repli (tilemap/mini-carte) ; **2** — **génération par biomes**
> (`mapgen.ts` : bruit fractal élévation/humidité/température → biomes cohérents,
> rivières en descente de pente ; pure & déterministe, carte valide par
> construction) remplace les amas aléatoires ; **3** — **chunking + culling** au
> viewport de `Tilemap` (petites cartes toujours aplaties en une texture ; grandes
> cartes = chunks 16² batchés, seuls les chunks visibles rendus) ; **4** — tailles
> **64/96/128/256** (`MAP_SIZE_DIMENSIONS` Petite→Immense, plafond schéma 256) ;
> **5** — **props de relief** forêt/montagne (billboards `assets/tiles/props/` qui
> dépassent la tuile, 3 variantes procédurales, culés avec leur chunk ; art Gemini
> varié se branche par simple dépôt de PNG, prompts doc 12 §7.5). Terrains plats =
> tuile procédurale seule.
>
> 🎓 **Beta — faction Vox Arcana** (6ᵉ maison, doc 16 ; plan `.claude/plans/
> phase-16-faction-vox-arcana.md`). **Test de modularité #4 : livré.** Sous-lots
> 16.1→16.6, chacun données pures (ou un point d'extension moteur **générique**),
> garde-fou « zéro faction » maintenu : 16.1 **`houseAllegiance`** (LE nouveau
> point moteur générique — profil de bonus déclaratif par héros/ville, save
> v9→v10) ; 16.2a paquet jouable (5 **Maisons**, lineup T1–T8, ville) ; 16.2b
> choix de Maison via **« Le Choixpeau »** (effet de bâtiment générique
> `houseChoice`, save v10→**v11**) ; 16.4 **Résonance** (ressource de faction —
> réutilise `gainFactionResourceOnVictory`/Essence, T8 gaté) ; 16.5 **École de la
> Scène** (`spellSchool: scene` + 4 sorts à effets génériques, réutilise
> l'acquis `traque`) ; 16.6 **avatars** Hermione (magic) & Rumi (might) stagés à
> la convention client. **Différés** (comme pour toutes les factions) : capacités
> de signature (barrière Honmoon T8, peur Sombral, renaissance Phénix), Résonance
> intra-combat, unités élites, **identité** des héros nommés (système moteur non
> ouvert). Golden inchangé côté 16.4/16.5/16.6 (données hors replay inline).
>
> 🎛️ **UX multi-joueurs — passage de tour & tours IA** (plan `.claude/plans/
> multiplayer-ux-issues.md`, doc 08). Trois correctifs **client uniquement** (zéro
> diff moteur, pas de bump `CURRENT_SAVE_VERSION`) : (1) **recentrage caméra** sur le
> héros du joueur humain actif à chaque changement de main (hot-seat / retour d'un
> relais IA), après validation du passage d'appareil ; (2) **tours IA non bloquants**
> — `runAiLoop` devient asynchrone et cède la main au navigateur (rAF + court délai,
> coupé en *reduce-motion*) entre chaque tour, `dispatch` l'`await` (contrat des tests
> préservé) : fini l'écran figé, la carte reste navigable, les actions humaines sont
> ignorées tant que l'IA joue ; (3) **indicateur de tour** dans la barre (`TurnIndicator`,
> `store.aiTurn`) — joueur actif (pastille couleur + n°) et barre de progression
> `done/total` des adversaires IA. Smoke étendu.
>
> 🍺 **Système de héros complet — Taverne & héros canon** (plan `.claude/plans/
> m-tavern-client-canon-heroes.md`, docs 02/03/04/08). **M-TAVERN.2 livré** :
> onglet **Taverne** de l'écran de ville (visible si construite, comme Marché/
> Guilde) — roster de la faction de la ville (avatar/nom/bio/spécialité/
> attributs/coût), bouton Recruter ⇒ `RecruitHero`, états Recruté/cap/or ; le
> héros recruté devient le héros **sélectionné** ; roster embarqué à `StartGame`
> par **tous** les chemins client (partie rapide et `newGameStartCommand` ne le
> passaient pas). Correctif latent : libellés de héros nommés résolus **core →
> paquet** (`resolveHeroName`/`resolveSpecialtyName/Desc` — plus de clé brute au
> tiroir). **Héros canon du jeu d'origine** (`origin: canon`, `source: "Might &
> Magic"`) : Haven +3 (Anton/Freyda/Isabel), Necropolis +3 (Sandro/Markal/
> Ornella) ; test-faction +1 original (Garrick, exerce le smoke sur la partie
> rapide). Seul diff moteur : **export** du helper pur `recruitedHeroId`. Pas de
> bump save, golden inchangé, garde-fou faction vert. Différés : Vhalen/Mère
> Corbeau & co (spécialités conditionnelles = nouveau point d'extension),
> UX-HEROSWAP, héros-vs-héros, pool exclusif, IA recruteuse, H-NAMED.2.
>
> 🏁 **Chantier « système de héros complet »** (5 lots, 5 PR mergées ; plans
> `.claude/plans/{ux-heroswap,h-vs-h,m-tavern-4,h-named-2,h-cond}.md`). Clôt les
> différés ci-dessus. **UX-HEROSWAP** : commande générique `TransferBetweenHeroes`
> (armée/artefacts entre 2 héros du même joueur sur tuiles adjacentes) + UI de
> rencontre `HeroSwap` double-colonne tap-tap (« Équilibrer »/split → UX-SPLIT).
> **H-VS-H** : marcher sur un héros ENNEMI ouvre un combat (`beginHeroCombat`,
> `defenderHeroId` enfin non-null) ; le vaincu meurt + dépouille d'artefacts au
> vainqueur (surplus au sol). **M-TAVERN.4** : pool de Taverne **exclusif
> inter-joueurs** (`HeroState.rosterId`, save **v25→v26** ; un héros mort
> redevient recrutable) + **IA recruteuse** (riche + sous le cap, `ai/town-ai.ts`).
> **H-NAMED.2** : chaque siège humain **choisit son héros de départ** à « Nouvelle
> partie »/« Escarmouche » (`startingHeroId`, défaut aléatoire seedé ; zéro diff
> moteur). **H-COND** : UN point d'extension moteur générique — spécialité
> `conditional` scopée par `unitId` et/ou par niveau (`conditionalUnitBonus` en
> combat : att/déf/vitesse), **zéro faction moteur, pas de bump save, golden
> inchangé** ; 6 héros nommés différés désormais jouables (Vhalen/Mère Corbeau,
> Sylwen/Faelar, Evadne/Alwin ; locales FR/EN, avatars génériques). Différés
> restants notés dans chaque doc de faction (signatures exactes = points
> d'extension distincts) : Nécromancie/niveau, Symbiose de départ, familier gratuit.
>
> 🎯 **Retours de jeu — équilibrage, combat & UI** (plan `.claude/plans/
> game-balance-combat-ui.md`, docs 02/08). Quatre correctifs : (1) **moulin** —
> l'or aléatoire suit les paliers **250/500/1000** (comme les mines) au lieu de
> 1–3 à l'unité (`mapgen.ts`, données) ; (2) **abandon pré-combat** — commande
> moteur générique `AbandonCombat` (garde l'armée survivante, gratuit, gate
> round 1) + 3ᵉ bouton **« Abandonner »** sur `PreBattleScreen` UNIQUEMENT (jamais
> en bataille — choix utilisateur) et hors arène ; (3) **courbe XP** — `levelCurve.
> base` 1000→**268** (`config.json`) ⇒ 1ᵉʳ palier niveau 2 ≈ **1000 XP** (exposant
> 1.9 inchangé ; fixture de test gardée à 1000 ⇒ golden inline épargné) ; (4)
> **bilan de fin de combat** — `CombatEnded` enrichi de `survivors` (état haché
> inchangé ⇒ golden épargné), `dispatch.buildCombatResult` agrège pertes/
> survivants + gains (XP/niveaux/or/ressources/artefact/mort-vivants), composant
> `CombatResultScreen` (modale par-dessus la carte, « Continuer » ; pas de bilan
> pour un départ délibéré). Garde-fou « zéro faction » vert, pas de bump save,
> golden inchangé ; smoke étendu (abandon + bilan).

> 🎓 **Retours de jeu — héros Vox Arcana & équilibrage sorts/attaque** (plan
> `.claude/plans/vox-arcana-hero-balance.md`, capture ville Vox Arcana). Quatre
> correctifs : (1) **héros Vox Arcana recrutables** — les 5 fiches
> (`data/factions/vox-arcana/heroes/`) étaient *identity-only* (sans `attributes`)
> ⇒ ignorées par `buildHeroRoster` (« Aucun héros disponible ») ; dotées du gameplay
> complet (attributs, spécialité, `startingSkills`/`startingSpells`, locales de
> spécialité fr/en) comme les héros canon Haven/Necropolis — **données pures** ;
> (2) **attaque du héros en combat** — `combat.heroAttack` re-scalée sur l'ATTAQUE et
> non le Pouvoir (`{base:8,perPower:6,perAttack:2}` → `{base:3,perPower:0,perAttack:3}`),
> magnitude ~cercle 1 (data config) ; (3) **sorts** déjà scalés sur le Pouvoir
> (`castHeroSpell` → `effectivePower`), contraste voulu avec (2) — rien à coder ;
> (4) **accès cercle 3 gaté par Sagesse (fidélité HoMM3)** — `BASE_LEARNABLE_CIRCLE`
> 3 → **2** (cercles 1-2 libres, 3+ via Sagesse) + `skills.json` wisdom `learnCircle`
> [4,5,5] → **[3,4,5]** (basic→3, avancé→4, expert→5) ⇒ seuls les héros magie dotés de
> Sagesse (ou de `startingSpells`) accèdent tôt au cercle 3. Docs 02 §1.3/§4.1 alignées.
> Garde-fou « zéro faction » vert, **pas de bump save**, golden inchangé ; mage-guild.test
> étendu (gate cercle 3/4).

> ⚔️ **Retour de jeu — action de héros par round** (plan `.claude/plans/
> hero-action-per-round.md`). L'attaque du héros était verrouillée **1×/combat**
> (`heroAttackUsed` jamais réinitialisé), en contradiction avec le core loop
> (doc 02 §1 : « le héros agit une fois par round, sort **ou** attaque »).
> Corrigé : `heroAttackUsed` est vidé **chaque round** comme `heroCastThisRound`,
> et frappe/sort deviennent **mutuellement exclusifs par round** (une seule
> action de héros par round ; la Prière de bataille reste un special 1×/combat).
> Câblé côté moteur (validations frappe/sort + `advanceTurn` + IA `maybeHeroAction`)
> et client (désactivation mutuelle des boutons). **Forme de sauvegarde inchangée
> ⇒ pas de bump `CURRENT_SAVE_VERSION`** ; golden inchangé, garde-fou « zéro faction »
> vert ; doc 02 §5.6 alignée sur §1.

> 🏹 **Retour de jeu — tir par-dessus les obstacles + obstacles visibles** (plan
> `.claude/plans/shooter-los-obstacles.md`, suite de la capture « arbalétriers sans
> tir »). Vraie cause du « aucune attaque à distance possible » : la règle **C-LOS**
> bloquait le tir dès qu'un **obstacle** de champ était sur la ligne tireur→cible
> (2–5 obstacles tirés au centre ⇒ ligne souvent coupée) — divergence HoMM, aggravée
> par des obstacles quasi **invisibles** (brun translucide + fines hachures). Deux
> correctifs : **(A moteur)** nouveau helper `sightBlockedKeys` (murs de siège
> **seuls**) consommé par `hasLineOfSight` ⇒ les tireurs tirent **par-dessus les
> obstacles** (seul un rempart coupe la flèche) ; `staticBlockedKeys` (obstacles +
> murs) reste pour le **déplacement**/téléportation. **(B client)** `hexgrid.ts`
> rend chaque obstacle comme un **rocher** dessiné (`drawBoulder`, déterministe) sur
> fond opaque, à la place des hachures. **Pas de bump `CURRENT_SAVE_VERSION`**, golden
> **inchangé** (802 tests moteur verts), garde-fou « zéro faction » vert ; doc 02
> §5.2/§5.4 alignées. `combat-los.test` réécrit (obstacle ⇒ tir OK ; mur ⇒ bloqué).*

> ⚖️ **Fidélité de `faction:sim` (équilibrage passe 2, prérequis)** (plan
> `.claude/plans/faction-sim-fidelity.md`, docs 06 §5.6). Constat : le sim ne
> résolvait qu'**un duel valeur-égale sans héros** ⇒ aveugle aux mécaniques
> **inter-combat** (nécromancie surtout — il classait Necropolis **dernière** alors
> que c'est son identité). Correctif **outillage seul** (zéro tuning de stats) :
> **UN** primitif moteur pur `simulateHeroCombat` (combat **héros-vs-héros**
> auto-résolu, 2 joueurs + 2 héros liés ⇒ effets de faction post-victoire réels ;
> rend le vainqueur + **l'armée reconstruite du challenger, relève incluse**),
> exporté et faction-agnostique (`factionId` opaques). `faction:sim` gagne deux
> lectures qui **reportent l'armée d'une vague à l'autre** ⇒ valorisent
> sustain/nécromancie : **matrice d'attrition** (vagues fraîches croissantes
> vaincues avant wipe) et **gauntlet de survie** (rotation escaladante des autres
> factions ; même yardstick). Le **duel** reste le seul gate (code sortie non-nul
> sur béance). Résultat mesuré : au gauntlet, Necro remonte **2ᵉ/3ᵉ** (plus jamais
> dernière) et la domination duel de Vox (71.5 %) **n'est pas confirmée sur le
> sustain** — la passe 2 (tuning subjectif) part désormais d'un avis juste.
> *Limitation assumée* : résonance/essence (dépense hors combat) hors périmètre —
> sous-estime seulement Vox, déjà la plus forte. **Pas de bump `CURRENT_SAVE_VERSION`**
> (état ad hoc, rien de sérialisé), golden **inchangé** (833 tests moteur, +4 ;
> unités synthétiques), garde-fous faction/couleurs verts.*

> ⚡ **Perf moteur — lot 7b** (plan `.claude/plans/code-review-performance.md`,
> dernier item de la revue perf ; décision utilisateur « perf max »). Deux
> optimisations du hot loop de combat, **zéro nouvelle règle** : **F3** —
> l'auto-combat (`AutoCombat`/`AiTurn`) s'exécute sur un **clone plat**
> (`structuredClone`) plutôt que sous proxy Immer (surcoût ×5-20 par lecture/
> écriture, jusqu'à 20 000 itérations) ; mêmes mutations sur les mêmes données ⇒
> **golden inchangé** ; `simulateHeroCombat` perd aussi son `produce`. **F2** —
> plafond de jets de dégâts par frappe (`MAX_DAMAGE_ROLLS = 10` × échelle de
> l'effectif, moyenne préservée & bornes tenues) : une pile de N créatures tirait
> N dés PCG32/BigInt par frappe ⇒ désormais O(min(N,10)). Golden **finalement
> inchangé** (le seul stack > 10 du replay ne frappe jamais) ; test dédié du
> plafond ajouté (dégât fixe ⇒ `count × d` exact ; variable ⇒ borne). **Mesure :
> `faction:sim` ~300 s → 47 s (×6,3)** ; le lot 7a (F5–F8) avait déjà donné
> mouvement 150 pas ×27. PCG32-32 bits **non** fait (changerait tout le RNG dont
> mapgen — hors proportion). Pas de bump `CURRENT_SAVE_VERSION`, garde-fous
> faction/couleurs verts, moteur 835/835.*

---

## Structure des fichiers

```
README.md                        Vue d'ensemble + principes non négociables
docs/
  01-gdd-overview.md             Vision, core loop, piliers, monétisation, scope MVP
  02-mechanics.md                Héros, carte d'aventure, ressources, combat hex, town building
  03-faction-haven.md            Faction Haven : lore, unités T1–T7, bâtiments, bonus, héros
  04-faction-necropolis.md       Faction Necropolis : idem + Nécromancie
  05-faction-arcane-hunters.md   Faction Arcane Hunters : nouvelle maison, 8 tiers, mécaniques uniques
  06-modularity.md               Plan data-driven : dossiers, interfaces, checklist d'intégration de faction
  07-architecture.md             Frontend TS/PixiJS, state management, backend Node.js, sauvegardes, réseau
  08-ui-ux.md                    Écrans principaux, wireframes, adaptation mobile
  09-roadmap.md                  Phases MVP → Alpha → Beta → Live
  10-plan-phase-2-implementation.md  Plan Phase 2 : structure, architecture, build Vite, déploiement GitHub Pages, code prioritaire
  11-plan-mvp-implementation.md  Plan Phase MVP : découpage en sous-phases 3.x (villes, héros, factions, scénarios)
  12-assets-style-guide.md       Guide de style des assets générés : cadre visuel, procédures de génération, intégration client
  13-plan-narrative-polish.md    Plan de polishing narratif : ton, campagnes, quêtes, dialogues data-driven, lots N1→N4
  14-faction-sylvan-court.md     Faction Sylvan Court (Beta, 4ᵉ maison) : cadrage — lineup 7 tiers, signature Symbiose, points d'extension
  15-backend-infra.md            Backend coût 0 (Cloudflare Workers + D1) : levier déterministe, modèle de données, auth magic-link, PvP async, déploiement
  16-faction-vox-arcana.md       Faction Vox Arcana (Beta, 6ᵉ maison — Poudlard × KPop Demon Hunters) : livrée — 5 Maisons (signature houseAllegiance), Résonance/Honmoon, École de la Scène, lineup T1–T8, avatars Hermione & Rumi
  17-faction-dungeon.md          Faction Dungeon / Donjon (Beta, 7ᵉ maison — elfes noirs de HoMM) : cadrage — pendant sombre de la Sylvan Court, signature Magie Irrésistible (1 point d'extension générique irresistibleMagic), lineup 7 tiers, ressources sulfur/gems, héros canon Raelag & Shadya
  18-audit-fonctionnalites-vs-heroes-online.md  Audit complet vs Might & Magic: Heroes Online (2014-2020) : écarts priorisés P1/P2/P3 (moteur/données/client/assets), gradation visuelle des gardiens (§3), plan de comblement en 5 étapes (étape 5 = décisions de cadrage)
  templates/faction-template.md  Gabarit pour spécifier une nouvelle maison
.github/workflows/
  ci.yml                         PR : typecheck, lint, tests, build, smoke headless
  deploy.yml                     main : build Vite + smoke sur build de prod + déploiement Pages (rebuild avec VITE_BACKEND_URL)
  deploy-worker.yml              Déploiement du Worker backend Cloudflare (wrangler via pnpm ; secrets CLOUDFLARE_*, doc 15 §10)
packages/
  engine/                        Moteur de règles pur (état, commandes, RNG PCG32) — @heroes/engine
  content/                       Schémas Zod + loader/validateur de paquets de faction — @heroes/content
  client/                        Client Vite + PixiJS 8 (rendu, caméra, scènes) — @heroes/client
  tools/                         CLI : faction:new, faction:validate, content:check — @heroes/tools
data/
  core/abilities.json            Catalogue générique de capacités (doc 02 §5.4)
  core/config.json               Constantes d'équilibrage (mouvement, terrains, vision, combat, héros, ville de départ)
  core/buildings.json            Bâtiments communs des villes (doc 02 §4.1 : hôtel de ville, fort, guilde…)
  core/spells.json               Sorts génériques cercles 1–3 (doc 02 §1.4 : école/cercle/coût/effet)
  core/skills.json               Compétences secondaires + effets par rang (doc 02 §1.3)
  core/artifacts.json            Artefacts à bonus cumulés sur 10 slots (doc 02 §1.1, doc 08 §2.3)
  core/locales/                  Locales FR/EN de l'UI générique (menu, options, toasts, ville)
  factions/                      Paquets de faction (index.json + haven, necropolis, arcane-hunters, sylvan-court, test-faction)
  maps/proto-01.map.json         Carte prototype 32×32 (légende, tuiles, routes, objets, départs)
  scenarios/                     Scénarios (index.json : prologue + chapitres de campagne haven/necropolis/arcane + tutorial/survival/conquest + 2 événements ; joueurs, IA, objectifs, quêtes, dialogues)
  manifest.webmanifest           PWA : manifeste installable (servi /heroes/, lot 8.1)
  sw.js                          PWA : service worker offline-first hand-rolled (lot 8.1)
  icons/                         PWA : icônes app (192/512/180 PNG + SVG)
server/
  schema.sql                     Schéma D1 (Cloudflare) du backend : profiles/sessions/saves/matches/moves (doc 15)
tests/smoke.spec.ts              Smoke Playwright/Chromium headless (guideline §7) sur le build de prod
playwright.config.ts             Config smoke (desktop + mobile, vite preview)
.claude/
  guidelines.md                  Règles de travail (incluses ci-dessus)
  plans/                         Plans vivants par changement (règle §5 des guidelines)
```

---

## Architecture cible (résumé — détail dans `docs/07-architecture.md`)

- **Moteur de règles pur** : TypeScript strict, déterministe (RNG seedé
  injecté), zéro dépendance au rendu ou au DOM. Testable en unitaire.
- **Rendu** : PixiJS 8 (WebGL/WebGPU, fallback canvas), consomme l'état du
  moteur — jamais l'inverse.
- **Contenu 100 % data-driven** : unités, bâtiments, héros, bonus décrits en
  JSON + manifeste de faction, validés par schémas. Le moteur ne connaît
  aucune faction (checklist d'intégration : `docs/06-modularity.md`).
- **Sauvegarde** : locale (IndexedDB) au MVP ; backend Node.js + WebSocket
  pour l'asynchrone/PvP post-MVP.

---

## Conventions de travail

- **Langue** : documentation et discussions en français ; identifiants de
  code en anglais.
- **Branche par défaut** : `main`. Travailler sur des branches `claude/…`,
  PR ouverte en draft (voir guidelines §6 avant tout push).
- **Toute évolution de design** passe par la mise à jour du document
  `docs/0X-*.md` concerné — les docs sont la source de vérité en Phase 1.
- **Nouvelle faction** : partir de `docs/templates/faction-template.md` et
  suivre la checklist de `docs/06-modularity.md` ; ne jamais introduire de
  cas particulier de faction dans le futur moteur.
- **Plans** : chaque changement non trivial a son plan vivant dans
  `.claude/plans/<feature>.md` (guidelines §5).
