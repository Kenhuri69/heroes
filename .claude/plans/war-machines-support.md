# Plan — Lot 2.3 (doc 18) : tente de premiers soins & chariot de munitions (B2)

> **Statut** : ✅ livré (2026-07-17).
> Écart couvert : **B2** (doc 18 §2.B) — machines de guerre de soutien de la
> suite HoMM. Étape 2 du plan de comblement (« profondeur de règles à faible
> risque, moteur générique opt-in »). Lots 2.1 (`rangePenalty`) et 2.2
> (`guardianGrowth`) déjà livrés.

## 0. Objectif & critère de sortie

Deux nouvelles machines achetables à la Forge : la **tente de premiers soins**
(soigne périodiquement la pile alliée la plus blessée) et le **chariot de
munitions** (recharge les munitions des tireurs alliés). Le moteur gagne DEUX
comportements **génériques** déclarés par capacité — aucune référence aux
machines elles-mêmes.

**Critère de sortie mesurable** : en combat avec la tente, une pile alliée
blessée regagne des PV à chaque début de round (jamais au-delà de son effectif
initial) ; avec le chariot, un tireur à munitions entamées les voit remonter
(jamais au-delà de sa réserve initiale). Sans ces machines : comportement
bit-identique (golden inchangé).

## 1. Invariants (guidelines §8)

- **Zéro faction dans le moteur** : deux capacités génériques
  (`healPerRound { amount }`, `replenishAmmo { amount }`) interprétées pour
  TOUTE pile qui les porte — les machines ne sont que des données.
- **Opt-in par données** : aucune unité existante ne porte ces capacités ⇒
  golden/replays inchangés.
- Déterminisme : cible du soin = pile alliée au manque de PV maximal, égalité
  départagée par l'ordre du tableau (stable) ; aucun RNG.
- Pas de bump `CURRENT_SAVE_VERSION` : aucun champ d'état nouveau
  (`ammo`/`count`/`firstHp` existent ; les capacités vivent dans le catalogue).
- Événements : `StackHealed` réutilisé (tente — ligne de journal existante) ;
  nouvel événement `StackAmmoReplenished` (chariot) + ligne de journal. Le
  golden hache l'état, pas les événements (précédent `CombatEnded.survivors`).

## 2. État des lieux (points d'ancrage vérifiés)

- Machines = `hero.warMachines: string[]`, achetées via `BuyWarMachine`
  (`town/war-machine.ts`, bâtiment `warMachineVendor` — la Forge **déclare**
  ses `units` dans `data/core/buildings.json:203`) ; engagées en combat comme
  piles de 1 (`combat/setup.ts`).
- Tick périodique modèle : `applyPoisonTicks` appliqué aux transitions de
  round dans `combat/turns.ts` (~`:138`), AVANT `CombatRoundStarted` (~`:157`).
