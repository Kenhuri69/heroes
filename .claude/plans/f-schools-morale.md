# Lot F-SCHOOLS.morale — modificateur de moral par sort (générique)

> Point d'extension moteur **générique** : un sort `buff`/`debuff` peut porter un
> `moraleMod` (± moral tant que le statut dure). Exercé par les sorts de l'**École
> de la Scène** (doc 16 §3.3) : *Chant de Courage* (+1 moral, en plus de +Att) et
> *Dissonance* (−1 moral, en plus de −Att) — jusqu'ici « effets simplifiés »
> (backlog §2.3 F-SCHOOLS). **Zéro nom de faction dans le moteur.**

## Mécanique

- Nouveau champ **optionnel** `SpellStatus.moraleMod?` (± moral pendant le statut)
  et `SpellDef.moraleMod?` (effet du sort). Optionnel ⇒ **pas de bump save**
  (SpellStatus n'est pas couvert par le garde-fou save-shape, qui vise
  `keyof CombatStack`) ; les anciennes saves lisent `?? 0`.
- `applySpellToTargets` (branche buff/debuff) : écrit `moraleMod: spell.moraleMod ?? 0`
  sur le statut posé (les autres constructeurs de statut — malédiction/poison —
  restent inchangés, champ absent = neutre).
- `moraleOf` : ajoute la somme des `moraleMod` des statuts actifs de la pile,
  avant le bornage [−3, +3] et le plancher `moraleImmune` existants.
- Schéma contenu (`spells`) : `moraleMod: z.number().optional()` + refine
  buff/debuff « au moins un modificateur » élargi à `moraleMod` ; loader mappe
  le champ (comme `attackMod`).

## Changements

- `packages/engine/src/hero/types.ts` : `SpellStatus.moraleMod?` + `SpellDef.moraleMod?`.
- `packages/engine/src/combat/spell-effect.ts` : pose `moraleMod` sur le statut buff/debuff.
- `packages/engine/src/combat/state-helpers.ts` : `moraleOf` somme les `moraleMod` de statut.
- `packages/content/src/schemas.ts` + `loader.ts` : champ `moraleMod`.
- `data/core/spells.json` : `moraleMod` sur `chant-de-courage` (+1) et `dissonance` (−1).
- `docs/16-faction-vox-arcana.md` §3.3 (École de la Scène) : effets moral livrés ;
  backlog F-SCHOOLS (Scène : moral câblé).

## Vérification

- test moteur (nouveau `combat-morale-spell`, ids OPAQUES) : un sort buff `moraleMod:+1`
  posé ⇒ `moraleOf` +1 tant qu'actif ; debuff `moraleMod:-1` ⇒ −1 ; bornage/plancher
  respectés ; statut sans `moraleMod` = neutre (non-régression).
- typecheck 5/5 · lint · engine (golden + save-shape **INCHANGÉS**, aucun sort de
  moral dans la fixture golden) · content + content:check · garde-fous faction/couleur ·
  build + bundle gzip < 800 Ko · `faction:sim` (moral léger ⇒ pas de blowout Vox) · smoke.

## Journal

- 2026-07-13 — Plan créé, branche `claude/f-schools-morale` depuis origin/main.
- 2026-07-13 — Implémenté : `moraleMod` optionnel (SpellDef + SpellStatus + schéma
  + loader), sommé dans `moraleOf` ; données Chant de Courage +1 / Dissonance −1.
  Test `combat-morale-spell` (ids opaques). Vérif verte : typecheck 5/5 · lint ·
  engine 697/697 (golden + save-shape **inchangés**) · content 125/125 ·
  content:check · garde-fous faction/couleur · build · bundle gzip 300 Ko <
  800 Ko · faction:sim **0 déséquilibre béant** · smoke 101/101.
