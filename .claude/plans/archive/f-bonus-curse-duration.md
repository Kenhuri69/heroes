# Lot F-BONUS.2 — Fléau persistant (Necropolis)

> Câble le bonus de faction **Fléau persistant** (doc 04 §2) : les sorts de
> malédiction lancés par un héros Necropolis durent **+1 round**. Backlog §2.3
> F-BONUS. Un point d'extension moteur **générique** + données Necropolis.

## Spec

- Nouveau `FactionBonus` **générique** `curseDurationBonus { rounds }` : ajoute
  `rounds` à la durée des statuts posés par un sort **`debuff`** (malédiction)
  lancé par le HÉROS de la faction. N'affecte ni les buffs, ni le silence, ni les
  sorts d'unité (`spellcaster`) — uniquement le sort de héros de kind `debuff`.
- Interprété au point d'application des statuts (`applySpellToTargets`), qui gagne
  un paramètre **numérique** `statusDurationBonus` (défaut 0) — le moteur ne voit
  qu'un nombre, jamais un nom de faction. Le CALLER (`castHeroSpell`) calcule le
  bonus depuis la faction du héros **et** ne le passe que pour un sort `debuff`.

## Changements

- `faction/types.ts` : variante `CurseDurationBonus`.
- `combat/state-helpers.ts` : helper `factionCurseDurationBonus(state, hero)`
  (somme des `curseDurationBonus.rounds`, patron de `factionCombatBonus`).
- `combat/spell-effect.ts` : `applySpellToTargets(..., statusDurationBonus = 0)`
  ⇒ `roundsLeft += statusDurationBonus`.
- `hero/index.ts` : `castHeroSpell` passe le bonus pour `spell.kind === 'debuff'`.
- `content/schemas.ts` : variante `curseDurationBonus` du `factionBonusSchema`.
- `data/factions/necropolis/manifest.json` : `{ type:'curseDurationBonus', rounds:1 }`.
- Doc 04 §2 (Fléau persistant livré) + backlog.

## Vérification

- test moteur : un héros Necropolis pose un `debuff` de durée +1 round vs une
  faction sans le bonus ; un `buff` n'est pas prolongé. typecheck 5/5 · lint ·
  golden + save-shape **inchangés** (factionCatalog déjà sérialisé, aucun champ
  d'état) · content + content:check · `faction:sim` (pas de blowout) · garde-fous ·
  build + bundle · smoke.

## Journal

- 2026-07-12 — Plan créé, branche `claude/f-bonus-curse-duration` depuis origin/main.
