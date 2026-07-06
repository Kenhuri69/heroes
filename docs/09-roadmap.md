# 09 — Roadmap

Estimations pour une petite équipe (2–3 dev + 1 artiste temps partiel). Chaque phase se termine par un jalon **jouable et testé**.

## Phase 0 — Fondations (3–4 semaines)

- Monorepo pnpm + Vite + TS strict + CI (typecheck, lint, tests, budgets).
- `packages/engine` : boucle commande→état→événements, RNG seedé, sérialisation `GameState`.
- Schémas de contenu + chargeur/validateur de paquets ; paquet « faction de test » minimal généré par `faction:new`.
- Client : canvas Pixi qui rend une carte de tuiles, pan/zoom souris + tactile, shell UI Preact.
- **Jalon** : déplacer un héros sur une carte JSON, fin de tour, sauvegarde/rechargement IndexedDB.

## Phase 1 — MVP (10–14 semaines)

> ✅ **MVP livré** (sous-phases 3.1→3.6, cf. `docs/11-plan-mvp-implementation.md`
> et le journal de phases dans `CLAUDE.md`) : les items ci-dessous sont
> implémentés et vérifiés (unitaires + smoke Playwright desktop/mobile). Restent
> pour l'Alpha les items explicitement différés (upgrades d'unités, capacités
> spéciales de faction avancées, `faction:sim` d'équilibrage fin, sorts
> d'aventure, hot-seat/PvP, assets peints).

