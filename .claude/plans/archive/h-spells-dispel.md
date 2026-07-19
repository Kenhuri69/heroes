# Lot H-SPELLS.4 — Dissipation réelle (Dispel)

> Ouvre le dernier « faux » sort du catalogue : `dissipation` est aujourd'hui un
> **debuff déguisé** (−2 Att / −2 Déf) alors que son nom et son lore
> (« on souffle sur les enchantements d'autrui comme sur une bougie ») décrivent
> une **dissipation**. Backlog §2.4 H-SPELLS.4 (« dissipation réelle »),
> doc 02 §1.4. Nouveau **`SpellKind 'dispel'`** générique + conversion du sort en
> données. Point d'extension moteur minimal, réutilise le tableau `statuses`
> existant ⇒ **aucun champ d'état neuf, pas de bump save, golden inchangé**.

## Mécanique (générique, zéro faction)

- Nouveau `SpellKind 'dispel'` — sort **offensif** (vise l'ADVERSE, comme le
  lore « enchantements d'autrui ») : retire **tous les statuts temporaires de
  sort** (`stack.statuses`) de la/les pile(s) ciblée(s). Contre les stratégies de
  buff (Bénédiction/Hâte/écoles de faction) posées par le héros ennemi.
- `spellTargetsEnemy('dispel') = true` (source unique de la contrainte de camp —
  validation héros + IA + client héritent). Le grimoire client (`TargetList`)
  liste donc les piles ennemies sans changement.
- Effet dans le cœur partagé `applySpellToTargets` : `t.statuses = []` sur chaque
  pile affectée ; `amount` = nombre de statuts retirés (journal + préviz).
- Zone : `spellTargets` gère déjà `splash`/`all` ⇒ une « dissipation de masse »
  serait gratuite en données (le sort livré reste mono-cible).
- Aucun nouvel événement : `SpellCast{amount}` (amount = statuts retirés) suffit
  au journal (`combatLog.spell`).
- IA : `chooseHeroSpell` ne lance que damage/heal/debuff/applyMarks/buff ⇒
  ignore `dispel` (pas de cast, pas de crash). Comportement IA inchangé.

## Changements

- `packages/engine/src/hero/types.ts` : `'dispel'` dans l'union `SpellKind`.
- `packages/engine/src/hero/spells.ts` : `'dispel'` dans `spellTargetsEnemy`.
- `packages/engine/src/combat/spell-effect.ts` : branche `kind === 'dispel'`
  (vide `statuses`, compte `amount`).
- `packages/engine/src/hero/index.ts` `estimateSpellWithPower` : cas `dispel`
  (préviz `amount` = nb de statuts sur la/les cible(s), `kills` 0).
- `packages/content/src/schemas.ts` : `'dispel'` dans l'enum `kind` du sort.
- `data/core/spells.json` : `dissipation` → `kind: 'dispel'`, suppression de
  `attackMod`/`defenseMod` (school neutral, cercle 3, mana 12 inchangés).
- `data/core/locales/{fr,en}.json` : `spellbook.previewDispel` (préviz).
- `packages/client/src/ui/SpellBook.tsx` + `ui/combat.tsx` : cas `dispel` dans
  `formatPreview`/`formatSpellPreview`.
- doc 02 §1.4 (note État Dissipation + retrait de « dissipation réelle » du
  reste-à-faire) ; backlog `game-feature-gaps.md` H-SPELLS.4.

## Vérification

- test moteur `combat-dispel.test.ts` (ids de faction OPAQUES) : un héros
  dispel retire les statuts (buff + poison + malédiction) d'une pile ennemie ;
  aucun statut ⇒ no-op ; cible du mauvais camp (allié) refusée par `validateCastSpell`.
- typecheck 5/5 · lint · vitest engine (golden + save-shape **inchangés**) ·
  vitest content · `content:check` · garde-fou faction (ids opaques) · garde-fou
  couleur · build + bundle < 800 Ko gzip · smoke.
- `faction:sim` non requis (sort utilitaire hors lineup, armées de sim sans héros).

## Journal

- 2026-07-13 — Plan créé, branche `claude/h-spells-dispel` depuis origin/main.
  Constat : le lot recommandé (F-SKILLS.2-UI) et plusieurs alternatives (Phénix
  CAP-LIFE.2, F-SCHOOLS moral) étaient déjà mergés (#326/#328/#327) ⇒ choix du
  prochain trou ouvert : H-SPELLS.4 « dissipation réelle ».
- 2026-07-13 — Implémenté : `SpellKind 'dispel'` (types + `spellTargetsEnemy`
  offensif), branche `applySpellToTargets` (vide `statuses`, amount = nb retirés),
  cas préviz `estimateSpellWithPower`, enum schéma content, données `dissipation`
  → `kind: 'dispel'` (mods retirés), locale `spellbook.previewDispel`, cas client
  (`SpellBook`/`combat.tsx`). Doc 02 §1.4 + backlog.
- 2026-07-13 — Vérif : typecheck 5/5 · lint · engine 705/705 (dont
  `combat-dispel` +4 ; golden + save-shape **inchangés**) · content 126/126 ·
  content:check · garde-fous faction/couleur (ids opaques dans le test) · build ·
  bundle gzip 311 Ko < 800 Ko. Smoke en cours.
