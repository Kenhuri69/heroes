# Lot CAP-SPELLIMMUNE — Capacité générique `spellImmune`

> Nouvelle capacité d'unité générique **`spellImmune`** (doc 02 §5.4) : une pile
> dotée est **inciblable par un sort HOSTILE** (dégâts/debuff/silence/marque/
> bannissement/dissipation), qu'il vienne du héros ou d'une unité lanceuse — la
> « Black Dragon » immunity de HoMM. Miroir de la furtivité (`stealthed`), mais
> côté DÉFINITION d'unité. Carrier CORE : la **tour de tir** de siège
> (`arrow-tower`) — zéro faction, hors `faction:sim` (les armées de sim n'ont pas
> de machine de guerre). **Pas de champ d'état neuf (capacité de def) ⇒ pas de
> bump save ; golden inchangé** (golden = combat de gardien sans sort/tour).

## Mécanique (générique, zéro faction)

- Capacité `spellImmune` au catalogue `abilities.json`.
- Helper pur `isSpellImmune(catalog, unitId)` (state-helpers). Une pile immunisée
  est exclue du ciblage d'un sort HOSTILE (`spellTargetsEnemy`) — les sorts amis
  (soin/buff) ne sont pas concernés. L'immunité NE bloque PAS les frappes
  physiques (arme/tir), seulement les sorts.
- Sites : validation héros (`validateCastSpell`), validation unité
  (`validateCombatAction castSpell`), IA (héros `chooseHeroSpell`, unité
  `chooseSpellcast` — filtrent les cibles de sort), client (grimoire `TargetList`,
  `UnitSpellModal`). La frappe héroïque reste possible sur une pile immunisée
  (hors périmètre).

## Changements

- `packages/engine/src/combat/state-helpers.ts` : `isSpellImmune` ; `index.ts` l'exporte.
- `packages/engine/src/hero/index.ts` : refus sort hostile sur pile immunisée.
- `packages/engine/src/combat/actions.ts` : idem pour le sort d'unité.
- `packages/engine/src/combat/ai.ts` : IA héros + unité excluent les immunisés.
- `packages/client/src/ui/{SpellBook,combat}.tsx` : listes de cibles.
- `data/core/abilities.json` : `+ spellImmune` ; `data/core/war-machines.json` :
  `arrow-tower` doté.
- doc 02 §5.4 (catalogue de capacités) ; backlog `game-feature-gaps.md` CAP-*.

## Vérification

- test moteur `combat-spell-immune.test.ts` : `isSpellImmune` ; sort hostile
  refusé sur immunisé, autorisé sur non-immunisé ; soin ami inchangé. (ids OPAQUES.)
- typecheck 5/5 · lint · engine (golden + save-shape **inchangés**) · content ·
  content:check · garde-fous faction/couleur · build + bundle < 800 Ko · smoke.
- `faction:sim` non requis (carrier = machine de guerre, absente des armées de sim).

## Journal

- 2026-07-13 — Plan créé, branche `claude/cap-spell-immune` depuis origin/main
  (après merges #330/#331/#333/#334/#335/#337).
- 2026-07-13 — Implémenté : helper `isSpellImmune` (exporté), refus sort hostile
  (validate héros + unité), IA (héros/unité filtrent les immunisés hors frappe),
  client (SpellBook `TargetList` + `UnitSpellModal`), `abilities.json` +spellImmune,
  `arrow-tower` doté, doc 02 §5.4 (+ correction du décompte 27→32) + backlog CAP-DEF.
- 2026-07-13 — Vérif : typecheck 5/5 · lint · engine 723/723 (dont
  `combat-spell-immune` +4 ; golden + save-shape **inchangés**) · content 126/126 ·
  content:check · garde-fous faction/couleur · build · bundle gzip 312 Ko < 800 Ko.
  Smoke en cours.
