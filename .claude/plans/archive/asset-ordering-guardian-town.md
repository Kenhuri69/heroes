# Correctif de suivi — gardiens & villes « entre quatre cases »

## Contexte
Suite de la PR #183 (mergée) qui a corrigé le jeton de héros en l'ancrant par sa
base (`anchor.set(0.5, 1)`) au lieu de son centre géométrique. Les gardiens
neutres et les villes partagent le même motif d'ancrage centré et débordent du
losange de la même façon (moins fort, mais visible — surtout la ville à 1,35 tuile).

## Cause (identique à #183)
Sprite ancré par son centre et posé sur le centre du losange de la tuile : un
sprite plus haut que le losange (haut ±16 px) déborde symétriquement au-dessus et
en-dessous → il chevauche les tuiles voisines et son bas empiète sur la tuile
avant (profondeur iso `x+y` supérieure), d'où l'occlusion perçue comme un
problème d'ordre.

## Changements
- `render/mapObjects.ts` — `buildGuardian` : sprite d'unité gardienne ancré par sa
  base centrée (`anchor.set(0.5, 1)`), pieds au centre-sol de la tuile. Taille
  inchangée (`setSize(TILE_SIZE, TILE_SIZE)`).
- `render/townsLayer.ts` — `buildKeep` : château peint ancré par sa base centrée,
  base au centre-sol de la tuile. Échelle inchangée (1,35 tuile).

Repli procéduraux (fanion gardien, donjon de ville) et liseré de siège laissés
tels quels : marqueurs au sol de petite empreinte qui ne débordent pas.

## Vérification
1. `pnpm typecheck` → OK.
2. `pnpm lint` → OK.
3. `pnpm build` → OK (budget bundle tenu).
4. `pnpm smoke` (PW_CHROMIUM_PATH=chromium local) → vert (non-régression rendu carte,
   dont les tests d'assets qui affichent gardiens/villes).
