# H-SPELLS.4+ — Invocation (`SpellKind 'summon'`)

## But
Un sort d'invocation place une pile FRAÎCHE de créatures du camp du lanceur sur
le plateau de combat. Générique, data-driven, zéro faction, pas de bump save.

## Design (mirror resurrectFull — cible-proxy alliée, zéro client hex)
- `SpellKind 'summon'` = sort AMICAL (`spellTargetsEnemy` false) : le joueur
  choisit une pile alliée (proxy — seul son CAMP compte), le sort place une
  nouvelle pile. Toute la logique dans `applySpellToTargets` (comme resurrectFull)
  ⇒ AUCUNE nouvelle mode de ciblage client (pas de sélection d'hex).
- `SpellDef.summon.unit = { id, nativeTerrain, stats, abilities }` : créature
  invocable INLINE dans le sort (aucun nouveau pipeline de contenu core). Au
  lancer : def enregistrée dans `unitCatalog` (idempotent, sérialisé), pile
  placée au 1er hex libre de la ligne arrière du lanceur (`firstFreeCombatHex`),
  slot unique (> tous les slots existants + cimetière). Effectif = `round(base +
  perPower × Pouvoir)`. Réutilise l'événement `StackResurrected`.
- Contenu-fork tranché : def inline (pas de catalogue core neuf) ⇒ plumbing min.
- Optionnel ⇒ pas de bump save ; golden = fixtures inline (sans summon) ⇒ inchangé.
- `groupId` de l'invoquée = son id (groupe de moral propre — accepté MVP, documenté).
- L'IA ignore `summon` (pas dans `firstOfKind`).

## Étapes / vérif
1. `engine/hero/types.ts` : `SpellKind += 'summon'` + `SpellDef.summon`. → typecheck
2. `content/schemas.ts` : `summon` sur spellSchema (réutilise `unitSchema.shape`) + base>0. → content
3. `content/loader.ts` buildSpellCatalog : propager `summon`. → content
4. `engine/combat/spell-effect.ts` : branche `summon` dans `applySpellToTargets`. → engine
5. `engine/hero/index.ts` estimateSpell : branche `summon` (préviz effectif). → engine
6. `data/core/spells.json` : sort `invocation-elementaire` + élémentaire de terre. → content:check
7. locales fr/en : nom + lore + `spellbook.previewSummon` + nom d'unité invoquée.
8. client `SpellBook.tsx` : `formatPreview` case `summon`. → build+smoke
9. test `combat-summon.test.ts`. → engine
10. docs 02 §1.4 alignée.

## Note hors périmètre (à signaler)
`buildSpellCatalog` ne propage PAS `area`/`chain` (bug latent pré-existant) —
signalé, non corrigé ici.

## Pipeline complet vert AVANT push (exit réels, pas de pipe tail)
✅ typecheck 5/5 · ✅ lint · ✅ vitest engine 802 (golden+save-shape INCHANGÉS,
combat-summon 4 tests) · ✅ vitest content 138 · ✅ content:check · ✅ garde-fou
faction (status 1) · ✅ garde-fou couleur (status 1) · ✅ build · ✅ bundle
318297 < 819200 · ⏳ smoke.

Commit c64c90a (non-smoke vert). Reste : confirmer smoke, rebaser origin/main,
push, PR draft, CI, merge, resync.
