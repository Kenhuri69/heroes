# Correctif — jeton de héros « entre quatre cases » + problème d'ordre

## Symptôme (retour utilisateur, capture mobile)
Le sprite de héros monté sur la carte d'aventure semble posé à l'intersection
de plusieurs cases (pas sur UNE case) et paraît mal ordonné vis-à-vis des objets
de premier plan (un objet le recouvre au niveau du bas du corps).

## Cause
`AdventureScene.buildHeroToken` ancre le sprite par son **centre géométrique**
(`anchor.set(0.5)`) et le pose sur le **centre du losange** de la tuile. Le
sprite (~1,25 tuile ≈ 80 px) déborde alors symétriquement de ~24 px au-dessus et
en-dessous du losange (haut ±16 px) → il chevauche les tuiles voisines
(« entre quatre cases ») et son bas empiète sur la tuile avant (profondeur iso
`x+y` supérieure), d'où l'occlusion perçue comme un problème d'ordre.

La convention correcte est déjà appliquée aux props de relief
(`render/terrainProps.ts` : `anchor.set(0.5, 1)`, base au sol) : le sprite se
dresse depuis le sol au lieu d'être centré dessus.

## Changement
`buildHeroToken` : ancrer le sprite par sa **base centrée** (`anchor.set(0.5, 1)`)
et poser cette base sur le **centre-sol de la tuile** (`TILE_SIZE/2`, `TILE_SIZE/2`).
Le héros se tient alors sur sa case, l'anneau de sélection (ellipse au sol,
centrée tuile) l'entoure aux pieds, et son empreinte visuelle coïncide avec sa
profondeur iso → l'ordre d'affichage redevient cohérent.

Échelle inchangée (1,25 tuile) : le héros « occupe » toujours sa case et déborde
un peu vers le haut, comme dans HoMM.

## Vérification
1. `pnpm typecheck` → pas d'erreur. 
2. `pnpm build` client → OK.
3. Smoke Playwright (`pnpm test` / smoke) → vert (non-régression rendu carte).
4. Contrôle visuel : le héros se tient sur sa case, anneau aux pieds.

## Portée / hors périmètre
- Correctif limité au jeton de héros (asset signalé).
- Gardiens neutres (`mapObjects.buildGuardian`, sprite 1× centré) et ville
  (`townsLayer`, 1,35× centrée) partagent le même motif d'ancrage centré mais
  débordent moins ; non modifiés ici — à traiter en suivi si souhaité.
- Repli procédural `buildHeroSprite` (petit écusson plat centré) laissé tel quel :
  marqueur au sol, ne déborde pas.
