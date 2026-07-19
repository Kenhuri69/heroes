# Lot — Hygiène du backlog `game-feature-gaps.md` (2026-07)

> **Travail documentaire uniquement** (backlog interne `.claude/plans/`, aucun
> code). Corrige des affirmations **périmées** du backlog de référence : plusieurs
> ⬜ y sont marqués « à faire » alors que le code + les données les ont livrés
> depuis. Découle de l'audit de démarrage de la session marathon (2026-07-16).

## Constats vérifiés (preuves)

1. **Synthèse §1 item 1 — « ~20 capacités inertes / le moteur n'interprète que 9 »
   est faux.** Les **32** capacités du catalogue `data/core/abilities.json` sont
   **toutes** interprétées par le moteur (`packages/engine/src/combat/*.ts`) :
   vérifié par grep, chaque id (`taunt`, `lifeDrain`, `spellcaster`, `aura`,
   `fear`, `rebirth`, `swarm`, `firstStrike`, `poisonSting`, `breathAttack`,
   `areaAttack`, `performer`, `banishable`, `spellImmune`…) a une logique réelle
   (ex. `fear` → jet RNG seedé → `immobilizedRounds`, `damage.ts:731`).

2. **CAP-LIFE « Reste ⬜ » — renaissance (Phénix) et `swarm` sont livrés.**
   - `rebirth` : moteur `packages/engine/src/combat/death.ts` (`rebirthPlan`,
     `tryRebirth`, `CombatState.rebornStackIds`) + données `t7-phenix.json` /
     `t7-phenix-elite.json`. Plan : `.claude/plans/cap-life-rebirth.md` (CAP-LIFE.2).
   - `swarm` : moteur `packages/engine/src/combat/damage.ts` (`swarmBonus`) +
     données Élève AH (`t1-eleve`) et Chœur Vox (`t1-choeur`). Plan :
     `.claude/plans/a3b-swarm.md`, PR #198.

## Étapes

1. Corriger la synthèse §1 item 1 → décrire l'état réel (toutes capacités
   interprétées ; les vrais gros écarts restants = en ligne / assets).
   → vérif : relire, plus de « 9 capacités ».
2. Flip CAP-LIFE « Reste ⬜ » → ✅ pour rebirth + swarm (avec pointeurs de plan),
   ne garder en note que le résiduel réel (« autres porteurs » = données futures).
   → vérif : plus de ⬜ mensonger sur des items livrés.
3. Pas de test navigateur (doc-only, backlog interne). Pipeline code inchangé.

## Notes

- Périmètre volontairement **minimal** : on ne re-audite pas tout le backlog, on
  corrige uniquement les affirmations dont la fausseté est **prouvée** ci-dessus.
  Les autres ⬜ (NET-*, AS-*, F-BUILDEFF.7+, C-SIEGE2.7b+) restent en l'état.
