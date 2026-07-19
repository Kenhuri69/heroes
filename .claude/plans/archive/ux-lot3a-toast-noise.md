# Lot 3a (P1) — Feedback : moins de bruit de toasts (E9)

> Plan `game-ergonomics-immersion-review.md` §5 Lot 3, items **1-2** (E9 🟡). Le
> reste du Lot 3 (raisons des boutons combat E2, confirmation attaque perdue E8,
> filtres journal E14) suivra. **Client + locales — zéro moteur, pas de bump save.**

## Constat E9
- **Revenus quotidiens multi-lignes** : à l'aube, chaque mine/ville émet SON toast
  (`MineIncome`/`TownIncome`) ⇒ 3-6 toasts empilés pour « le revenu du jour ».
- **Combats IA-vs-neutres notifiés** : `CombatEnded` toaste « combat gagné/perdu »
  même pour un combat de l'IA (écart documenté dans `notifications.ts`). Le combat
  du joueur pose déjà `game.combat` (écran) ; ceux de l'IA se résolvent DANS
  `AiTurn` sans jamais poser `game.combat` côté client.

## Changements (client)
1. **Bus par lot** (`events.ts`) : `onBatch(events, meta)` en plus de `on` (par
   événement, conservé pour les animations `CombatScene`). `emit(events, meta)`
   passe un `meta` optionnel.
2. **`dispatch.ts`** : `emit(result.events, { humanCombat })` où `humanCombat` =
   un combat du JOUEUR vient de se terminer (`before.combat && !after.combat`).
3. **`ToastHost`** (`toasts.tsx`) passe à `onBatch` :
   - **Agrège** `MineIncome` + `TownIncome` du joueur humain d'un lot en UN toast
     `toast.dailyIncome` (« Revenus du jour : +N or, +X bois… », somme/ressource) ;
     journal idem (une entrée).
   - **`CombatEnded`** : ne toaste QUE si `meta.humanCombat` (les combats IA filtrés
     du toast ; ils restent dans le journal si on le décide — ici filtrés des deux,
     l'écran de combat/bilan du joueur couvre son propre combat).
   - Autres événements : inchangés (un toast chacun).

## Vérification
- Smoke @core : une fin de tour avec ≥ 2 sources de revenu ⇒ **UN seul** toast de
  revenu ; un tour IA qui combat un neutre ⇒ **aucun** toast « combat ».
- Unitaire client si une fonction pure d'agrégation est extraite.
- typecheck · lint · content (i18n) · build · bundle · smoke @core · gardes.

## Journal
- [x] Bus `onBatch(events, meta)` + `emit(events, meta)` (par-événement conservé).
- [x] `dispatch.ts` : `meta.humanCombat` = `before.combat && !after.combat`.
- [x] `notifications.ts` : `sumDailyIncome` (pur) + `aggregateDailyIncome` ; `ToastHost`
      passe à `onBatch` (agrège revenus, filtre `CombatEnded` non-humain). Locale
      `toast.dailyIncome`.
- [x] Tests : **client 4** (`sumDailyIncome` : somme/or-en-tête/filtre joueur/vide) ;
      **smoke @core** (E9 : 1 entrée « Revenus du jour », 0 entrée par-source).
- [x] Recette : typecheck · lint · engine 890 (golden inchangé) · content 152 ·
      client 13 · build · bundle 333 023 ≤ 819 200 · smoke @core 29 + mobile 13 ·
      gardes faction/couleurs.
