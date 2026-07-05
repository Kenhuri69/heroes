# Plan — Phase 4.9 : École de la Traque (amorce) — Arcane Hunters

Sous-lot Alpha (plan 4.1). Amorce l'école de sorts propre à AH (doc 05 §6).
Bornée : un **nouvel effet de sort générique** (`applyMarks`, réutilise le
système de Marque) + un sort **exprimable en données** (Entraves = debuff de
vitesse). Les sorts plus complexes (Bannissement, Silence, Volée de Dagues…)
et l'accès héros faction (héros nommés) sont différés.

## Design

- `SpellSchool` += `'traque'` ; `SpellKind` += `'applyMarks'` ; `SpellDef.marks?`.
- Schéma contenu : `school` enum += `traque` ; `kind` enum += `applyMarks` ;
  champ `marks` optionnel ; refine « applyMarks ⇒ marks > 0 ».
- `handleCastSpell` : branche `applyMarks` — `target.marks = min(marksMax,
  target.marks + spell.marks)`, event `MarkApplied` (comme la capacité `mark`).
- `estimateSpell` : `SpellEstimate.kind` élargi ; `applyMarks` → `amount = marks`.
- Données `data/core/spells.json` : `marque-du-guetteur` (applyMarks, marks 2,
  school traque, cercle 1) + `entraves-runiques` (debuff, speedMod −3, school
  traque, cercle 2). Locales `spell.<id>` fr/en.
- Manifeste AH : `spellSchool: "traque"`.

## Étapes

1. Moteur : types (`hero/types.ts`), dispatch (`hero/index.ts` handleCastSpell +
   estimateSpell). 2. Contenu : `schemas.ts` (school/kind/marks/refine).
3. Données : 2 sorts + locales + manifeste. 4. Test moteur (`hero-spells`) :
   lancer `applyMarks` ajoute des charges à la cible (plafonné). 5. Docs, vérif, PR.

## Vérification

typecheck, lint, garde-fou, tests moteur+contenu, content:check (catalogue de
sorts + 2), smoke, budget. **Golden inchangé** (les sorts du golden ne changent
pas ; nouvelles branches inertes hors usage).

## Écarts

- Sorts Traque complexes (Bannissement conditionnel, Silence anti-spellcaster,
  Volée de Dagues = dégâts × marques consommées, Heure de la Curée) : lots
  ultérieurs (nouveaux effets). Accès héros AH aux sorts Traque : avec les héros
  nommés (doc 05 §7), différé — les sorts vivent au catalogue, apprenables via
  guilde/`startingSpells`.
