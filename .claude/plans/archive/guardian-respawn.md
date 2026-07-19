# Plan — Lot 3.4 (doc 18) : respawn de gardiens (A2b)

> **Statut** : ✅ livré (2026-07-17).
> Écart couvert : **A2b** (doc 18 §2.A) — « respawn optionnel façon MMHO :
> champ optionnel `respawnDays` sur le gardien ; les gardes réapparaissent
> après un délai pour re-farmer (scénarios survival, quotidiennes).
> Config absente ⇒ comportement inchangé ». Dernier lot de l'Étape 3.

## 0. Objectif & critère de sortie

Un gardien doté de `respawnDays: N` (données de carte, opt-in) **réapparaît
N jours après sa disparition** (vaincu par un héros, ou anéanti mutuellement),
au même endroit, avec son **effectif d'avant le combat** — et la croissance
hebdo (`guardianGrowth`) reprend sur lui comme sur tout gardien vivant.

**Critères mesurables** (unitaires moteur) :
- gardien `respawnDays: 2` vaincu au jour J ⇒ absent aux jours J+1 ;
  présent au jour J+2 (même id, même pos, effectif pré-combat) ;
- gardien **sans** `respawnDays` vaincu ⇒ ne réapparaît jamais ET l'état ne
  gagne aucun champ (`map.respawns` jamais créé — bit-identique, golden intact) ;
- tuile occupée (héros) au jour dû ⇒ réapparition **reportée** au premier
  jour où la tuile est libre ;
- anéantissement mutuel (B17, gardien retiré à 0) ⇒ respawn aussi, avec
  l'effectif **pré-combat** (pas 0).

## 1. Périmètre & décisions

