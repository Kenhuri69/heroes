# T-GROWTHUI — Affichage croissance base/accumulée (backlog §2.5, 🎨 S)

Doc 02 §4.1 : la croissance hebdo s'accumule dans `town.stock`, plafonnée à
2× l'apport hebdomadaire. Le moteur calcule tout (`applyWeeklyGrowth`,
`economy.ts`) mais l'onglet Recruter n'affiche que le stock — le joueur ne
voit ni le rythme (+X/sem) ni le plafond d'accumulation.

## Étapes

1. [x] **Moteur — helper pur** `weeklyGrowthOf(state, town, unitId)` →
   `{ added, cap } | null` : exactement le calcul d'`applyWeeklyGrowth`
   (croissance de donnée × (1 + bonus Fort) × facteur d'événement de calendrier,
   plafond 2×added), `null` si l'unité n'a pas de donnée de croissance.
   `applyWeeklyGrowth` refactoré pour l'appeler — zéro changement de
   comportement.
   → vérif : tests moteur existants verts (golden compris) + test unitaire du
   helper (bonus Fort, facteur calendrier, null sans donnée).
2. [x] **Client — onglet Recruter** : sous le stock de chaque habitation,
   `+X/sem · max Y` (`data-testid="town-growth-<unitId>"`). Pattern R7 : le
   client consomme le helper moteur, aucun calcul dupliqué.
3. [x] **i18n** : `town.growthPerWeek` (« +{count}/sem » / « +{count}/wk »)
   et `town.growthCap` (« max {count} ») dans `data/core/locales/fr,en.json`.
4. [x] **Smoke** : le test de recrutement existant vérifie la présence du
   détail de croissance.
5. [x] Backlog `game-feature-gaps.md` : T-GROWTHUI ⬜ → ✅.
   → vérif finale : typecheck, lint, tests, build, smoke ciblé ville.
