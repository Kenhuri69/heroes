# 07 — Architecture technique

## 1. Choix de stack

### Rendu : **PixiJS 8** (retenu)

| Option | Verdict | Pourquoi |
|--------|---------|----------|
| **PixiJS 8** | ✅ retenu | Rendu 2D WebGL/WebGPU le plus performant du web, léger (~450 Ko), ne nous impose aucune structure de jeu — parfait puisque notre « moteur » est un moteur de *règles* maison. Excellent sur mobile. |
| Phaser 3/4 | ❌ | Framework complet (scènes, physique, input) dont on n'utiliserait que le rendu ; plus lourd ; sa boucle temps réel n'apporte rien à un tour par tour. |
| Godot 4 (export web) | ❌ | Exports WASM lourds (10 Mo+), démarrage lent sur mobile, iOS Safari fragile ; verrouille l'UI dans le canvas. |
| Canvas 2D pur | ❌ | Insuffisant pour les centaines de sprites animés + brouillard + particules à 60 fps mobile. |

**UI** : l'interface de gestion (ville, héros, inventaire, menus) est en **DOM (Preact + CSS)** superposé au canvas — accessibilité, texte net, layouts responsive gratuits. Le canvas ne rend que carte et combat. Ce split DOM/canvas est le choix le plus rentable pour un jeu de gestion.

### Langage & outillage

- **TypeScript strict** partout ; **Vite** (dev + build) ; **pnpm workspaces** (monorepo) ; **Vitest** (unitaires + property-based sur le moteur) ; **Playwright** (E2E, déjà préinstallé dans nos environnements) ; ESLint avec frontières d'imports (cf. doc 06 §4).

## 2. Découpage en packages

> **État livré** (le découpage a évolué en Phase 2/3 — voici la réalité ; le
> plan initial prévoyait un package `engine-api` et un package `ai` séparés,
> non retenus). Le moteur ne connaît toujours aucune faction, et les frontières
> d'import ESLint restent en place.

```
heroes/ (monorepo pnpm)
├── packages/
│   ├── engine/          # @heroes/engine — RÈGLES PURES : aucune dépendance DOM/Pixi.
│   │   ├── adventure/   # carte, mouvement, économie, calendrier
│   │   ├── combat/      # simulation hex, capacités, IA de combat
│   │   ├── ai/          # IA d'aventure (joueur ordinateur) — interne au moteur
│   │   ├── core/ hero/ town/ faction/ scenario/ quest/ net/  # règles par domaine
│   │   └── index.ts     # surface publique du moteur (consommée par client/content/tools)
│   ├── content/         # @heroes/content — schémas Zod + chargeur/validateur de paquets
│   ├── client/          # @heroes/client — rendu Pixi, UI Preact, input, scènes
│   └── tools/           # @heroes/tools — CLI faction:new/validate/sim, éditeur de carte
├── server/              # @heroes/server — (Beta) Worker Cloudflare + D1 (doc 15)
├── data/                # contenu : core/ (sorts neutres, artefacts…), factions/, maps/, scenarios/
└── docs/
```

Les schémas du contenu sont des **schémas Zod** dans `@heroes/content` (pas de dossier `schemas/` racine ni de JSON Schema séparé).