- Soin plafonné : patron `lifeDrain`/`devourMarks` (`combat/damage.ts:657-700`)
  — pool = `(count−1)×hp + firstHp`, plafond `maxCount = count +
  stackLostSoFar` (relève dans la limite de l'effectif initial), `recordRevive`.
- Munitions : `CombatStack.ammo` (null = pas tireur), initial = param `ammo`
  de la capacité `shooter` du def ; décrément à `combat/actions.ts:438`.
- Une pile `immobile` ne bouge jamais (`reachableHexes` vide) ; l'IA retombe
  sur `defend` quand aucune action (`combat/ai.ts:256/354`) ⇒ machines de
  soutien inertes sans code IA nouveau.
- Schéma `warMachineSchema` (`content/schemas.ts:67`) : `damage` exige des
  entiers **positifs** ⇒ stats symboliques `[1,1]`.

## 3. Étapes

- [ ] a. **Moteur — événement** : `StackAmmoReplenished { stackId, amount }`
      dans `core/events.ts`.
- [ ] b. **Moteur — tick de soutien** (`combat/turns.ts`) : à chaque
      transition de round (même point que le poison, juste après
      `CombatRoundStarted`), pour chaque pile vivante portant :
      - `healPerRound { amount }` ⇒ soigner la pile **alliée** la plus blessée
        (manque de pool max, hors elle-même ; égalité = ordre du tableau) avec
        le patron de plafond `lifeDrain` ; émettre `StackHealed` ;
      - `replenishAmmo { amount }` ⇒ pour chaque tireur allié à munitions
        entamées, `ammo = min(initial, ammo + amount)` ; émettre
        `StackAmmoReplenished` (montant réellement rendu).
      Round 1 : pas de tick (comme le poison — les transitions seulement).
- [ ] c. **Données** : `data/core/war-machines.json` + `first-aid-tent`
      (hp 75, `[1,1]`, immobile, `healPerRound {amount: 30}`, ~1000 or) et
      `ammo-cart` (hp 100, `[1,1]`, immobile, `replenishAmmo {amount: 6}`,
      ~1000 or) ; Forge (`buildings.json → warMachineVendor.units`) vend les
      deux ; `abilities.json` décrit les 2 capacités (nom/desc UI).
- [ ] d. **Locales FR/EN** : noms des 2 machines (`warMachine.<id>.name`),
      nom/desc des 2 capacités, ligne de journal `combatLog.ammoReplenished`.
- [ ] e. **Client** : case `StackAmmoReplenished` dans `app/combat-log.ts`
      (le reste — vente Forge, rendu de pile, fiche — est déjà générique).
- [ ] f. **Doc** : `docs/02-mechanics.md` §5 (machines de guerre) — les 2
      entrées + la règle du tick de round.
- [ ] g. **Tests** (skill `test-authoring` : unitaires moteur, pas de smoke —
      aucune surface UI nouvelle) : nouveau `war-machine-support.test.ts` —
      tente soigne la pile la plus blessée au round 2 (plafond effectif
      initial respecté, pas de cible ⇒ pas d'événement) ; chariot recharge au
      plafond initial ; pile sans ces capacités ⇒ aucun changement.
- [ ] h. **Vérifs standard** : typecheck, lint, moteur (golden inchangé),
      contenu (parité locales), garde-fou « zéro faction », budget, smoke
      `@core` non-régression.

## 4. Hors périmètre

- IA d'achat des machines de soutien (l'IA achète-t-elle à la Forge ? état
  actuel conservé) ; positionnement dédié des machines sur la grille ;
  upgrade/niveaux de machines ; FX de soin dédié (le popup vert `StackHealed`
  existe déjà).

## 5. Risques

| Risque | Mitigation |
|---|---|
| Golden cassé | capacités portées par AUCUNE unité existante ; si le golden bouge, l'opt-in fuit — corriger, pas re-fixer |
| Double soin/duplication du patron de plafond | le tick réutilise le patron exact `lifeDrain` (pool/maxCount/recordRevive) ; extraction d'un helper commun NON faite (3 sites → refactor hors périmètre, noté) |
| La tente se soigne elle-même en boucle | cible = pile alliée **autre** qu'elle-même |
| Machine morte qui agit | tick gaté `count > 0` |

## 6. Suivi

- [x] Plan rédigé (2026-07-17)
- [x] a→f implémentés — `StackAmmoReplenished` (events), `applySupportTicks`
      dans `combat/turns.ts` (appelé après `CombatRoundStarted`, patron
      `applyPoisonTicks`), 2 machines + Forge + capacités (data, formatage
      d'origine préservé), locales FR/EN (machines, capacités, journal), case
      journal client, doc 02 §5.
- [x] g tests verts — `war-machine-support.test.ts` (4 cas : cible la plus
      blessée + plafond de pool + bascule de cible, ni ennemi ni soi-même,
      recharge plafonnée à la réserve initiale + ennemi jamais servi, opt-in
      bit-identique sans capacité).
- [x] h vérifs — typecheck ✅ lint ✅ moteur 846/846 (golden inchangé) ✅
      contenu 148/148 (parité locales) ✅ `content:check` ✅ garde-fou
      « zéro faction » ✅ budget 328 Ko/800 Ko gzip ✅ smoke `@core` 19/19 ✅.
