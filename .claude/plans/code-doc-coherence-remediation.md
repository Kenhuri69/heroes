# Plan de remédiation — revue de cohérence code ↔ documentation

> Plan vivant (guidelines §5). Issu d'une revue complète menée le 2026-07-07 :
> 7 passes d'audit parallèles (combat, carte d'aventure, villes/économie,
> héros, factions/modularité, scénarios/IA/quêtes/sauvegarde, bugs moteur
> transverses), chaque constat cité doc:ligne ↔ code:ligne, et les constats
> majeurs re-vérifiés à la main sur le code avant inscription ici.

## 0. État des lieux

- **Base saine** : 395 tests verts (moteur 319, contenu 76). Invariants non
  négociables (guidelines §8) **tous respectés** : zéro `Math.random`/
  `Date.now` dans le moteur, zéro import rendu/DOM, zéro identifiant de
  faction dans le moteur (garde-fou CI vert, rejoué manuellement), garde de
  version de sauvegarde opérante des deux côtés (IndexedDB + import `.heroes`).
- **Chiffres d'équilibrage conformes** : lineups T1–T7(T8) des 4 maisons
  stat par stat (zéro divergence), coûts de terrain/PM/vision, revenus de
  mines, croissance, formule de dégâts côté unités, Nécromancie (15 %, cap),
  Marque (+8 %, max 3), Essence (+10/victoire), Pénitent T8, demonform.
- **Mais** : ~12 bugs de code réels (dont 1 critique), ~8 écarts de gameplay
  ou d'équilibrage vs la spec, et une dérive documentaire importante — les
  docs 01/02/06/07 et CLAUDE.md sont en retard de plusieurs lots sur le code
  livré (save v8 vs « 3/4 » documenté, 4ᵉ scénario, Sylvan Court, marché,
  machines de guerre, contrats, upgrades, hot-seat…).

**Doctrine de tri** (docs = source de vérité du design ; le code a pu évoluer
légitimement) :
- Règle documentée + code contraire **sans note de report** → corriger le code.
- Feature livrée volontairement plus simple (lots tracés dans les plans) →
  corriger la doc (note d'état « différé », comme le veut l'usage du projet).
- Ambigu → décision proposée ici (Lot D), notée dans la doc au même commit.

---

## 1. Lot A — Bugs moteur (corriger le CODE) — priorité P0

Chaque item : correctif + test unitaire dans le même commit (guidelines §4/§7).
⚠️ A2, A3, A4 changent le résultat des combats ⇒ re-fixer le golden replay
une seule fois en fin de lot, et re-passer le test d'équilibrage grossier.

> **Découpage en PR** (lot A trop gros pour une seule revue) :
> **A-1 = A1–A5 (correctifs combat, golden re-fixé)** ✅ livré ;
> A-2 = A6–A11 (héros/scénario/ville) ✅ livré. Tests : `lot-a-combat.test.ts`
> (5) ; golden `fda800c6`→`48c3a5e5` ; `heroDefenseStep: 0.025` ajouté à
> `data/core/config.json` + schéma + type + fixtures ; équilibrage `balance.test`
> re-passé vert (aucun blowout).

- [x] **A1 — CRITIQUE. Attaque en mêlée : `from` non validé quand la cible est
  adjacente ⇒ téléportation arbitraire.** ✅ `validateCombatAction` valide
  TOUJOURS `from` (adjacent à la cible + atteignable/position actuelle) ;
  `applyAttack` ignore un `from` égal à la position (pas de StackMoved à vide).
  `combat/actions.ts:146` retourne `null` dès `dist === 1` sans regarder
  `action.from`, puis `actions.ts:293-297` applique aveuglément le `from`
  fourni : une commande `{attack, from:{col:999,row:-4}}` téléporte la pile
  hors plateau/sur un obstacle/sur une autre pile, puis frappe. Refuser tout
  `from` non ∈ `reachableHexes` et non adjacent à la cible (ou l'ignorer si
  `dist === 1`). → vérif : test « from hostile rejeté ».
- [x] **A2 — `noRetaliation` inversée.** Doc 02 §5.4:252 (+ Vampire doc 04:48,
  Manticore doc 05:195) : la capacité est sur l'ATTAQUANT et prive la victime
  de riposte. Code : `!hasAbility(targetDef, 'noRetaliation')`
  (`combat/actions.ts:312-313`, idem préviz `damage.ts:398-402`) — le porteur
  ne riposte jamais quand on l'attaque, l'exact inverse (capacité-malus).
  Corriger en testant le `strikerDef` + test fixant la direction.
