# Plan — Alpha 4.17 : outil `faction:sim` + première passe d'équilibrage

> Item roadmap doc 09 ligne 48. Livre l'**outil de mesure** d'équilibrage
> (auto-combats déterministes entre factions) + une **première passe** de réglage.

## Conception
- **Moteur** : helper pur `simulateAutoCombat(catalog, config, attaquant,
  défenseur, terrain, seed) → camp vainqueur` (réutilise `StartCombat` +
  `AutoCombat`, RNG seedé). Testable, déterministe.
- **Outil** `packages/tools/src/faction-sim.ts` (`pnpm faction:sim`) : charge le
  contenu, construit un catalogue d'unités, arme chaque faction au **lineup
  complet** (unité de base par tier, effectif ∝ budget or / coût) et oppose
  chaque paire sur N graines × 2 sens. Rapport de winrates ; **exit 1** sur
  déséquilibre béant (hors 20–80 %). **Générique** : les factions viennent des
  données, aucun nom en dur (garde-fou faction respecté).
- **Première passe** : corriger l'outlier révélé (Havre 100 %) par des données
  (défenses + coûts) ; durcir la faction la plus fragile ; docs 03/05 en phase.

## Lots
- [x] Moteur : `combat/simulate.ts` + export ; test `combat-simulate.test.ts`.
- [x] Outil : `faction-sim.ts` + scripts `faction:sim` (tools + racine) ;
  dépendance `@heroes/engine` ajoutée à `@heroes/tools`.
- [x] Première passe d'équilibrage (données) : Havre def T1/T3/T5/T6/T7 abaissées
  + coûts or T1–T6 rehaussés ; Arcane Hunters Manticore T7 PV 130→155/Déf 16→18.
- [x] Docs 03 (Havre) + 05 (Arcane) tables synchronisées + notes ⚖️ ; roadmap 09.

## Résultats (faction:sim, 120×2 combats/paire, budget 4000 or/tier)
| Paire | Avant | Après |
|-------|-------|-------|
| Havre vs Arcane Hunters | 100 % | **65.8 %** |
| Havre vs Necropolis | 100 % | **56.7 %** |
| Arcane Hunters vs Necropolis | 52.1 % | **53.8 %** |

**0 déséquilibre béant** (avant : 2 blowouts à 100 %). Havre reste légèrement
favorisé (~57–66 %) ; convergence fine 45–55 % = itérations ultérieures.

## Écarts / décisions constatés
- **Filtre lineup complet** : `test-faction` (1 seul tier) faussait la mesure →
  seules les factions aux 7 tiers entrent (filtre structurel, pas un nom).
- **Métrique = valeur d'or égale** : révèle le sous-coût (Havre avait plus
  d'unités à budget égal). Autres résolutions possibles (valeur de combat
  calculée) = raffinement.
- **Non-monotonie** de l'auto-combat déterministe : un nerf de dégâts Havre a
  *augmenté* son winrate vs Arcane (flip d'ordre de kill) → réglage prudent, on
  garde les leviers localisés (def/coût/PV de tier isolé).
- **Golden inchangé** (aucune donnée du golden touchée ; helper pur).
- Pas de gate CI sur `faction:sim` (la cible fine 45–55 est un objectif de
  réglage, pas un blocage) — l'outil sert la mesure + un garde-fou anti-blowout.

## Journal
- **2026-07-06** — Après merge #73 (sorts d'aventure 4.16). Base = `origin/main`
  (7bf1cb4). Outil + helper + première passe livrés ; tout vert.