- **File d'attente lazy sur la carte** : `AdventureMapDef.respawns?:
  { day, object }[]` — champ optionnel jamais créé si aucun gardien n'a de
  `respawnDays` (précédent `grailPos?`/Calendar : les objets de carte ne sont
  PAS sous la garde Exact de `save-shape.test`) ⇒ **pas de bump
  `CURRENT_SAVE_VERSION`**, sérialisation gratuite (la carte est déjà dans
  l'état).
- **Effectif restauré = pré-combat** (post-croissance hebdo), pas l'effectif
  initial de la carte : le snapshot est pris au retrait, quand `count` porte
  encore la valeur d'avant le combat (le retrait victoire lit `count` APRÈS
  la récompense, qui le lit intacte ; le retrait « remnants à 0 » capture la
  valeur avant écrasement).
- **Réapparition au changement de jour** (bloc jour d'`advanceSeat`, entre
  `fireDayTriggers` et `roamGuardians`) — ordre déterministe (file FIFO),
  aucune consommation RNG.
- **Tuile occupée** (héros ou autre objet — un errant a pu dériver dessus) ⇒
  l'entrée reste en file et réessaie chaque jour.
- **Zéro nouvel événement, zéro diff client** : `MapObjectsLayer.sync` est
  diff-based (objet réapparu ⇒ reconstruit) ; le retrait l'était déjà.
- **Aucune donnée de carte modifiée** : `proto-01` est PARTAGÉE par tous les
  scénarios/campagnes — y poser `respawnDays` changerait leur difficulté en
  douce. Le champ est offert aux auteurs de cartes (schéma + doc) ; le
  câblage d'un scénario survival dédié = décision de design ultérieure.
- `guardedBy` : un gardien réapparu re-garde naturellement les ramassables
  survivants liés à son id (test dynamique par id — aucune donnée à toucher).

## 2. État des lieux (points d'ancrage vérifiés)

- `GuardianObjectDef` (`adventure/map.ts:30`) — `roamRadius?` = précédent du
  champ optionnel opt-in.
- Retraits du gardien : victoire `combat/turns.ts:396-397` (count encore
  pré-combat) ; remnants à 0 `persistDefenderRemnants` (`:437-447`, count
  écrasé AVANT le splice ⇒ capturer avant).
- Bascule de jour : `core/engine.ts advanceSeat` (`:893-997`) —
  `fireDayTriggers` puis `roamGuardians`.
- Validation StartGame des gardiens : `core/engine.ts:491-496` (idiome
  `roamRadius`).
- Schéma gardien : `content/src/schemas.ts:999-1007` ; résolution :
  `loader.ts:1443-1451` (+ type `ResolvedMapObject:964-972`).
- Client : `render/mapObjects.ts sync` — diff-based, rien à faire.

## 3. Étapes

- [x] a. **Types moteur** (`adventure/map.ts`) : `respawnDays?` sur
      `GuardianObjectDef` ; `respawns?: { day: number; object:
      GuardianObjectDef }[]` sur `AdventureMapDef`.
- [x] b. **Module** `adventure/respawn.ts` : `queueGuardianRespawn(draft,
      guardian, count)` (no-op sans `respawnDays`) +
      `respawnDueGuardians(draft)` (réapparition des entrées dues sur tuile
      libre, report sinon).
- [x] c. **Câblage retraits** (`combat/turns.ts`) : victoire (avant le
      splice) + remnants (capture du count avant écrasement).
- [x] d. **Câblage jour** (`core/engine.ts`) : appel entre `fireDayTriggers`
      et `roamGuardians` (un revenant peut roamer le jour même) ; validation
      StartGame `respawnDays > 0` (idiome `roamRadius`).
- [x] e. **Contenu** : schéma (`respawnDays` int positif optionnel) + type et
      copie dans `loader.ts` ; test loader étendu (gardien `errant`, 152/152).
- [x] f. **Tests moteur** (`test/guardian-respawn.test.ts`, 5 tests) : les 4
      critères du §0 + rejet StartGame `respawnDays ≤ 0` (patron
      `combat-guardian.test.ts`, jours avancés par `EndTurn`).
- [x] g. **Docs** : doc 02 §2.2 (note gradation/croissance — « différé »
      remplacé par l'état livré). **Écart au plan** : doc 18 non annotée —
      les fiches y sont des instantanés d'audit, aucun lot précédent
      (2.2→3.3) n'y a coché sa ligne ; on garde cette convention.
- [x] h. **Vérifs standard** : typecheck ✅ lint ✅ moteur **866/866** (+5,
      golden inchangé — champ lazy jamais créé sans donnée) ✅ contenu
      152/152 ✅ `content:check` ✅ garde-fou faction ✅ budget 330 Ko/800 Ko ✅
      smoke `@core` 19/19 ✅. Aucun smoke dédié (mécanique moteur opt-in
      qu'aucune donnée livrée n'exerce — couverture unitaire, guideline §7).

## 4. Hors périmètre

- Poser `respawnDays` sur `proto-01` ou un scénario existant (carte partagée
  — cf. §1) ; respawn avec effectif escaladant (le `guardianGrowth` hebdo
  s'en charge déjà une fois le gardien revenu) ; respawn d'autres types
  d'objets (ressources/trésors — non demandé).

## 5. Risques

| Risque | Mitigation |
|---|---|
| Fuite de forme d'état (golden/save) | champ lazy jamais créé sans `respawnDays` ; test « sans config ⇒ pas de champ » |
| Respawn sur une tuile devenue occupée | report quotidien tant que la tuile n'est pas libre |
| Effectif 0 restauré (chemin remnants) | capture du count AVANT l'écrasement ; test B17 dédié |
| Doublon d'id à la réapparition | l'entrée n'est queueée qu'au retrait effectif de l'objet |

## 6. Suivi

- [x] Plan rédigé (2026-07-17)
- [x] a→h livrés (2026-07-17) — voir coches du §3. Décision notable : le
      snapshot restauré garde `respawnDays` ⇒ le revenant est lui-même
      re-farmable (boucle survival voulue) ; la file conserve l'ordre FIFO
      (déterminisme, zéro RNG).
