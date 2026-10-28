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

1. [ ] Bench jetable de référence (2 IA, 64², 30 graines, 90 jours, élimination).
2. [ ] Héros principal (plus forte `armyStrength`, id le plus petit à égalité).
3. [ ] Relais vers le principal (≥ 25 % de sa force, ≤ 2 jours), garde ≥ 1 créature.
4. [ ] Offensive sans horizon à ≥ 1,5× `townDefenseStrength` d'une ville adverse
   explorée, avant l'exploration ; hystérésis (garde ≥ 1,2×) ; chemin en cache.
5. [ ] LD6a : Ville-portail en priorité 0 si la ville est menacée et hors de portée.
6. [ ] Tests (relais garde 1 créature, offensive > 3 jours) ; property IA vs IA.
7. [ ] Bench cible : ≥ 15/30 parties conclues, ≤ 5/30 sans combat hors gardien,
   part du principal ≥ 0,85, 1ᵉʳ combat joueur-joueur médian ≤ J35, tour IA ≤ +20 %.
8. [ ] Docs 02 (IA d'aventure), CLAUDE.md, registre.

## Journal

- LD1 : check complet vert (1 145 tests moteur, golden inchangé, bundle 402 Ko).
