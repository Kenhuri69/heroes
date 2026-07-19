# Plan — Phase 2.3 : Carte d'aventure & mouvement héros

Réf : `docs/10-plan-phase-2-implementation.md` §3 (Phase 2.3), doc 02 §1.5,
§2.1–§2.3, §3 ; doc 08 §1–§2.1 ; doc 07 §3–§4, §6. Jalon Phase 0 roadmap :
*déplacer un héros sur une carte JSON, fin de tour, sauvegarde/rechargement
IndexedDB* + smoke test étendu.

## Décisions préalables (valeurs non chiffrées dans les docs)

Doc 02 donne : 1500 + 50×vitesse la plus lente en points de mouvement/jour,
route ×0,75, marais ×1,5. Manquent — tranchés ici, reportés dans doc 02 §1.5
dans le même lot (guidelines §8.6), tous stockés dans `data/core/config.json`
(« jamais en dur ») :

1. **Coût de base d'une tuile : 100 pts** (convention HoMM ; 1500 pts = 15
   tuiles/jour).
2. **Diagonale : ×1,41** (≈ √2, HoMM 3), arrondi à l'entier après cumul des
   multiplicateurs : `round(coûtTerrain × 1.41)`.
3. **Portée de vision de base : 5 tuiles** (distance de Tchebychev) —
   les bonus Recherche (+2/4/6) arriveront avec les compétences (MVP).
4. **Terrains du proto** : `grass` (100), `swamp` (150), `water` et
   `mountain` (infranchissables). Routes en couche séparée : coût ×0,75.

## Écarts assumés (guidelines §2 : rien de spéculatif)

- **Pas de `PickChoice`/coffres en 2.3** : le bullet 2.3 du doc 10 ne liste
  que le ramassage de ressources ; les coffres (choix or/XP) viendront avec
  l'XP (2.5).
- **Héros sans armée** : l'armée arrive avec le combat (2.4). Formule de
  mouvement implémentée avec « armée vide ⇒ base seule » (1500).
- **Sauvegarde 2.3 = snapshot IndexedDB brut** (sérialisation existante,
  wrapper IndexedDB minimal sans dépendance). Le format complet doc 07 §4
  (idb + gzip + journal + export `.heroes`) reste en 2.5 comme prévu.
- **Chemin multi-jours** : la prévisualisation affiche les jours
  (verts/jaunes) ; la commande `MoveHero` n'exécute que ce que les points de
  mouvement du jour permettent — pas de « destination mémorisée » inter-tours
  (confort post-proto).
- **Interception = arrêt** : le héros s'arrête sur la tuile d'un ramassage
  (standard HoMM, doc 08 §2.1) ; seuls les objets `resource` existent en 2.3.

## Étapes

