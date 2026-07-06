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
- [x] **B0 (pilote)** — moteur : `UpgradeUnits` + `UnitsUpgraded` +
  `upgradedUnitFor`/`upgradeCost`, `notUpgradable`, `builtDwellings` ajusté. **6
  tests** unitaires. Golden stable (aucun changement de forme).
- [x] **B1/B2/B3 (délégués Sonnet)** — données par faction : haven 7, necropolis
  7, arcane-hunters 8 variantes améliorées + dwellings `maxLevel:2` + locales.
  `content:check` vert (haven 14 / necropolis 14 / arcane 16 unités).
- [x] **B4 (pilote)** — client : bouton « Améliorer » (+ coût) par pile de
  garnison, toast `UnitsUpgraded`, i18n. Upgrade ajouté à **test-faction**
  (démo sur la partie par défaut). Smoke « bâtir dwelling amélioré → améliorer ».
- [x] **B5 (pilote)** — docs 02 §4.1 (upgrades), roadmap 09 (4.11 livré), plan.
- [x] **Fix tests** (pilote) — assertions « 7 unités » remplacées par le compte
  de BASE (via `manifest.town.dwellings`) : `faction-recruit`/`balance`/
  `arcane-hunters-mark` identifient les factions par propriété robuste (compte de
  base, pas `units.length`), recrutent les unités de base (le niveau 2 exige le
  dwelling amélioré). 70 content + 258 engine verts.

## Invariants
Moteur pur ; **zéro nom de faction** (mapping dérivé) ; golden stable (à
re-vérifier — pas de changement de forme attendu) ; budget < 800 Ko ; anti-gel ×4 ;
touch-first (bouton ≥ 44 px) ; docs à jour.

## Journal
- **2026-07-06** — Création. Base `fdb9871` (main, après #65). Conception : upgrade
  de dwelling = données pures (graded) ; upgrade de piles = 1 commande générique.
- **2026-07-06** — B0/B4 pilotés + B1/B2/B3 délégués (3 agents Sonnet parallèles).
  Intégration : correction des tests « 7 unités » (base-aware). Vérif : typecheck
  4/4, lint, **258 engine + 70 content**, golden **stable** (aucun changement de
  forme), content:check, build 71,4 Ko, **58 smoke** (dont upgrade). Docs à jour.
  Mécanisme committé (`2d766eb`) ; données + tests + smoke + docs à committer. PR.
