# Plan — Phase 3.4 : Necropolis + Nécromancie (test de modularité n°1)

Réf : doc 11 §Phase 3.4 ; doc 04 (spec Necropolis) ; doc 06 §4 (points
d'extension — « la Nécromancie est **en fait déclarative** »). Contrairement à
3.3 (data-only), cette phase **ouvre UN point d'extension moteur générique**,
une seule fois, sans que le moteur connaisse « necropolis ».

## Le test de modularité n°1

Doc 11 §3.4 : « la Nécromancie passe par un `AbilityModule`/hook générique du
moteur (point d'extension ouvert **une fois**, sans connaître la faction) ;
critère CI : le diff hors `data/` se limite à l'ouverture du point d'extension
générique ». Doc 06 §4 note explicitement que la Nécromancie est **déclarative**
(pas un module JS) : le vrai travail moteur est donc **interpréter un effet de
faction déclaratif à la fin d'un combat gagné**, piloté par les données du
manifeste, jamais par un `if (faction === …)`.

## Décision d'architecture : effet de faction post-victoire générique

Le moteur gagne un **interpréteur d'effets de faction déclaratifs**, appliqué
dans `applyConsequences` (combat gagné par le héros). Il lit les effets depuis
un **catalogue de faction** résolu par le contenu (comme `unitCatalog`/
`buildingCatalog`), indexé par `factionId`. Le héros porte désormais un
`factionId`. **Aucun nom de faction dans le moteur** : il applique l'effet
`type` (générique) avec ses paramètres de données.

Effet MVP (un seul type ouvert) :
```
{ type: 'raiseUndeadOnVictory', unitId: string, percentHpRaised: number,
  capBase: number, capPerExisting: number }
```
À la victoire du héros : compter les PV **vivants** (non-`undead`) tués côté
adverse ; ressusciter `round(hpKilled × percent/100 / hp(unitId))` unités de
`unitId`, plafonné à `capBase + capPerExisting × (effectif courant de unitId
dans l'armée)` ; ajouter/fusionner dans l'armée du héros (respecte ≤ 7 piles).
Émettre un événement `UndeadRaised { heroId, unitId, count }`.

## Décisions préalables

1. **`HeroState.factionId: string`** (nouveau). Fourni par `PlayerSetup.
   startingFactionId` (défaut : factionId de la ville de départ, sinon `''`).
   Défaut `''` ⇒ aucun effet ⇒ golden intact.
2. **Catalogue de faction** : `StartGame.factionCatalog?: Record<string,
   { bonuses: FactionBonus[] }>` résolu depuis les manifestes (contenu). Le
   moteur applique `factionCatalog[hero.factionId]?.bonuses` post-victoire.
   Défaut `{}` ⇒ aucun effet.
3. **Schéma manifeste** : `factionBonuses` passe de `max(0)` à une **union
   discriminée** validée — pour l'instant le seul type `raiseUndeadOnVictory`
   (les types non interprétés restent refusés : pas de mensonge de validation).
   Règle croisée : `unitId` doit exister dans le paquet ; `undead` requis sur
   l'unité ressuscitée.
4. **Comptage des vivants** : un mort adverse compte s'il n'a PAS la capacité
   `undead` (lue dans `unitCatalog`). Cohérent avec doc 04 (« PV des créatures
   **vivantes** ennemies tuées »).
5. **Nécromancie = effet de faction plat en 3.4** : le `percentHpRaised` vient
   des données de faction (valeur unique MVP). Le **scaling par la compétence
   Nécromancie** (Novice/Expert/Maître 10/15/20 %) et le bâtiment Amplificateur
   (doc 04 §2/§4) sont **différés** (raffinement) : nécessiteraient de brancher
   le rang de compétence du héros dans l'effet — noté en écart. Le point
   d'extension, lui, est ouvert et générique.
6. **Unités Necropolis** : capacités restreintes aux 6 supportées (`undead`,
   `flying`, `shooter`, `noRetaliation` présentes dans le lineup ; `curseOnHit`/
   `incorporeal`/`lifeDrain`/`areaAttack`/`charge`/`aura`/`breathAttack` =
   différées, comme Haven). `undead` est **déjà géré** (moral 0, exclu du
   calcul de groupes) — la faction l'exploite sans code neuf.
7. **Bâtiments** : arbre d'habitations (7 dwellings + prérequis) ; bâtiments
   spéciaux (Amplificateur/Croisée/Puits) différés (effets non supportés).
8. **Terrain natif** : `dirt` (« terre morte ») — vérifier que le terrain
   existe dans les configs ; sinon utiliser un terrain valide et documenter.
9. **spellSchool** : `null` (Nécromancie/Prime = variante Terre, non peuplée).
   heroSkills : `[]` (Nécromancie compétence de faction différée, cf. #5).

## Surfaces figées (cadrage)

- **Moteur** : `HeroState.factionId`; `PlayerSetup.startingFactionId?`;
  `StartGame.factionCatalog?`; `GameState.factionCatalog`; type `FactionBonus`
  (union, 1 variante) + `FactionBonusDef`; événement `UndeadRaised`; interpréteur
  `applyFactionVictoryEffects(draft, combat, hero)` appelé dans `applyConsequences`.
- **Contenu** : `factionBonusSchema` (union), relâche `factionBonuses` ; règles
  croisées (unitId existe + undead) ; `buildFactionCatalog(report)` ;
  `data/factions/necropolis/` (manifeste + 7 unités + buildings + locales).
- **Client** : toast `UndeadRaised` (i18n) ; `buildFactionCatalog` câblé dans
  `newGameCommand` ; `hero.factionId` peuplé depuis la ville de départ.

## Lots

- [x] **Cadrage (principal)** : ce plan + specs + point d'accroche identifié.
- [x] **Lot O (sonnet) — moteur** : `HeroState.factionId`, `factionCatalog`,
      type `FactionBonus`, interpréteur post-victoire `raiseUndeadOnVictory`
      (`faction/effects.ts` : comptage vivants via `hasAbility`, plafond, fusion
      armée ≤ 7, no-op si armée pleine ou unité absente), événement
      `UndeadRaised`, `casualties` calculées avant `applyConsequences`. 8 tests
      tabulaires + property (armée ≤ 7) dans `faction-effects.test.ts` (ids
      synthétiques, aucun nom de faction). **Golden refixé** `f85c9e64` →
      `211e3cfd` (2 nouveaux champs d'état `factionId`/`factionCatalog`).
      158 tests moteur verts.
- [x] **Lot P (sonnet) — contenu** : `factionBonusSchema` (union) + règle
      croisée (unitId existe + `undead`), `buildFactionCatalog`,
      `data/factions/necropolis/` (7 unités undead stats doc 04, manifeste avec
      `raiseUndeadOnVictory`, arbre habitations, locales), `content:check`
      étendu (« N effet(s) de faction »), test faction identifiée par sa
      propriété. 42 tests contenu, `content:check` 4 paquets valides.
- [x] **Lot Q (principal) — client** : toast `UndeadRaised` + i18n FR/EN,
      `buildFactionSetup`/`FactionCatalog` dans `game.ts`, `hero.factionId`
      depuis `config.newGame.startingTown.factionId`, câblé dans `main.ts`.
- [x] **Intégration (principal)** : catalogue faction→moteur câblé ; test
      end-to-end **données réelles** « héros mort-vivant gagne un combat de
      vivants ⇒ `UndeadRaised` + squelettes dans l'armée » (API publique
      `MoveHero`→interception→`AutoCombat`) ; smoke liste de factions mise à
      jour (+necropolis) ; docs 04 « État 3.4 » + 06 « point d'extension ouvert »
      + CLAUDE.md. Vérif : 158 moteur, 42 contenu, 15 smokes desktop / 14
      mobile, typecheck/lint verts, garde-fou (0 nom de faction dans le moteur).

## Écarts assumés

- Scaling de la Nécromancie par compétence + bâtiment Amplificateur différé
  (effet plat en données au MVP) ; capacités spéciales `curseOnHit`/
  `incorporeal`/`lifeDrain`/`areaAttack`/`charge`/`aura`/`breathAttack`,
  bâtiments spéciaux, école Prime, héros nommés (Vhalen/Mère Corbeau),
  « Fléau persistant » : différés (points d'extension non ouverts). Le point
  d'extension `raiseUndeadOnVictory` est le SEUL ouvert cette phase.
- Le diff moteur hors `data/` se limite à l'ouverture de ce point générique
  (critère CI doc 06 §5.8 / doc 11 §3.4).