- [x] **A3 — Attribut Défense du héros compté −5 %/pt au lieu de −2,5 %/pt.**
  Doc 02 §1.1:16 + note §5.3:232-236 explicite (« s'ajoutera au MVP »).
  Code : `heroDefenseOf` sommé brut dans la pente symétrique
  `attackDefenseStep: 0.05` (`combat/damage.ts:153-157,237-243`). Introduire
  une pente défensive héros dédiée (0,025) dans `data/core/config.json`
  (règle « jamais codé en dur »). → vérif : test de dégâts avec héros
  défenseur ; équilibrage grossier re-passé.
- [x] **A4 — Hâte/Lenteur/Entraves sans effet sur la portée de déplacement.**
  Doc 02:212 « la vitesse est la portée de déplacement en hexes ». Les 4
  sorts à `speedMod` (spells.json:68,78,136,213) n'affectent que l'initiative
  (`combat/turns.ts:17-20`), pas `reachableHexes`/`effectiveSpeed`
  (`actions.ts:30`, `state-helpers.ts:35-43`). Intégrer la somme des
  `speedMod` (bornée ≥ 0) dans `effectiveSpeed`, utilisée partout (IA
  comprise). → vérif : test « Lenteur réduit la portée ».
- [x] **A5 — Prévisualisation de dégâts ≠ résolution (murs de siège,
  Symbiose, Marques en riposte).** `estimateDamage`
  (`damage.ts:359-366,416-425`) omet `wallDefenseBonus`,
  `symbiosisAttack/DefenseBonus` et `markConsumeBonus` côté riposte, alors
  que `performStrike` les applique (`damage.ts:231-245,252`). La préviz
  « même formule sans tirage » (doc 08 §2.4) ment en siège et face aux
  Sylvan ; l'IA, qui score via `estimateDamage` (`ai.ts:176`), hérite du
  biais. Aligner les termes + tests préviz=résolution en siège et symbiose.
- [x] **A6 — Réduction de coût de mana « Magie par école » non filtrée par
  école.** Doc 02 §1.3:41 « par école ×4 ». Code : `heroManaCostReduction`
  somme TOUTES les compétences (`hero/skills.ts:70-72`), `effectiveManaCost`
  ne transmet pas `spell.school` (`hero/spells.ts:14-21`) ⇒ Magie du Feu
  réduit l'Eau/la Traque, cumul −80 % possible. Filtrer par l'école du sort.
- [x] **A7 — Bonus d'artefact `knowledge` mort (Orbe de savoir sans effet).**
  `heroManaMax = attributes.knowledge × 10 + bonus.manaMax`
  (`hero/artifacts.ts:50-52`) ignore `bonus.knowledge` pourtant sommé (l.41).
  Corriger : `(knowledge + bonus.knowledge) × 10 + bonus.manaMax`.
- [x] **A8 — Sort d'aventure lançable en combat comme faux buff.**
  `validateCastSpell` ne rejette pas `kind: 'adventure'`
  (`hero/index.ts:38-65`) ⇒ Ville-portail posable en combat pour 16 mana
  (statut à mods 0). Rejeter au validateur (filtre UI au Lot C).
- [x] **A9 — Contrat de chasse : blocage définitif + pas d'échéance hebdo.**
  Doc 05:174 « avant la fin de la semaine ». Code : `assignHuntContracts`
  saute tout joueur ayant déjà un contrat (`town/hunt-contract.ts:36-52`) et
  seul le héros du joueur sous contrat libère la cible ⇒ si un tiers tue le
  gardien (`combat/turns.ts:179-180`), contrat insoluble à jamais, plus
  aucune assignation. Au `WeekStarted` : expirer/réassigner ; libérer tout
  contrat dont la cible n'existe plus. → vérif : tests expiration + cible
  tuée par un tiers.
- [x] **A10 — Objectifs de victoire des joueurs IA jamais évalués.**
  Doc 02:275-276 « par joueur » ; conquest déclare une victoire
  `captureTown('start-town')` pour `ai-1`. Code : `evaluateOutcome` n'évalue
  que le premier joueur humain (`scenario/outcome.ts:74-77`) — data morte,
  l'IA « gagne » sans fin de partie. Évaluer la victoire de chaque joueur non
  éliminé ; victoire d'un ennemi ⇒ défaite du joueur local. → vérif : test
  « l'IA capture start-town ⇒ partie perdue ».
- [x] **A11 — Trigger `onDay` du jour 1 indéclenchable.** Le schéma accepte
  `day ≥ 1` (`content/schemas.ts:564`) mais `fireDayTriggers` n'est appelé
  qu'à la bascule de jour (`core/engine.ts:541`), jamais à `StartGame`
  (jour 1, engine.ts:429). Appeler les triggers du jour 1 en fin de
  `StartGame` + test (bug latent : proto-01 utilise day 2).

## 2. Lot B — Bugs mineurs & validation (corriger le CODE) — P1

- [x] **B1 — `RecruitUnits` accepte un effectif non entier** (2,5 créatures
  persistées). Ajouter `Number.isInteger(cmd.count)`
  (`town/recruit.ts:29-38`), comme `TradeResources` (`market.ts:54`).
- [x] **B2 — Récompense de quête : artefact poussé en 11ᵉ slot**
  (`quest/evaluate.ts:64-65`) — casse l'invariant 10 slots (state.ts:89-90).
  Aligner sur le comportement du ramassage au sol.
- [x] **B3 — Joueur éliminé : son héros persiste et rapporte encore.**
  L'or/jour de la compétence Économie ne filtre pas `eliminated`
  (`core/engine.ts:523-529`, contrairement aux mines `town/economy.ts:28`) ;
  le héros reste un obstacle de pathfinding et une cible de gardiens.
  Retirer les héros à `PlayerEliminated` (ou a minima filtrer `eliminated`).
- [x] **B4 — `townPortal` ignore l'occupation de la tuile d'arrivée**
  (`hero/index.ts:148-160`) ⇒ deux héros superposés possibles. Valider la
  tuile (ou choisir une adjacente libre).
- [x] **B5 — IA d'aventure : chemins traversant des gardiens non ciblés**
  (`ai/adventure.ts:118,141`) ⇒ interceptions non planifiées à marge < 1,5×.
  Exclure du pathfinding IA les tuiles de gardien non ciblées ; dupliquer le
  garde-fou « armée vide ⇒ refus d'engager » dans `beginGuardianCombat`
  (latent : R1 E1 ne couvre que le validateur humain).
- [x] **B6 — Machine de guerre = −1 moral pour toute l'armée.** La baliste
  (`groupId: 'war-machine'`, client `game.ts:120-128`) compte comme une
  « faction » dans `moraleOf` (`combat/state-helpers.ts:58-72`). Exclure les
  machines du décompte via un marqueur de données (pas de cas particulier
  moteur).
- [x] **B7 — Bonus d'artefact `morale` sommé mais jamais branché**
  (`hero/artifacts.ts:43` vs `state-helpers.ts:46-49`) — latent (aucun
  artefact core n'en porte). Brancher comme la chance (`damage.ts:160-168`).
- [x] **B8 — Garde procédurale de version de sauvegarde.** La garde a déjà
  été contournée deux fois (champ requis `symbiosisStacks` ajouté en 5.3
  sans bump — NaN démontrable sur une save v6 avec combat en cours ;
  `visitLuck` intra-PR #83). Ajouter un test qui snapshotte la FORME de
  `GameState` et échoue si elle change sans bump de `CURRENT_SAVE_VERSION`
  (`core/state.ts:119-130`).

## 3. Lot C — Client/UI (corriger le CODE) — P1

- [x] **C1 — École `traque` invisible dans le grimoire de combat.**
  `SCHOOL_ORDER` omet `traque` (`ui/SpellBook.tsx:17`) : sorts connus,
  acceptés par le moteur, jamais affichés. Dériver l'ordre du catalogue +
  texte de préviz `applyMarks` (`SpellBook.tsx:236-249`).
- [x] **C2 — Grimoire : disponibilité/coût sans la réduction Magie.**
  `castable = mana >= manaCost` brut (`SpellBook.tsx:169,180`) alors que le
  moteur encaisse `effectiveManaCost` ⇒ sorts lançables affichés grisés,
  coût affiché faux. Utiliser `effectiveManaCost` (après A6).
- [x] **C3 — Sorts de départ : tout le catalogue cercle ≤ 3, école de faction
  et sort d'aventure compris** (`app/game.ts:183-185`) — un héros Haven
  connaît les sorts de Traque dès le jour 1. Exclure l'école de faction des
  autres maisons (A8 gère le sort d'aventure).
- [x] **C4 — Le rendu du brouillard ignore le bonus de vision Recherche.**
  Le moteur révèle avec `visionRadius + heroVisionBonus`
  (`adventure/movement.ts:62-67`), le client dessine avec
  `config.visionRadius` seul (`AdventureScene.ts:103`, `render/fog.ts:32-41`)
  ⇒ anneau faussement grisé. Passer le rayon effectif par héros.
- [x] **C5 — Préviz de chemin : « jours nécessaires » réduit à un booléen
  aujourd'hui/plus tard** (`AdventureScene.ts:212-220`) — doc 02:76 promet le
  compte de jours. Resegmenter par allocation quotidienne de PM.
- [ ] Vérif de lot : smoke Playwright (desktop + mobile) vert ; audit i18n
  0 chaîne en dur maintenu.

## 4. Lot D — Décisions de design à trancher (recommandation incluse)

Chaque décision = correctif code OU ligne de doc, dans le même commit.

- [x] **D1 — XP de combat réservée à l'attaquant vainqueur**
  (`combat/turns.ts:146-151`) : un héros qui gagne en DÉFENSE (siège subi)
  ne gagne rien. *Reco : créditer le héros du camp vainqueur (code).*
- [x] **D2 — Effets de faction post-victoire (Nécromancie, Essence) réservés
  à l'attaquant** (`combat/turns.ts:168-173` ; docs 04:38/05:52 disent
  « après chaque victoire »). *Reco : cohérence avec D1 — étendre au
  défenseur vainqueur (code) ; sinon noter « en tant qu'attaquant » docs
  04 §2 et 05 §3.3.*
- [x] **D3 — Stock de base orphelin après upgrade du dwelling niveau 2**
  (`town/helpers.ts:24-34`, `recruit.ts:31-35`) : le stock accumulé de
  l'unité de base devient irrécupérable. *Fait : `unitIsRecruitable` /
  `builtDwellings` itèrent TOUS les niveaux bâtis ⇒ base ET améliorée
  recrutables (façon HoMM) ; test `town-upgrade.test.ts` D3.*
- [x] **D4 — « 1 seul Capitole par joueur » non appliqué** (doc 02:152 ;
  `town/build.ts:13-61` — townHall niv 4 possible dans chaque ville).
  *Fait : flag générique data-driven `uniquePerPlayer` sur `BuildingLevel`
  (schéma + townHall@4) ; `validateBuildStructure` rejette (code
  `uniquePerPlayer`) si une autre ville du joueur porte déjà ce niveau ;
  test `town-build.test.ts`.*
- [x] **D5 — `consumeMarks` déclenché aussi en riposte** (`damage.ts:252` via
  `actions.ts:317-326`) — doc 05:36 dit « à l'attaque », et la préviz ne le
  reflète pas. *Reco : restreindre aux frappes volontaires (code), lecture
  stricte de la doc.*
- [ ] **D6 — Arrêt du héros au ramassage de ressource/artefact**
  (`adventure/movement.ts:104-117,156` — le commentaire cite la doc à tort).
  *Reco : retirer le `break` (fidélité HoMM, guidelines §8.5) ; sinon
  l'acter doc 02 §2.2.*
- [x] **D7 — Cap de Nécromancie sur l'effectif post-combat** vs « effectif
  initial » (doc 04:38 ; `faction/effects.ts:78-79`). *Reco : corriger la
  doc (« effectif restant ») — plus conservateur et déjà équilibré ainsi.*
- [x] **D8 — Prérequis « Château » des T7/T8 absent** (docs 03:76/04:69/
  05:217 ; les dwellings sommets ne requièrent que le tier précédent, et
  aucun bâtiment « château » n'existe). *Fait : `fort@3` ajouté au `requires`
  du dwelling sommet — T7 Haven & Necropolis, T8 Arcane Hunters (l'apex AH ;
  doc 05 gâte le Portail T8 par « T7 + Château »). Pur diff data ; balance
  + recruit tests re-passent (stats d'unités inchangées).*
- [x] **D9 — Tableau des Contrats : prérequis `townHall` au lieu de `tavern`**
  (doc 05:213 ; `arcane-hunters/buildings.json:185` — la taverne core n'est
  pas dans la ville AH). *Fait : `tavern` ajoutée à la ville AH (manifest) +
  `requires` du contrat passé à `tavern@1` ; test contenu D9 (repérage par
  effet `huntContract`, pas d'id de faction en dur) + smoke ajusté (bâtir la
  taverne j1, le contrat j2).*
- [x] **D10 — Marques sans effet sur les dégâts des sorts** (doc 05:157
  « +8 % des unités AH ET des sorts de Traque » ; `hero/spells.ts:33-40`
  ignore `target.marks`). *Reco : appliquer `markBonusPerStack × marks` aux
  sorts de dégâts (code).*
- [ ] **D11 — Littéral `'traque'` dans l'union `SpellSchool` du moteur**
  (`hero/types.ts:9`) : pas une violation du garde-fou (aveugle aux écoles),
  mais un nom propre à une faction dans le moteur ; toute future école de
  faction = diff moteur. *Reco : `SpellSchool = string` validée par les
  données.*
- [x] **D12 — Coûts des unités élites : asymétrie suspecte** relevée par
  l'audit factions (élite moins chère que la base chez Haven/Necropolis,
  2-3× plus chère chez Arcane Hunters) — aucune table d'élites dans les
  docs pour arbitrer. *Fait : table des unités élites (nom/stats/coût/
  capacités, chiffres extraits des `units.json`) ajoutée aux docs 03/04/05
  (§3bis/§4bis) + mécanisme corrigé (dwelling niveau 2, pas `upgradeOf`).
  Asymétrie chiffrée : premium or élite/base Haven ~1,44× / Necropolis
  ~1,65× / AH 1,80× uniforme ; à revoir aussi la parité de capacités
  (élites Haven/Necro perdant leur signature). Arbitrage des coûts renvoyé
  à `faction:sim` (couvre la partie « table » de E5).*

## 5. Lot E — Remise à niveau documentaire (corriger la DOC)

- [ ] **E1 — docs/07-architecture.md** : `CURRENT_SAVE_VERSION` 4 → **8**
  (+ historique v5 huntContract, v6 warMachines, v7 quests, v8 objets de
  carte/pendingTreasure/visitLuck) ; §2 : structure de packages réelle
  (`engine/src/ai` interne, `@heroes/content` avec schémas, pas
  d'`engine-api` ni de `schemas/` racine) ; §3 : Web Worker « différé,
  interface prête » (`dispatch.ts` synchrone assumé) ; §4 : autosave fin de
  tour (aligner doc 01 pilier:16), métadonnées `packs` sans versions
  (différé avec les migrations).
- [ ] **E2 — docs/02-mechanics.md** : table des capacités §5.4 (9 au
  catalogue : + `consumeMarks`, `demonform`, `symbiosis` — renvoi docs
  05/14 ; capacités « extrait » non implémentées marquées différées) ;
  §4.1 : notes d'état Guilde des mages (apprentissage différé — l'effet
  `mageGuild` n'a AUCUN consommateur moteur, bâtiment payé pour rien),
  Taverne (zéro effet livré : ni recrutement de héros, ni rumeurs, ni
  moral +1 défense), coûts réels hôtel de ville niv 3/4 (gemmes/cristal,
  buildings.json:18,23) ; §3 : marché livré = ressource↔or à taux plats
  (taux dégressif + troc ressource↔ressource différés) ; §1.2 : profil de
  montée unique 30/30/20/20 (classes de héros différées) ; §1.5/§4.1 :
  multi-héros (8), échanges entre héros, recrutement en taverne, combat
  héros-vs-héros — différés sans note aujourd'hui ; §2.2 : sémantique
  d'interception de gardien (paie le pas d'engagement, n'entre pas sur la
  tuile ; gardien en dernier pas uniquement) ; grâce/élimination actives en
  scénario uniquement (`outcome.ts:55`) ; « un seul choix de compétence
  visible » (montées en chaîne, `experience.ts:68-73`) ; XP à la victoire
  uniquement ; terrain natif ×1,0 et PM d'artefacts : différés ou retirés ;
  `RETAKE_GRACE_DAYS` : exempter les constantes calendaires du « tout en
  données » ou déplacer en config.
- [ ] **E3 — docs/06-modularity.md** : §2 structure de paquet réelle
  (manifest + units/ + buildings.json + locales/ ; PAS de heroes/, skills,
  abilities/*.ts, assets/ par paquet ; les sorts d'école de faction vivent
  au catalogue CORE — contredit l'auto-containment, à acter) ; §4 : le
  mécanisme livré est « capacités génériques inline paramétrées par les
  données » — les interfaces `AbilityModule`/`AdventureHook` n'existent pas
  (schémas les forcent vides, schemas.ts:124-125) ; §3 : exemple
  `factionBonuses` avec un type inexistant (`onAttackApplyStatus`) — les 2
  types réels sont `raiseUndeadOnVictory`/`gainFactionResourceOnVictory`
  (faction/types.ts:30) ; §5.6 : « faction:sim reste à écrire » est FAUX
  (`tools/src/faction-sim.ts` + balance.test.ts existent).
- [ ] **E4 — docs/01-gdd-overview.md** : carte MVP 32×32 (pas ~72×72) ;
  « sauvegarde à chaque fin de tour » (pas « à chaque action ») ; 4
  scénarios (prologue inclus) ; hot-seat livré.
- [ ] **E5 — docs 03/04/05/14 (factions)** :
  doc 03 — F1 : mécanisme d'élite réel = dwelling niveau 2 (pas
  `upgradeOf`) ; table des unités élites à ajouter (14/maison livrées sans
  aucune doc — noms, stats, coûts) ; « 6 capacités » (03:11) → 9.
  doc 04 — F6 : « −1 moral aux vivants adverses » ajouté à la liste
  « Différé » ; F5/D7 : formulation du cap de Nécromancie.
  doc 05 — F8 : astérisque « 60 Essence différée » sur la table §5 ; F9 :
  diagramme §5 (T8 branché sur T7, pas T6) ; F3 : `sharedGrowthGroups`
  apex ni déclaré (manifest vide) ni câblé — acter ou déclarer ; chiffres
  livrés des Cercles (placeholder +250/+400 or/j, +20/40 % croissance) et
  du Contrat (300 or + 15 Essence) ; Salle des Reliques jamais mentionnée
  dans les reports — l'ajouter aux différés.
  doc 14 — F15 : phrase des prérequis §4 fausse (T1 requiert fort, T5
  requiert mageGuild dans les données).
- [ ] **E6 — docs/13-plan-narrative-polish.md** : annoter §4.1/§5/§6 vs le
  livré N2 réel : prologue AJOUTÉ en 4ᵉ scénario (tutorial intact),
  2 quêtes/2 dialogues (pas 3/4) ; quêtes sans `trigger` (démarrage en bloc
  à `StartGame` — reporté N3) ; conditions réduites (4 types) et récompenses
  sans XP/sort ; journal sans centrage caméra ni badge « ! » ;
  `choices`/`setFlag` validés par le schéma mais silencieusement ignorés
  par le client (`narrative.ts:48-68`) — retirer du schéma ou garde
  `content:check` ; trancher la contradiction « conditions événementielles »
  vs « évaluation pure d'état » avant N3.
- [ ] **E7 — CLAUDE.md** : save v8, faction `sylvan-court` dans l'arbo,
  4 scénarios, systèmes livrés depuis la dernière mise à jour (marché,
  machines de guerre, upgrades d'unités, contrats de chasse, hot-seat,
  quêtes/prologue, mines capturables/coffres/lieux de bonus, éditeur),
  renvoi vers ce plan.
- [ ] **E8 — Hygiène des commentaires menteurs** (au fil des lots A–C) :
  `hero/skills.ts:34,39,49` (« NON branché » alors que branché),
  `combat/damage.ts:24-25`, `town/types.ts:28` (forge « sans effet » alors
  que warMachineVendor), `adventure/movement.ts:33` (fausse citation doc),
  `adventure/config.ts:74` (« classes au MVP »).

## 6. Ordre d'exécution & vérification

1. **Lot A** (P0, moteur) → tests unitaires nouveaux ; golden replay re-fixé
   une fois en fin de lot ; équilibrage grossier re-passé ; bump
   `CURRENT_SAVE_VERSION` si la forme de l'état change (aucun changement
   prévu, sauf arbitrage D3).
2. **Lot B** (P1, moteur) → tests unitaires ; B8 verrouille le processus de
   versioning pour la suite.
3. **Lot C** (P1, client) → smoke Playwright desktop + mobile.
4. **Lot D** : arbitrages (recommandations ci-dessus par défaut) — chaque
   décision appliquée code OU doc dans le même commit.
5. **Lot E** (docs) — peut avancer en parallèle des lots A–C, sauf sections
   dépendantes d'un arbitrage D.
6. Fin de chantier : CI complète (typecheck, lint, tests, garde-fou faction,
   budget < 800 Ko gzip, smoke) + mise à jour finale de ce plan.

## Journal

- 2026-07-07 : plan créé à l'issue de la revue (7 audits parallèles +
  contre-vérification manuelle de A1, A2, A6, A7, A10, F5, F6, F12, F14).
  Aucun correctif appliqué — les arbitrages du Lot D restent à valider.
