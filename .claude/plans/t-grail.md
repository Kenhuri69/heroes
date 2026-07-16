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