- [x] **Moteur `packages/engine/src/adventure/`** : types carte
      (terrain/route/objets résolus dans `GameState`), coûts de pas
      (terrain × route × diagonale), A* 8 directions (`findPath`, pur,
      heuristique octile), héros (position, points de mouvement quotidiens),
      brouillard exploré par joueur (tableau 0/1 par tuile, révélation rayon
      vision), `StartGame` étendu (map + config + héros aux positions de
      départ), `MoveHero` (consommation pas à pas, arrêt si points
      insuffisants, ramassage + arrêt, événements `MoveStepped`/
      `ResourcePicked`/`FogRevealed`), reset des points au `DayStarted`.
      → vérif : unitaires A* (ligne droite, contournement, préférence route,
      pas de chemin), MoveHero (coûts, arrêt, ramassage, rejets), brouillard,
      property (« l'or n'est jamais négatif » couvre le ramassage ; pureté
      d'`apply` sur `MoveHero`), golden replay étendu (nouveau hash).
- [x] **Contenu** : `configSchema` (`data/core/config.json` : mouvement,
      terrains, multiplicateurs, vision, ressources de départ, carte par
      défaut) + `mapSchema` (`*.map.json` : legend, tiles en chaînes par
      rangée, roads, objets ressource, positions de départ) + règles croisées
      (dimensions, chars connus, objets/départs en zone passable) ; loader
      (`loadConfig`, `loadMap`) ; `content:check` valide aussi `data/maps/` ;
      données `config.json` + `proto-01.map.json` (32×32).
      → vérif : tests Vitest — carte corrompue ⇒ rapport précis ;
      `pnpm content:check` vert.
- [x] **Client** : deps Preact + zustand (store vanilla + hook
      `useSyncExternalStore`), `dispatch()` (validate + apply + store + bus
      d'événements), rendu tuiles par chunks `RenderTexture` (API chunkée
      d'emblée, doc 10 §2.3), couche objets (placeholders teintés), sprite
      héros animé sur `MoveStepped`, brouillard 2 états (texture 1 px/tuile,
      NEAREST, mise à jour incrémentale), `input/pointer.ts` (tap < 8 px /
      250 ms vs drag caméra), tap-tap : sélection héros → prévisualisation
      chemin A* (points verts = aujourd'hui, jaunes = jours suivants) →
      2ᵉ tap = `MoveHero` ; UI Preact : barre de ressources (7, bandeau haut),
      jour/semaine, gros bouton « Fin de tour » (bas-droite), points de
      mouvement du héros, boutons Sauvegarder/Charger (IndexedDB, 1 slot) ;
      hooks de test `window.__HEROES_TEST__` (dispatch, getState,
      tileToScreen).
      → vérif : manuel dev + smoke ci-dessous ; cibles tactiles ≥ 44 px.
- [x] **Smoke étendu** (`tests/smoke.spec.ts`, desktop + mobile) : la carte
      est rendue, seed fixe ⇒ déplacement scripté (tap-tap) ⇒ position finale
      attendue + points décomptés + ressource ramassée ; « Fin de tour » ⇒
      jour 2 + points restaurés ; sauvegarde → déplacement → chargement ⇒
      position restaurée.
      → vérif : `pnpm build && pnpm smoke` vert en local et en CI.
- [x] **Docs même lot** : doc 02 §1.5 (coût de base 100, diagonale ×1,41,
      vision 5 — valeurs de départ) ; CLAUDE.md (Phase 2.3 livrée).
- [x] **Livraison** : typecheck + lint + test (38 moteur + 12 contenu) +
      content:check + build (~170 Ko gzip) + smoke 8/8 verts en local ;
      guideline §6 vérifiée (aucune PR existante sur la branche) ; push
      `claude/implementation-phase-2-3-w5clgx` ; PR draft #6.

## Écarts constatés en cours de route

1. **Golden replay refigé** (`2a1ccdfd`) : `StartGame` embarque désormais carte
   + config, le journal golden inclut des `MoveHero` (ramassages, marais,
   route). Carte/config inline dans le test — le golden est autonome.
2. **Zustand sans React** : `zustand/vanilla` + `useSyncExternalStore` de
   `preact/compat` (pas d'alias react → preact/compat, pas de dépendance à
   `zustand` côté React).
3. **`checkerboard.ts` supprimé** : remplacé par `render/tilemap.ts` (chunks
   `RenderTexture` 16×16, API chunkée d'emblée — doc 10 §2.3, culling différé
   aux grandes cartes).
4. **Bug attrapé par le smoke** : la règle CSS `#ui-root > * { pointer-events:
   none }` (spécificité d'ID) écrasait le `auto` des boutons — les blocs
   interactifs ré-activent désormais leurs pointer-events individuellement.
5. **Smoke mobile** : les tuiles visées par tap-tap doivent rester dans le
   viewport Pixel 7 (la caméra est centrée sur le départ du héros) — cible
   post-sauvegarde ramenée de (8,5) à (5,5).
6. **Occupation** : une tuile occupée par un autre héros est infranchissable
   (A* + validation) ; la rencontre/échange entre héros (doc 02 §1.5) viendra
   avec le multi-héros.
