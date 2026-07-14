# H-SPELLS — Sort d'aventure « Cartographie » (revealMap)

> Lot atomique du backlog `game-feature-gaps.md` (§2.4, H-SPELLS). 4ᵉ variant
> `AdventureEffect` **générique** `{ type: 'revealMap' }` : révèle TOUT le
> brouillard de la carte pour le joueur. Patron EXACT de Vision / Marche forcée —
> union discriminée, additif, zéro client.

## Objectif

Un sort d'aventure `{ type: 'revealMap' }` révèle l'intégralité de la carte pour
le joueur (classique « View Air » HoMM). Réutilise `revealAround` avec un rayon =
`max(width, height)` (couvre toute la grille en distance de Tchebychev) — aucun
helper neuf.

## Invariants

- Zéro faction dans le moteur ni les tests (ids opaques).
- `player.explored` déjà sérialisé + additif ⇒ **pas de bump save**.
- Aucun sort d'aventure dans le golden replay ⇒ **golden inchangé**.
- Pas d'équilibrage de faction ⇒ **pas de `faction:sim`**.
- Client **inchangé** (spellbook + toast `AdventureSpellCast` génériques).

## Étapes

1. `engine/hero/types.ts` : `AdventureEffect` union += `{ type: 'revealMap' }`.
2. `engine/hero/index.ts` : handler — `revealAround(player.explored, map, hero.pos, max(w,h))`.
3. `content/schemas.ts` : variant Zod `z.object({ type: z.literal('revealMap') })`.
4. `data/core/spells.json` : sort `cartographie` (Air, cercle 4, mana modérée).
5. Locales FR/EN : `spell.cartographie`.
6. Test `hero-adventure-spell` : révèle un coin opposé de la carte, mana débitée.
7. Docs : `docs/02-mechanics.md` §1.4 + backlog H-SPELLS.

## Pipeline

typecheck · lint · vitest engine (golden + save-shape inchangés) · vitest content
· content:check · garde-fou faction · garde-fou couleur · build · bundle gzip
< 819200 · smoke. (Pas de `faction:sim`.)

## Suivi

- [ ] 1 types · [ ] 2 handler · [ ] 3 schema · [ ] 4 data · [ ] 5 locales
- [ ] 6 test · [ ] 7 docs
