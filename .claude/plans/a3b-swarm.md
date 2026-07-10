# Lot A3b — Capacité `swarm` (tactique de meute)

Morceau du lot A3 (CAP-LIFE/positionnel). Part de `main` (A2c/A3a mergés).
Branche `claude/a3b-swarm`. **Pas de bump save** (bonus calculé live).

## Périmètre
- `swarm(bonus, minAllies)` (Élève AH doc 05 §4, Chœur Vox doc 16 §4) : chaque
  créature de l'attaquant inflige `+bonus` de dégâts (∝ effectif) si au moins
  `minAllies` **autres** piles alliées de l'attaquant sont adjacentes à la cible.
  L'attaquant est exclu du décompte ⇒ préviz stable.

## Étapes & vérifs
1. `abilities.json` : +`swarm` (19 → 20).
2. `combat/damage.ts` : `swarmBonus` ; ajouté à `base` dans `performStrike` et
   aux bornes de `estimateDamage`.
3. Données : Élève + Chœur `swarm{bonus:1, minAllies:2}`.
4. Docs 02 §5.4 (20 capacités + ligne), 05 (Élève livré), 16 (Chœur — déjà « réutilise »).
5. Tests `combat-swarm.test.ts`.
6. Vérifs : typecheck, lint, `pnpm test` complet, content:check, garde-fou,
   golden **inchangé** (aucun swarm dans le catalogue golden), bundle, smoke.

## Journal
- branche + plan.
- `swarmBonus` (attaquant exclu) branché dans `performStrike`/`estimateDamage` ;
  abilities.json 19→20 ; Élève + Chœur `swarm{1,2}`.
- Docs 02/05. +4 tests `combat-swarm`.
- Vérifs : typecheck 5/5, `pnpm test` (443 engine +4, 101 content), golden inchangé,
  content:check, garde-fou vert, bundle < 800 Ko gzip. Smoke : en cours.
