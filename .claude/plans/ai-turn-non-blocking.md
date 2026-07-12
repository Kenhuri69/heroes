# Plan — Tour d'IA non bloquant (anti-gel onglet)

## Symptôme
Le navigateur détecte un script trop long pendant les tours d'IA et propose de
tuer l'onglet. L'UI est figée le temps que l'IA « réfléchisse ».

## Diagnostic
Deux niveaux :

1. **Inter-tours (déjà traité)** — `packages/client/src/app/dispatch.ts`
   `runAiLoop` est asynchrone : `requestAnimationFrame` + délai entre chaque
   tour IA (`yieldToPaint`). Le thread est rendu au navigateur *entre* deux
   joueurs IA. ✅ Rien à changer ici.

2. **Intra-tour (LA cause racine)** — `packages/engine/src/ai/adventure.ts`
   `apply({ type: 'AiTurn' })` est **synchrone** (moteur pur, invariant §8). Pour
   chaque héros IA, la sélection d'objectif fait un **fan-out de pathfinding** :
   - `pickResourceTarget` : un `findPath` (A\* complet) **par objet collectable**
     de la carte.
   - `pickGuardianTarget` : un A\* **par gardien**.
   - `pickEnemyHeroTarget` : un A\* **par héros ennemi**.
   Chaque A\* alloue deux tableaux `Array(width*height)` (jusqu'à 2×65 536 sur
   carte Immense 256²). Sur une grande carte riche → des centaines d'A\* +
   pression GC massive par héros, ×N héros ×N joueurs IA ⇒ blocage de plusieurs
   secondes dans **un seul** `AiTurn` que le yield inter-tours ne découpe pas.

## Décision
Attaquer la cause racine côté moteur, **sans** rompre les invariants (pur,
déterministe, zéro faction, pas de dépendance rendu). L'approche « pauses »
seule (yield intra-tour) est écartée : elle exigerait de découper `AiTurn` en
sous-commandes moteur (nouvelle surface de commande + churn) alors que le vrai
problème est la **quantité de calcul**, pas sa répartition. On **supprime** le
calcul redondant plutôt que de l'étaler.

**Optimisation retenue : pré-filtre par borne inférieure octile.**
Avant tout `findPath` (A\*), les pickers écartent en `O(1)` toute cible dont la
**borne inférieure admissible** du coût (distance de Chebyshev × coût de pas
minimal de la carte — l'heuristique même de l'A\*) dépasse le budget de PM du
jour. Sur grande carte riche, l'immense majorité des objets est hors du rayon de
mouvement ⇒ leur A\* (et son allocation `O(width*height)`) n'est jamais lancé.
Le fan-out `O(objets × A\*)` retombe à `O(objets proches × A\*)`.

### Pourquoi PAS le Dijkstra borné unique (essayé puis écarté)
Une passe Dijkstra bornée par héros remplaçait N A\* par 1 champ de coûts. C'est
un gain net sur grande carte à **beaucoup** de cibles, mais une **régression ×3**
sur le cas « 0–1 cible proche » (fixture 10×10, PM énormes) : Dijkstra explore
**tout** le rayon (uniforme) là où l'A\* est **dirigé vers le but** et s'arrête
tôt. Le test de propriété « IA vs IA se termine » passait de 6,5 s à 18,6 s (à la
limite du timeout 20 s). Le pré-filtre, lui, **ne régresse jamais** : sur le
fixture il garde exactement le même unique A\* qu'avant (6,6 s ≈ baseline).

### Équivalence prouvée (⇒ golden + tests inchangés)
- La borne écartée est l'heuristique admissible de l'A\* : si
  `octileLowerBound > PM`, alors `findPath` aurait donné `cost ≥ borne > PM` et la
  cible aurait été rejetée. Écarter en amont ⇒ **décision strictement identique**.
- Le golden replay n'exerce **pas** `AiTurn` (joueurs humains + `MoveHero`) ⇒
  hash inchangé. Les tests `ai-adventure` (ramassage, H-VS-H, marge, terminaison,
  déterminisme) restent verts, comportement inchangé.

## Étapes
1. `packages/engine/src/adventure/path.ts` : `minStepCost(config)` (coût de pas
   minimal, factorisé) + `octileLowerBound(minStep, from, to)`. → typecheck. ✅
2. `packages/engine/src/ai/adventure.ts` : calculer `minStep` une fois dans
   `playHeroTurn`, ajouter le pré-filtre en tête de boucle de chaque picker
   (`pickResourceTarget` / `pickGuardianTarget` / `pickEnemyHeroTarget`).
   → `pnpm test` (642/642, dont ai-adventure/golden/properties). ✅
3. Vérifs finales : typecheck (all), lint, tests moteur+content, build (bundle
   ~295 Ko gzip < 800), smoke headless. ✅

## Écarts constatés
- Approche initiale (Dijkstra borné) implémentée puis **abandonnée** pour cause
  de régression du petit-cas (voir ci-dessus) — remplacée par le pré-filtre.
- `pickExplorationStep` garde son unique `findPath` (branche de repli, 1 appel
  par héros, cible = tuile inexplorée la plus proche donc voisine) : non
  optimisé, coût borné à un appel. Noté, hors périmètre.
- Boucle inter-tours `runAiLoop` (`dispatch.ts`) : déjà `await yieldToPaint`,
  inchangée.

## Suivi possible (hors périmètre)
- Si un `AiTurn` restait long (très nombreux héros/objets proches), découper le
  pilotage IA par héros côté client avec yield (approche événementielle) — noté,
  non requis tant que le pré-filtre suffit.
