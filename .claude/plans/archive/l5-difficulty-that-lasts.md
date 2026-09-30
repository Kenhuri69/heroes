# Lot L5 — une difficulté qui pèse dans la durée

> Lot 5 du plan `.claude/plans/missing-features-2026-08.md` (famille **G1.d**).

## 1. Constat

`DIFFICULTY_TUNING` (`packages/client/src/app/game.ts`) n'agit qu'au **démarrage** :
armée de départ ×0,6/1/1,6, ressources ×1/1,5, Fort prébâti en difficile. Passé
les premières semaines, les trois crans deviennent **indiscernables** : l'IA
produit exactement comme le joueur. Un cran de difficulté doit peser tant que la
partie dure.

## 2. Décision de conception

Deux façons de faire durer un cran : **mieux jouer** (heuristiques distinctes par
cran) ou **produire plus** (avantage économique). Le plan recommandait « bonus de
données modestes + meilleures heuristiques partagées par tous les crans » : les
lots L2-L4 ont déjà relevé les heuristiques **pour tout le monde**, ce lot ajoute
donc le levier économique — et **rien** qui ressemble à un cran de difficulté
dans le moteur.

Point d'extension moteur **générique** : `PlayerState.economyBonus?
{ incomePercent?, growthPercent? }` — un profil économique par joueur, en
pourcentages opaques, posé par les données (`PlayerSetup`). Le moteur ne connaît
ni « facile » ni « difficile » : il applique un facteur. Champ **optionnel**
⇒ absent = facteur 1 ⇒ **pas de bump `CURRENT_SAVE_VERSION`**, golden inchangé.

## 3. Étapes

1. Moteur : champ `economyBonus` (state + `PlayerSetup` + création de joueur)
   → verify: typecheck.
2. `applyDailyIncome` : revenus de bâtiment ET de mine multipliés par
   `1 + incomePercent/100` (plancher 0, arrondi bas) → verify: unitaire.
3. `weeklyGrowthOf` (helper partagé villes/UI) + croissance des habitations de
   carte : facteur `1 + growthPercent/100` du **propriétaire** → verify: unitaire.
4. Client : `DIFFICULTY_TUNING` gagne `aiIncomePercent`/`aiGrowthPercent`, posés
   sur les sièges **IA** des deux chemins de démarrage → verify: unitaire client.
5. Docs 02 §4.1 (économie) + 09 (crans) → verify: relecture.
6. Vérification complète (typecheck, lint, tests, content:check, garde-fous,
   build+budget, smoke @core + @e2e, golden inchangé).

## 4. Journal

- **2026-08-31 — livré**. Décisions et écarts :
  - Le facteur est appliqué **aussi** aux projections lues par l'UI
    (`dailyIncome`, `weeklyGrowthOf`) : sans ça le HUD aurait annoncé un revenu
    que la journée suivante n'aurait pas tenu.
  - **Mines comprises** dans le revenu majoré : une IA « difficile » qui ne
    profite que de ses bâtiments reste plafonnée par le contenu de sa ville.
  - Le cran **normal** ne pose **aucun** champ (`seatEconomy` rend `{}`) : la
    partie standard sérialise exactement comme avant le lot.
  - *Limite assumée* : le levier est **économique**. Les crans ne changent pas
    les heuristiques (marges d'engagement, priorités) — les lots L2-L4 les ont
    relevées pour tout le monde, et une IA « facile » qui joue mal exprès serait
    une autre décision de design.

## 5. Vérification (rejouée en entier le 2026-08-31)

- [x] `pnpm typecheck` (5 projets) · `pnpm lint`
- [x] tests **moteur 968/968** (+5 `economy-bonus.test.ts`), contenu 165,
      **client 85** (+3 `difficulty.test.ts`)
- [x] `pnpm content:check` · garde-fous faction & couleurs
- [x] `pnpm build` + budget bundle **367 783 o gzip** (cap 819 200)
- [x] smoke `@core` **55/55** · `@e2e` **3/3**
- [x] **golden inchangé** — le replay golden n'a aucun `economyBonus`, donc
      facteur 1 sur toutes les lignes de revenu et de croissance
