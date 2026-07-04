@.claude/guidelines.md

# Heroes — Mémoire Projet

Recréation navigateur du gameplay de *Might & Magic: Heroes Online* :
exploration par héros sur carte d'aventure, gestion de villes, armées et
combats tactiques tour par tour sur grille hexagonale.
Cible desktop + mobile (touch-first), architecture data-driven modulaire.

> 🚧 **Phase actuelle : Phase 2 — implémentation** (plan :
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
> < 800 Ko gzip vérifié en CI. **Sortie de Phase 2 atteinte** — la suite
> est la Phase MVP de la roadmap (doc 09).
> Les docs `docs/0X-*.md` restent la source de
> vérité du design ; le code doit s'y conformer.

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
  templates/faction-template.md  Gabarit pour spécifier une nouvelle maison
.github/workflows/
  ci.yml                         PR : typecheck, lint, tests, build, smoke headless
  deploy.yml                     main : build Vite + smoke sur build de prod + déploiement Pages
packages/
  engine/                        Moteur de règles pur (état, commandes, RNG PCG32) — @heroes/engine
  content/                       Schémas Zod + loader/validateur de paquets de faction — @heroes/content
  client/                        Client Vite + PixiJS 8 (rendu, caméra, scènes) — @heroes/client
  tools/                         CLI : faction:new, faction:validate, content:check — @heroes/tools
data/
  core/abilities.json            Catalogue générique de capacités (doc 02 §5.4)
  core/config.json               Constantes d'équilibrage (mouvement, terrains, vision, combat, héros, nouvelle partie)
  core/locales/                  Locales FR/EN de l'UI générique (menu, options, toasts)
  factions/                      Paquets de faction (index.json + arcane-hunters, test-faction)
  maps/proto-01.map.json         Carte prototype 32×32 (légende, tuiles, routes, objets, départs)
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
