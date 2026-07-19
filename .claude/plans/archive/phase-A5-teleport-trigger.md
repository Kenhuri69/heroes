# A5 (partiel) — Trigger de téléport scripté (doc 18 A5)

## Contexte

`TriggerEffect` (doc 02 §2.1) porte `grantResource`/`message`/`grantArtifact`/
`grantArmy`/`ambush`. Manquent (A5, P2) : **message-à-choix** (interactif, save +
UI ⇒ A5b différé) et **téléport scripté**. Ce lot = **téléport** : déterministe,
moteur seul, opt-in par données.

## Décision

Nouvelle variante générique `{ kind: 'teleport'; to: GridPos }`. À la visite de
la tuile piégée : le héros est **déplacé** en `to`, la vision est révélée, le
chemin **s'interrompt** (comme l'embuscade, mais **sans combat**). Réutilise
l'événement `HeroTeleported` existant (déjà rendu client). No-op sur un trigger
`day` (pas de héros) comme les autres effets liés au héros.

## Étapes

1. `map.ts` : `teleport` dans l'union `TriggerEffect`.
   → verify: typecheck.
2. `triggers.ts` : `fireVisitTrigger` retourne `TriggerOutcome`
   (`'continue'|'combat'|'teleport'`) ; cas teleport (move + `revealAround` +
   `HeroTeleported`), garde `inBounds` ; cas dans le switch exhaustif de copie.
   → verify: exhaustivité union OK.
3. `movement.ts` : caller lit l'outcome — `combat` ⇒ `onCombatEngaged`+return ;
   `teleport` ⇒ return (interrompt sans combat).
   → verify: typecheck.
4. `schemas.ts` (union trigger @~1203) : variante `teleport` + `to:{x,y}`.
   → verify: content:check.
5. Test moteur `triggers` (nouveau ou étendu) : téléport déplace + interrompt +
   vision ; day-trigger teleport = no-op.
   → verify: engine tests, golden inchangé (opt-in, hors fixture golden).
6. Docs : doc 02 §2.1 (liste des effets) + doc 18 A5 (téléport livré, message-à-
   choix restant) + ce plan.

## Invariants

Nouvelle variante d'union opt-in ⇒ **golden inchangé** (triggers hors replay),
**pas de bump save** (le trigger `fired`/effet vit dans la carte, forme
inchangée : union élargie n'altère aucun champ existant), zéro faction.

## Statut

- [x] **LIVRÉ**. `teleport` ajouté à `TriggerEffect` (map.ts) + schéma (trigger
      union) ; `fireVisitTrigger` retourne `TriggerOutcome` (`continue`/`combat`/
      `teleport`), cas teleport (move + `revealAround` + `HeroTeleported`, garde
      `inBounds`) ; `movement.ts` interrompt sans combat. 2 tests `triggers.test`
      (téléport + garde hors-carte). Docs 02 §2.1 + 18 A5 alignées. Vérif :
      typecheck ✓, lint ✓, 908 engine ✓, golden inchangé, content:check ✓,
      garde-fou vert. **message-à-choix** différé (A5b : état d'attente + UI).
