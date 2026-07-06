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
> assiégeables en données ; tour/catapulte différés v2 (doc 02 §4.1).

- **Arcane Hunters** produite intégralement via le pipeline de faction (validation grandeur nature de la doc 06 — aucun diff moteur hors ouverture de points d'extension génériques).
- ✅ **Unités améliorées (upgrades)** pour toutes les factions (4.11) ; ✅ **machines de guerre basiques** (Baliste, achetée à la Forge — 4.12) ; ✅ **sièges v1 fondation** (combat de ville défendue + murs — 4.13) ; tour de garde / catapulte = v2.
- Escarmouche vs IA (config de carte, difficulté), hot-seat, sorts d'aventure (Ville-portail…).
- Outil `faction:sim` + première passe d'équilibrage sérieuse (winrates 45–55 %).
- Éditeur de carte interne minimal (accélère la prod de contenu).
- Playtests fermés hebdomadaires ; télémétrie locale opt-in (durée des tours, taux d'abandon des combats).
- **Jalon** : 3 factions équilibrées, escarmouche rejouable, retours de 20+ playtesteurs traités.

## Phase 3 — Beta (10–12 semaines)

- **Backend Node.js** (doc 07 §5) : comptes (magic link), cloud saves, **PvP asynchrone** avec notifications ; serveur autoritaire par re-simulation.
- 4ᵉ faction (choisie parmi les pré-concepts de la doc 06 §6 — vote de la communauté).
- DA finale par faction (remplacement des placeholders), audio complet, PWA hors-ligne.
- Équilibrage continu piloté par les données serveur ; classement saisonnier expérimental.
- Accessibilité complète (audit), performances re-validées sur parc mobile élargi.
- **Jalon** : beta ouverte navigateur, PvP asynchrone stable, rétention J7 mesurée.

## Phase 4 — Live (continu)

- PvP temps réel à timer, générateur de cartes aléatoires, campagne narrative.
- Cadence de contenu : **1 faction/trimestre** (le pipeline doc 06 est l'outil de production), saisons, cosmétiques si monétisation activée (doc 01 §4).

## Risques principaux & parades

| Risque | Parade |
|--------|--------|
| Le combat n'est pas « fun » assez tôt | Le combat est développé **en premier** en Phase 1, testable seul via une scène de combat direct (« arène ») dès la semaine 2 |
| La promesse de modularité ne tient pas | Testée 3 fois avant la Beta (faction de test Phase 0, Nécromancie MVP, Arcane Hunters Alpha) avec critère CI « zéro diff moteur » |
| Performances mobiles | Budgets chiffrés en CI dès la Phase 0, pas d'optimisation de dernière minute |
| Scope creep (le genre y pousse) | Tout ajout passe par la liste « Exclus du MVP » de la doc 01 ; sièges, upgrades, météo… ont déjà leur phase assignée |
| Équilibrage à 3+ factions | Simulation automatisée `faction:sim` + plafonds data-driven sur les mécaniques exponentielles (Nécromancie, Marques, Essence) |
