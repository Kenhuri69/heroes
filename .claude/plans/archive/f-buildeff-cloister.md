# Lot F-BUILDEFF.3 — Cloître (bâtiment qui enseigne un sort au visiteur)

Backlog §2.3 (F-BUILDEFF, sous-lot .3). Exemplaire : **Cloître** (doc 03 §4 —
« les héros visiteurs apprennent Bénédiction ; +2 mana/j régénérés »).

## Portée F-BUILDEFF.3

- **Effet générique** `{ type: 'grantSpell'; spellId }` (`town/types.ts`) : à la
  construction, `spellId` est ajouté à `town.spellPool` ; **réutilise** la
  mécanique d'apprentissage à la visite déjà livrée (`learnGuildSpellsAtTown`
  appelée sur `MoveHero`/construction) — un héros du propriétaire présent apprend
  le sort si son cercle apprenable le permet. Générique : n'importe quelle
  faction peut enseigner un de ses sorts (core ou école propre, tous dans
  `core/spells.json`).
- **Câblage** : bloc `grantSpell` dans `handleBuildStructure` (jumeau du bloc
  `mageGuild`, sans RNG).
- **Contenu** : variante `grantSpell` du schéma d'effet + **cross-validation**
  (le `spellId` doit exister dans `core/spells.json` — `coreSpells` passé à
  `loadFactionPack`, comme `dwelling.unitId`/`houseChoice.houseId`).
- **Données** : bâtiment **Cloître** (`data/factions/haven/`, `grantSpell
  benediction`, prérequis `mageGuild@1`) + locales FR/EN.
- **Docs** : doc 03 §4 (Cloître : apprentissage livré), doc 02 §4.1.

## Réconciliation doc (DOC-STATS)

Le volet **« +2 mana/j régénérés »** est **différé/réconcilié** : dans le modèle
livré, la mana se **restaure entièrement chaque jour** (doc 02 §1.4) — un bonus
de régénération quotidien serait un no-op. Un vrai levier « mana » exigerait un
`manaMax` bonus (surface héros absente) ⇒ noté au doc, hors périmètre .3.

## Invariants

- **Zéro faction** (effet opaque, `spellId` opaque) — garde-fou vert.
- **Aucun bump de sauvegarde** : `spellPool` existe déjà (v ≥ save G2).
- **Golden inchangé** : pas de bâtiment `grantSpell` dans le replay.

## Vérifs

typecheck · lint · engine+content (bâtiment grantSpell → sort dans le pool +
héros présent l'apprend ; cross-validation d'un spellId inconnu) · content:check
· garde-fou · build · budget · smoke.

## Journal

- branche `claude/f-buildeff-cloister` depuis `main` @ merge #239 (F-BUILDEFF.2).
