# Lot C-SIEGE2.4 — dégâts de douve

> Suite de C-SIEGE2.3 (douve = ralentissement). Enrichit la douve : une pile qui
> **s'arrête dans la douve** subit des dégâts (comme HoMM). Backlog §2.1
> C-SIEGE2.4, doc 02 §5. Localisé (`applyMove`), zéro faction, pas de bump save.

## Spec

Comme la douve est **non traversable** (C-SIEGE2.3), tout déplacement qui s'y
termine = la pile y est ENTRÉE ce tour. À ce moment, elle subit `combat.moatDamage`
dégâts (échelle Fort : `fortLevel × SIEGE_MOAT_DAMAGE_PER_FORT`). Réutilise
`damageOneStack` (kills/firstHp/mort/bilan) ; event `MoatDamaged` (analogue de
`StackPoisoned`) ⇒ chiffre de dégâts flottant client. Les défenseurs (derrière le
mur) n'entrent jamais dans la douve ; seul l'assaillant la subit. Attaque
depuis la douve non concernée (aucun ennemi adjacent à la douve).

## Changements

- `combat/types.ts` : `CombatState.moatDamage?: number` (optionnel ⇒ pas de bump).
- `combat/setup.ts` : `moatDamage = fortLevel × SIEGE_MOAT_DAMAGE_PER_FORT` posé
  avec la douve (Fort ≥ 2).
- `combat/actions.ts` `applyMove` : si l'arrivée est un hex de douve, applique les
  dégâts (`damageOneStack`), émet `MoatDamaged`, `checkCombatEnd` si mort.
- `core/events.ts` : `MoatDamaged { stackId, damage, kills }`.
- Client `CombatScene` : `MoatDamaged` ⇒ `spawnDamageNumber` (chiffre flottant).
- Doc 02 §5 (état v2 .4) + backlog.

## Vérification

- tests moteur `town-siege` : entrer dans la douve inflige des dégâts (count réduit),
  event émis ; hors douve, aucun dégât. typecheck 5/5 · lint · golden + save-shape
  **inchangés** (golden = gardien sans douve) · content · garde-fous · build +
  bundle · smoke non régressé.

## Journal

- 2026-07-12 — Plan créé, branche `claude/c-siege2-moat-damage` depuis main (@bb7bf68).
- 2026-07-12 — Implémenté les 6 changements (types/setup/actions/events/client/doc).
- 2026-07-12 — **Bug attrapé au test** : sans garde de camp, l'IA **défenseuse**
  avançait sur SA PROPRE douve à l'ouverture, se prenait 40 dégâts et mourait ⇒
  le combat s'achevait aussitôt (tous les tests siège Fort ≥ 2 tombaient, combat
  null). Correctif : garde `stack.side === 'attacker'` (le défenseur vit derrière
  son mur — sémantique HoMM correcte). Ajouté un test dédié « la douve épargne le
  défenseur » (piloté via `playerSide = 'defender'`).
- 2026-07-12 — Le test de dégâts assaillant assertait sur `after.combat` (null car
  43 grunts vs 1 loup ⇒ le combat se résout dans la continuation IA après le
  déplacement). Rebasculé sur l'assertion de l'événement `MoatDamaged`
  (`{ stackId, damage: 40, kills > 0 }`).
- 2026-07-12 — Vérif verte : typecheck 5/5 · lint · engine 675/675 (golden +
  save-shape **inchangés**, aucun bump) · content 125/125 · content:check ·
  garde-fous faction/couleur clean · build · bundle gzip 299 Ko < 800 Ko.
