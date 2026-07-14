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

- [ ] 1 types · [ ] 2 handler · [ ] 3 schema · [ ] 4 data spell · [ ] 5 locales
- [ ] 6 test · [ ] 7 docs
