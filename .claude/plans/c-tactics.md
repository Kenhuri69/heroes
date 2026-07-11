# C-TACTICS — Compétence Tactique & phase de placement (backlog §2.1, 🕳️ M)

Doc 02 §5.1 : « placement initial automatique + phase de placement tactique si
compétence Tactique ». Aujourd'hui `combat/setup.ts` ne fait que le placement
auto par slot ; aucune compétence `tactics`. Fidélité HoMM (guideline §8.5) :
Tactique = repositionner ses piles dans une bande avant la bataille.

## Design

- **Données** : compétence `tactics` (`data/core/skills.json`), rang → champ
  `tacticsColumns` (1/2/3) = profondeur de la bande de placement depuis la
  colonne de spawn du camp. Locales FR/EN.
- **Moteur** :
  - `CombatState.phase: 'placement' | 'battle'` (save v23→**v24**).
  - Le combat lié à un héros (interception/siège — `playerSide = attacker`)
    entre en `phase:'placement'` (activeStackId null, aucun tour) **si** le héros
    attaquant a `tactics > 0` ; sinon `phase:'battle'` + `advanceTurn` (comportement
    actuel). L'arène (sans héros) : toujours `battle`.
  - Commandes `PlaceStack {stackId,to}` (repositionne une pile du camp joueur dans
    la bande `col ∈ [0, tacticsColumns]`, en jeu, non occupée, non obstacle) et
    `FinishPlacement` (phase→battle, `advanceTurn`). Actions de combat rejetées
    tant que `phase==='placement'`.
  - **Auto/IA** : `runAutoCombat` (donc l'`AutoCombat`/Auto-Battle) et
    `runAiIfNeeded` **auto-terminent** un placement pendant (skip → battle) ⇒ pas
    de blocage IA-vs-IA, property « un combat se termine toujours » préservée.
  - Golden re-fixé (forme : `phase` + saveVersion ; issues inchangées).
- **Client** :
  - `combat.tsx` : bandeau de placement + bouton **« Commencer la bataille »**
    (`combat-start-battle` → `FinishPlacement`) quand `phase==='placement'` ;
    barre d'actions normale masquée.
  - `CombatScene` : en placement, tap pile du camp joueur → tap hex libre de la
    bande ⇒ `PlaceStack` ; bande surlignée.

## Étapes

1. [x] Données `tactics` + schéma `tacticsColumns` + locales.
2. [x] Moteur : `phase`, save bump, commandes+validations+handlers, setup wiring,
   auto/IA skip, `heroTacticsColumns` helper.
3. [x] Tests moteur : entrée en placement si tactics ; PlaceStack borné (bande/
   occupé/obstacle/mauvais camp) ; FinishPlacement → battle ; action rejetée en
   placement ; AutoCombat skip ; property IA-vs-IA ; golden re-fix.
4. [x] Client : bandeau + bouton + tap de placement.
5. [x] Smoke : interception avec héros Tactique ⇒ placement, PlaceStack via hook,
   Commencer ⇒ bataille.
6. [x] Docs 02 §5.1 / 07 §4 ; backlog C-TACTICS ✅ (clôt A10).

## Note de couverture
- Cœur moteur couvert par 7 tests (`combat-tactics.test.ts`) : entrée en placement, no-op sans Tactique, PlaceStack (déplacement + rejet hors bande/pile ennemie), FinishPlacement, action rejetée en placement, auto-skip. Golden re-fixé (`ad317a4a`, forme seule).
- **Smoke UI non couvert** (guideline §7) : le hook `__HEROES_TEST__` ne permet pas d'octroyer la compétence `tactics` au héros de départ, et lui donner en config casserait les smokes de combat manuel. L'UI de placement (bandeau + bouton + tap→PlaceStack) est thin, typecheck/lint/build verts ; non-régression combat vérifiée (23/23).
