# Lot C-SIEGE2.1 — murs de siège (grille bloquante avec porte)

> Backlog §2.1 C-SIEGE2 (siège v2), incrément **(a)** « murs/porte comme
> obstacles sur la colonne de grille ». Premier sous-lot du système de siège v2.
> Doc 02 §5/§4.1. La destructibilité + catapulte (incrément b) = **C-SIEGE2.2**.

## Décision de décomposition

`C-SIEGE2` est un lot **L**. Découpage :
- **.1 (ce lot)** : murs de siège **bloquants** sur une colonne, avec une
  **porte** (ouverture) — chokepoint tactique. **Non destructibles** pour l'instant.
- **.2** : catapulte (machine de guerre) + destruction de segments de mur (PV).
- **.3** : tour de tir (pile défenderesse fixe). **.4** : douves (ralentissement).

## Spec (incrément a)

- Une ville avec **Fort** (`buildings.fort ≥ 1`) assiégée dresse un **mur** :
  segments d'obstacle sur une colonne devant le défenseur, laissant une **porte**
  (2 rangées ouvertes au centre). Le mur **bloque déplacement + ligne de vue**
  (comme un obstacle) ; les **volants** le survolent, les **tireurs** tirent par
  la porte, la **mêlée** s'y engouffre. Ville **sans Fort** ⇒ pas de mur (le
  siège v1 est inchangé — `neutral-keep` du smoke n'a pas de Fort).
- **Générique, zéro faction.** Champ **OPTIONNEL** `CombatState.siegeWalls?`
  ⇒ **pas de bump save** (save-shape ne garde que HeroState/CombatStack) et
  **golden inchangé** (le combat golden est un gardien, pas un siège).

## Changements

- `combat/types.ts` : `CombatState.siegeWalls?: OffsetPos[]`.
- `combat/setup.ts` : `beginTownCombat` reçoit `fortLevel` ; `buildSiegeWalls`
  (mur colonne `WALL_COL` avec porte, gaté `fortLevel ≥ 1`) ; pose `siegeWalls`.
- `combat/actions.ts` : `reachableHexes` + `hasLineOfSight` incluent les murs
  dans l'ensemble bloqué (helper `staticBlockedKeys`).
- `hero/index.ts` : `teleportDestinations` inclut les murs dans le bloqué.
- `town/capture.ts` : passe `town.buildings.fort` à `beginTownCombat`.
- Client `CombatScene` : rend les murs comme bloqueurs (union dans l'ensemble
  `obstacles` de `drawBoard`) — art de rempart distinct = polish .2.
- Doc 02 §5 (état siège v2 .1) + backlog C-SIEGE2.

## Vérification

- tests moteur `combat-siege-walls` : Fort ⇒ murs posés ; un hex de mur est
  **inatteignable** ; la **porte** est atteignable ; un assaillant fort **gagne
  quand même** en auto-combat (pas de blocage/stalemate). town-siege inchangé.
- typecheck 5/5 · lint · content · golden **inchangé** · pas de bump save ·
  garde-fous · build + bundle · smoke (siège `neutral-keep` sans Fort ⇒ non régressé).

## Journal

- 2026-07-12 — Plan créé, branche `claude/c-siege2-walls` depuis main (@0d60b10).
- 2026-07-12 — **Implémenté**. Moteur : `CombatState.siegeWalls?` (optionnel) ;
  helper partagé `staticBlockedKeys` (obstacles + murs) branché dans
  `reachableHexes`/`hasLineOfSight`/`teleportDestinations` ; `buildSiegeWalls`
  (rempart colonne `COMBAT_COLS-4` + porte centrale, gaté `fort ≥ 1`) ;
  `beginTownCombat` reçoit `fortLevel` (passé par `capture.ts`). Client :
  `CombatScene.blockedKeys` rend les murs comme bloqueurs (4 sites drawBoard).
  Doc 02 §5 (état v2 .1) + backlog. **Vérifs** : typecheck 5/5 ✅, lint ✅, engine
  **659** (+4 `town-siege` murs, dont « assaillant fort capture malgré le
  rempart » = pas de stalemate) ✅, golden + save-shape **inchangés** (champ
  optionnel CombatState) ✅, content 123 + content:check ✅, garde-fous ✅, build +
  bundle 307 Ko gzip ✅. Smoke en cours (siège `neutral-keep` sans Fort ⇒ non
  régressé). Zéro faction, pas de bump save.
