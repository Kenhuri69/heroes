# Lot A3d — Capacité `breathAttack` (souffle du Dragon d'os)

Morceau du lot A3 (CAP-ATK zone). Part de `main` (A2d mergé).
Branche `claude/a3d-breath-attack`. **Pas de bump save**.

## Périmètre
- `breathAttack(pct)` (Dragon d'os, doc 04 §3) : une frappe **de mêlée** touche
  AUSSI la pile ennemie située **derrière** la cible (prolongement du segment
  attaquant → cible) d'une fraction `pct` des dégâts primaires. Sans RNG/riposte.
- Réutilise l'application « splash » de A3c (helper `applySplashDamage` extrait).

## Étapes & vérifs
1. `combat/hex.ts` : `hexBehind(from, through)` (case au prolongement axial).
2. `abilities.json` : +`breathAttack` (22 → 23).
3. `combat/damage.ts` : `breathAttackParams` ; extraction `applySplashDamage`
   (réutilisée par `areaAttack` **et** `breathAttack`) ; souffle appliqué dans
   `performStrike` (gated non-riposte/non-esquive, striker adjacent).
4. Données : Dragon d'os `breathAttack{pct:0.6}`.
5. Docs 02 §5.4 (23 capacités + ligne), 04 (Dragon d'os livré — Necropolis complet).
6. Tests `combat-breath.test.ts` (+ `hexBehind`).
7. Vérifs : typecheck, lint, `pnpm test` complet, content:check, garde-fou,
   golden **inchangé** (aucun breathAttack dans le catalogue golden), bundle, smoke.

## Journal
- branche + plan.
- `hexBehind` ; `applySplashDamage` extrait (areaAttack refactorée dessus) ;
  `breathAttackParams` + souffle dans `performStrike` ; Dragon d'os doté.
- Docs 02/04. +5 tests (`combat-breath` 4 + hexBehind).
- Vérifs : typecheck 5/5, `pnpm test` (452 engine +5, 101 content), golden inchangé,
  content:check, garde-fou vert, bundle < 800 Ko gzip. Smoke : en cours.
