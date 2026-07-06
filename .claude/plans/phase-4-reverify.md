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

## Étape 1 — Audit ordonné (délégué, read-only) — EN COURS
5 sous-agents Sonnet, un par tranche, comparant doc 05 + plan(s) au code :
- [ ] 4.2 Marque + lineup
- [ ] 4.3/4.5/4.8 consumeMarks (expose/executioner/pinningShot)
- [ ] 4.4/4.6 Essence + **Contrats de chasse** (suspecté manquant)
- [ ] 4.7/4.9 Cercles + Traque
- [ ] 4.10 demonform + héros nommés + modularité §8

## Étape 2 — Synthèse + tri (écart réel / différé-documenté)
## Étape 3 — Combler les écarts DANS L'ORDRE (4.2→4.10), un lot = un point
d'extension générique + données, garde-fou « zéro faction moteur » vert, golden
re-fixé si forme d'état évolue, tests + smoke, docs, PR par lot.

## Invariants
Moteur pur, zéro nom de faction dans `packages/` (y compris commentaires/tests),
golden re-fixé explicitement, budget < 800 Ko, anti-gel ×4, docs = vérité.

## Journal
- **2026-07-06** — Création. Base `54b3657` (main, après #67). Ré-ancrage sur
  l'ordre 4.1→4.10 ; audit 5 agents lancé. Écart pressenti : Contrats de chasse.
