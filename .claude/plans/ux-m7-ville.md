# Plan — Lot M7 : Ville, décision au premier écran (C19, C20, C21)

> Lot du plan `.claude/plans/ux-revue-mmho.md` (après M1/M2/M4/M5/M6).
> Client + un helper moteur pur (revenu de ville). C22 (vignettes manquantes)
> est un suivi asset, hors code — noté au journal.

## Constats

- **C19 (P1)** : « tout recruter » absent (recrutement par habitation seul,
  `TownScreen.tsx` `RecruitTab`). Doc 08 §2.2 : achat max multi-tiers.
- **C20 (P1)** : liste Construire triée par id alphabétique
  (`townBuildingIds(...).sort()`) — les verrouillés passent avant les
  disponibles ; incohérent avec la bande peinte (triée par statut).
- **C21 (P2)** : en-tête « VILLE » anonyme — ni nom de faction, ni revenu
  or/jour, ni prochaine croissance (doc 02 §4).

## Étapes

1. **Moteur — `townIncome(town, buildingCatalog)` pur** (`town/economy.ts`) :
   revenu quotidien de CETTE ville (bâtiments à effet `income` du niveau
   construit) ⇒ `Partial<Record<ResourceId, number>>`. Réutilise `builtLevelOf`.
   Exporté ; test unitaire.
2. **Client — tri Construire par statut (C20)** : remplacer `.sort()` par un tri
   `available → built → locked` (ordre de `buildStatus`) puis id. Cohérent avec
   `VIEW_STATUS_ORDER` de la bande peinte.
   → *Vérif* : capture ; smoke (1er élément de la liste est un disponible).
3. **Client — « Tout recruter » (C19)** : bouton global du `RecruitTab`. Plan
   d'achat glouton **tier le plus haut d'abord** (proxy : coût unitaire en or
   décroissant), borné par stock ET ressources courantes (helper client pur
   `maxAffordable(cost, resources)`), confirmation du coût total, dispatch
   séquentiel des `RecruitUnits` (le moteur re-valide chacun). Désactivé si
   rien d'abordable.
   → *Vérif* : smoke « tout recruter ⇒ l'armée grossit, l'or baisse ».
4. **Client — en-tête de ville (C21)** : nom de faction (`@loc:faction.<id>.
   name`) + « Ville », revenu **or/jour** (`townIncome`), **croissance dans N
   jours** (`weekOf(day)*7 + 1 − day`). i18n FR/EN.
   → *Vérif* : capture + parité FR/EN.
5. **Docs & journaux** : doc 08 §2.2 (état M7) ; C22 re-noté suivi asset.

## Vérifications de sortie

- [x] Moteur : 368 tests (dont `townIncome` + golden).
- [x] Smoke : nouveau test M7 (en-tête + tout recruter + tri) desktop+mobile ;
      suite complète (résultat au journal).
- [x] Typecheck 5/5, lint, garde-fou couleurs, contenu 83.

## Journal

- 2026-07-08 : plan ouvert (M6 mergé #150, branche repartie de main), livré.
  Moteur : `townIncome(town, catalog)` pur + test. Client : tri Construire par
  statut (C20) ; `RecruitTab` bouton « Tout recruter » + helper pur
  `maxAffordable` (C19) ; en-tête de ville nom de faction + revenu/jour +
  croissance dans N jours (C21). 4 clés locale FR/EN. Doc 08 §2.2 (état M7).
  C22 (vignettes Habitation:Recrue / Tableau des Contrats) re-noté suivi asset.
