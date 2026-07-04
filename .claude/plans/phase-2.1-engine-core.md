# Plan — Phase 2.1 : Cœur du moteur

Réf : `docs/10-plan-phase-2-implementation.md` §3 (Phase 2.1) et §5.2 ;
doc 07 §2–§3. Moteur **pur** : aucun import DOM/Pixi (frontière lintée +
tsconfig sans lib DOM), déterministe (RNG PCG32 dans l'état).

## Étapes

- [x] `packages/engine` : `GameState`, `Command` (`StartGame`, `EndTurn`),
      `apply()` + `validate()` + événements, RNG PCG32 pur
      → vérif : 20 tests Vitest verts. ✅
- [x] Property-based (fast-check) : pureté d'`apply`, non-mutation de
      l'entrée, replay déterministe (même seed+commandes ⇒ même hash),
      calendrier jour/semaine pour 1–8 joueurs, reprise RNG depuis état
      sérialisé. ✅ (note : `fc.hexaString` retiré de fast-check v4 →
      `fc.string`.)
- [x] Sérialisation : `stableStringify` (clés triées) + `hashState` FNV-1a
      → vérif : save→load→hash identique + la partie rechargée continue à
      l'identique. ✅
- [x] Golden replay : 2 joueurs, seed fixe, 10 jours (traverse le début de
      semaine du jour 8), hash figé `a3da94d9`. ✅
- [x] Garde-fou « moteur sans rendu » : tsconfig engine `lib: ["ES2022"]`
      (aucun type DOM) + frontières ESLint déjà en place (2.0). ✅
- [x] Intégration : `pnpm test` racine exécute les tests moteur (vérifié) ;
      commentaires workflows et CLAUDE.md mis à jour. ✅
- [x] Vérification complète locale : typecheck + lint + test + build + smoke
      (desktop/mobile) verts. ✅
- [x] Commit, push, PR draft (branche repartie de main post-merge #3,
      guideline §6).

## Écarts / décisions

1. **Pas de `MoveHero`/`PickChoice`/`CombatAction` en 2.1** : ils exigent la
   carte (2.3) et le combat (2.4). Le doc 10 §5.2 liste l'union cible ;
   l'union livrée démarre à `StartGame`/`EndTurn` et s'étend par phase.
2. **`StartGame` est une commande** appliquée sur l'état vide
   (`createEmptyState()`) : le journal de replay est ainsi 100 % uniforme
   (une partie = `[StartGame, …]`), ce qui simplifie golden tests et futur
   protocole réseau.
3. **Pas de revenu quotidien en 2.1** : les montants vivent dans
   `data/core/config.json` (doc 02, jamais en dur) — le revenu arrive avec le
   pipeline de contenu (2.2). La propriété « or jamais négatif » s'armera avec
   les premières dépenses ; en attendant, les propriétés couvrent pureté,
   déterminisme RNG et calendrier.
4. **PCG32 via BigInt en interne**, état exposé en 4 entiers 32 bits
   (JSON-safe, conforme doc 10 §5.2). `rollRange` en modulo simple (biais
   négligeable pour du gameplay, documenté dans le code).
5. **Immer** : dépendance runtime unique du moteur (doc 07 §3).
