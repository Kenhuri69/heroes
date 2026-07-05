# 12 — Guide de style des assets générés

> Source de vérité pour la **génération d'images** du jeu : tuiles, icônes,
> sprites d'unités, avatars, bâtiments, fonds, logo. Méthode héritée du projet
> Hogwarth (`kenhuri69/hogwarth` — `IMG_STYLE.md`,
> `tools/ICON_SHEET_PROCEDURE.md`), adaptée à l'univers HoMM de Heroes.
>
> **Objectif** : éliminer les re-runs en fixant un cadre unique avant
> génération. Outillage : `tools/assets/` ; staging : `assets/` (jamais
> référencé par le client tant que le lot intégration n'est pas ouvert).

---

## 0. Les cinq règles — identifier la famille AVANT de générer

| Règle | Famille | Mode | Dimensions | Fond |
|---|---|---|---|---|
| **P** | Tuiles terrain, icônes UI, déclinaisons logo | Procédural (Pillow, seed fixe) | 64² (tuiles), 256→16 (icônes) | Opaque (tuiles) / transparent (icônes) |
| **A** | Sprites d'unités (combat + carte) | Planche LLM + détourage | **512×512** RGBA | **Transparent strict** |
| **B** | Avatars de héros | Planche LLM + détourage léger | **256×256** | Décor sombre flou accepté |
| **C** | Icônes d'artefacts, vignettes de bâtiments, mines de ressources | Planche LLM + `sheet_extract` | 512² par sujet | Planche gris clair plat → transparent |
| **D** | Fonds d'ambiance (menu, ville, combat) | Pièce unique LLM | **1920×1080** | Opaque |
| **E** | Logo du jeu | Pièce unique LLM | ≥ 1024² | Transparent |

> Erreur classique observée sur Hogwarth : appliquer le template d'une famille
> à une autre (ex. style sprite transparent pour un portrait). Identifier la
> règle d'abord.

---

## 1. Règle P — génération procédurale

- **Déterminisme absolu** : `random.Random(seed)` dérivé de l'id de l'asset,
  jamais d'horloge ni de `random` global. Re-lancer le script = octets
  identiques (même exigence que le moteur, guidelines §8.2).
- Scripts : `tools/assets/gen_tiles.py`, `tools/assets/gen_ui_icons.py`.
  Chaque asset est une **recette** dans le script (comme les `RECIPES`
  d'`icon_factory.py` Hogwarth) — ajouter un asset = ajouter une recette.
- **Tuiles** : 64×64 (le client rend `TILE_SIZE = 64`), **tileables** (tout
  motif est dessiné avec wrap ±64 px), 3 variantes par terrain pour casser la
  répétition. Palette sourde, lisible sous le brouillard de guerre et sous les
  objets de carte.
- **Icônes UI** : rendues à 256 px puis mipmaps LANCZOS 64/48/32/24/16
  (pratique Hogwarth). Silhouette pleine + ombrage simple 45° + liseré sombre ;
  **lisible à 16 px** (taille bandeau ressources mobile).
- Chaque script écrit une planche `_preview.png` de contrôle — la regarder
  avant de committer.

## 2. Règle A — sprites d'unités (planche LLM)

### 2.1 Spécifications
| Champ | Valeur |
|---|---|
| Dimensions finales | **512×512 px**, PNG-32 RGBA |
| Fond | **Transparent total** (alpha 0 strict) |
| Marge intérieure | ≥ 8 % sur les 4 côtés |
| Surface occupée | 75-85 % du cadre |
| Poids | < 350 Ko après optimisation |
| Lisibilité | silhouette reconnaissable à **48-72 px** (taille arène hex) |

### 2.2 Style
- **Digital painting type concept-art HoMM / Magic: the Gathering.** Pas de
  photoréalisme, pas de cartoon, pas de pixel art.
- Posture **en action, jamais statique ni frontale symétrique** ; regard 3/4.
- Lumière principale haut-gauche 45°, remplissage froid (cyan léger) côté
  opposé. **Ombres portées au sol bannies** (bavure d'alpha).
- Effets magiques translucides (alpha 30-70 %), panaches courts collés au
  sujet, 3-8 particules max.

### 2.3 Palettes par faction
| Faction | Dominante | Accent | Ambiance |
|---|---|---|---|
| Haven | Blanc cassé, acier clair, bleu ciel | Or | Lumière sainte, plumes, tabards |
| Necropolis | Os, gris cendre, noir | Vert nécrotique | Brume spectrale, étoffes en lambeaux |
| Arcane Hunters | Bleu nuit, violet arcane | Argent + runes cyan | Instruments de traque, glyphes |
| test-faction | Gris neutre | Orange | Placeholder assumé |

### 2.4 Production
1. `python3 tools/assets/gen_prompts.py` → `assets/prompts/units-<faction>.md`
   (prompt de planche personnalisé depuis le lineup + locales).
2. Générer la planche (Gemini / Nano Banana / Copilot), fond **gris clair
   plat** (voir Règle C — le détourage en dépend).
3. `python3 tools/assets/sheet_extract.py <planche> --cols … --rows … --ids …
   --out assets/raster_src --qc /tmp/qc.png` — **QC verte obligatoire**.
4. Copier les PNG validés vers `assets/units/<faction>/<unitId>.png`.
   Pour une image unique hors planche : `process_sprite.py --src … --id …
   --dest assets/units/<faction>` (rembg ; `birefnet` pour les translucides —
   spectres, fantômes Necropolis).

## 3. Règle B — avatars de héros

- **256×256**, buste 3/4, sujet ~75 % de la hauteur.
- **Painterly, PAS photoréaliste** (divergence assumée avec Hogwarth : Heroes
  est intégralement painterly, un portrait photo jurerait à côté des sprites).
- Fond : décor contextuel de la faction, sombre et flou (l'UI l'affichera dans
  des panneaux sombres). Alpha non requis.
- Poids < 150 Ko. Staging : `assets/heroes/<id>.png`.
- Tant que les héros nommés n'existent pas dans `data/`, produire les
  archétypes par faction (might / magic) — prompts dans
  `assets/prompts/hero-avatars.md`.

## 4. Règle C — planches d'icônes (artefacts, bâtiments)

Contraintes de planche **non négociables** (sinon le découpage souffre) :
- **8 sujets max par planche** (grille 4×2) — cible Gemini : au-delà, la
  qualité par cellule chute et la découpe souffre. `gen_prompts.py` éclate
  automatiquement une famille plus grande en planches `-p1`, `-p2`, …
- Fond **plat et CLAIR** — `flat uniform LIGHT GREY background (#c8c8c8)`,
  identique partout. ⚠️ Un fond sombre rend les objets sombres (cuir, bois,
  fer) iso-couleur au fond → **indétourables**. Erreur historique Hogwarth,
  à ne jamais refaire.
- Grille régulière (4 colonnes de préférence), **un sujet centré par
  cellule**, espaces nets, aucun contact entre sujets ni avec les bords.
- **Aucun cadre / halo / texte / ombre portée** (le pipeline ou le moteur les
  ajouteront).
- ≥ 512 px utiles par sujet (planche ≥ 2048² pour du 4×4).

Extraction : `sheet_extract.py` garantit anti-bave (suppression des composants
touchant le bord de cellule), recentrage sur le sujet nettoyé, érosion 1 px du
liseré, et **porte QC** (marge ≥ 10 %, couverture 3-85 %, exit 1 si échec).
Vérifier la planche QC à l'œil : cadre vert = PASS, rouge = FAIL → regénérer,
**ne jamais committer un FAIL**.

- Artefacts → `assets/artifacts/<id>.png`. Le halo de rareté / cartouche
  (équivalent `icon_factory.py --raster`) sera porté au lot intégration.
- Bâtiments → `assets/buildings/<faction>/<buildingId>.png` (vignettes de
  l'écran de ville ; la vue de ville peinte est un chantier Beta séparé).
- Mines → `assets/mines/mine-<ressource>.png` (objets de carte : une mine par
  ressource du jeu, dérivées des manifestes par `gen_prompts.py` ; silhouette
  lisible à 64 px = taille de tuile).

## 5. Règle D — fonds d'ambiance

- **1920×1080** painterly, pièces uniques (pas de planche).
- Sujets : écran titre, écran de ville par faction, toiles de fond de combat
  par terrain (grass/swamp/…), écran de victoire/défaite.
- **Zones sûres** : tiers inférieur libre de détail fort (l'UI y pose ses
  panneaux) ; pas de point focal dans les 10 % de bord (recadrage mobile).
- Valeurs sombres en périphérie, focal au centre-haut. Poids < 500 Ko (JPEG
  qualité 80-85 accepté — pas d'alpha nécessaire).
- Staging : `assets/backgrounds/<id>.jpg|png`.

## 6. Règle E — logo

- Pièce unique LLM ≥ 1024², fond transparent : emblème héraldique (écu, épée,
  couronne) + lettrage « Heroes » gravé métal/or, lisible en petit.
- Déclinaisons (favicon 32/16, icônes PWA 192/512, bannière) : **procédurales**
  à partir du master — script à écrire au lot intégration.
- Staging : `assets/logo/`.

## 7. Prompts-types

Suffix universel à coller à TOUS les prompts :
`no text, no watermark, no signature, no border frame, no ground line`
(pour les planches, ajouter : `flat uniform light grey background #c8c8c8`).

### 7.1 Planche d'unités (Règle A)
```
Character sheet, [N] fantasy creatures in a [cols]x[rows] grid,
digital painting, heroic fantasy concept art style (Heroes of Might and Magic,
MTG illustration quality), painterly brush strokes,
each creature centered in its own cell, not touching cell edges,
dynamic action pose, 3/4 view, soft directional light from upper-left,
[palette faction — cf. §2.3],
cell 1: [tier, nom, description visuelle, capacité signature]
cell 2: …
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line
```

### 7.2 Planche d'artefacts / bâtiments (Règle C)
```
Item sheet, [N] fantasy [artifacts|medieval fantasy buildings] in a
[cols]x[rows] grid, digital painting, painterly MTG illustration quality,
each object centered in its own cell with clear spacing,
soft directional light from upper-left, rich material detail,
cell 1: [nom + indice visuel dérivé du bonus/de la fonction]
…
flat uniform light grey background (#c8c8c8), no shadow,
no text, no watermark, no signature, no border frame
```

### 7.3 Avatar de héros (Règle B)
```
Painterly bust portrait of a [archétype] hero of the [faction] faction,
heroic fantasy digital painting (Heroes of Might and Magic style),
3/4 face turn, [tenue/attributs de faction], determined expression,
warm key light upper-left, cool rim light,
soft out-of-focus dark background of [lieu de faction],
character occupies 75% of the 256x256 frame,
no text, no watermark, no signature, no border frame
```

### 7.4 Fond d'ambiance (Règle D)
```
Epic painterly fantasy [scène], Heroes of Might and Magic concept art,
wide 16:9 composition, focal point upper-center, darker vignetted edges,
lower third kept simple for UI overlay, atmospheric depth, volumetric light,
no text, no watermark, no signature, no border frame
```

## 8. Critères d'acceptation (toutes familles)

- [ ] **Alpha** (A/C/E) : aucun halo clair au zoom 400 % sur fond noir ; QC
      `sheet_extract` verte.
- [ ] **Cadrage** : marge ≥ 8-10 %, occupation 75-85 %.
- [ ] **Silhouette** lisible à la taille d'affichage réelle (§ de la règle).
- [ ] **Palette** conforme à la faction / au terrain.
- [ ] **Poids** sous le plafond de la règle (350 Ko sprite, 150 Ko avatar,
      500 Ko fond).
- [ ] **Déterminisme** (P) : re-run du script = fichiers identiques.
- [ ] Un seul critère en échec → **re-run**, pas d'intégration « à peu près ».

## 9. Anti-patterns (importés de Hogwarth, vérifiés en production)

- Planche sur **fond sombre** → sujets sombres indétourables.
- `rembg` u2net sur sujets **translucides** (ailes, spectres) → détails
  écrasés ; utiliser `birefnet-general`.
- **Aura/brume large** dépassant la cellule → coupée à l'extraction, sujet
  décentré.
- **Pose frontale symétrique** → sans vie, refusée par défaut.
- Ombre portée au sol → bavure dans l'alpha.
- Committer un FAIL de QC « en attendant mieux ».

## 10. Rappel de périmètre

Tant que le lot intégration n'est pas ouvert : **rien dans `packages/client`
ne référence `assets/`**. Le budget bundle < 800 Ko gzip est incompatible avec
l'embarquement naïf des PNG — l'intégration passera par du chargement différé
et une révision explicite du garde-fou CI (décision à prendre à ce moment-là).
