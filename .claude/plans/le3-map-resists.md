# LE3 — La carte qui résiste

> Lot LE3 du plan `game-experience-enrichment.md` (§4) : **A2** (gardiens aux
> goulots, `generatorVersion`, repli par régions) → **A3** (banques de
> créatures) → **A1** (zone de contrôle des gardiens, opt-in puis activée).
> Décisions adoptées par l'utilisateur le 2026-09-29 (§5, points 1, 2, 14) ;
> amendements de l'expert (§3.1) repris tels quels. Relevé du lot LE1 traité
> ici : garnisons démesurées des villes neutres générées.

## 1. Constat (lu dans le code)

- `generateMap` pose les gardiens de champ **au hasard** (`place`), avant même
  que la connexité ne soit creusée : ils ne gardent rien, on les contourne.
- Les villes neutres reçoivent une garnison graduée comme un gardien de fond de
  carte (`8 + depth × 30` créatures du tier le plus haut) : ≈ 17 700 de défense
  contre ≈ 1 800 pour une armée IA au j40 (mesure LE1) ⇒ jamais prises.
- Un gardien n'occupe que sa tuile : sans zone de contrôle, un couloir de
  2 cases suffit à le contourner.

## 2. Décisions de conception

- **`generatorVersion`** (option de `generateMap`, défaut **2**). La version 1
  reproduit à l'octet près les cartes d'avant le lot (graines partagées). Une
  sauvegarde embarque sa carte : aucun impact save.
- **A2 (v2)** : les gardiens de champ sont posés **après** la connexité, sur la
  carte finale. Environ 60 % d'entre eux vont sur les **goulots** : points
  d'articulation du graphe franchissable 8 directions (Tarjan itératif) qui
  isolent une région d'au moins `max(8, 2 %)` des tuiles. Les goulots sont triés
  par taille de la région coupée. Si les goulots manquent, le repli est la
  **frontière entre régions de départ** (tuiles à égale distance de deux départs
  à ±1, « portes gardées »). Le reste est posé au hasard sur la composante
  atteignable. Les zones ne se chevauchent pas (Tchebychev ≥ 3 entre gardiens de
  champ et tout autre gardien) et ne touchent jamais un départ (Tchebychev ≥ 3).
- **Villes neutres (v2)** : la garnison vise une armée de mi-partie : tier vu à
  `depth × 0,6` (`TOWN_GARRISON_DEPTH`), effectifs `6 + 10·depth` et `4 + 6·depth`
  (§4).
- **A3 (v2)** : une **banque** = une sentinelle forte (tier 3/4/5 selon le palier
  petite/moyenne/grande, lui-même fixé par la profondeur ; effectif ×1,5–2 d'un
  gardien de champ de même profondeur) plus 2 butins verrouillés `guardedBy` :
  un coffre d'or, puis une ressource rare (petite) ou un artefact (moyenne et
  grande ; la plus haute rareté est réservée à la grande). La banque est à usage
  unique (le butin disparaît au ramassage). Sa force se lit déjà par les bandes
  `strengthBands` du client. `neverFlee` sera ajouté avec la fuite des neutres
  (LE5) : la fuite n'existe pas encore.
- **A1** : flag `adventure.guardianZoneOfControl` (absent ⇒ comportement
  actuel). Un pas vers l'une des 8 voisines (même couche) d'un gardien est une
  **interception** : le héros paie le pas mais n'entre pas sur la tuile, comme
  pour un pas sur le gardien lui-même. Il combat le gardien visé si le pas
  suivant du chemin est ce gardien, sinon le premier par id. L'A\* entre dans une
  tuile de zone sans la traverser : seul un pas vers le but en repart, et la
  tuile de départ reste libre. Les caravanes ne sont pas concernées. L'IA ne
  vise jamais une tuile de zone, sauf celle d'un gardien qu'elle attaque. Le flag
  est **activé** dans `data/core/config.json` (LE1 et A2 livrés).

## 3. Étapes

1. [x] A2 — `generatorVersion`, articulations + repli frontières, gardiens après
   connexité, espacement, villes neutres. Tests : v1 identique à l'octet ;
   ≥ 50 % des gardiens de champ sur goulot ou porte (20 graines) ; espacement ;
   cartes valides.
