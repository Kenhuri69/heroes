# Heroes — Might & Magic Browser Remake

Recréation moderne en JavaScript/TypeScript du gameplay de **Might & Magic: Heroes Online** (ex-jeu Flash navigateur) : exploration par héros sur carte d'aventure, gestion de villes, armées et combats tactiques tour par tour sur grille hexagonale.

Cible : **navigateur desktop + mobile** (responsive, touch-friendly), architecture **data-driven modulaire** permettant d'ajouter de nouvelles « maisons » (factions) sans toucher au moteur.

## Documentation de spécification (Phase 1)

| # | Document | Contenu |
|---|----------|---------|
| 01 | [Vue d'ensemble & GDD haut niveau](docs/01-gdd-overview.md) | Vision, core loop, piliers, monétisation, scope MVP |
| 02 | [Mécaniques détaillées](docs/02-mechanics.md) | Héros, carte d'aventure, ressources, combat hex, town building |
| 03 | [Faction : Haven](docs/03-faction-haven.md) | Lore, unités (T1–T7), bâtiments, bonus, héros |
| 04 | [Faction : Necropolis](docs/04-faction-necropolis.md) | Lore, unités (T1–T7), bâtiments, bonus, héros, Nécromancie |
| 05 | [Faction : Arcane Hunters](docs/05-faction-arcane-hunters.md) | Nouvelle maison (Poudlard × Demon Hunter) : lore, 8 tiers, mécaniques uniques |
| 06 | [Système de modularité (factions)](docs/06-modularity.md) | Plan data-driven, dossiers, interfaces, checklist d'intégration, futures maisons |
| 07 | [Architecture technique](docs/07-architecture.md) | Frontend TS/PixiJS, state management, backend Node.js, sauvegardes, réseau |
| 08 | [UI / UX](docs/08-ui-ux.md) | Écrans principaux, wireframes, adaptation mobile |
| 09 | [Roadmap](docs/09-roadmap.md) | Phases MVP → Alpha → Beta → Live |

## Stack pressentie (résumé)

- **Rendu** : PixiJS 8 (WebGL/WebGPU, fallback canvas) — voir justification dans [07-architecture](docs/07-architecture.md).
- **Langage** : TypeScript strict, moteur de règles pur (déterministe, sans dépendance au rendu).
- **Contenu** : 100 % data-driven (JSON + manifestes de faction), validé par schémas.
- **Backend (post-MVP)** : Node.js + WebSocket pour l'asynchrone/PvP, sauvegarde locale (IndexedDB) au MVP.

## Principes non négociables

1. **Le moteur de règles ne connaît aucune faction.** Tout contenu passe par les données.
2. **Simulation déterministe** (RNG seedé) : replays, tests, et anti-triche serveur gratuits.
3. **Touch-first** : chaque interaction est conçue au doigt d'abord, à la souris ensuite.
4. **Fidélité au core loop HoMM** avant toute innovation.
