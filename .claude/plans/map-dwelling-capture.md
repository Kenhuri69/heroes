# M-DWELLOWN — habitations de carte capturables (doc 02 §2.2)

> « go next » autonome. Item S du backlog. Les habitations hors ville
> deviennent **possédables** (drapeau du joueur qui les foule) avec **réassort
> hebdomadaire réservé au propriétaire**, façon HoMM. Miroir du pattern mine.

## Changements (livré)
- `DwellingObjectDef.ownerId: string | null` (save v18, golden re-fixé 6fa5044c).
- `movement.ts` : fouler une habitation ⇒ `ownerId = player.id` + `revealStructure`
  (drapeau + vision), puis recrutement (inchangé). Recapturable.
- `economy.ts` : `applyWeeklyGrowth` gardé sur `!obj.ownerId` ⇒ seule une
  habitation possédée réassort ; neutre = stock initial figé.
- `vision.ts` : habitation possédée révèle son voisinage (comme la mine).
- `loader.ts` : résolution JSON→moteur pose `ownerId: null` (+ type ResolvedMap).
- Client `render/mapObjects.ts` : `ownerFlag` partagé (mine + habitation), passé à
  `buildDwelling` ; signature de recapture inclut `dwelling:<ownerId>`.
- Doc 02 §2.2 mis à jour ; backlog M-DWELLOWN ✅.

## Vérif
- Tests moteur 455 (capture, croissance neutre=figée vs possédée=+croît, recruit).
- Content 101 (forme résolue du dwelling avec ownerId).
- typecheck / lint / build OK ; smoke : drapeau du joueur après visite du camp.
- Garde « zéro faction » vert (ownerId = id de joueur opaque).
