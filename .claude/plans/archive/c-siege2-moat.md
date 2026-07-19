# Lot C-SIEGE2.3 — douves (zone de ralentissement du siège)

> Suite de C-SIEGE2.1 (murs) + .2 (catapulte). Incrément **(d)** du backlog §2.1 :
> « douves = zone de ralentissement ». Doc 02 §5. Une ville **bien fortifiée**
> (Fort ≥ 2) ajoute une **douve** devant le rempart : on peut y entrer mais pas
> la traverser d'un seul déplacement (elle coûte un tour à franchir).

## Décision de portée

Modèle **simple et sûr** : la douve est une **colonne d'hexes** juste devant le
rempart (`SIEGE_WALL_COL - 1`). Un hex de douve est **atteignable** (on peut s'y
arrêter) mais **non traversable** en un mouvement (le BFS ne prolonge pas
au-delà) ⇒ franchir la douve coûte un tour de plus. Les **volants** l'ignorent
(ils ne pathent pas). La douve ne bloque **pas** la ligne de vue (ce n'est pas
un mur). Gatée **Fort ≥ 2** (progression : Fort 1 = murs, Fort 2+ = murs +
douve). Dégâts de douve (comme HoMM) = raffinement ultérieur.

## Changements

- `combat/types.ts` : `CombatState.moat?: OffsetPos[]` (optionnel ⇒ pas de bump
  save, golden inchangé).
- `combat/setup.ts` : `buildMoat(fortLevel)` (colonne devant le mur, gatée
  `fort ≥ 2`) ; `beginTownCombat` pose `combat.moat`.
- `combat/actions.ts` `reachableHexes` : un hex de douve est ajouté à
  l'atteignable mais **non ré-exploré** (on ne path pas à travers). Non-siège
  (`moat ?? []` vide) ⇒ BFS inchangé.
- Client `hexgrid.drawBoard` : nouvel ensemble `moat` (teinte « fossé » distincte) ;
  `CombatScene` le passe depuis `combat.moat`.
- Doc 02 §5 (état v2 .3) + backlog C-SIEGE2.

## Vérification

- tests moteur `town-siege` : Fort ≥ 2 ⇒ douve posée (Fort 1 ⇒ aucune) ; un hex
  de douve est atteignable mais **on ne peut pas la traverser d'un coup** ; un
  assaillant fort capture quand même (pas de stalemate). typecheck 5/5 · lint ·
  golden + save-shape **inchangés** · content:check · garde-fous · build + bundle ·
  smoke non régressé. Pas de nouveau smoke (mécanique de déplacement = unitaire).

## Journal

- 2026-07-12 — Plan créé, branche `claude/c-siege2-moat` depuis main (@ef989ae).
- 2026-07-12 — **Implémenté**. Moteur : `CombatState.moat?` (optionnel) ;
  `buildMoat(fortLevel)` (colonne `SIEGE_WALL_COL-1`, gatée Fort ≥ 2) ;
  `beginTownCombat` pose `moat` ; `reachableHexes` — un hex de douve est
  atteignable mais non ré-exploré (franchir = un tour). Client : `drawBoard`
  gagne `moat` (teinte `FILL_MOAT`), `CombatScene.moatKeys` passé aux 3 rendus.
  Doc 02 §5 (état v2 .3) + backlog. **Vérifs** : typecheck 5/5 ✅, lint ✅, engine
  **668** (+3 `town-siege` douve, dont « atteignable mais infranchissable d'un
  coup » et pas de stalemate) ✅, golden + save-shape **inchangés** ✅, content 125
  + content:check ✅, garde-fous faction/couleurs ✅, build + bundle 307 Ko gzip ✅.
  Zéro bump save. Smoke en cours (non régressé).
