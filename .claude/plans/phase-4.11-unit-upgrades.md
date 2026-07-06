# Plan — Alpha 4.11 : upgrades d'unités (×3 factions)

> Étape 4 de `mvp-audit-and-alpha.md` : premier lot Alpha (doc 09 Phase 2, choix
> user). Chaque unité T1–T7 gagne une variante **améliorée** (stats + parfois
> capacité). Fidélité HoMM : bâtir le dwelling amélioré, recruter la version sup,
> et améliorer les unités déjà recrutées contre de l'or.

## Principe directeur (on-brand : données d'abord, UN point d'extension moteur)

1. **Dwelling gradué = ZÉRO diff moteur** (preuve de l'architecture data-driven,
   comme la modularité de faction) : chaque `<faction>-dwelling-tN` passe en
   **`maxLevel: 2`** — niveau 1 = dwelling de base (existant), niveau 2 =
   dwelling amélioré (`requires` niveau 1, coût d'upgrade, `effect: dwelling(tier,
   unitIdAmélioré)`). Le moteur existant (`builtLevelOf` = niveau construit) fait
   **automatiquement** que la croissance accumule l'unité améliorée et que seul
   l'amélioré est recrutable une fois le niveau 2 bâti. **Aucune règle nouvelle.**
2. **UN point d'extension générique** — commande `UpgradeUnits { townId, unitId }`
   pour convertir les piles **déjà recrutées** (garnison) de base → amélioré
   contre le **différentiel de coût** (par ressource, ≥ 0, × effectif). Le mapping
   base→amélioré est **dérivé** du dwelling gradué (niveau1.unitId → niveau2.unitId),
   jamais un nom de faction ni un champ de données dédié.

## Surfaces figées (pilote)
- **Moteur** : `UpgradeUnits` (commande + `validate`/`handle` dans `town/`),
  événement `UnitsUpgraded { townId, fromUnitId, toUnitId, count }`, code d'erreur
  `notUpgradable`. Helper `upgradedUnitFor(town, catalog, baseUnitId)` (dérive du
  dwelling gradué construit au niveau 2). Ajuster `builtDwellings` pour n'exposer
  que l'unité du **niveau construit** par bâtiment (cohérent avec `unitIsRecruitable` ;
  sûr car aucun dwelling multi-niveaux n'existait). Golden : inchangé (pas de
  changement de forme d'état ; nouvelle commande non jouée dans le golden).
- **Contenu** : schéma inchangé (dwellings maxLevel 2 déjà exprimables). Convention
  d'id d'unité améliorée = libre par faction (ex. `t1-conscrit` → `t1-hallebardier`).
  Le loader doit valider un dwelling dont l'effet niveau 2 référence l'unité améliorée.
- **Client** : onglet Garnison → bouton « Améliorer » par pile améliorable
  (aperçu du coût) ; le dwelling amélioré se bâtit via l'onglet Construire existant.

## Lots
- [ ] **B0 (pilote)** — geler + implémenter le moteur : `UpgradeUnits`, event,
  helper, ajustement `builtDwellings`, tests unitaires (recrute amélioré après
  upgrade dwelling ; convertit garnison base→amélioré au bon coût ; rejets).
- [ ] **B1/B2/B3 (délégués Sonnet, disjoints)** — données par faction (haven,
  necropolis, arcane-hunters) : 7 unités améliorées (stats doc 03/04/05 si
  fournies, sinon +~30 % cohérent), dwellings maxLevel 2, locales FR/EN.
  `content:check` + test de recrutement amélioré verts.
- [ ] **B4 (pilote)** — client : bouton « Améliorer » (garnison) + aperçu coût ;
  i18n. Smoke : bâtir dwelling amélioré → recruter amélioré → améliorer une pile.
- [ ] **B5 (pilote)** — docs 03/04/05 (variantes améliorées), doc 02 §4.1
  (upgrades), roadmap 09 (item coché), plan.

## Invariants
Moteur pur ; **zéro nom de faction** (mapping dérivé) ; golden stable (à
re-vérifier — pas de changement de forme attendu) ; budget < 800 Ko ; anti-gel ×4 ;
touch-first (bouton ≥ 44 px) ; docs à jour.

## Journal
- **2026-07-06** — Création. Base `fdb9871` (main, après #65). Conception : upgrade
  de dwelling = données pures (graded) ; upgrade de piles = 1 commande générique.
