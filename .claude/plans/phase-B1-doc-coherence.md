# B1 — Cohérence doc (pénalité de portée déjà livrée)

## Constat

L'utilisateur a demandé « go B1 » (pénalité de portée de tir, doc 18 §2.B).
**Le code est déjà livré** : commit `3fbf50a` (« sprint 1 — juice de combat +
pénalité de portée », sur `main`) a posé :

- moteur : `CombatRulesConfig.rangePenalty?` + hook dans `computeMultiplier`/
  `performStrike`/`estimateDamage` (`combat/damage.ts`) — tir au-delà de
  `rangePenalty.hexes` × `rangePenalty.factor`, jamais cumulé avec la mêlée ;
- schéma : `packages/content/src/schemas.ts` valide `rangePenalty` ;
- données : `data/core/config.json` **activé** à `{ hexes: 10, factor: 0.5 }`
  (fidélité HoMM3 : ½ dégâts au-delà de 10 hexes) ;
- test : `combat-damage.test.ts` (« B1 — pénalité de portée de tir ») vert ;
- doc 02 §5.3 (ligne 715) **déjà** à jour.

Le **même commit** a aussi livré **B6/F3** (projectiles + FX de sorts,
`render/combatFx.ts`), doc 18 non mise à jour non plus.

## Écart réel : documentation seule

`3fbf50a` a mis à jour **doc 02** (1 ligne) mais **pas doc 18 ni CLAUDE.md** ⇒
divergence code↔spec (guidelines §8.6). Rien à coder.

## Étapes (documentaire pur)

1. doc 18 **B1** → marqué **livré** (état/manque réécrits).
   → verify: le bloc reflète le livré (config activée, préviz, opt-in).
2. doc 18 **B6/F3** → marqué **livré** (projectiles + FX de sorts).
   → verify: idem.
3. CLAUDE.md → ligne de changelog « sprint 1 » (B1 + B6).
   → verify: cohérent avec le style des entrées existantes.

Aucun code ⇒ pas de golden/save/bundle ; smoke omis (changement documentaire,
guidelines §7). Garde-fou faction non concerné.

## Statut

- [x] **LIVRÉ** (documentaire). doc 18 B1 + B6/F3 marqués livrés (état/manque
      réécrits) ; CLAUDE.md : entrée changelog « sprint 1 » (B1 + B6). doc 02 §5.3
      déjà à jour (sprint-1). Aucun code touché ⇒ golden/save/bundle non concernés,
      smoke omis (§7). Diff 100 % markdown.
