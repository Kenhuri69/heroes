# C-TACTICS.2 — surlignage de la bande de placement (polish client)

Suite de C-TACTICS (#258) : la phase de placement fonctionne (tap pile → tap
case → `PlaceStack`, bouton « Commencer la bataille »), mais la bande autorisée
n'était pas montrée — le joueur tapait à l'aveugle et n'apprenait ses limites
que par le toast de rejet. Ce lot ajoute le retour visuel. Client pur, zéro
moteur, zéro save.

## Étapes

1. [x] Export moteur `combatTacticsColumns` (helper pur déjà existant) via
   `@heroes/engine`.
2. [x] `CombatScene.redrawBoard` : pendant `phase==='placement'`, surligne la
   BANDE de placement (cases libres, hors obstacle) avec le canal `reachable`
   de `drawBoard`, et la pile sélectionnée avec le canal `selected` —
   réutilisation des surbrillances existantes, aucune nouvelle primitive.
3. [x] Vérif : typecheck/lint/build + tests moteur (export additif) +
   non-régression combat smoke.
