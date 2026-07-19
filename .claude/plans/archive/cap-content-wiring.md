# Lot — Câblage de contenu : capacités thématiques (données pures)

> Décision utilisateur (« câblage de contenu », choix « les deux »). Les données
> de toutes les factions matchent déjà leur doc (CAP-DATAFIX) ⇒ ceci **ajoute**
> une capacité **existante du catalogue** (engine-ready) à des unités qui la
> méritent thématiquement et qui aident l'équilibrage. **Zéro moteur, zéro faction
> en dur, pas de bump save, golden inchangé** (unités de faction ≠ unités
> synthétiques du golden).

## Changements (données + doc)

1. **Sylvan T5 Licorne → `magicResistance` 0.25** (base + elite). La licorne est
   l'unité de résistance magique canonique de HoMM ; c'était la SEULE unité Sylvan
   sans aucune capacité. Sylvan mi-tableau au sim (55.9 %) ⇒ buff défensif modeste
   sûr. MAJ doc 14 (note « lineup n'utilise que flying/shooter/doubleAttack » →
   ajouter magicResistance à la Licorne ; la promesse « 1 module » tient — capacité
   de catalogue existante, pas un nouveau module).

2. **Dungeon T2 Furie Sanglante → `firstStrike`** (base + elite). Assaut frénétique
   qui frappe avant à vitesse égale. Dungeon est la faction la PLUS FAIBLE au sim
   (43.7 %) ⇒ buff offensif bas-tier balance-positif. MAJ doc 17 (table lineup T2).

Parité elite ⊇ base (test `elite-ability-parity`) : capacité ajoutée aux DEUX
variantes de chaque unité.

## Vérification

- [x] `faction:validate sylvan-court` + `dungeon` (schéma + capacité au catalogue) : ✓/✓.
- [x] `pnpm faction:sim` : **aucun nouveau déséquilibre béant**. Baseline **7**
      blowouts → **6** avec câblage ; sylvan-vs-dungeon **80.8 % → 79.6 %** (sort de
      la bande) ; Dungeon (faction la plus faible) remonte : vs Haven 75→69, vs Vox
      73→70 ; aucun nouveau > 80 %.
- [x] content test (élite-parité tient, 148 passed), content:check (7 valid),
      garde-fou faction (1=clean). Colors non touché (données/doc/test seuls).
- [x] typecheck -r · lint · engine test **842 passed, golden 04cb6e08 inchangé** ·
      build · bundle **327 342 ≤ 819 200** · smoke @core **19 passed**.
- [x] Docs 14 §6 (Sylvan) + 17 §lineup (Dungeon) alignées ; CLAUDE.md note ajoutée.

## Journal
- [x] Données Licorne + Furie (base + elite) — `magicResistance` 0.25 / `firstStrike`.
- [x] Docs 14 (Licorne → magicResistance, note ²) / 17 (Furie T2 → firstStrike, note ²).
- [x] Test `dungeon-recruit` T2 : assertion capacités mise à jour (firstStrike+noRetaliation).
- [x] faction:sim avant/après mesuré + recette complète verte.
