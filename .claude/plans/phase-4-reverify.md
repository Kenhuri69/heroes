# Plan — Re-vérification Alpha Arcane Hunters (4.1 → 4.10), dans l'ordre

> Directive utilisateur : « reprendre proprement à partir de 4.1 » — suivre
> l'ordre défini (décomposition `phase-4.1` §2), vérifier chaque lot Arcane
> Hunters contre son plan + doc 05, combler les écarts. Même rigueur que
> l'audit 3.x. Aucune divagation (pas de « machines de guerre » hors séquence).

## Ordre défini (phase-4.1 §2, étendu à l'implémentation 4.2→4.10)
1. 4.2 — Marque du Chasseur (signature) + lineup 8 tiers (doc 05 §3.1, §4)
2. 4.3 — consumeMarks (générique) ; 4.5 expose ; 4.8 pinningShot (doc 05 §4)
3. 4.4 — Essence (économie de faction) ; 4.6 — dépense Essence / T8 Pénitent
   + **Contrats de chasse** (doc 05 §3.3, point (5) `AdventureHook.weekStart`)
4. 4.7 — Cercles (`exclusiveGroup`) ; 4.9 — École de la Traque (doc 05 §3.2, §6)
5. 4.10 — demonform (T8) + héros nommés (doc 05 §7) + résumé §8

## Écart déjà repéré (avant audit)
- **Contrats de chasse** (doc 05 §3.3) : le cadrage 4.1 le liste (point 5,
  `AdventureHook.weekStart`) mais **aucun fichier `phase-4.x`** ne l'implémente
  → probablement MANQUANT. À confirmer par l'audit, puis combler dans l'ordre.

## Étape 1 — Audit ordonné (délégué, read-only) ✅ TERMINÉ (5/5)
- [x] 4.2 Marque + lineup — ✅ propre (exotiques différées documentées).
- [x] 4.3/4.5/4.8 consumeMarks — ✅ propre, testé, générique.
- [x] 4.4/4.6 Essence — ✅ gain + dépense/T8 ; ❌ **Contrats de chasse ABSENTS**.
- [x] 4.7/4.9 Cercles + Traque — ✅ `exclusiveGroup` ; ⚠️ passifs génériques +
      2/8 sorts + pas d'accès héros (différés documentés).
- [x] 4.10 demonform — ✅ (scope réduit) ; héros nommés différés ; ⚠️ §8
      **surévalue** 2 points : Contrats de chasse (absent) + `sharedGrowthGroup`
      (schéma seul, non câblé).

## Étape 2 — Synthèse ✅
**Vrais trous non-différés (à combler) :** (1) **Contrats de chasse** (doc 05 §3.3/§8)
— absents, schéma les bloque ; (2) **`sharedGrowthGroup`** apex T7/T8 — non câblé.
**Différés Beta documentés (hors périmètre) :** capacités exotiques d'unités,
passifs distincts des Cercles + bâtiments de suivi, 6/8 sorts Traque + accès héros,
héros nommés, « Grand Amphithéâtre ».

## Étape 3 — Combler DANS L'ORDRE (un lot = un point d'extension générique)
- [x] **A — Contrats de chasse** (point 5 du cadrage 4.1) : effet de bâtiment
  **générique** `{ type: 'huntContract', gold, resource, amount }` (pas un hook
  impératif) ; au `WeekStarted`, le propriétaire d'un tel bâtiment se voit
  assigner une cible neutre (gardien) tirée au RNG seedé ; la vaincre crédite
  or + ressource de faction. Bâtiment « Tableau des Contrats » en données AH.
  État `PlayerState.huntContract`, save v→5, golden re-fixé. Tests + smoke + docs
  02 §4.1 + 05 §3.3/§8. **Livré** (journal 2026-07-06).
- [x] **B — sharedGrowthGroup** : câblé (décision utilisateur : feature complète,
  pas correction doc). Plan dédié `.claude/plans/phase-4.20-shared-growth-apex.md`.
  Point d'extension générique `GameState.growthGroups` + `TownState.sharedGrowthChoice`
  + commande `ChooseSharedGrowth` ; croissance mutualisée au `WeekStarted` ; données
  AH `{ apex: [t7-manticore, t8-penitent] }` ; UI ville ; save v13→**14** ; golden
  re-fixé `0968d47e`. Docs 02 §4.1 / 05 §5/§8 / 06 alignées. **Livré (4.20).**

## Invariants
Moteur pur, zéro nom de faction dans `packages/` (y compris commentaires/tests),
golden re-fixé explicitement, budget < 800 Ko, anti-gel ×4, docs = vérité.

## Journal
- **2026-07-06** — Création. Base `54b3657` (main, après #67). Ré-ancrage sur
  l'ordre 4.1→4.10 ; audit 5 agents lancé. Écart pressenti : Contrats de chasse.
- **2026-07-06** — Audit 5/5 rendu. Confirmé : seul **Contrats de chasse** est un
  vrai trou non-différé (+ `sharedGrowthGroup` non câblé) ; le reste est propre
  ou différé-Beta documenté.
- **2026-07-06** — **Lot A livré** : Contrats de chasse. Effet de bâtiment
  générique `huntContract` (schéma + moteur), `PlayerState.huntContract`,
  assignation au `WeekStarted` (RNG seedé), récompense à la victoire de gardien ;
  bâtiment « Tableau des Contrats » (AH) + locales ; toasts client. `saveVersion`
  → 5, golden re-fixé `0b51c01e`. Vérif : typecheck 4/4, lint, **263 engine + 70
  content** (dont town-hunt-contract ×5), content:check, build, **60 smoke**
  (dont le contrat assigné). Docs 05 §3.3/§8 à jour (§8 ne surévalue plus).
  **Reste : Lot B — sharedGrowthGroup** (ou correction doc si trop lourd).
- **2026-07-09** — **Lot B livré (4.20)** : câblage complet de la croissance
  partagée apex (choix utilisateur). Point d'extension **générique**
  `GameState.growthGroups` + `TownState.sharedGrowthChoice` + commande
  `ChooseSharedGrowth` + événement `SharedGrowthChosen` ; `applyWeeklyGrowth`
  mutualise la croissance (destinataire = choix joueur, défaut = 1er membre) ;
  `buildGrowthGroupCatalog` (contenu) ; manifeste AH `{ apex: [t7-manticore,
  t8-penitent] }` ; sélecteur apex `RecruitTab` + locales fr/en. `saveVersion`
  → **14**, golden re-fixé `0968d47e`. Vérif : typecheck **5/5**, lint,
  **401 engine + 96 content** (dont town-shared-growth ×9 + 2 content), content:check,
  garde-fous faction + CSS verts, build < 800 Ko (276 Ko gzip), **132 smoke**.
  Docs 02 §4.1 / 05 §5/§8 / 06 + CLAUDE.md alignées. **phase-4-reverify clos.**
