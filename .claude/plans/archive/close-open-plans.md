# Clôture des plans restés ouverts

> **Demande utilisateur (2026-08-24)** : « go traité les plan restés ouverts pour
> les clôturer ». Passe d'hygiène de `.claude/plans/` : aucun code de gameplay
> n'est écrit ici — on **vérifie** ce qui est livré, on **coche** les cases de
> vérification avec les mesures réelles, on **consigne** les reliquats
> délibérément différés, et on **archive** les plans terminés
> (`.claude/plans/archive/`, convention des commits `chore(plans): archiver…`).

## Constat de départ

10 plans portaient des cases non cochées :

| Plan | Cases ouvertes | Nature réelle |
|---|---|---|
| `e8-prebattle-overwhelm-warning.md` | 6/6 | **code livré sur `main`**, vérif non consignée |
| `e8b-combat-lethal-retaliation.md` | 6/6 | idem |
| `e14-combatlog-filter-copy.md` | 6/6 | idem |
| `e15-fullscreen-toggle.md` | 6/6 | idem |
| `i18n-audit-spell-schools.md` | 6/6 | idem |
| `game-review-remediation-plan.md` | 4 | suivi **périmé** (R0/R6 livrés) |
| `phase-alpha-e2e-ergonomics.md` | 4 | suivi périmé (S2-S4) + S5 optionnel |
| `game-ergonomics-immersion-review.md` | 3 | reliquats **asset-lourds** différés |
| `map-design-issues.md` | 1 | planches d'assets à générer (différé) |
| `siege-visual-overhaul.md` | 1 | Lot 3 polish (différé, après retour porteur) |

Preuves de livraison des 5 plans « e*/i18n » (grep sur `main`) :
`PreBattleScreen.tsx:41` (`overwhelmed`, ratio ×2) · `combat.tsx:97`
(`lethalRetaliation`) · `CombatLog.tsx:50-69` (filtre + copie + `noMatch`) ·
`app/fullscreen.ts` + `app/fullscreen.test.ts` + `OptionsPanel.tsx:15` ·
`data/core/locales/{fr,en}.json` (`school.lumiere/prime/traque/scene`) +
`packages/content/test/{spell-school-locale,loc-refs-resolve}.test.ts`.

## Étapes

1. **Vérification unique** du pipeline complet (les 5 listes de vérification des
   plans « e*/i18n » sont identiques) → verify: typecheck, lint, tests moteur/
   contenu/client, `content:check`, garde-fous faction & couleurs, build, budget
   bundle, smoke `@core` desktop + mobile, golden inchangé.
2. **Cocher** les cases avec les mesures réelles (pas de coche sans preuve).
3. **Synchroniser** les deux plans de suivi périmés (`game-review-remediation-plan`,
   `phase-alpha-e2e-ergonomics`) sur l'état livré, sans cocher ce qui ne l'est pas.
4. **Consigner les reliquats** différés dans `reliquats-differes.md` (fichier
   unique, en racine de `.claude/plans/`) : rien ne disparaît en archivant.
5. **Archiver** les plans terminés (les 10 ci-dessus + les plans déjà 100 %
   cochés restés en racine) → verify: `ls .claude/plans/*.md` ne garde que les
   plans vivants.

## Vérification (pipeline rejoué le 2026-08-24 sur cette branche)

- [x] `pnpm typecheck` vert (5 projets)
- [x] `pnpm lint` vert
- [x] `pnpm test` — moteur **935/935**, contenu et client verts
- [x] `pnpm content:check` — 7 paquets, 2 cartes, 16 scénarios valides
- [x] garde-fou faction (dérivé de `data/factions/index.json`) : aucun ID dans `packages/`
- [x] garde-fou couleurs : aucun littéral hors `ui/tokens.css`
- [x] `pnpm build` + budget bundle : **364 866 o gzip** (cap 819 200)
- [x] smoke `@core` desktop + mobile : **55/55** verts — 54 au 1ᵉʳ passage, le test
      `ville` mobile ayant dépassé le timeout **local** de 30 s sous contention CPU
      (rendu logiciel du conteneur) ; **rejoué seul : vert en 22,1 s**. La CI porte
      ce timeout à 45 s précisément pour ce motif (`playwright.config.ts`)
- [x] golden inchangé (aucun fichier moteur touché par ce lot — plans seuls)

## Décisions

- **Rien de nouveau n'est implémenté** : les 5 plans « e*/i18n » décrivaient du
  code déjà sur `main` (livré avec les lots UX), seule la trace de vérification
  manquait. Les cocher **après** avoir rejoué le pipeline évite la coche de
  complaisance (guideline §4).
- Les reliquats différés (planches d'assets, ambiances de biome, Lot 10, polish
  de siège, filtre par catégorie du journal) **ne sont pas clôturés en silence** :
  ils sont regroupés dans `reliquats-differes.md`, seul plan vivant qui les porte.
- `game-feature-gaps.md` (inventaire vivant) et `llm-asset-generation-plants.md`
  (attend des planches fournies par l'utilisateur) **restent en racine** : ce ne
  sont pas des plans terminés.

## Résultat

**29 plans archivés** vers `.claude/plans/archive/` :

- les 10 plans traités ici (5 « e*/i18n » + `game-review-remediation-plan`,
  `phase-alpha-e2e-ergonomics`, `game-ergonomics-immersion-review`,
  `map-design-issues`, `siege-visual-overhaul`) ;
- les 10 plans de lots **R0→R7** (`r0-*`, `r0-verification-gaps`, `r1`…`r7`,
  `r5b`), déjà 100 % cochés — l'umbrella qui les référence étant clos, ils n'ont
  plus de raison d'être en racine ;
- 9 plans de fonctionnalité déjà livrés et cochés restés en racine :
  `boot-loading-screen`, `map-hero-stat-locations`, `phase-A5d-onflagcaptured`,
  `phase-dungeon-ombre-school`, `phase-honmoon-barrier`, `phase-map-size-512`,
  `phase-necro-building-scaling`, `playtest-adventure-zoom`,
  `necropolis-skeleton-archer`.

**Restent en racine (vivants, à dessein)** :

| Fichier | Pourquoi il reste |
|---|---|
| `reliquats-differes.md` | porte les chantiers différés des plans archivés |
| `game-feature-gaps.md` | inventaire vivant jeu livré vs concept (référence) |
| `llm-asset-generation-plants.md` | attend les planches d'images de l'utilisateur |
| `merged-branches-cleanup.md` (+ `.branches.txt`) | la suppression des 209 branches est **refusée à la session** : la commande attend l'utilisateur |
| `close-open-plans.md` | ce plan (la passe elle-même) |
