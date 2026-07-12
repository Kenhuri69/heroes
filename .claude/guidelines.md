# Guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Plan écrit obligatoire

**Tout changement nécessite un plan rédigé en Markdown dans le projet, amendé progressivement à chaque étape.**

- Avant d'implémenter, créer un fichier `.md` qui décrit les étapes (convention du projet : `.claude/plans/<feature>.md`).
- Le plan liste les étapes avec critères de vérification (voir §4).
- À chaque étape franchie, mettre à jour le plan : cocher l'étape, ajouter les écarts constatés, noter les décisions prises.
- Le plan reste vivant jusqu'à la fin du changement ; il n'est ni jeté ni figé en début de tâche.
- Pour un changement vraiment trivial (typo, renommage local), mentionner l'absence de plan plutôt que l'éluder en silence.

## 6. Vérifier l'état d'une PR avant de pousser

**Ne JAMAIS pousser sur la branche d'une PR déjà mergée ou fermée. Toujours vérifier le statut avant `git push`.**

- Avant chaque `git push`, vérifier l'état de la PR liée à la branche courante via `mcp__github__pull_request_read` (champ `state` + `merged`).
- Si la PR est `merged` ou `closed` :
  1. Repartir de `main` (`git fetch origin main && git checkout main && git pull`).
  2. Créer une **nouvelle branche** descriptive (ex: `claude/<feature>-followup`).
  3. Cherry-pick ou recréer les commits orphelins.
  4. Pousser et ouvrir une **nouvelle PR**.
- Pousser sur une branche post-merge laisse les commits orphelins (invisibles, hors review) — c'est une erreur silencieuse à éviter.
- Cette vérification s'applique aussi en cas de retour utilisateur après merge : ne pas amender l'ancienne PR, en ouvrir une nouvelle.

## 7. Test navigateur headless obligatoire

**Tout changement de code doit être validé via Chromium headless avant d'être considéré comme terminé, pour garantir la non-régression.**

> ⚠️ Le projet est en **Phase 1 (spécification)** : il n'y a pas encore de code
> exécutable. Cette règle s'arme dès le premier module livré — le smoke test
> (`tests/smoke.js`, Playwright + Chromium headless) doit être créé **dans le
> même lot** que le premier code jouable, pas après.

- Une fois le smoke test en place : s'il échoue, corriger avant de commit. Ne jamais commit en disant "le test échoue mais le code est bon".
- Le moteur de règles étant **pur et déterministe** (voir §8), il se teste aussi en unitaire sans navigateur — le smoke headless couvre l'intégration rendu/UI, les tests unitaires couvrent les règles.
- Si le changement introduit un nouveau scénario à couvrir, ajouter le cas de test **dans le même commit**.
- Si le test ne couvre pas la zone modifiée, le dire explicitement à l'utilisateur plutôt que de prétendre que la non-régression est garantie.
- Pour un changement purement documentaire (markdown, commentaires), le test reste recommandé mais peut être omis si justifié.
- **Pour AJOUTER ou modifier un test, suivre le skill `test-authoring`** : il donne l'arbre de décision de niveau (unitaire moteur / contenu / smoke — le smoke coûte ~100× un unitaire), les tags (`@core`/`@mobile`/`@perf`), les pièges de conformité CI et la recette de vérification locale. Objectif : garder la rigueur sans laisser dériver le temps de CI (cf. `.claude/plans/test-performance-optimization.md`).

## 8. Principes non négociables du projet (moteur pur & data-driven)

**Ces invariants du README priment sur toute solution de facilité. Un changement qui en viole un est refusé, même s'il "marche".**

1. **Le moteur de règles ne connaît aucune faction.** Aucun `if (faction === 'haven')` dans le moteur : tout contenu (unités, bâtiments, bonus, héros) passe par les données (JSON + manifeste de faction, validés par schéma). Ajouter une maison = ajouter des données, zéro modification du moteur (voir `docs/06-modularity.md`).
2. **Simulation déterministe (RNG seedé).** Jamais de `Math.random()` dans le moteur de règles — uniquement le RNG seedé injecté. C'est ce qui rend replays, tests et anti-triche serveur gratuits (voir `docs/07-architecture.md`).
3. **Moteur sans dépendance au rendu.** Le moteur de règles (TypeScript strict) ne doit jamais importer PixiJS ni toucher au DOM ; le rendu consomme l'état, pas l'inverse.
4. **Touch-first.** Chaque interaction est conçue au doigt d'abord, à la souris ensuite (cibles tactiles, gestes — voir `docs/08-ui-ux.md`).
5. **Fidélité au core loop HoMM avant toute innovation.**
6. **Docs = source de vérité en Phase 1.** Tant que la spécification fait foi, tout changement de design doit mettre à jour le document `docs/0X-*.md` concerné dans le même commit ; ne pas laisser code et spec diverger silencieusement.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