- **Combat hex complet** (grille 12×10, vagues d'initiative, riposte, moral/chance, catalogue de ~20 capacités, sorts en combat, IA de combat, auto-combat, prévisualisation de dégâts).
- **Carte d'aventure** : brouillard 2 états, ~25 objets, mines, gardiens neutres, pathfinding multi-jours.
- **Villes** : arbre complet, 1 bâtiment/jour, recrutement, croissance hebdo, capture, écran de ville (liste d'abord, vue peinte simple).
- **Héros** : progression, 12 compétences, ~20 sorts (2 écoles + neutres), inventaire/artefacts.
- **Factions Haven + Necropolis** complètes en données (T1–T7, placeholders artistiques acceptés) ; Nécromancie via le pipeline de contenu (test de modularité n°1).
- 3 scénarios solo + 1 IA d'aventure simple ; hot-seat local si le temps le permet (sinon Alpha).
- UI mobile complète (portrait + paysage), i18n FR/EN.
- **Jalon / critères** : cf. doc 01 §5 (partie complète desktop + iOS, 60 fps, 3ᵉ faction test sans diff moteur).

## Phase 2 — Alpha (8–10 semaines)

> 🚧 **Alpha démarrée (4.1)** : cadrage Arcane Hunters livré
> (`.claude/plans/phase-4.1-arcane-hunters-cadrage.md`, doc 05 « État 4.1 »).
> Décomposition en sous-lots 4.2→4.7, chacun ouvrant **un** point d'extension
> moteur générique (Marque, consommation de charges, Essence, choix de Cercle,
> contrats hebdo, `demonform`) + les données qui l'exercent — garde-fou
> « zéro faction dans le moteur » maintenu. **4.11 livré** : upgrades d'unités
> pour toutes les factions (habitations graduées `maxLevel:2` = données pures +
> commande générique `UpgradeUnits`, doc 02 §4.1). **4.13 livré** : sièges v1
> (fondation) — attaquer une ville défendue ⇒ combat de siège générique
> (`beginTownCombat`) + bonus de défense « murs » du Fort ; villes neutres
> assiégeables en données ; tour/catapulte différés v2 (doc 02 §4.1). **4.14
> livré** : escarmouche vs IA — partie 1v1 **générée à l'exécution** (factions
> choisies + difficulté), la difficulté étant un **levier de données**
> (`skirmishStartCommand` met l'armée/les ressources de l'IA à l'échelle) ;
> **zéro code de difficulté ni nom de faction dans le moteur** (doc 08 §2.5).
> **4.15 livré** : **hot-seat** — l'escarmouche accepte un 2ᵉ joueur humain local ;
> le HUD/brouillard/sélection se re-keyent au joueur **actif** (`humanId` suit
> `currentPlayer`) et un overlay « passez l'appareil » sépare les tours ; **aucun
> code moteur** (la boucle IA s'arrête déjà sur chaque humain, doc 08 §3).
> **4.16 livré** : **sorts d'aventure** — ouverture du sous-système hors combat
> (kind `adventure` + effet déclaratif + commande `CastAdventureSpell` +
> restauration quotidienne de la mana). Sort phare **Ville-portail** ; extensible
> en pure donnée (doc 02 §1.4). **Fin de l'item ligne 47.** Restent : `faction:sim`
> + équilibrage, puis éditeur de carte.

- **Arcane Hunters** produite intégralement via le pipeline de faction (validation grandeur nature de la doc 06 — aucun diff moteur hors ouverture de points d'extension génériques).
- ✅ **Unités améliorées (upgrades)** pour toutes les factions (4.11) ; ✅ **machines de guerre basiques** (Baliste, achetée à la Forge — 4.12) ; ✅ **sièges v1 fondation** (combat de ville défendue + murs — 4.13) ; tour de garde / catapulte = v2.
- ✅ **Escarmouche vs IA** (choix des factions + difficulté — 4.14) : partie 1v1 générée à l'exécution, difficulté = levier de **données** (armée/ressources IA mises à l'échelle, aucun code de difficulté dans le moteur). ✅ **Hot-seat** (4.15) : deux humains locaux alternent, plateau re-keyé au joueur actif + overlay « passez l'appareil » — **zéro code moteur** (`runAiLoop` s'arrête déjà sur chaque humain). ✅ **Sorts d'aventure** (4.16) : sous-système hors combat (kind `adventure` générique + `CastAdventureSpell` + restauration quotidienne de la mana) ; sort livré = **Ville-portail** (téléportation vers une ville possédée).
- ✅ **Outil `faction:sim`** + **première passe d'équilibrage** (4.17) : simulation d'auto-combats à valeur d'or égale entre factions (armées T1–T7, N graines × 2 sens, RNG seedé), rapport de winrates + garde-fou anti-déséquilibre béant. 1ᵉʳ pass : Havre (100 % dominant) ramené dans la bande (défenses + coûts), Arcane Hunters durcie ; plus aucun déséquilibre béant. Réglage fin vers 45–55 % = itérations ultérieures avec l'outil.
- ✅ **Éditeur de carte interne minimal** (4.18) : outil in-client (route `editor` / `#editor`) — grille DOM peinte au clic (4 terrains), placement de positions de départ / ressources / villes, **export d'un `.map.json` validé par `mapFileSchema`** (jamais d'export invalide) + import d'une carte existante. Gardiens / triggers / routes = raffinement ultérieur.
- Playtests fermés hebdomadaires (activité ops) ; ✅ **télémétrie locale opt-in** (4.19) : collecteur **100 % local** (localStorage), désactivé par défaut, activable dans les Options — durée des tours + taux de combats auto-résolus (« abandon ») ; export/reset ; rien n'est envoyé.
- **Jalon** : 3 factions équilibrées, escarmouche rejouable, retours de 20+ playtesteurs traités.

## Phase 3 — Beta (10–12 semaines)

> 🚧 **Beta démarrée par la 4ᵉ faction (5.1)** — l'item **backend** (ci-dessous)
> requiert des décisions d'infra (hébergement/DB/auth) relevant du porteur du
> projet ; il attend une direction. La 4ᵉ faction, elle, est **autonome et
> in-paradigme** : continuation du pipeline data-driven prouvé 3×. Cadrage
> **Sylvan Court** livré (`docs/14-faction-sylvan-court.md`) — signature `symbiosis`
> (1 module de combat générique, aucun nouveau point d'extension de framework),
> **4ᵉ test de modularité**. Créneau « vote communauté » : choix par défaut,
> réversible. Décomposition 5.1 cadrage ✅ → 5.2 données ✅ → 5.3 `symbiosis` ✅ → 5.4
> équilibrage/finitions ✅. **Sylvan Court complète.**

- **Backend Node.js** (doc 07 §5) : comptes (magic link), cloud saves, **PvP asynchrone** avec notifications ; serveur autoritaire par re-simulation. *(attend une direction d'infra)*
- ✅ **4ᵉ faction — Sylvan Court complète** (5.1→5.4 livrés — doc 14) : produite via le pipeline de faction (doc 06), signature `symbiosis` en 1 point d'extension générique, équilibrée via `faction:sim` (0 blowout), Bosquet du Cœur (`growthBonus`). **4ᵉ test de modularité réussi** — zéro nom de faction dans `packages/`.
- DA finale par faction (remplacement des placeholders), audio complet, PWA hors-ligne.
- Équilibrage continu piloté par les données serveur ; classement saisonnier expérimental.
- Accessibilité complète (audit), performances re-validées sur parc mobile élargi.
- **Jalon** : beta ouverte navigateur, PvP asynchrone stable, rétention J7 mesurée.

## Phase 4 — Live (continu)

- PvP temps réel à timer, générateur de cartes aléatoires, campagne narrative.
  - 🚧 **Polishing narratif démarré** (doc 13, à lancer post-Alpha) : lot **N1 — La voix du monde** ✅ (textes d'ambiance `loreKey` sur tout le contenu des 4 factions, affichés dans les écrans existants, zéro diff moteur). Reste N2 systèmes de quêtes/dialogues → N3 campagnes fondatrices → N4 chasse & vivant.
- Cadence de contenu : **1 faction/trimestre** (le pipeline doc 06 est l'outil de production), saisons, cosmétiques si monétisation activée (doc 01 §4).

## Risques principaux & parades

| Risque | Parade |
|--------|--------|
| Le combat n'est pas « fun » assez tôt | Le combat est développé **en premier** en Phase 1, testable seul via une scène de combat direct (« arène ») dès la semaine 2 |
| La promesse de modularité ne tient pas | Testée 3 fois avant la Beta (faction de test Phase 0, Nécromancie MVP, Arcane Hunters Alpha) avec critère CI « zéro diff moteur » |
| Performances mobiles | Budgets chiffrés en CI dès la Phase 0, pas d'optimisation de dernière minute |
| Scope creep (le genre y pousse) | Tout ajout passe par la liste « Exclus du MVP » de la doc 01 ; sièges, upgrades, météo… ont déjà leur phase assignée |
| Équilibrage à 3+ factions | Simulation automatisée `faction:sim` + plafonds data-driven sur les mécaniques exponentielles (Nécromancie, Marques, Essence) |
