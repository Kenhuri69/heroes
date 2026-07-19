# Siège S8 — popups de dégâts repositionnés & durée liée au jeton

Dernier item **client-only** de la vague 1 de `siege-visual-remediation.md`.
Purement présentation (aucun moteur, aucune donnée, pas de bump save).

## Constat

Les chiffres flottants de dégâts (`spawnDamageNumber`) apparaissaient à
`-TOKEN_RADIUS·0.6` au-dessus du centre du jeton — soit **sur le corps du
sprite**, recouvrant le badge d'effectif (posé à `+TOKEN_RADIUS·1.15`) et
frôlant les jetons voisins. De plus, quand une pile mourait, son popup
continuait de planer ~700 ms au-dessus d'une **case vide** (jeton déjà retiré
par `animateDeath`).

## Changements

- **S8.1** — nouvelle constante `POPUP_HEAD_OFFSET = TOKEN_RADIUS·1.55` :
  `spawnDamageNumber` **et** `spawnFloatingLabel` (esquive/soin/maudit/peur)
  montent désormais au-dessus de la tête du sprite. → verify: typecheck +
  smoke combat (aucun chevauchement badge/voisin).
- **S8.2** — `spawnDamageNumber` accepte un `token?: Container` optionnel ;
  dès que le jeton est détruit pendant le vol (la pile meurt), le fondu du
  popup orphelin est **écourté** (~120 ms via `orphanFrom`) au lieu de tenir
  700 ms. Câblé à tous les sites qui disposent du jeton cible (frappe,
  MoatDamaged, SpellCast, UnitSpellCast, HeroStruck). → verify: typecheck +
  smoke.

## Vérification

- [ ] typecheck / lint verts
- [ ] engine / content / client vitest verts
- [ ] build + budget bundle ≤ 800 Ko gzip
- [ ] garde-fous faction / couleurs verts
- [ ] smoke @core (desktop) + @mobile
- [ ] golden inchangé (zéro moteur)

## Différés (inchangés)

S2.2 (overlay mur fissuré, asset), S3.3 (lecture dégâts de douve en préviz de
déplacement), S5b (point moteur), S-TEST (harnais de smoke siège partagé).
