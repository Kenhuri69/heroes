# Éléments manquants de la carte d'aventure — plan vivant

Demande : identifier, lister et implémenter les éléments de carte manquants —
mines possédées (drapeau couleur joueur, revenu journalier), tas de ressources
de chaque type, trésors donnant or **ou** XP, monstres bloquant le passage.

## 1. État des lieux (inventaire vérifié dans le code)

| Élément | État | Détail |
| --- | --- | --- |
| Monstres bloquants (gardiens) | ✅ EXISTANT | `type:'guardian'` — bloque réellement (`movement.ts`), interception ⇒ combat, pertes appliquées, testé (`combat-guardian.test.ts`). Rien à faire. |
| Tas de ressources ramassables | 🟡 PARTIEL | Les 7 ressources sont posables et ramassables (`ResourcePicked`), mais proto-01 n'instancie ni `crystal` ni `sulfur`. → compléter les données. |
| Mines capturables (drapeau + revenu/jour) | ❌ MANQUANT | Aucun objet `mine`, aucun `ownerId`, aucun drapeau, revenu = bâtiments de ville uniquement (`applyDailyIncome`). → à créer (moteur+contenu+client). |
| Trésor or **ou** XP (coffre HoMM) | ❌ MANQUANT | Aucun type `treasure`, aucun choix or/XP, aucune XP hors combat. → à créer. |
| Artefact posé sur la carte | ❌ MANQUANT | Artefacts uniquement en inventaire héros. → à créer (ramassage → 1er slot libre). |
| Bâtiments visitables (moulin, puits…), portails, habitations de créatures sur carte, gardiens « errants » mobiles | ⏸ DIFFÉRÉ | Hors de cette passe — listés pour mémoire, chacun mérite son propre lot. |
| Éditeur de carte | ⏸ DIFFÉRÉ | L'éditeur (Alpha 4.18) ne pose déjà pas les gardiens ; les nouveaux types y sont ignorés proprement à l'import (repli `[]`). |

## 2. Conception (invariants §8 respectés : zéro faction, déterministe, data-driven)

### Moteur (`packages/engine`)
- `adventure/map.ts` : 3 nouvelles variantes de `MapObjectDef` :
  - `{ type:'mine', pos, resource, amount, ownerId: string|null }` — `amount` = revenu/jour, `ownerId` = joueur (null = neutre).
  - `{ type:'treasure', pos, gold, xp }` — le héros choisit l'un OU l'autre.
  - `{ type:'artifact', pos, artifactId }`.
