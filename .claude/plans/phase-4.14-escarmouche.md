# Plan — Alpha 4.14 : escarmouche vs IA (config + difficulté)

> Item roadmap suivant (doc 09 Phase 2, ligne 47 : « Escarmouche vs IA (config
> de carte, difficulté), hot-seat, sorts d'aventure »). Ce lot livre le **premier
> tiers** : une escarmouche 1 humain vs 1 IA configurable (factions + difficulté)
> sur la carte proto. Hot-seat et sorts d'aventure = lots suivants (4.15/4.16).

## Constat de cadrage (exploration)
- Le jeu humain-vs-IA existe déjà **via le scénario `conquest`** (données figées).
- L'IA est une **heuristique fixe non paramétrée** — aucun bouton de difficulté.
- **Décision clé** : une escarmouche est un **scénario généré à l'exécution**.
  La difficulté est un **levier de données** (l'IA reçoit une armée / des
  ressources / des bâtiments mis à l'échelle au moment de construire le
  `StartGame`). **Zéro modification du moteur, aucun nom de faction** — l'IA voit
  des nombres, pas un enum « Difficile ». Le label reste en locales + client.
- T1 d'une faction dérivable **génériquement** : `manifest.town.dwellings` (tier
  1 → `unitId` + `buildingId`) ; toutes les factions du dépôt en ont un.
- Hero id = `hero-${playerId}` (moteur) ⇒ objectifs `defeatHero` calculables.

## Conception
- `skirmishStartCommand(report, config, seed, map)` (client `app/game.ts`),
  jumeau de `scenarioStartCommand` : 2 joueurs (`player-1` humain, `player-2` IA)
  aux `map.startPositions[0/1]`, chacun sa ville (townHall + habitation T1
  dérivée) et une armée de sa T1. Objectifs `eliminateAllEnemies` (victoire) +
  `defeatHero(hero-<pid>)` (défaite). Villes neutres de la carte matérialisées
  (comme 4.13).
- `config: SkirmishConfig = { humanFactionId, aiFactionId, difficulty }`.
- Difficulté = table de données `DIFFICULTY_TUNING` (facile/normal/difficile) :
  multiplicateur d'armée IA, multiplicateur de ressources IA, Fort prébâti IA.
  L'humain reste à la ligne de base.
- UI : modale `SkirmishScreen` (2 listes de factions + 3 crans de difficulté),
  ouverte par un bouton « Escarmouche » du menu ; « Lancer » émet
  `heroes:start-skirmish` → `main.ts` construit et joue la commande. Nouveau
  `Modal` kind `skirmish` ; `factions` ajouté au store (peuplé depuis les packs).
- i18n FR/EN complet (aucune chaîne en dur).

## Lots
- [x] `app/game.ts` : `SkirmishDifficulty`/`SkirmishConfig`/`DIFFICULTY_TUNING`,
  `factionT1(pack)` (dérive T1 unité + habitation du manifeste), `skirmishStartCommand`.
- [x] `app/store.ts` + `main.ts` : `factions` dans le store ; `startSkirmish`,
  listener `heroes:start-skirmish`, hook `__HEROES_TEST__.startSkirmish`.
- [x] `app/router.ts` : `Modal` kind `skirmish`.
- [x] `ui/SkirmishScreen.tsx` + `ui/shell.tsx` + `ui/MenuScreen.tsx` + `options.css`
  (`.skirmish-select` ≥ 44px) : écran de config + bouton menu.
- [x] Locales `data/core/locales/fr.json` + `en.json` : blocs `menu.skirmish`,
  `skirmish.*`, `toast.skirmishFailed`.
- [x] Smoke : ouvrir l'escarmouche, « Difficile », lancer → 2 joueurs
  (humain + IA), villes attribuées, armée IA ×1,6 (48 vs 30), l'IA joue son tour
  (desktop + mobile).
- [x] Docs 09 (roadmap) + 08 §3 (écran). Plan à jour.

## Écarts / décisions constatés
- **Choix de carte différé** : une seule carte proto existe ; le sélecteur de
  carte arrivera avec l'éditeur (roadmap 09). L'escarmouche utilise la carte par
  défaut. `map.startPositions[0/1]` portent les deux joueurs.
- **Villes de départ** : synthétisées aux positions de départ avec townHall +
  habitation T1 (dérivée du manifeste) ; les objets `town` de la carte non
  attribués deviennent neutres (assiégeables, réutilise 4.13).
- **Difficulté = données pures** : `DIFFICULTY_TUNING` (facile 0.6× armée ; normal
  1× ; difficile 1.6× armée, 1.5× ressources, Fort prébâti). L'humain reste à la
  base. Le moteur ne voit que des nombres — garde-fou faction vert (la liste de
  factions vient du store peuplé par les données, jamais codée dans `packages/`).
- **Golden inchangé** : aucun code moteur touché.

## Invariants
Moteur pur inchangé, RNG seedé, **zéro nom de faction dans `packages/`**
(la liste de factions vient des données, jamais codée en dur ; le levier de
difficulté est numérique), golden inchangé (partie libre = scénario généré, pas
touché au proto), budget < 800 Ko, anti-gel ×4, garde-fou faction vérifié
localement, smoke desktop + mobile.

## Journal
- **2026-07-06** — Création après merge #70 (sièges v1). Base = `origin/main`
  (588c243). Exploration des surfaces menu/scénario/IA/sorts faite (agent
  read-only) : difficulté = données, escarmouche = scénario généré.
- **2026-07-06** — Implémentation complète. Tout vert : typecheck 4/4, lint,
  `content:check`, build (~232 Ko gzip < 800), smoke desktop + mobile (nouveau
  cas d'escarmouche) + suite complète 66 verts, garde-fou faction propre
  (grep statut 1). Aucun code moteur/contenu touché (golden inchangé).
