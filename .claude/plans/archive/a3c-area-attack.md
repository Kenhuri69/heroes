# Lot A3c — Capacité `areaAttack` (attaque de zone)

Morceau du lot A3 (CAP-ATK zone). Part de `main` (A3b mergé).
Branche `claude/a3c-area-attack`. **Pas de bump save** (aucun champ d'état).

## Périmètre
- `areaAttack(pct, sparesUndead?)` (Liche nuage, doc 04 §3) : une frappe
  **volontaire** qui touche éclabousse les piles **ennemies adjacentes à la
  cible** de `pct` des dégâts primaires (sans riposte ; épargne les morts-vivants
  si `sparesUndead`). Sans RNG (dégâts déjà tirés). Shape = « nuage 1 hex ».
- Reporté : `breathAttack` (souffle en ligne), cône Pénitent (autres shapes).

## Étapes & vérifs
1. `abilities.json` : +`areaAttack` (20 → 21).
2. `combat/damage.ts` : `areaAttackParams` ; splash dans `performStrike` après la
   frappe primaire (gated non-riposte/non-esquive, dégâts>0) via `killsFromDamage`/
   `recordLoss`, event `StackAttacked` par pile éclaboussée.
3. Données : Liche `areaAttack{pct:0.5, sparesUndead:true}`.
4. Docs 02 §5.4 (21 capacités + ligne), 04 (Liche livré).
5. Tests `combat-area.test.ts`.
6. Vérifs : typecheck, lint, `pnpm test` complet, content:check, garde-fou,
   golden **inchangé** (aucun areaAttack dans le catalogue golden), bundle, smoke.

## Journal
- branche + plan.
- `areaAttackParams` + splash dans `performStrike` ; abilities.json 20→21 ;
  Liche `areaAttack{0.5, sparesUndead}`.
- Docs 02/04. +3 tests `combat-area`.
- Vérifs : typecheck 5/5, `pnpm test` (446 engine +3, 101 content), golden inchangé,
  content:check, garde-fou vert, bundle < 800 Ko gzip. Smoke : en cours.
