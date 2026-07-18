# UX-ENDSTATS suite — pertes cumulées (Lot 7.3, I-endstats)

> Le seul **point moteur** du plan ergonomie/immersion. L'overlay de fin affiche
> durée/avoirs mais PAS les pertes cumulées : les compter côté client mécompterait
> (les `CombatEnded` ne portent pas le joueur). On les suit **côté moteur** au
> commit du combat, où la carte camp→joueur est connue. **Feu vert utilisateur**
> pour le **bump de sauvegarde** + re-fix golden.

## Moteur
- `PlayerState.unitsLost: number` (cumul d'unités perdues en combat), défaut 0 à
  toute création de joueur. **Bump `CURRENT_SAVE_VERSION` 35 → 36** + changelog.
- `turns.ts resolveCombatEnd` : après `collectCasualties` (AVANT `applyConsequences`
  qui retire le vaincu), attribuer les pertes de chaque **camp** au **joueur** de
  ce camp (`attackerHeroId`/`defenderHeroId` → `hero.playerId`). Camp neutre
  (gardien, sans héros) ⇒ non attribué. Générique, zéro faction, zéro `if`.
  ⇒ résout le mécompte IA-vs-IA (chaque camp a son joueur) documenté à l'origine.
- Golden re-fixé une fois (forme + valeurs de pertes du replay).

## Client
- `OutcomeOverlay` `StatsSummary` : ligne **« Unités perdues »** = `unitsLost` du
  joueur humain (remplace la note « différé »). Locale `outcome.unitsLost` FR/EN.

## Vérification
- **Unitaire moteur** : combat où le joueur perd N unités ⇒ `player.unitsLost === N` ;
  pertes d'un gardien neutre **non** comptées ; hero-vs-hero ⇒ les deux joueurs comptés.
- `save-shape.test` : la forme v36 (champ requis) tient.
- Golden re-fixé (une fois).
- Client : smoke fin de partie affiche la ligne pertes.
- typecheck · lint · engine (golden re-fixé) · content · client · build · bundle ·
  smoke @core + mobile · gardes.

## Journal
- [x] `PlayerState.unitsLost?` **OPTIONNEL** (absent ⇒ 0) — suit la convention du
      codebase (obelisksVisited?/hasGrail?) pour éviter la churn des états
      construits à la main ET rendre une sauvegarde antérieure valide ⇒ **PAS de
      bump `CURRENT_SAVE_VERSION`** (revu vs le plan initial : le bump n'était pas
      nécessaire, un champ optionnel suffit). Init `unitsLost: 0` aux 2 sites réels
      (engine.ts StartGame, simulate.ts). Changelog « sans bump » ajouté.
- [x] `turns.ts resolveCombatEnd` : `accumulateUnitsLost` attribue les pertes de
      chaque camp au joueur du héros lié, AVANT `applyConsequences` (le vaincu peut
      être retiré). Camp neutre (gardien) non attribué. Générique, zéro faction.
- [x] Unitaire moteur `combat-units-lost.test` (2 tests : gardien ⇒ attaquant compté
      / neutre exclu ; héros-vs-héros ⇒ les deux joueurs comptés). save-shape OK.
      **Golden re-fixé une fois** `a4a17d37 → 5d4260d7` (pertes du replay).
- [x] Client `StatsSummary` ligne « Unités perdues » (`unitsLost ?? 0`) + i18n
      `outcome.unitsLost` FR/EN + smoke (ligne affichée). Recette : typecheck · lint ·
      **engine 920** (golden re-fixé) · content 154 · client 27 · build · bundle
      345 881 ≤ 819 200 · smoke @core 34 + mobile 13 · gardes faction/couleurs propres.
