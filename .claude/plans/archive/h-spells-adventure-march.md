# H-SPELLS — Sort d'aventure « Marche forcée » (movementBonus)

> Lot atomique du backlog `game-feature-gaps.md` (§2.4, H-SPELLS). Nouveau variant
> `AdventureEffect` **générique** `{ type: 'movementBonus', amount }` : un sort
> d'aventure accorde des points de mouvement immédiats au héros. Patron EXACT de
> Vision (H-SPELLS.3) — union discriminée extensible, additif.

## Objectif

Un sort d'aventure de kind `adventure` porte `adventure: { type: 'movementBonus',
amount }` : le lancer ajoute `amount` PM au héros (`hero.movementPoints`), sans le
déplacer. Reprend le cœur du lieu de bonus `movement` (écurie) sous forme de sort.

## Invariants

- Zéro faction dans le moteur ni les tests (ids opaques).
- `hero.movementPoints` déjà sérialisé + additif ⇒ **pas de bump save**.
- Aucun sort d'aventure dans le golden replay ⇒ **golden inchangé**.
- Pas d'équilibrage de faction ⇒ **pas de `faction:sim`**.
- Client **inchangé** : `AdventureSpellbook` liste tout `kind === 'adventure'` et le
  toast `AdventureSpellCast` est générique (aucun cas par type).

## Étapes

1. `engine/hero/types.ts` : `AdventureEffect` union += `{ type: 'movementBonus'; amount: number }`.
2. `engine/hero/index.ts` : handler dans `handleCastAdventureSpell` — `hero.movementPoints += amount`.
3. `content/schemas.ts` : variant Zod `z.object({ type: z.literal('movementBonus'), amount: positive int })`.
4. `data/core/spells.json` : sort `marche-forcee` (Air, cercle 1, +600 PM).
5. Locales FR/EN : `spell.marche-forcee`.
6. Test `hero-adventure-spell*` : le sort ajoute des PM (mana débitée).
7. Docs : `docs/02-mechanics.md` §1.4 + backlog H-SPELLS.

## Pipeline

typecheck · lint · vitest engine (golden + save-shape inchangés) · vitest content
· content:check · garde-fou faction · garde-fou couleur · build · bundle gzip
< 819200 · smoke. (Pas de `faction:sim`.)

## Suivi

- [x] 1 types · [x] 2 handler · [x] 3 schema · [x] 4 data spell · [x] 5 locales
- [x] 6 test · [x] 7 docs

## Résultat pipeline (local)

typecheck 5/5 ✓ · lint ✓ · vitest engine 729 (golden + save-shape inchangés) ✓ ·
vitest content 126 ✓ · content:check ✓ · garde-fou faction ✓ · garde-fou couleur ✓
· build ✓ · bundle 312685 o < 819200 ✓ · smoke 101/101 ✓.
