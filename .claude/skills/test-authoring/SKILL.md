---
name: test-authoring
description: Ajouter ou modifier un test dans Heroes en gardant rigueur ET économie de temps d'exécution. Utiliser dès qu'on écrit un nouveau cas de test (règle moteur, donnée/schéma, ou parcours UI) ou qu'on touche à la suite smoke — l'arbre de décision oriente vers le BON niveau (unitaire moteur / contenu / smoke), impose les tags (@core/@mobile/@perf), rappelle les pièges de conformité CI (zéro ID de faction dans packages/, appel Playwright direct, RNG seedé) et donne la recette de vérification locale avant push. Empêche la dérive du temps de CI (le smoke coûte ~100× un unitaire) documentée dans .claude/plans/test-performance-optimization.md. Ne PAS utiliser pour lancer/mesurer la suite existante sans en ajouter (voir ce plan), ni pour un audit d'ergonomie (skill ux-audit), ni pour générer des assets (skills asset-*).
---

# Écriture de test (test-authoring)

Sources de vérité : **`.claude/guidelines.md` §7 (test navigateur) et §8 (invariants
moteur)**, et **`.claude/plans/test-performance-optimization.md`** (pourquoi le
temps a dérivé, et les axes qui le contiennent). Ce skill rend l'ajout de test
**discipliné** : chaque lot ajoutait des smokes par réflexe → dérive. La question
n'est pas « quel smoke écrire ? » mais « **ce test doit-il vraiment être un
smoke ?** ».

## 1. Arbre de décision — choisir le NIVEAU (le plus important)

Le smoke Playwright coûte ~100× un test unitaire (démarrage navigateur + Pixi
par cas). **Descendre au niveau le plus bas qui couvre réellement la chose.**

| Ce que je veux prouver | Niveau | Où | Coût |
|---|---|---|---|
| Une **règle du moteur** (dégâts, mouvement, combat, sorts, IA, sauvegarde, scénario…) | Unitaire | `packages/engine/test/*.test.ts` (vitest) | ~ms |
| Une **donnée / un schéma** (faction, bâtiment, scénario, dialogue, carte valides) | Contenu | `packages/content/test/*.test.ts` (vitest) | ~ms |
| L'**intégration rendu / UI / routing** (l'écran affiche, le tap déclenche, le DOM se câble au moteur) | Smoke | `tests/smoke.spec.ts` (Playwright) | ~s, **dernier recours** |

Règles d'or :
- Le moteur est **pur et déterministe** (§8) ⇒ presque toute règle se teste en
  unitaire, sans navigateur. N'écris un smoke que si le **DOM/Pixi** est le sujet.
- Une **donnée** (« l'arc X pose bien 2 drapeaux distincts », « la faction Y
  charge ») se valide en contenu, pas en smoke — de façon **faction-agnostique**
  (cf. §3).
- Avant d'ajouter un smoke, demande-toi : « la même garantie tient-elle avec un
  unitaire + un smoke *représentatif* déjà existant ? » Si oui, pas de nouveau smoke.

## 2. Si (et seulement si) c'est un smoke — checklist

1. **Réutiliser les helpers** de `tests/smoke.spec.ts` (`openGame`, `openMenu`,
   `tapTapTile`, `endTurn`, `passPreBattle`, `clickSaveAction`, `trackAssets`…).
   Ne pas ré-implémenter un démarrage ou un tap-tap.
2. **Un `test()` = un état de départ.** Plusieurs assertions sur le MÊME état
   après un seul démarrage ⇒ regrouper via `test.step(...)` (ex. les vérifs
   « confort »). Ne PAS fusionner des cas qui exigent chacun un démarrage
   distinct : en parallèle, 6 tests légers finissent plus vite qu'1 test qui
   sérialise 6 démarrages (leçon F du plan).
3. **Tagger** (2ᵉ argument `{ tag: … }`) :
   - `@core` — parcours critique joué **sur chaque PR** (la CI PR ne joue que
     `@core`). Réserver aux chemins vitaux (démarrage, déplacement, combat,
     ville, sauvegarde, scénario…). ~15-20 max : un noyau qui gonfle tue l'intérêt.
   - `@mobile` — le **viewport mobile est réellement le sujet** (HUD replié,
     tiroir, tactile) OU parcours critique à re-vérifier en 412px. Sinon, le
     desktop couvre déjà : ne pas tagger (le projet `mobile` ne joue que `@mobile`).
   - `@perf` — mesure de fluidité (throttling CPU). Tourne **isolé, mono-worker**.
   - Cumul possible : `{ tag: ['@mobile', '@core'] }`.
4. **Déterminisme** : graine fixe (`?seed=42`), synchro par condition
   (`expect.poll`, `toPass`) jamais par `waitForTimeout`. Un smoke tourne en
   parallèle (`fullyParallel`) : ne dépends jamais de l'ordre ni d'un état laissé
   par un autre test (chaque test a un contexte/IndexedDB neuf).

## 3. Pièges de conformité CI (déjà tombés — à ne pas refaire)

- **Zéro ID de faction/scénario en dur dans `packages/`** (README §1, garde-fou
  CI). Le motif `\bhaven\b|\bnecropolis\b|…` matche aussi les sous-chaînes
  (`haven-ch2` !). Un test de **contenu** doit valider des **invariants
  génériques** sur les données chargées, sans nommer une faction/un scénario.
  (Le smoke sous `tests/` n'est pas grepé — mais évite quand même le superflu.)
- **En CI, appeler Playwright directement** : `pnpm exec playwright test <args>`.
  Le script `pnpm smoke -- <args>` **ne transmet pas** les arguments (shard,
  grep) ⇒ toute la suite tournerait. Voir `.github/workflows/ci.yml`.
- **Moteur** : jamais de `Math.random()` / `Date.now()` — uniquement le RNG seedé
  injecté (§8.2). Un test qui en dépend n'est pas déterministe.
- **i18n** : pas de chaîne UI en dur ; cibler par `data-testid`, pas par texte
  traduit (sauf test d'i18n).

## 4. Vérification locale AVANT push (obligatoire, §7)

```bash
# Compte / filtrage attendus (sanity sans exécuter)
pnpm exec playwright test --list --grep=@core        # noyau PR
pnpm exec playwright test --list --project=mobile     # doit rester restreint

# Exécuter le sous-ensemble modifié (sandbox : pointer le Chromium local)
CI=1 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  pnpm exec playwright test --project=desktop --grep "mon nouveau test"

# Unitaires + statique
pnpm test          # engine + content (vitest)
pnpm typecheck && pnpm lint

# Reproduire le garde-fou faction sur packages/ (si tu as ajouté un test contenu)
pattern=$(jq -r '.factions | map("\\b" + . + "\\b") | join("|")' data/factions/index.json)
grep -rInE "$pattern" packages/ --include='*.ts' --exclude-dir=node_modules --exclude-dir=dist \
  && echo "❌ ID de faction dans packages/" || echo "✓ propre"
```

Un test ajouté dans une zone non couverte par le smoke ⇒ le dire explicitement
(§7), ne pas prétendre la non-régression garantie.

## 5. Où tourne quoi (rappel)

- **PR** (`ci.yml`) : job `quality` (typecheck/lint/unit/contenu/gardes-fous/
  build/budget) + `smoke` **`@core` seul** (shardé) + `smoke-perf` (@perf isolé).
- **`main` / `workflow_dispatch`** : suite smoke **complète** (`deploy.yml` +
  dispatch CI). Une régression hors `@core`/`@perf` se voit là — pas sur la PR.
