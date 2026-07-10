# Lot A2c — Capacité `curseOnHit` (malédiction au contact)

Sous-lot du lot A2 (CAP-ATK). Part de `main` (A1/A2a/A2b mergés).
Branche `claude/a2c-combat-debuffs`. **Un bump `CURRENT_SAVE_VERSION`** (14 → 15).

## Périmètre A2c — `curseOnHit`
Sur une frappe qui touche (non esquivée, cible vivante), une chance d'appliquer
un statut temporaire à la cible. Point d'extension moteur générique :
- Zombie putride (Necro) : `curseOnHit(Affaiblissement, 20 %)` — modélisé
  `defenseMod: -2` (aligné sur le sort « affaiblissement » = −défense), 3 rounds.
- Cavalier funeste (Necro) : `curseOnHit(Faux funeste : −20 % dégâts, 100 %)` —
  nouveau champ `SpellStatus.damageDealtMod` (−0,2 multiplicatif), 2 rounds.

## Save bump (v14 → v15)
`SpellStatus` gagne `damageDealtMod` ⇒ forme sérialisée modifiée ⇒ bump +
golden re-fixé **une fois** (le champ `saveVersion` de l'état haché change ;
les piles golden ont des statuts vides ⇒ seule la FORME change).

## Reporté (A2d/A3)
`poisonSting` (DoT — nouveau tick de round + magnitude à cadrer), `taunt`
(ciblage), `firstStrike` (ordre de riposte).

## Étapes & vérifs
1. `hero/types.ts` : `SpellStatus.damageDealtMod`. `hero/index.ts` : push spell
   +`damageDealtMod:0`.
2. `combat/damage.ts` : `statusModSum` clé étendue ; `computeMultiplier`
   `dealtDamageMod` ; `curseOnHitPlan` ; `performStrike` (applique la malédiction
   après la frappe, gated non-esquive/cible vivante) ; `estimateDamage` aligné.
3. `core/events.ts` : `StackCursed`.
4. `core/state.ts` : `CURRENT_SAVE_VERSION` 15.
5. Données : Zombie + Cavalier funeste `curseOnHit`.
6. Client : label « maudit » sur `StackCursed`.
7. Docs 02 §5.4 (17 capacités + ligne), 04, 07 (v15).
8. Golden re-fixé une fois. `save-shape` / autres tests mis à jour si besoin.
9. Tests `combat-curse.test.ts`. **`pnpm test` complet.**
10. Vérifs : typecheck, lint, content:check, guardrail, bundle, smoke.

## Journal
- branche `claude/a2c-combat-debuffs` (depuis main mergé) + plan.
- `SpellStatus.damageDealtMod` ajouté (save v14→**15**) ; `hero/index.ts` push
  spell +damageDealtMod:0.
- Moteur : `curseOnHitPlan`, `statusModSum` clé étendue, `computeMultiplier`
  `dealtDamageMod` (× multiplicatif), `performStrike` applique/rafraîchit la
  malédiction (gated non-esquive/cible vivante, jet gated), `estimateDamage`
  aligné (attaque + riposte). Event `StackCursed`. Client : label « maudit ».
- Données : Zombie `curseOnHit{chance .2, defenseMod -2, rounds 3}` (Affaiblissement),
  Cavalier funeste `curseOnHit{chance 1, damageDealtMod -.2, rounds 2}` (Faux funeste).
- Golden **re-fixé une fois** (0968d47e → 2713b959 : bump saveVersion 14→15,
  simulation inchangée). `save-shape` 14→15. Fixtures de test SpellStatus
  +damageDealtMod:0.
- Docs 02 §5.4 (17 capacités + ligne), 04 (note livré A2c), 07 (v15).
- Vérifs : typecheck 5/5, lint, `pnpm test` complet (435 engine +4 `combat-curse`,
  101 content), content:check, garde-fou zéro faction, bundle < 800 Ko gzip.
  Smoke : en cours.
- Reste : commit + push + PR draft (sur main).
