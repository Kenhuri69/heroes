# Siège S7 — pré-combat « Siège » & repli du médaillon de héros

Lot **client-only** de `siege-visual-remediation.md` (vague 3, partie UI). Zéro
moteur, zéro donnée de gameplay, pas de bump `CURRENT_SAVE_VERSION`, golden
inchangé. Répond aux constats doc 19 §3.2 et §3.3.

## Constats (doc 19)

- **§3.3** : l'écran pré-combat d'un **siège** est indistinct d'un combat de
  plaine — titre générique « COMBAT », défenseur nommé d'après la pile
  dominante, aucune mention des défenses de la ville, alors que le moteur
  possède déjà `combat.townId`, `siegeWalls`, `moat`, la tour et `fort`.
- **§3.2** : le **médaillon de héros** en combat tombe sur un **disque noir nu**
  quand l'avatar n'existe pas (toute faction sans planche d'avatars).

## Changements

- **S7.1/S7.2 — `PreBattleScreen.tsx`** : si `combat.townId` résout une ville,
  titre **« Siège de {faction} »** (`preBattle.siegeTitle`), blason de la
  faction **de la ville** en priorité, et une `<ul>` de défenses :
  *Fort niv. N* + *Rempart* / *Douve* / *Tour de tir* selon l'état
  (`town.buildings.fort`, `combat.siegeWalls?.length`, `combat.moat?.length`,
  pile `defender-tower`). 4 clés locales FR/EN + styles CSS (tokens uniquement).
  → verify: siège ⇒ titre + défenses ; combat de plaine inchangé ; typecheck.
- **S7.3 — `CombatScene.buildHeroTokens`** : le repli du médaillon dessine
  désormais **l'initiale du héros** (`resolveHeroName` → 1ʳᵉ lettre) au centre ;
  l'avatar chargé plus bas la recouvre. Helper `heroInitial`. → verify:
  typecheck + smoke (héros test-faction sans avatar ⇒ initiale, pas disque nu).

## Vérification

- [ ] typecheck / lint verts
- [ ] engine / content / client vitest verts
- [ ] build + budget bundle ≤ 800 Ko gzip
- [ ] garde-fous faction / couleurs verts
- [ ] smoke @core desktop + mobile
- [ ] golden inchangé (aucun fichier moteur touché)

## Notes

- Le repli d'avatar du **pré-combat** utilisait déjà `FactionBadge` (héros ET
  défenseur) : S7.3 ne concernait donc que le **jeton de combat** (§3.2 nomme
  bien `buildHeroTokens`).
- `'defender-tower'` est l'id de slot structurel posé par `combat/setup.ts`
  (jamais un id de faction) — détection de la tour sans dupliquer la logique
  `fortLevel`/catalogue.
