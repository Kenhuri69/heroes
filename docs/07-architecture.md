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

> **État (remédiation cohérence)** : le découpage effectivement livré diffère
> du plan initial ci-dessous — l'IA d'aventure et les schémas de contenu n'ont
> pas leur propre package, et il n'existe ni `@heroes/engine-api` ni `schemas/`
> racine. Structure réelle (voir aussi CLAUDE.md / doc 10) :
>
> ```
> heroes/ (monorepo pnpm)
> ├── packages/
> │   ├── engine/    # @heroes/engine — RÈGLES PURES (aucun DOM/Pixi) :
> │   │   ├── adventure/  combat/  town/  hero/  faction/  scenario/  quest/
> │   │   └── ai/         # IA d'aventure — vit DANS le moteur (pas de package séparé)
> │   ├── content/   # @heroes/content — schémas Zod + loader/validateur de paquets
> │   ├── client/    # @heroes/client — rendu Pixi, UI Preact, input, audio, scènes
> │   └── tools/     # @heroes/tools — CLI faction:new/validate/sim, map:gen
> ├── data/          # contenu : core/ (sorts, artefacts, abilities…), factions/, maps/, scenarios/
> └── docs/
> ```
>
> Un `server/` Node.js reste prévu en Beta (non livré). Les JSON Schemas sont
> des schémas **Zod** dans `@heroes/content`, pas des fichiers dans `schemas/`.

Plan initial (conservé pour mémoire ; la cible `api`/`ai`/`schemas` séparés
n'a pas été retenue) :

```
heroes/ (monorepo pnpm)
├── packages/
│   ├── engine/          # RÈGLES PURES : aucune dépendance DOM/Pixi.
│   │   ├── adventure/   # carte, mouvement, économie, calendrier
│   │   ├── combat/      # simulation hex, capacités, IA de combat
│   │   ├── content/     # chargeur/validateur de paquets de faction (Zod)
│   │   └── api/         # @heroes/engine-api — surface publique pour les modules de faction
│   ├── client/          # rendu Pixi, UI Preact, input, audio, scènes
│   ├── ai/              # IA d'aventure (joueur ordinateur) — consomme engine-api
│   ├── server/          # (Beta) Node.js : matchmaking, relais de commandes, persistance
│   └── tools/           # CLI faction:new/validate/sim, éditeur de carte (futur)
├── data/                # contenu : core/ (sorts neutres, artefacts…), factions/, maps/
├── schemas/             # JSON Schemas du contenu
└── docs/
```

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
- Le moteur tournera dans un **Web Worker** dès que la carte est grande ou l'IA réfléchit (UI jamais bloquée). *État : différé — le dispatch est synchrone sur le thread UI ; le passage en worker est un changement d'implémentation, l'interface est prête (cartes ≤ 32×32 : besoin nul).*

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
    Historique des incréments : v4 comblement MVP (`townlessDays`, `triggers`),
    v5 contrats de chasse (`huntContract`), v6 machines de guerre (`warMachines`,
    `symbiosisStacks`), v7 quêtes (`quests`), v8 objets de carte
    (`pendingTreasure`, `HeroState.visitLuck`). *Garde-fou (remédiation B8) : un
    test verrouille la forme de `GameState` à `CURRENT_SAVE_VERSION` — tout ajout
    de champ requis force le bump, la garde ne peut plus être contournée.*
- Une sauvegarde référence les paquets de faction (ids de groupes). *Les
  **versions** de paquets ne sont pas encore stockées — champ différé avec les
  migrations ascendantes ; les `packs` actuels sont informatifs.*
- Le **moteur tourne sur le thread UI** (dispatch synchrone) : le Web Worker du
  §3 est différé (interface prête, aucun besoin sur les cartes ≤ 32×32).
- Autosave **à chaque fin de tour** (pas « à chaque action » — cf. doc 01) :
  gzip + IndexedDB, coût maîtrisé au tour par tour.

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
- **PWA** : service worker (Workbox) → jeu solo jouable hors-ligne, icône sur l'écran d'accueil.

## 7. Qualité & CI

- CI GitHub Actions : typecheck, lint (frontières), tests unitaires moteur (dont property-based : « un combat se termine toujours », « or jamais négatif »), validation de tous les paquets de faction, simulation d'équilibrage (rapport en artefact), E2E Playwright (desktop + viewport mobile), budget de bundle.
- Golden tests de replays : des parties enregistrées rejouées à chaque commit — toute divergence de simulation casse la CI (protège le déterminisme).
