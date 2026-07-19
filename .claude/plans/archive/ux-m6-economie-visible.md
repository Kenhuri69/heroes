# Plan — Lot M6 : Économie visible (C8, C9, C24)

> Lot du plan `.claude/plans/ux-revue-mmho.md` (après M1/M2/M4/M5). Rend
> lisibles les grandeurs de décision que MMHO affichait en barres permanentes.
> Client + **un helper moteur pur** (revenu/jour), zéro règle nouvelle.

## Constats

- **C8 (P1)** : ressources sans détail ni revenu (`shell.tsx` : « tap = détail
  plus tard »). Objectif : tap sur une ressource ⇒ fiche stock + **revenu/jour**
  (villes + mines possédées + compétence Économie).
- **C9 (P1)** : PM bruts « PM 1700 » sans jauge ni ordre de grandeur. Objectif :
  « PM restants / PM max du jour » + jauge fine.
- **C24 (P1)** : « XP 0 » sans progression. Objectif : jauge XP → seuil du
  prochain niveau, « XP 120 / 300 » (ou « niveau max »).

## Étapes

1. **Moteur — `dailyIncome(state, playerId)` pur** (`town/economy.ts`) :
   miroir SANS mutation de `applyDailyIncome` + or/jour de la compétence
   Économie des héros du joueur ⇒ `Partial<Record<ResourceId, number>>`.
   Réutilise `builtLevelOf`, `heroGoldPerDay`. Exporté par l'index.
   → *Vérif* : test unitaire (ville + mine + skill ⇒ revenu attendu ;
   `applyDailyIncome` produit bien le même total sur un tour).
2. **Client — fiche ressource (C8)** : `resourceDetail` (store) + composant
   `ResourceDetail` (overlay léger, backdrop + Échap, hors pile de modales —
   même patron que `MapObjectCard`/`StackSheet`). Tap sur une ressource du
   bandeau ⇒ table des 7 ressources + faction : stock + `+X/j` (via
   `dailyIncome`). i18n FR/EN.
3. **Client — jauge de PM (C9)** : `turnBar.movementPoints` = « PM {points} /
   {max} » (`max = dailyMovementPoints(config, hero.army, unitCatalog)`) + une
   barre fine (largeur = points/max), 2ᵉ canal chiffré. Cibles/couleurs tokens.
4. **Client — jauge d'XP (C24)** : dans le tiroir héros, « XP {xp} / {next} »
   (`next = xpForLevel(config, level+1)`) + barre de progression ; « niveau
   max » au cap. Helper moteur `xpForLevel` déjà exporté ? sinon l'exporter.
5. **Tests & docs** : 2 assertions smoke `movement-points` mises à jour (texte
   « PM x / y ») + smoke « tap ressource ⇒ fiche revenu » ; doc 08 §2.1
   (état M6) ; journaux.

## Vérifications de sortie

- [x] Moteur : 367 tests (dont `dailyIncome` ×2 + golden).
- [x] Smoke : nouveau test fiche ressource desktop+mobile + assertions PM
      « x / y » adaptées ; suite complète (résultat au journal).
- [x] Typecheck 5/5, lint, garde-fou couleurs, build.

## Journal

- 2026-07-08 : plan ouvert (M5 mergé #147, branche repartie de main), livré.
  Moteur : helper pur `dailyIncome(state, playerId)` (villes + mines +
  Économie), exporté ; test « projection ≡ crédit du DayStarted ». Client :
  `resourceDetail` au store + `ResourceDetail` (tap ressource, overlay léger) ;
  ressources du bandeau devenues boutons (≥ 44 px) ; jauge de PM « PM x / y »
  (`dailyMovementPoints`) et jauge d'XP « XP x / seuil » (`xpForLevel`, « niveau
  max » au cap), composant `.gauge` réutilisable (2ᵉ canal chiffré). Locale
  `hero.xp` orpheline retirée (remplacée par `hero.xpProgress`/`hero.xpMax`).
  Smoke `tapTapTile` durci (re-tap jusqu'à préviz via `toPass`). Doc 08 §2.1
  (état M6).
