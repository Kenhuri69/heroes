# Doc 18 — Sweep de cohérence (audit ↔ code)

## Constat

Plusieurs sessions « sprint » parallèles ont livré des écarts de l'audit doc 18
**sans mettre à jour l'audit**. Vérification code : **7 items marqués « manque »
sont en réalité livrés**. Le doc 18 (roadmap de comblement) est trompeur ⇒
divergence spec↔code (guidelines §8.6), et fait re-piocher des lots déjà faits.

## Items livrés à re-marquer (preuve code)

| Item | Preuve |
|---|---|
| **A2** croissance/respawn gardiens | `config.guardianGrowth {weeklyFactor,maxCount}` + `engine.ts` WeekStarted ; `respawn.ts` `queueGuardianRespawn` (respawn opt-in) |
| **A4** effets de calendrier au mois | `calendar.monthEvents` / `CalendarMonthEventDef` / `monthEventId` (`calendar.ts`) |
| **B2** tente de soin & chariot de munitions | `healPerRound`/`replenishAmmo` (`turns.ts`) + `first-aid-tent`/`ammo-cart` (`war-machines.json`) |
| **B4** mort subite PvP | `combat.suddenDeath {round,resolution}` (`turns.ts:199`) |
| **C1** perks might/magic | `config.hero.archetypeEffects` → `armySlotsBonus`/`heroActionsPerRound` (doc 02 §1) |
| **C2** panoplies d'artefacts | 3 sets (`attirail-voyageur`, `panoplie-gladiateur`, `regalia-archimage`) dans `artifacts.json` |
| **E1** vue de royaume | `ui/KingdomOverview.tsx` + toggle shell + router modal `kingdom` (sprint 3) |

## Items GÉNUINEMENT ouverts (re-listés pour clarté)

- **E4.4** actions de héros par-héros en coop (P3, lourd : heroId dans les
  commandes de combat + bump save + UI multi-grimoire).
- **E3** comparatif inter-joueurs / guilde des voleurs (P2, client — la vue de
  royaume ne montre que le joueur humain, pas un classement des adversaires).
- **A5** triggers de carte : partiels (`grantArtifact`/`grantArmy`/`ambush`
  livrés ; message à choix, téléport scripté restants) (P2).
- **A6** ville neutre comme `MapObjectDef` (P3, dette de forme).
- **D1** vue de ville peinte (client+assets, Beta) · **D2** commerce avancé (P3).

## Étapes (documentaire pur)

1. Réécrire les 7 blocs doc 18 (A2/A4/B2/B4/C1/C2/E1) → **✅ livré** + résumé
   fondé sur le code.
   → verify: chaque bloc reflète le livré, marqueur ✅ cohérent avec B1/B3/B6/E2.
2. (Aucun code) — pas de golden/save/bundle ; smoke omis (§7).

## Statut

- [x] **LIVRÉ** (documentaire). Fiches §2 re-marquées livrées : **A1, A2, A4, B2,
      B4, C1, C2, E1, F4** (✅) ; **A5** passé à 🚧 (partiel). Tables §4 Étapes 1–3
      : ✅ sur les lots livrés (1.1–1.4, 2.1/2.2/2.3/2.5, 3.1/3.2/3.4). Étape 5
      (cadrage) : B3/A3/E4 retenus & livrés (reste E4.4). Encart « État de
      comblement (2026-07) » ajouté en tête du §4 avec la liste des items **encore
      ouverts** : E3, E4.4, A5(partiel), A6, D1, D2. Aucun code ⇒ pas de
      golden/save/bundle ; smoke omis (§7). Diff 100 % markdown.
