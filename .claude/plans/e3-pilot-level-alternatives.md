# E3 — pilote : choix exclusif au niveau 2 d'une habitation (Haven T3)

> Report E3 du plan `game-experience-enrichment.md` (§2.2 « Dilemmes de
> construction exclusifs »), après `e3-prereq-elite-sim.md` et
> `e3-elite-balance-pass-3.md`. Arbitrages utilisateur du 2026-10-01 :
> **variantes de niveau** (un point moteur générique) et **Vindicateur
> offensif** en face du Templier.

## 1. Constat

- Un pilote « données pures » (deux bâtiments d'amélioration liés par
  `exclusiveGroup`) casse deux choses : la croissance hebdo va à l'unité du plus
  haut niveau **de chaque bâtiment** (deux bâtiments ⇒ croissance du T3 doublée),
  et `UpgradeUnits` ne relie base et élite qu'au sein d'un même bâtiment.
- Une quinzaine de lectures directes de `levels[i].effect` (moteur, client, outil).

## 2. Décisions

- **Point moteur générique** : un niveau de bâtiment peut déclarer
  `alternatives` (effets de remplacement). L'option 0 est `effect`, l'option k
  est `alternatives[k-1]`. Le joueur choisit à la construction
  (`BuildStructure.choice`), choix **irréversible**, mémorisé dans
  `TownState.levelChoices?` (optionnel ⇒ pas de bump, sauvegardes existantes =
  option 0).
- Résolution centralisée : `levelEffectOf` ; `builtLevelOf` rend le niveau avec
  l'effet choisi ⇒ croissance, recrutement, `UpgradeUnits` inchangés.
- Validation de contenu : une alternative a le même type d'effet que `effect`
  (et, pour une habitation, le même tier) ; unité référencée existante.
- IA : prend l'option 0 (choix d'IA différé, noté).
- **Données** : `haven-dwelling-t3` niveau 2 = Templier (option 0) ou
  **Vindicateur** (option 1). Le Vindicateur garde `shieldWall` (invariant de
  parité base → amélioration) et gagne `firstStrike` ; profil offensif (plus
  d'attaque, défense de la base). Prix calé au banc d'équilibre (comme la passe 3).
- Invariant de parité des élites : dérivé des habitations (base du niveau 1 →
  chaque option du dernier niveau) au lieu du suffixe `-elite`.
- `faction:sim` : lecture « facteur d'égalité » par variante.
- Client : l'onglet Construire montre une carte par option (unité, coût) ; le
  choix fait, l'option écartée n'apparaît plus.

## 3. Étapes

1. [x] Moteur : types, `levelEffectOf`/`builtLevelOf`, lectures directes, commande + validation, tests
2. [x] Contenu : schéma, loader, `content:check`, invariant de parité, tests
3. [x] Données : Vindicateur (unité, locales, manifeste, habitation), prix au banc
4. [x] Outil : `faction:sim` par variante
5. [x] Client : choix à la construction, locales, smoke
6. [x] Docs 02/03/06/08, CLAUDE.md
7. [ ] Vérifications

## 4. Vérifications

- [ ] typecheck (sans `-s`), lint, build, tests, garde-fous, golden inchangé
- [ ] Playwright complet

## 5. Journal

- 2026-10-01 : plan ouvert après la fusion de la passe 3 (#559).
- 2026-10-01 : livré. Écarts et décisions :
  - le Vindicateur sort au banc à 297 or de prix juste (Templier 295) ⇒ **même
    prix** ; armée qui le prend : facteur d'égalité ×0,992 (Templier ×1,000) ;
  - la faction de test gagne une alternative au niveau 2 de son habitation T1
    (`t1-recruit-guard`) pour un smoke léger de l'interface (ville de départ du
    smoke = faction de test, habitation T1 pré-bâtie) ; smoke non tagué ;
  - `builtLevelOf` rend l'effet choisi ⇒ ses ~10 appelants sont couverts sans
    retouche ; les lectures directes de `levels[i].effect` (amélioration, IA,
    marché, guilde au démarrage, client) passent par le helper ;
  - sprite du Vindicateur : repli procédural (pas d'illustration) ;
  - invariant de parité des élites dérivé aussi des habitations (couvre les
    alternatives, qui ne portent pas le suffixe `-elite`).
