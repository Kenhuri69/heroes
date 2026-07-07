# Lot D-misc — décisions design divers (D6, D11)

Dernier sous-lot du Lot D (`code-doc-coherence-remediation.md`). Deux écarts
code↔doc tranchés côté code, chacun avec test.

## Portée

- **D6** — Le héros s'arrêtait au ramassage d'une ressource/artefact au sol,
  contredisant la fidélité HoMM (guidelines §8.5) et le comportement « en
  passant » de la mine juste au-dessus.
- **D11** — Littéral `'traque'` (école de faction Arcane Hunters) dans l'union
  `SpellSchool` du moteur : toute future école de faction = diff moteur.

## Étapes & vérification

1. **D6** (`adventure/movement.ts`) : `break` retiré après `ResourcePicked`
   (→ `continue`) et après `ArtifactPicked` ; docstring corrigée. Le trésor
   (choix or/XP interactif) garde son `break`.
   → vérif : `adventure.test.ts` « ramasse une ressource en passant sans
   s'arrêter » (héros finit à (4,0), pas (3,0)) ; `map-objects.test.ts`
   « ramassé en passant … sans arrêter le héros » (finit à (3,0)). Golden
   **inchangé** (347 tests verts) — la trace golden ne franchit pas de tas. ✅
2. **D11** : `hero/types.ts` → `export type SpellSchool = string` (chaîne
   opaque ; le moteur ne fait qu'une égalité d'école pour la réduction de
   mana A6). Le registre des écoles valides passe au contenu :
   `packages/content/schemas.ts` expose `SPELL_SCHOOLS` (DRY des deux
   `z.enum` spell/skill) — rejette toujours une école inconnue (invariant
   `loader.test.ts` « rejette une école inconnue » conservé).
   → vérif : typecheck 5/5 (client `SpellBook`/`game.ts` géraient déjà un
   ensemble ouvert) ; content 83 tests ; garde-fou faction vert. ✅

## Invariants

- Golden replay **inchangé** ; garde-fou « zéro faction dans le moteur » vert
  (le moteur n'énumère plus aucune école) ; color guard OK.
- typecheck 5/5, `pnpm lint`, engine + content, content:check, build < 800 Ko
  gzip, smoke desktop + mobile.

## Après D-misc : Lot E (doc sync E1–E8, plan §5).

## État : livré. Vérif complète verte (typecheck 5/5, lint, engine 347 golden
inchangé, content 83, content:check, guards, build 260 Ko, smoke 104/2).
