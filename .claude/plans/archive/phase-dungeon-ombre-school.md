# École de magie `ombre` du Donjon (doc 17 §5, différé)

## Contexte

Le Donjon réutilise `fire`/`neutral` ; son **école propre `ombre`** (Ténèbres)
est différée « comme `traque`/`scene` ». Recette **prouvée et data-driven** (zéro
moteur) : les deux écoles de faction livrées (`traque` AH, `scene` Vox) suivent le
même patron. Gate déjà générique (client `game.ts`) : un héros connaît les sorts
des écoles universelles + ceux de l'école de SA faction (`manifest.spellSchool`).

## Design (données pures)

- Ajouter `ombre` à la liste contrôlée `SPELL_SCHOOLS` (anti-typo, schemas.ts).
- 4 sorts `ombre` (`data/core/spells.json`), cercles 1–3, **magnitudes alignées
  sur les écoles existantes** (l'avantage du Donjon = `irresistibleMagic` déjà
  livré, pas des chiffres bruts) :
  1. `trait-d-ombre` (c1, damage 6 + 2/Pouvoir, mana 5).
  2. `cecite` (c2, debuff attackMod −4, mana 8).
  3. `nuee-d-ombre` (c2, damage 12 + 3/Pouvoir, mana 9).
  4. `fleau-des-tenebres` (c3, damage 16 + 4/Pouvoir, mana 15, `area: splash`).
- `manifest.spellSchool: "ombre"` (Donjon) ⇒ ses héros apprennent ces 4 sorts.
- Locales `spell.<id>` fr/en (core).

## Invariants

Données pures : zéro moteur, zéro faction en dur (école = chaîne opaque). Golden
**inchangé** (le replay/golden utilise les sorts fixtures, pas `core/spells.json`).
Pas de bump save. Les 4 sorts `damage` **synergisent** avec `irresistibleMagic`
(pierce) — cohérence de faction, sans buff de magnitude.

## Étapes

1. `SPELL_SCHOOLS` += `ombre` → verify: content:check.
2. 4 sorts dans `spells.json` + locales fr/en → verify: content:check, parité locale.
3. `manifest.spellSchool` Donjon = `ombre` → verify: content:check.
4. Docs 17 (§5 école `ombre` livrée) → verify: relecture.
5. Test content : un héros Donjon apprend les sorts `ombre`, un héros d'une autre faction non → verify.
6. Vérif complète (typecheck, lint, tests, golden, garde-fou, build, budget, smoke).

## Statut

- [x] **LIVRÉ.** `ombre` ajouté à `SPELL_SCHOOLS` ; 4 sorts (`trait-d-ombre` c1,
      `cecite` c2, `nuee-d-ombre` c2, `fleau-des-tenebres` c3 splash) dans
      `core/spells.json` ; `manifest.spellSchool: "ombre"` (Donjon) ; locales
      `spell.<id>` + `school.ombre` fr/en. Test `dungeon-ombre.test.ts` (Donjon
      apprend / Vox non, parité locale). Doc 17 alignée.
- **Vérif** : content:check ✓ · typecheck ✓ · **161 content** (+5) ✓ · **935 engine**
  ✓ · **golden inchangé** (sorts fixtures ≠ core/spells.json) · lint/garde-fou/build/
  budget/smoke ci-dessous.
- Données pures, zéro moteur, zéro faction en dur, pas de bump save.
