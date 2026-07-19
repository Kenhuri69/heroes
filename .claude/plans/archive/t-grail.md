# T-GRAIL — Graal & obélisques (épic, 3 lots)

Doc 02 §2.2/§4.1 (post-MVP, méta-puzzle — design libre, validé utilisateur « go grail »).
Design: obélisques (tous visités => révèle la tuile du Graal) ; Dig sur la tuile => obtient le Graal ;
bâtiment Graal constructible si possession, effet majeur via effets EXISTANTS (growthBonus/income), data par faction.

## Lot 1 — Obélisques + grailPos + révélation (CE LOT)
Moteur:
- map.ts: ObeliskObjectDef {id,type:obelisk,pos} + union ; AdventureMapDef.grailPos: GridPos|null.
- PlayerState.obelisksVisited: string[] (ids, dedup). Helper grailRevealed(player,map)= visited>=total obélisques.
- movement: fouler un obélisque ajoute son id (idempotent) + event ObeliskVisited{visited,total}.
- content schemas: obelisk + grailPos ; loader propage (TEST de propagation).
- mapgen + resolveGeneratedMap: poser N obélisques (par taille) + choisir grailPos seedé ; proto-01 idem (data).
- CURRENT_SAVE_VERSION 30->31 (migration/guard) ; golden re-fixé.
Client:
- rendu obélisque (map prop, repli procédural) ; MapObjectCard obélisque ; toast X/N ; marqueur Graal quand révélé ; i18n FR/EN.
Verif: typecheck lint vitest(engine golden re-fix + content propagation) content:check gardes build bundle smoke.

## Lot 2 — Dig + obtention (à venir)
## Lot 3 — bâtiment Graal (données + gate hasGrail) (à venir)

## Notes Lot 1 (livré)
- Champs optionnels (obelisksVisited?/grailPos?) => zéro churn fixtures ; save v30->31 ; golden re-fixé (e43b1f7e->01e60459, saveVersion seul).
- Client: rendu obélisque (buildObelisk), MapObjectCard obélisque, toast progression/révélation, locales FR/EN.
- MARQUEUR Graal visuel REPORTÉ au Lot 2 (avec Dig — il y devient actionnable) ; Lot 1 = mécanique + toast de révélation.
- Data: proto-01 (3 obélisques + grailPos) ; mapgen (obélisques scalés + grailPos, connectés).
- Tests: engine map-grail (3), content propagation (loadMap), smoke (visite obelisk-1).

## Lot 2 (livré)
- Commande Dig (validate+handler), PlayerState.hasGrail? (save v31->v32, golden re-fixé 01e60459->04cb6e08), event GrailFound.
- Client: bouton Fouiller (TurnBar, gaté hero-sur-grailPos-révélé), marqueur Pixi buildGrailMarker sur grailPos révélé, toast GrailFound, locales FR/EN, CSS .dig-grail (tokens).
- proto-01 grailPos -> (6,6) atteignable pour smoke intégration.
- Tests: engine map-grail (+3 Dig), smoke lot2 (MoveHero->Dig->hasGrail).
- Reste Lot 3: bâtiment Graal (données par faction + gate hasGrail, effets existants).

## Lot 3 (livré)
- Point extension générique BuildingDef.requiresGrail (schema content + moteur + loader propagé + test).
- validateBuildStructure gate grailRequired si !player.hasGrail.
- Data: core building grail (uniquePerPlayer, effet growthBonus 100%, requires townHall@1, cost {}).
- Client: gate affichage BuildTab + townViewStatus (grailLocked), message town.requiresGrail, cmdError.grailRequired.
- PAS de bump save (hasGrail deja v32, requiresGrail optionnel), golden INCHANGE.
- Tests: engine town-build (+1 gate), content loader (+1 propagation), smoke lot3 (verrouille -> Dig -> constructible).
- Epic T-GRAIL COMPLET (lots 1-3). Différé: effets Graal par faction (données).
