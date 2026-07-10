# Lot A3a — Capacités de moral (`aura` + `moraleImmune`)

Premier morceau du lot A3 (CAP-MORAL). **Empilé sur A2c** (`claude/a2c-combat-debuffs`,
PR #196 non mergée) ⇒ branche `claude/a3a-morale-auras` part de A2c.
**Pas de bump save** (le moral est calculé live dans `moraleOf`, jamais sérialisé).

## Périmètre
- `aura(moraleMod)` (Dragon d'os Necro, doc 04 §2/§3) : une pile **ennemie**
  portant l'aura module le moral des piles adverses vivantes (−1).
- `moraleImmune` (Ange Haven, doc 03 §3) : immunité au moral **négatif** ⇒
  plancher 0 (le moral positif reste possible).

## Étapes & vérifs
1. `abilities.json` : +`aura`, +`moraleImmune` (17 → 19).
2. `combat/state-helpers.ts` `moraleOf` : somme des auras ennemies + plancher
   `moraleImmune`.
3. Données : Dragon d'os `aura{moraleMod:-1}`, Ange `moraleImmune`.
4. Test de contenu faction-recruit : Ange abilities +moraleImmune.
5. Docs 02 §5.4 (19 capacités + 2 lignes), 03 (Ange livré), 04 §2/§3 (aura livrée).
6. Tests `combat-morale.test.ts`.
7. Vérifs : typecheck, lint, `pnpm test` complet, content:check, garde-fou,
   golden **inchangé** (aucune aura/immune dans le catalogue golden), bundle, smoke.

## Journal
- branche (sur A2c) + plan.
- `moraleOf` étendu (aura ennemie + plancher moraleImmune) ; abilities.json 17→19 ;
  Dragon d'os `aura{-1}`, Ange `moraleImmune`.
- Test contenu Ange mis à jour ; +4 tests `combat-morale`.
- Docs 02/03/04.
- Vérifs : typecheck 5/5, `pnpm test` (439 engine +4, 101 content), golden inchangé.
