# Plan — Lot M4 : Auto-combat, reprise de main (C15)

> Lot du plan `.claude/plans/ux-revue-mmho.md` (après M1 #140 et M2 #141).
> Doc 08 §2.4 promet : « combat auto **avec possibilité de reprendre la main à
> tout round** ». Aujourd'hui `AutoCombat` résout tout le combat d'un bloc —
> aucune reprise (`combat.tsx` : délégation sèche).
>
> Contexte : le Lot 1 du plan parallèle (#144) a livré l'**écran pré-combat**
> avec « Auto-Battle » (résolution instantanée). Répartition retenue :
> **pré-combat Auto-Battle = résolution instantanée** (fidèle MMHO, chemin
> rapide) ; **« Auto ▶▶ » en combat = bascule round par round** avec
> « Reprendre la main » (doc 08 §2.4) — les deux coexistent sans se marcher
> dessus.

## Étapes

1. **Moteur — variante générique « jouer N rounds auto »** : champ optionnel
   `rounds?: number` sur la commande `AutoCombat` (rétro-compatible : absent =
   résolution complète, replays/journaux nets inchangés, golden intact).
   `runAutoCombat(draft, events, rounds?)` s'arrête quand `combat.round`
   atteint `roundDépart + rounds` ; `handleAutoCombat` enchaîne alors
   `runAiIfNeeded` pour rendre la main **sur une pile du joueur** (invariant
   des commandes de combat préservé). Validation : `rounds` entier ≥ 1.
   → *Vérif* : test moteur « itérer AutoCombat{rounds:1} jusqu'à la fin ≡
   AutoCombat complet (même hashState) » + « une commande avance d'exactement
   un round et rend la main au joueur ».
2. **Client — bascule et reprise** : store `combatAutoActive` ; « Auto ▶▶ »
   devient une bascule (activation = télémétrie `recordCombatAuto`, libellé →
   « Reprendre la main ») ; une boucle d'effet dans `CombatUi` dispatch
   `AutoCombat{rounds:1}` à chaque fois que c'est au joueur (délai entre
   rounds ÷ vitesse ×1/×2/×4) ; « Reprendre la main » coupe la boucle au
   round courant. Les autres actions sont désactivées pendant l'auto. Le flag
   est réinitialisé aux transitions de combat (`app/dispatch.ts`, comme
   `preBattlePending`).
   → *Vérif* : smoke « Auto ⇒ le round avance et le combat continue ;
   Reprendre la main ⇒ les actions redeviennent actives ».
3. **Tests existants** : les 3 smoke qui utilisaient « Auto ▶▶ » comme
   résolution instantanée passent en vitesse ×4 avant la bascule (le combat
   se résout en boucle auto, quelques secondes) — le chemin instantané reste
   couvert par « Auto-Battle » du pré-combat.
4. **Docs & journaux** : doc 08 §2.4 (état M4, répartition des deux autos),
   journal des plans.

## Vérifications de sortie

- [x] Moteur : 365 tests verts dont `combat-auto-rounds.test.ts` ×4
      (itération rounds:1 ≡ résolution complète, même hashState ; golden
      intact).
- [x] Smoke : suite complète **116 passés, 0 échec** (desktop + mobile),
      dont le nouveau test M4 (bascule + reprise) et les 3 tests adaptés.
- [x] Typecheck 5/5, lint, build.

## Journal

- 2026-07-08 : plan ouvert (M2 mergé #141 ; pré-combat #144 pris en compte).
- 2026-07-08 : étapes 1–4 livrées. Moteur : `AutoCombat{rounds?}` (validation
  `invalidRounds`, `runAutoCombat` borné + `runAiIfNeeded` pour rendre la main
  au joueur). Client : bascule `combatAutoActive` (reset aux transitions de
  combat dans `dispatch`), boucle d'effet `AutoCombat{rounds:1}` avec pause ÷
  vitesse, libellé « Reprendre la main », actions désactivées pendant l'auto.
  **Correctif au passage** : gardes `destroyed` manquantes sur les tweens de
  `CombatScene` (move/attack/dégâts flottants/mort) — préexistant, révélé par
  l'enchaînement d'animations de l'auto par rounds (TypeError `null.y` quand
  la scène était détruite pendant un tween en vol). 3 smoke existants adaptés
  (×4 + marge de poll : l'auto n'est plus instantané). Doc 08 §2.4 (état M4).
- 2026-07-08 : **durcissement tap-tap** — le bouton « Annuler le déplacement »
  (M2) faisait grandir le HUD bas et l'armée recouvrait la tuile à confirmer
  (régression mobile) ⇒ le bouton devient un flotteur absolu ancré AU-DESSUS
  du HUD (aucun décalage de layout). Au passage, `tapTapTile` (smoke) remplace
  son attente aveugle de 100 ms par un point de synchro déterministe (le
  bouton d'annulation visible) — la flakiness documentée des 2 clics
  chronométrés disparaît (suite 116/116).
