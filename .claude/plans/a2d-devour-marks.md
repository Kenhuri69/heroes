# Lot A2d — Capacité `devourMarks` (Pénitent)

Morceau du lot A2/A3 (CAP-LIFE/marques). Part de `main` (A3c + travail parallèle
mergés : save v16, héros nommés). Branche `claude/a2d-devour-marks`.
**Pas de bump save** (aucun champ d'état ; réutilise Marques + soin).

## Périmètre
- `devourMarks(perMark, healPerMark)` (Pénitent, doc 05 §4) : sur une frappe
  **volontaire**, dévore **toutes** les charges de Marque du champ — +`perMark`
  par charge de dégâts sur cette attaque (canal `markConsumeBonus`), puis remet
  toutes les Marques à 0 et soigne le striker de `healPerMark` par charge
  (plafond de relève identique à `lifeDrain`). Sans RNG.

## Étapes & vérifs
1. `abilities.json` : +`devourMarks` (21 → 22).
2. `combat/damage.ts` : `devourMarksParams` + `totalMarksOnField` ; bonus cumulé
   au `markConsumeBonus` dans `performStrike` et `estimateDamage` ; consommation
   + soin après la frappe. Event `MarksDevoured`.
3. `core/events.ts` : `MarksDevoured`.
4. Données : Pénitent `devourMarks{perMark:0.02, healPerMark:2}`.
5. Docs 02 §5.4 (22 capacités + ligne), 05 (Pénitent livré).
6. Tests `combat-devour.test.ts`.
7. Vérifs : typecheck, lint, `pnpm test` complet, content:check, garde-fou,
   golden **inchangé** (aucun devourMarks dans le catalogue golden), bundle, smoke.

## Journal
- branche + plan.
- `devourMarksParams`/`totalMarksOnField` ; bonus + consommation + soin dans
  `performStrike` ; préviz alignée ; event `MarksDevoured` ; Pénitent doté.
- Docs 02/05. +2 tests `combat-devour`.
- Vérifs : typecheck 5/5, `pnpm test` (448 engine +2, 101 content), golden inchangé,
  content:check, garde-fou vert, bundle < 800 Ko gzip. Smoke : en cours.
