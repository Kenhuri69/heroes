# Lot A2b — Capacités de combat (esquive & frappe-retour, vague 1b)

Sous-lot du lot A2. **Empilé sur A2a** (`claude/a2a-combat-capabilities`, PR #194).
Branche `claude/a2b-combat-capabilities`.

## Périmètre A2b
1. **incorporeal(dodge)** (Spectre Necro 20 %, doc 04 §3) : la pile a `dodge`
   chances d'esquiver une frappe subie (dégâts 0). Un tirage RNG par frappe
   subie, **gated** sur la présence de la capacité (golden inchangé).
   Event `StackAttacked.dodged`.
2. **strikeAndReturn** (Lame du Serment AH, doc 05 §4) : frappe de mêlée
   **volontaire** puis **retour à la case d'origine** ; la cible **ne riposte
   pas** (esquive du repli — sémantique HoMM « harpie », documentée ici car le
   doc était sous-spécifié). Sans effet en tir/riposte.

## Reporté (A2c / A3)
`firstStrike` (ordre de riposte ambigu — à cadrer), `curseOnHit`/`poisonSting`
(statuts + bump `CURRENT_SAVE_VERSION`), `taunt` (ciblage), `areaAttack`/
`breathAttack` (zone — A3).

## Étapes & vérifs
1. `abilities.json` : +`incorporeal`, +`strikeAndReturn` (14 → 16).
2. `combat/damage.ts` : `incorporealDodge` ; `performStrike` roll d'esquive
   (gated), event `dodged` ; skip mark/lifeDrain si esquive.
3. `core/events.ts` : `StackAttacked.dodged`.
4. `combat/actions.ts` : `strikeAndReturn` → suppression riposte + retour origine.
5. `estimateDamage` : gate riposte `strikeAndReturn` (préviz).
6. Client : `animateAttack` affiche « esquive » sur `dodged`.
7. Données : Spectre `incorporeal{dodge:0.2}`, Lame du Serment `strikeAndReturn`.
8. Docs 02 §5.4 (16 capacités), 04/05.
9. Tests `combat-capabilities-b.test.ts` (esquive forcée via dodge=1 ; retour +
   pas de riposte). **`pnpm test` complet (engine + content)**.
10. Vérifs : typecheck, lint, content:check, guardrail, golden (inchangé
    attendu), bundle, smoke. Pas de bump save version (event field ≠ save state).

## Journal
- branche (rebasée sur A2a corrigé, 28a0d5f) + plan.
- Catalogue `abilities.json` : +incorporeal/strikeAndReturn (14 → 16).
- Moteur : `incorporealDodge` + jet d'esquive gated dans `performStrike`
  (dégâts 0, skip mark/consume/lifeDrain), event `StackAttacked.dodged` ;
  `strikeAndReturn` dans `applyAttack` (suppression riposte + retour origine) ;
  `estimateDamage` gate riposte. Client : « esquive » flottant (helper
  générique `spawnFloatingLabel`).
- Données : Spectre `incorporeal{dodge:0.2}`, Lame du Serment `strikeAndReturn`.
- Docs 02 §5.4 (16 capacités + 2 lignes), 04/05 (notes « livré A2b »).
- Vérifs : typecheck 5/5, lint, **431** tests engine + 101 content (`pnpm test`
  complet cette fois — +3 `combat-capabilities-b`), content:check, garde-fou zéro
  faction, golden **inchangé** (aucune capacité A2b dans le catalogue golden),
  bundle < 800 Ko gzip, pas de bump save version. Smoke : en cours.
- Reste : commit + push + PR draft (empilée sur #194).