2. [x] A3 — banques. Tests : sentinelle + 2 butins verrouillés, palier ↔
   profondeur, artefact de plus haute rareté réservé à la grande.
3. [x] A1 — moteur (`advanceHeroAlongPath`, `findPath`), IA, config activée,
   client (préviz). Tests : passer à côté ⇒ combat ; A\* contourne ; IA ne vise
   pas une tuile de zone ; « IA vs IA se termine ».
4. [x] Mesures (§4) et docs 02 (§2.2, §1.5), 06/09 si besoin.
5. [x] Vérifications (§5).

## 4. Mesures

**Forces générées** (64², 20 graines, palette réelle, `Σ effectif × (PV + Att + Déf)`) :

| | v1 | v2 |
|---|---|---|
| Garnison de ville neutre (min / médiane / max) | 15 672 / 17 724 / 21 582 | **1 618 / 2 005 / 2 307** |
| Gardien de goulot ou de porte (min / médiane / max) | — | 120 / 860 / 1 562 |
| Sentinelle de banque (min / médiane / max) | — | 690 / 3 392 / 5 472 |

**Part des gardiens de champ qui tiennent un goulot ou une porte** (20 graines) :
24² 54 %, 36² 57 %, 64² 61 %, 128² 60 %. Les vrais points d'articulation sont
rares sur une carte biomes (2 à 16 sur 20 cartes) : le repli « portes » fait
l'essentiel, comme l'expert l'avait prévu. Une première version sans régions
neutres tombait à 25 % en 128² (une seule frontière entre deux départs).

**Bench IA** (jetable, non commité ; 2 IA, 64², 20 graines, 60 jours, normal) :

| | Avant (v1, sans zone) | v2 + zone | v2 + zone + gardien objectif |
|---|---|---|---|
| Parties avec un combat entre joueurs | 17/20, médiane j38 | 10/20, j33 | **12/20, j36** |
| Villes de joueur capturées | 3/20 | 4/20 | **5/20** |
| Parties conclues en 60 jours | 12/20 | 15/20 | 15/20 |

La colonne du milieu a révélé un trou (écart §2) : sans objectif « gardien
dominé », une porte gardée fermait la carte à l'IA. Elle vise désormais un
gardien dominé à ≤ 3 jours (valeur 3, entre la mine et rien). Les rencontres se
font un peu plus rarement qu'avant, ce qui est voulu : la carte résiste. Les
villes tombent en revanche plus souvent.

**Hors périmètre, relevé pour la suite** :
- dans 4 parties sur 20, une IA perd son héros de départ contre un gardien avant
  le j21, donc la partie (`defeatHero`). C'était déjà le cas 3 fois sur 20 avant
  le lot. L'IA évalue les forces par `armyStrength` (PV + Att + Déf), qui
  sous-estime un haut tier : 5 Minotaures élites battent 40 T1/T2 à « 2× » de
  force. À traiter avec **LE5** (division des piles) et **LE6** (fuite).

## 5. Vérifications

- [x] `pnpm typecheck` · `pnpm lint` verts
- [x] `pnpm test` — moteur **1050** (+6 `guardian-zone.test.ts`), contenu **193** (+6), client 109, serveur 10 ; **golden inchangé** (fixtures sans la règle)
- [x] `pnpm content:check` vert ; garde-fous faction et couleurs verts
- [x] `pnpm build` + budget : **379 972 o gzip**
- [x] smoke `@core` desktop + mobile **56/56** — le test « victoire contre le gardien »
  attendait le héros sur la case voisine du gardien : avec la zone, il s'arrête
  une case avant. Attente mise à jour, ainsi que dans le parcours `@e2e` (combat puis
  rechargement), repéré par la CI ; suite complète hors `@core` rejouée : 86/86.

## 6. Journal

- 2026-09-30 : plan ouvert. PR #552 (LE2) encore ouverte ⇒ LE3 empilé sur la
  même branche.
- 2026-09-30 : A2, A3, A1 livrés. Écarts : régions neutres ajoutées au repli
  « portes » ; gardiens de goulot/porte ramenés à l'échelle de mi-partie (au
  tarif du fond de carte, la porte entre deux départs enfermait chaque joueur) ;
  banques gardées hors des abords des départs et sous le plafond de tier de la
  profondeur ; objectif IA « gardien dominé » ajouté (bench §4).
