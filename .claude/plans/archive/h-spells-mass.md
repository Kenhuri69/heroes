# Lot H-SPELLS.1 — Sorts de masse (`area: 'all'`)

> Backlog : `game-feature-gaps.md` §2.4 (H-SPELLS). Doc source : **doc 02 §1.4**.
> Branche `claude/map-design-issues-jhjdy6` (repart de `origin/main`).

## Constat

Le catalogue de sorts ne connaît que le mono-cible et le `splash` (C7 : cible +
alliées adjacentes). **Aucun sort de masse** (« tous les alliés » / « tous les
ennemis ») — pilier HoMM (Hâte de masse, Bénédiction de masse, Lenteur de masse).

## Spec (point d'extension moteur GÉNÉRIQUE, zéro faction)

- Étendre le champ **`SpellDef.area`** : `'splash' | 'all'`. `all` = **toutes les
  piles vivantes du camp de la cible** (le « centre » choisi détermine le camp :
  taper un allié ⇒ buff de tout son camp ; taper un ennemi ⇒ debuff/dégâts de
  tout le camp adverse). Réutilise **intégralement** `applySpellToTargets` /
  `estimateSpell` (seule `spellTargets` gagne une branche).
- Content : `spellSchema.area = z.enum(['splash','all']).optional()`.
- Données : 3 sorts de masse cercle 3 (plafond apprenable via la Guilde niv. 3) —
  mana majorée vs mono-cible :
  - `benediction-de-masse` (water, buff, attackMod +3, area all)
  - `hate-de-masse` (air, buff, speedMod +3, area all)
  - `affaiblissement-de-masse` (earth, debuff, defenseMod −3, area all)
  Locales FR/EN `spell.<id>`.
- **Aucun champ d'état nouveau** (`area` est du catalogue, embarqué dans
  `StartGame`) ⇒ **pas de bump save**. Golden **inchangé** (replay inline, sa
  propre catalogue). Garde-fou « zéro faction » : sorts core, écoles génériques.

## Étapes / vérif

1. Engine `types.ts` (area) + `spell-effect.ts` (`spellTargets` branche `all`)
   → nouveau `combat-spell-mass.test.ts` (buff tous alliés, debuff tous ennemis,
   preview agrégée).
2. Content `schemas.ts` (area enum) → `pnpm --filter @heroes/content test`.
3. Données `spells.json` + locales FR/EN → `content:check`, parité.
4. Vérifs : typecheck 5/5, lint, engine, content, build (< 800 Ko), garde-fous
   zéro-faction + couleurs, smoke (non-régression combat/sorts). Golden inchangé.
5. Doc 02 §1.4 : noter `area:'all'`. Backlog H-SPELLS : slice masse ✅, reste
   (aventure vision/rappel, cercle 4-5 + extension Guilde niv 4-5, invocation,
   chaîne, dissipation réelle) ⬜.

## Journal

- Plan créé ; exploration : `spellTargets`/`applySpellToTargets`/`estimateSpell`
  partagés héros+unité ; le heal résout DÉJÀ la résurrection intra-pile
  (`maxCount = count + lostSoFar`). Guilde plafonne au cercle 3 ⇒ masse en c3.
- **Livré** : `SpellDef.area = 'splash' | 'all'` (types.ts) ; branche `all` de
  `spellTargets` (spell-effect.ts) ; schéma content `area: enum(['splash','all'])` ;
  3 sorts de masse c3 dans `spells.json` + locales FR/EN ; test moteur
  `combat-spell-mass.test.ts` (buff tous alliés, debuff/dégâts tous ennemis,
  preview agrégée).
- Vérifs vertes : typecheck 5/5, lint, engine **593** (+4 mass ; golden +
  save-shape **inchangés**), content **114** (parité), content:check 6 paquets,
  build (JS+CSS gzip ≈ 301 Ko < 800), garde-fous zéro-faction + couleurs, smoke
  combat/sorts **29 passed** (1 skipped) = non-régression. **Pas de bump save,
  golden inchangé.**
- Doc 02 §1.4 mise à jour ; backlog H-SPELLS découpé (H-SPELLS.1 ✅).
