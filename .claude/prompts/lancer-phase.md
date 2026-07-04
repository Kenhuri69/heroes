# Prompt — Lancer une phase avec sous-agents Sonnet

À coller au lancement d'une phase, en remplaçant `2.X` :

```text
Lance la phase 2.X du plan d'implémentation (docs/10-plan-phase-2-implementation.md),
en orchestrant le travail avec des sous-agents Sonnet quand un découpage est possible.

Méthode :

1. CADRAGE (session principale) — Lis le plan et les docs concernées, écris le
   plan vivant .claude/plans/<feature>.md (guidelines §5) avec un découpage en
   lots. Pour chaque lot : périmètre de fichiers EXCLUSIF, critères de
   vérification locaux, dépendances entre lots.

2. DÉLÉGATION — Confie à des sous-agents (Agent tool, model: sonnet) chaque lot
   qui est à la fois : bien spécifié, vérifiable seul (tests du package +
   typecheck), et sans chevauchement de fichiers avec un lot lancé en parallèle.
   Lance les lots indépendants en parallèle ; sérialise ceux qui consomment une
   API produite par un autre (définis l'interface AVANT de déléguer).
   Chaque sous-agent reçoit : le contexte minimal (extraits de specs +
   conventions du dépôt), la liste exacte des fichiers à créer/modifier,
   l'interdiction de toucher au reste, l'obligation de lancer les tests de son
   package, et le format de retour (fichiers produits, résultats de tests,
   points d'attention/écarts).

3. À NE PAS DÉLÉGUER (session principale) — décisions de design et écarts aux
   docs, invariants (golden replay et son hash, garde-fous CI, guidelines §8 :
   moteur sans faction, déterminisme, moteur sans rendu, touch-first),
   intégration finale, docs du même lot, commit/push/PR.
   Un lot trivial (< ~30 min) se fait directement, sans sous-agent.

4. INTÉGRATION — Relis les diffs des sous-agents, harmonise, puis vérification
   complète : pnpm typecheck && pnpm lint && pnpm test && pnpm content:check &&
   pnpm build, puis PW_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm smoke.
   Corrige toi-même les frictions d'intégration (ne renvoie pas un sous-agent
   pour ça, sauf lot entier à refaire).

5. LIVRAISON — Plan vivant mis à jour (étapes cochées, écarts, ce qui a été
   délégué), guideline §6 (état PR) avant push, PR draft, smoke étendu aux
   nouveaux scénarios dans le même lot (guideline §7).
```

Notes d'usage :

- Le parallélisme paie quand les lots sont **disjoints en fichiers** (les
  sous-agents partagent le même répertoire de travail). Pour des lots qui
  doivent toucher les mêmes fichiers en parallèle : isolation par worktree,
  au cas par cas.
- Figer les types partagés (commandes, événements, formes d'état) dans la
  session principale AVANT de paralléliser règles/rendu.
