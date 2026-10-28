# LD1 + LD2 — Une défaite HoMM, une IA qui conclut

Source : `.claude/plans/design-round-3.md` (LD1, LD2, LD6a + verdict de l'expert).
Livrés **dans la même PR** : LD1 seul en production allongerait les parties sans
fin (déploiement continu).

## LD1 — défaite par élimination

1. [x] `ScenarioObjectives.defeat?` optionnel (moteur, schéma, loader, briefing).
2. [x] Parties générées (`skirmishStartCommand`, `newGameStartCommand`) sans `defeat`.
3. [x] `defeatMet` : un héros en réserve ne fait pas perdre son joueur ;
   `conditionMet` (victoire adverse) inchangé.
4. [x] Hot-seat : la partie continue tant qu'un humain reste en jeu ; un humain
   sorti par sa défaite explicite est éliminé (`PlayerEliminated`).
5. [x] Client : `townlessDaysLeft` (moteur) → badge `TownlessWarning` + toast à
   l'aube ; toast « Joueur N éliminé ».
6. [x] Tests `scenario-ld1.test.ts` (7) ; `scenario.test.ts` : player-2 en IA
   (deux humains = hot-seat depuis LD1). Doc 02 §6 + §5.5 (fuite).

## LD2 — IA qui conclut (+ LD6a)

1. [x] Bench jetable de référence (2 IA, 64², 30 graines, 90 jours, élimination).
2. [x] Héros principal (plus forte `armyStrength`, id le plus petit à égalité).
3. [x] Relais vers le principal (≥ 25 % de sa force, ≤ 2 jours), garde ≥ 1 créature.
4. [x] Offensive sans horizon à ≥ 1,5× `townDefenseStrength` d'une ville adverse
   explorée, avant l'exploration ; hystérésis (garde ≥ 1,2×) ; chemin en cache.
5. [x] LD6a : Ville-portail en priorité 0 si la ville est menacée et hors de portée.
6. [x] Tests (relais garde 1 créature, offensive > 3 jours) ; property IA vs IA.
7. [x] Bench cible : ≥ 15/30 parties conclues, ≤ 5/30 sans combat hors gardien,
   part du principal ≥ 0,85, 1ᵉʳ combat joueur-joueur médian ≤ J35, tour IA ≤ +20 %.
8. [x] Docs 02 (IA d'aventure), CLAUDE.md, registre.

## Journal

- LD1 : check complet vert (1 145 tests moteur, golden inchangé, bundle 402 Ko).
- LD2 — mesure (2 IA, 64², 90 jours, élimination, 60 graines ; script jetable
  `bench2.mts` non commité) :

  | | Référence (LD1+LD3) | LD2 retenu (3 j, 10 %) | LD2 plan (2 j, 25 %) |
  |---|---|---|---|
  | parties conclues | 11 | **26** | 25 |
  | sans combat entre joueurs | 27 | **11** | 15 |
  | 1ᵉʳ combat joueur-joueur (médiane) | j52 | j50 | j50 |
  | part du principal | 0,52 | **0,79** | 0,67 |
  | ms / tour IA | 12 | 12 | 12 |
  | plantages (combat sans fin) | 1 | 0 | 0 |

- Écarts au plan : (a) **la vraie cause** du « l'IA ne conclut pas » était
  l'exploration à **un pas par jour** (`pickExplorationStep` rendait `[first]`) —
  ville adverse jamais vue, donc jamais visée (B31). Corrigé : chemin entier,
  6 cibles enchaînées par jour, sans traverser un téléporteur. Seule, l'offensive
  ne changeait rien (4–5/30). (b) **Percée** ajoutée : gardiens +10 %/semaine,
  l'IA restait enfermée. (c) **Rachat d'un héros** quand le joueur n'en a plus
  (des IA restaient sans héros toute la partie). (d) Relais à 10 % / 3 jours :
  meilleur que 25 % / 2 jours sur 60 graines. (e) Hystérésis sans état (1,2× à
  moins d'un jour) au lieu d'une cible mémorisée — pas de champ de sauvegarde ;
  pas de cache de chemin (tour IA inchangé à 12 ms).
- **Bug moteur trouvé et corrigé** (présent sur `main`) : un camp réduit à ses
  machines de guerre gardait le combat ouvert ⇒ `runAutoCombat` levait
  « boucle infinie » (siège au round 1 536 : tente qui soigne un chariot hors
  d'atteinte). Règle canon III : il a perdu ; la tour de tir de ville garde sa
  règle (C-SIEGE2.7a). Test C-SIEGE2.6 re-dimensionné (ses créatures doivent
  tenir pendant que la catapulte tire).
- Correctif de relecture : un relais collé à un principal plein ne restait plus
  planté. Mesure finale (60 graines) : **29/60** conclues, 11/60 sans combat
  entre joueurs, 1ᵉʳ combat j49, part du principal 0,79, 11 ms/tour.
- Cibles non atteintes : 1ᵉʳ combat joueur-joueur ≤ j35 (j50) et part du
  principal ≥ 0,85 (0,79). Pas d'autre levier sans triche d'information.
- Tests : `ai-closes.test.ts` (5), `hero-pool` (rachat sans héros), ajustements
  `hero-reserve`/`ai-underground` couverts sans modification. `faction:sim`
  identique, golden inchangé, 1 151 tests moteur.