**Règle d'or** : `engine` est une **fonction pure** `(état, commande) → nouvel état + événements`. Il tourne à l'identique dans le navigateur, dans un worker, dans Node (serveur, simulation d'équilibrage) et dans les tests.

## 3. State management & boucle de jeu

### Modèle : event-sourcing léger sur commandes

```
UI/IA ──commande──► [validation] ──► engine.apply(state, cmd)
                                        │
                          ┌─────────────┴─────────────┐
                          ▼                           ▼
                     nouvel état                 événements[]
                    (immuable, Immer)        (MoveStepped, CombatStarted,
                          │                   DamageDealt, TownBuilt…)
                          ▼                           ▼
                   store client (Zustand)      couche présentation :
                   sélecteurs → UI Preact      animations Pixi, sons, toasts
```

- **Commandes** (`MoveHero`, `BuildStructure`, `RecruitUnits`, `CombatAction`…) : petites, sérialisables → c'est le protocole réseau futur ET le format de replay.
- **État** : un seul arbre sérialisable (`GameState`), mutations via Immer dans le moteur, exposé au client par un store **Zustand** (UI) tandis que Pixi écoute les **événements** pour animer (l'état saute à la fin, l'animation raconte le passage).
- **Déterminisme** : RNG **PCG32 seedé** dans l'état ; interdiction lintée de `Math.random`/`Date.now` dans `engine` et les modules de faction. Bénéfices : replays, tests reproductibles, combat auto re-simulable, anti-triche serveur (le serveur rejoue les commandes).
- **État livré** : `client/app/dispatch.ts` expose une **interface asynchrone** (`Promise<EngineResult>`, prête pour un worker) mais exécute le moteur **synchronement sur le thread principal**. L'anti-gel repose sur le throttling CPU ×4 testé en CI (budget de temps par tour tenu). Le passage effectif en **Web Worker** (très grandes cartes / IA lourde) reste **différé** — la signature asynchrone le rendra transparent le jour venu.

## 4. Sauvegardes

| Phase | Mécanisme |
|-------|-----------|
| MVP | **IndexedDB** (API brute, `client/app/save.ts` — pas de dépendance `idb`) : snapshot `GameState` compressé (gzip via CompressionStream). Autosave à chaque fin de tour + slots manuels. Export/import fichier `.heroes` (JSON gzip) pour partage/backup. *État MVP : snapshot seul ; le journal de commandes incrémental depuis le dernier snapshot est différé (le moteur reste re-simulable, cf. §3).* |
| Beta | Cloud saves : mêmes blobs poussés sur le serveur, résolution de conflit « le plus récent gagne + copie de sécurité ». |

- Format versionné (`saveVersion`) + migrations, comme le contenu (doc 06 §7).
  - **État (lot 3.8)** : `CURRENT_SAVE_VERSION` (moteur) est l'unique source de
    vérité de la forme sérialisée ; à incrémenter à chaque changement de forme
    incompatible de `GameState`. Le chargement (IndexedDB « Continuer » **et**
    import `.heroes`) lit la version du snapshot (`readSaveVersion`, tolérant au
    JSON invalide) et **rejette proprement** toute sauvegarde d'une autre
    version — « Continuer » se grise, l'import échoue — au lieu d'adopter un
    état malformé. La **migration ascendante** d'anciennes sauvegardes reste
    différée (post-MVP) : au MVP on rejette, on ne migre pas.
    `CURRENT_SAVE_VERSION` vaut **8** (source de vérité `engine/core/state.ts`).
    Historique : v2 (`factionCatalog`/`scenario`/`outcome`/`controller`/
    `eliminated`, 3.4/3.5) ; v3 (`PlayerState.factionResources`, 4.4) ; v4
    (`townlessDays` grâce de reprise + `AdventureMapDef.triggers`, comblement
    MVP) ; v5 (`PlayerState.huntContract`, contrats de chasse, doc 05 §3.3) ;
    v6 (`HeroState.warMachines`, machines de guerre, doc 02 §5) ; v7
    (`GameState.quests`, quêtes, doc 13 §6.2) ; v8 (objets de carte
    `mine`/`treasure`/`artifact`/`visitable`/`dwelling`, `pendingTreasure`,
    `HeroState.visitLuck`, doc 02 §2.2).
- Une sauvegarde référence les paquets de faction (par id) ; le suivi de
  **version** par paquet est différé avec les migrations (post-MVP).

## 5. Backend multijoueur (Beta — architecturé dès le MVP)

- **Node.js + Fastify + WebSocket (ws)**, TypeScript, réutilise `packages/engine` tel quel.
- Modèle **serveur autoritaire par re-simulation** : les clients envoient des commandes ; le serveur les valide/applique avec le même moteur déterministe et rediffuse. Coût CPU minime (tour par tour).
- **PvP asynchrone d'abord** (notifications Web Push, tours en différé — le mode qui pardonne le mobile), temps réel à timer ensuite.
- Persistance : **PostgreSQL** (comptes, parties, classements) + blobs de sauvegarde ; **Redis** pour présence/matchmaking si besoin.
- Auth : magic link e-mail + OAuth (pas de mot de passe à gérer).
- Anti-triche : le client n'est jamais cru — brouillard de guerre calculé serveur, seule la vue du joueur lui est envoyée (`stateView(playerId)`).

## 6. Assets & performance

- **Budgets** : bundle JS initial < 800 Ko gzip ; atlas de la faction jouée chargé à la demande (lazy par paquet de faction — la modularité paie aussi ici) ; première partie jouable < 5 s en 4G.
- Spritesheets atlassées (TexturePacker ou packer maison dans `tools/`), 2 résolutions (@1x/@2x) servies selon `devicePixelRatio`.
- Carte d'aventure : rendu par chunks avec culling ; brouillard en texture dédiée mise à jour incrémentalement.
- Cible : 60 fps en combat sur mobile milieu de gamme (test CI Playwright avec throttling CPU ×4).
- **PWA** (lot 8.1 livré) : service worker **hand-rolled** `data/sw.js` (offline-first, sans dépendance Workbox — hors budget bundle) + manifeste installable `data/manifest.webmanifest` → jeu solo jouable hors-ligne, icône sur l'écran d'accueil.

## 7. Qualité & CI

- CI GitHub Actions : typecheck, lint (frontières), tests unitaires moteur (dont property-based : « un combat se termine toujours », « or jamais négatif »), validation de tous les paquets de faction, simulation d'équilibrage (rapport en artefact), E2E Playwright (desktop + viewport mobile), budget de bundle.
- Golden tests de replays : des parties enregistrées rejouées à chaque commit — toute divergence de simulation casse la CI (protège le déterminisme).