- `adventure/movement.ts` (logique partagée humain/IA) :
  - fouler une **mine** non possédée ⇒ `ownerId = joueur`, event `MineCaptured` (le héros continue — recapture possible par l'ennemi) ;
  - fouler un **trésor** ⇒ `GameState.pendingTreasure = {heroId, playerId, objectId, gold, xp}`, event `TreasureFound`, arrêt du héros ;
  - fouler un **artefact** ⇒ 1er slot libre du héros (sinon il reste au sol), retrait, event `ArtifactPicked`, arrêt.
- Nouvelle commande `ResolveTreasure { heroId, choice:'gold'|'xp' }` : or ⇒ crédite ; xp ⇒ `grantXp` (montées de niveau en chaîne existantes) ; retire l'objet, vide `pendingTreasure`, event `TreasureTaken`. `MoveHero`/`EndTurn` refusés tant qu'un trésor est en attente (code `treasurePending`).
- `town/economy.ts` `applyDailyIncome` : + revenu des mines possédées (event `MineIncome`), joueurs éliminés exclus.
- `core/engine.ts` `validateMap` : validation des 3 nouveaux types (ressource connue, montants > 0, artefact au catalogue).
- IA (`ai/adventure.ts`) : cibles de collecte étendues (trésor, artefact, mine non possédée) ; l'IA résout son trésor immédiatement (choix déterministe : or).
- `CURRENT_SAVE_VERSION` 7 → **8** (`pendingTreasure` + nouvelles variantes d'objets), commentaire mis à jour.

### Contenu (`packages/content`)
- `schemas.ts` `mapFileSchema` : variantes `mine` / `treasure` / `artifact` (validées Zod).
- `loader.ts` : `ResolvedMapObject` étendu (`mine` résolu avec `ownerId: null`), règle croisée : `artifactId` connu (`knownArtifactIds`, comme `knownUnitIds`).

### Données (`data/`)
- `maps/proto-01.map.json` : 4 mines (or 3,6 · bois 12,10 · minerai 7,15 · cristal 22,24), 2 coffres (2,3 et 18,22), 1 artefact au sol (5,5 trèfle), tas `crystal` (24,13) + `sulfur` (16,26) — toutes tuiles vérifiées franchissables, hors des chemins scriptés du smoke (rangées y=2 et y=3 x∈[4..9]).
- `core/locales/{fr,en}.json` : toasts mine/trésor/artefact + modale de choix du trésor.

### Client (`packages/client`)
- `render/playerColors.ts` : palette **couleur par joueur** (index dans `players`), gris neutre.
- `render/mapObjects.ts` : rendu mine = sprite `mines/mine-<res>` + **drapeau teinté couleur du propriétaire** (gris si neutre) ; resync quand `ownerId` change (signature par objet) ; coffre + artefact (sprite `artifacts/<id>` ou repli procédural).
- `ui/TreasureChoice.tsx` (modèle `SkillChoice`) : modale forcée « or ou XP » sur `pendingTreasure` du joueur humain ⇒ `ResolveTreasure`.
- `app/notifications.ts` : toasts/journal `MineCaptured`, `MineIncome`, `TreasureTaken`, `ArtifactPicked`.

### Docs (source de vérité, §8.6)
- `docs/02-mechanics.md` §2.2 : mines/trésors/artefacts documentés dans le même commit.

## 3. Étapes & vérifications

1. [x] Inventaire du code (agent Explore) → tableau §1.
2. [x] Moteur : types + mouvement + commande + revenu + validation + IA + bump v8 → vérif : nouveaux tests unitaires `map-objects.test.ts` verts, suite engine verte (309 tests).
3. [x] Contenu : schémas + loader + règles croisées → vérif : `loader.test.ts` étendu vert (75 tests — mine/treasure/artifact résolus + trésor sans gain/artefact inconnu rejetés).
4. [x] Données : proto-01 (4 mines, 2 coffres, 1 artefact, tas crystal+sulfur) + locales FR/EN → vérif : `content:check` vert (19 objets, 3 scénarios).
5. [x] Client : rendu drapeaux + modale trésor + toasts → vérif : typecheck + lint + build OK.
6. [x] Smoke Playwright (guideline §7) : « mine capturée ⇒ propriétaire + revenu J+1 » et « coffre ⇒ modale or/XP ⇒ or crédité » ; suite complète verte (78 ✓, 2 skip préexistants).
7. [x] Golden replay re-fixé (`3a766412`) — seule la FORME change (v8 + `pendingTreasure`), simulation inchangée (assertions métier du golden intactes).
8. [x] Docs 02 (note « État » §2.2, montants §3 respectés : mine d'or 1000/j) + plan coché, commit + push + PR draft.

## 4. Décisions & écarts

- Trésor = **choix** or/XP (fidélité HoMM, doc 01 pilier fidélité) — pas deux objets distincts ; le choix passe par un état `pendingTreasure` sérialisable (sauvegarde en pleine modale sûre).
- La capture de mine n'arrête pas le héros (visite en passant, recapture ennemie possible) ; trésor et artefact arrêtent (comme le tas de ressource).
- Les visuels `mines/mine-*` restent partagés tas/mine : le **drapeau** (toujours présent sur une mine, gris si neutre) est le discriminant visuel, comme dans HoMM.
- Pas de garde dédié « mine gardée » : le level design pose un `guardian` devant (déjà supporté).
- L'IA choisit toujours l'or au trésor (déterminisme, simplicité MVP).
- Écarts constatés en cours de route : la courbe d'XP (base×niveau^1,9) demande 3732 XP pour le niveau 2 — coffre de test à 4000 XP ; les 2 nouveaux tests smoke utilisent le déplacement scripté (`__HEROES_TEST__.dispatch`), pas le tap-tap (pratique du repo : tap-tap réservé à son test dédié — le tap réel était flaky sous charge et masqué par un overlay DOM sur desktop pour (3,6)).
- `MineCaptured` porte `amount` (revenu/jour) pour que le toast affiche le gain sans relire l'état.
- L'éditeur de carte (Alpha 4.18) ignore proprement les nouveaux types à l'import (comme il ignorait déjà les gardiens) — extension différée.
