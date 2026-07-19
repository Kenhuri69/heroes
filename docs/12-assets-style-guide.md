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
| **G** | Chrome d'UI (cadres de panneau, rubans d'en-tête) | Procédural (Pillow, formes fixes) | 160² (cadre), 320×72 (ruban) | Transparent (centre) |
| **H** | Blasons de faction (écus héraldiques) | Procédural (Pillow, formes fixes) | 256² | Transparent (hors écu) |
| **S** | Icônes de sorts, badges d'effet, mur de siège, unités invoquées | Procédural (Pillow, formes fixes) — phase 2 planche LLM | 256→24 (icônes/badges), 512² (mur/invocation) | Transparent |

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
- **Tuiles** : 64×64 (boîte de contenu du client), **tileables** (tout motif
  est dessiné avec wrap ±64 px), 3 variantes par terrain pour casser la
  répétition. Palette sourde, lisible sous le brouillard de guerre et sous les
  objets de carte. Terrains couverts : `grass`, `dirt`, `sand`, `forest`,
  `rough`, `snow`, `swamp`, `river`, `water`, `mountain`, `rocks` (doc 02 §1.5).
- **Props de relief** (`assets/tiles/props/<terrain>-<v>.png`) : billboards
  **transparents** qui **dépassent** la tuile pour donner de la hauteur à la
  carte, là où la profondeur compte — **forêt** (conifères) et **montagne**
  (pic). Repli procédural déterministe (`gen_tiles.py`, 3 variantes), destiné à
  être **remplacé par de l'art Gemini varié** (Rule C-like, §7.5) : déposer des
  PNG homonymes sous `assets/tiles/props/` suffit, le client les prend sans
  câblage. Le client (`tilemap.ts`) les pose debout (base au sol) au-dessus du
  losange texturé, culés avec leur chunk. Terrains plats = tuile procédurale
  seule (pas de prop).
- **Tuiles ISO** (Lot A1) : `gen_tiles.py` dérive en plus, de chaque tuile
  carrée, un **losange 64×32** (`assets/tiles/iso/`) par rotation 45° +
  compression verticale (= foreshortening iso) — transform PIL pur, donc
  déterministe. Elles matchent `render/projection.ts` (ISO_TILE_W/H) et sont
  posées par `tilemap.ts` sur le repli gouache. `iso/_preview.png` = contrôle de
  tessellation (grille 4×4, aucun trou entre losanges adjacents).
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
| Dungeon | Violet sombre, noir, obsidienne | Argent froid + magenta arcanique | Serpent lové, sorcellerie elfe noire, cavernes |
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
- **Layout de la vue de ville (UX-TOWNVIEW lot 2)** : sur le fond de ville, les
  bâtiments interactifs sont posés dans le **tiers inférieur** (bande d'avant-plan
  « au sol », zone sûre UI ci-dessus) par défaut. Un décor peut recevoir des
  **emplacements bespoke** calés sur son architecture via `assets/layouts/town-
  <factionId>.json` (tableau d'ancres `{x,y}` en % ; le i-ᵉ bâtiment en ordre id
  stable prend la i-ᵉ ancre, débordement → défaut « au sol »). Data-driven,
  branché par simple dépôt du JSON — aucun code. Livrés : haven, necropolis.

## 6. Règle E — logo

- Pièce unique LLM ≥ 1024², fond transparent : emblème héraldique (écu, épée,
  couronne) + lettrage « Heroes » gravé métal/or, lisible en petit.
- Déclinaisons (favicon 32/16, icônes PWA 192/512, bannière) : **procédurales**
  à partir du master — script à écrire au lot intégration.
- Staging : `assets/logo/`.

## 6bis. Règle F — audio (musiques & effets) (UXD-6)

Famille **AUDIO** : musiques d'ambiance (bouclables) et effets ponctuels (SFX).
Générés au prompt (Gemini) comme les images, mais **hors du pipeline planche** :
un fichier son par sujet.

- **Cadre sonore** : orchestre acoustique heroic-fantasy (esprit HoMM / M&M
  Online) — cordes, cuivres, bois, harpe, chœur léger ; tonal et mélodique ;
  **pas** de batterie moderne, de synthés ni de voix chantée. Cohérence de
  tempo et de tonalité pour que les boucles enchaînent proprement.
- **⚠️ Durées non fiables** : Gemini **ne respecte pas** les durées demandées
  (retour terrain). Les cibles des prompts sont indicatives ; le **retravail
  est obligatoire** après génération (voir ci-dessous).
- **Familles & cibles** :
  - Musiques (bouclables) : `menu` ~90 s, `adventure` ~120 s (basse intensité),
    `combat` ~90 s, `town` ~90 s ; jingles courts `victory`/`defeat` ~6 s (non
    bouclés).
  - SFX (one-shots courts, mono) : `ui-tap`/`ui-confirm`/`ui-error`,
    `map-step`/`map-pickup`/`end-turn`, `combat-hit`/`combat-shoot`/
    `combat-spell`/`combat-death`.
- **Retravail post-génération (obligatoire)** : trimmer les silences, poser des
  **points de boucle** propres (passage à zéro, mesure entière) pour les
  musiques, normaliser (`loudnorm`), puis encoder **`.ogg` (Vorbis q4) + repli
  `.m4a` (AAC)** (compat Safari). Commandes ffmpeg dans les fiches de prompt.
- **Budgets de poids** : SFX < 60 Ko, jingle < 150 Ko, musique de boucle
  < 800 Ko (l'audio est **hors bundle JS/CSS**, fetché à la demande — comme les
  PNG, doc §10.1 ; le garde-fou budget CI ne mesure que `*.js`/`*.css`).
- **Sourcing musique** : `python3 tools/assets/gen_audio_prompts.py` émet les
  prompts dans `assets/prompts/audio-{music,sfx}.md` ; génération via un modèle
  audio (Gemini), puis retravail ffmpeg (trim/boucle/normalisation/encodage).
- **Sourcing SFX & jingles (procédural)** : le modèle *musique* ne produit pas de
  one-shots courts et secs → ils sont **synthétisés** (déterministe, cf. Règle P)
  par `python3 tools/assets/gen_sfx.py` (stdlib + ffmpeg) : SFX dry/mono → `sfx/`
  (< 60 Ko) ; **jingles victoire/défaite** (stings musicaux courts) → `music/`
  (< 150 Ko). Aucune dépendance externe ni licence tierce.
- **Staging final** : `assets/audio/music/<id>.ogg` et `assets/audio/sfx/<id>.ogg`
  (+ `.m4a`).
- **Intégration client (UXD-6B)** : registre `app/audio.ts` (DOC-AUDIO —
  emplacement réel, sous `packages/client/src/app/`, et non `render/`)
  (`import.meta.glob ?url`, hors bundle, lazy), lecteur Web Audio débloqué à la
  1ʳᵉ interaction (politique autoplay), volumes musique/SFX persistés
  (`localStorage`), **coupé/modéré par défaut** ; le son ne porte JAMAIS seul
  une information (A5 étendu — un SFX double un feedback visuel existant).

## 6ter. Règle G — chrome décoratif d'UI (cadres & rubans)

Famille **CHROME** : l'habillage de l'UI **interactive** (cadres de panneau,
rubans d'en-tête, séparateurs). Comble le trou d'identité — l'art plein cadre
(fonds Règle D, logo Règle E, illustrations Règle A/B/C) porte la gouache, mais
les panneaux DOM étaient plats/tokenisés. Procédural (comme Règle P) car il faut
un rendu **9-slice** propre et déterministe, pas une planche LLM.

- **Style** : « laiton & parchemin » (doc 08 §5) — rails laiton (rampe
  brass sombre→clair), lit d'encre, rivets/caps ornés. Rampe couleur **dans le
  script** (`tools/assets/gen_chrome.py`), jamais dans les `.css` (garde-fou).
- **9-slice / 3-slice** : les **bords** (entre coins) ont une **section
  constante** → répétables sans couture en `border-image ... round` ; l'ornement
  vit dans les **coins** (cadre) ou les **caps** (ruban). Centre du cadre
  **transparent** (le fond tokenisé du panneau transparaît).
- **Pièces** : `panel-frame.png` (160², slice 40) ; `ribbon.png` (320×72, slice
  horizontal 72, face **encre** pour rester lisible sous un texte clair) ;
  `_preview.png` (contrôle à l'œil).
- **Déterminisme** : formes vectorielles fixes, aucun aléa → re-run = octets
  identiques (guidelines §8.2). `python3 tools/assets/gen_chrome.py`.
- **Staging** : `assets/ui/chrome/<pièce>.png`.
- **Intégration client** : registre `render/assets.ts` (auto-découverte
  `?url`, **hors bundle**) → résolveurs `chromeFrameUrl()`/`chromeRibbonUrl()`.
  Au bootstrap (`main.ts`), les URLs résolues sont posées en **variables CSS**
  `--chrome-frame` / `--chrome-ribbon` sur `:root`, consommées par les **classes
  partagées** `.chrome-framed` / `.chrome-ribbon` (`styles.css`, `border-image`
  + `box-sizing: border-box` → le cadre n'agrandit pas la surface ; repli
  gracieux : variable absente ⇒ `border-image` ignoré, la surface garde son
  fond/rayon tokenisés). **Déléguer la bordure** : retirer le `border` de la
  règle spécifique `.modal.<x>` habillée (sinon elle l'emporte en spécificité).
  Skill dédié : `.claude/skills/asset-chrome/`. **Surfaces habillées** : modales
  de **ville** (+ ruban « Chantier du jour »), **Options**, **Journal**,
  **pré-combat**.

## 6quater. Règle H — blasons de faction (écus héraldiques)

Famille **BLASONS** : un **écu** héraldique par faction, remplaçant le motif
géométrique procédural du `FactionBadge` (qui reste le **repli** a11y non
chromatique — doc 08 §4 — quand l'asset manque). Comble le trou d'identité de
l'en-tête de ville (le « dé » générique jadis affiché pour Havre).

- **Forme** : écu « heater » (haut droit, flancs courbes → pointe basse), bordure
  métal biseautée (rampe **laiton/or** ou **argent** selon la faction, esprit
  Règle G), chef teinté (2ᵉ couleur héraldique), ombre portée douce ; fond
  transparent hors de l'écu.
- **Recettes** (une par faction, `RECIPES` dans le script) — **charge** et
  **couleurs** dérivées de l'identité (doc 03/04/05/14/16) :
  - **haven** — bleu roi / or → **soleil rayonnant** (lumière, Saint-Empire du Griffon) ;
  - **necropolis** — noir·cendre / vert spectral, bordure argent → **crâne** (morts-vivants d'Heresh) ;
  - **arcane-hunters** — violet nuit / argent, runes cyan → **flèche de traque + anneau runique** ;
  - **sylvan-court** — verts profonds / ambre → **feuille** (motif de bannière, doc 14) ;
  - **vox-arcana** — noir·violet / or, liseré néon → **croissant (honmoon) + étoile (scène)**.
  `test-faction` **n'a pas** de blason (placeholder assumé, §2.3) → garde le motif SVG.
- **Déterminisme** : formes vectorielles fixes, supersampling ×4 → LANCZOS,
  aucun aléa → re-run = octets identiques (guidelines §8.2). Ajouter une faction
  = une entrée `RECIPES` + une fonction de charge. `python3
  tools/assets/gen_faction_badge.py [--only <ids>]`.
- **Staging** : `assets/badges/<factionId>.png` (256²). La clé est le `factionId`
  **opaque** — aucune faction connue du moteur/client (guidelines §8.1).
- **Intégration client** : registre `render/assets.ts` (auto-découverte `?url`,
  **hors bundle**) → résolveur `factionBadgeUrl(factionId)` → `FactionBadge` rend
  l'`<img>` du blason si présent, sinon le motif SVG (le `data-pattern` reste
  posé → le canal non chromatique survit au repli).

## 6quinquies. Règle S — sorts, effets, murs, invocations

Famille **S** : le retour visuel des SORTS et des éléments de combat qui en
découlent — jusqu'ici tous procéduraux au trait (grimoire en texte seul, effets
sans badge, remparts et invocations en repli). **Phase 1 procédurale** (livrée,
`tools/assets/gen_spell_assets.py`) ; **phase 2 LLM** planifiée (montée en
fidélité par simple substitution de PNG homonyme, aucun code — cf.
`.claude/plans/asset-spell-effects-related.md`).

- **Icônes de sorts** (`assets/spells/<school>-<kind>_<64|48|32|24>.png`) : une
  **gemme** par couple (école, type) — fond teinté par l'**école** (fire/water/
  earth/air/neutral/traque/scene/lumiere/prime, doc 02 §1.4), glyphe clair par
  **type** (`kind` : damage/heal/buff/debuff/dispel/cure/applyMarks/silence/
  banish/rally/stealth/teleport/summon/resurrectFull/adventure). Les couples sont
  **lus dans `data/core/spells.json`** → jamais de doublon ni d'orphelin. Rendu
  dans `SpellBook` (`spellIconUrl(school, kind)`) ; **repli** = liste texte seule.
- **Badges d'effet** (`assets/ui/status-<name>_<32|24|16>.png`) : disque + picto
  d'état, lisible ≥16px — `buff`, `debuff`, `silence`, `poison`, `mark`,
  `immobilized`, `stealth`. Posés en rangée au-dessus du jeton par `CombatScene`
  (`statusIconUrl(name)`) ; **repli** = disque coloré procédural.
- **Mur de siège** (`assets/combat/siege-wall.png`, 512²) : segment de rempart de
  pierre crénelé, distinct des obstacles de champ. Posé sur les hexes
  `combat.siegeWalls` (`siegeWallUrl()`) ; **repli** = rocher `drawBoulder`.
- **Habillage de siège** (S1/S2/S5a, plan `siege-visual-remediation`, prompts
  `combat-siege-set.md`, `war-machines-support.md`) — **art LIVRÉ** (style peint
  semi-réaliste HoMM Online, réf. captures du jeu d'origine) : rempart en 3
  paliers d'usure `combat/siege-wall` / `siege-wall-cracked` / `siege-wall-breached`
  (`siegeWallUrl`/`siegeWallCrackedUrl`/`siegeWallBreachedUrl`, sélection par ratio
  de PV) ; **porte** `combat/siege-gate` (staged, câblage géométrique S1.2/S1.3 à
  venir) ; **machines de soutien** `units/core/first-aid-tent.png` +
  `ammo-cart.png` (S5a, auto-découvertes). **Toiles de siège**
  (`backgrounds/siege-<factionId>.jpg` → `backgrounds/siege.jpg`,
  `siegeBackgroundUrl()`, prompt `combat-siege-backgrounds.md`) : **art à générer**
  (code câblé). **Mêmes clés ⇒ dépôt de PNG suffit** ; **repli gracieux** partout
  (rempart→pan unique→rocher ; siège→terrain ; machine→fanion).
- **Scène de siège composée** (refonte visuelle du siège, plan
  `siege-visual-overhaul`, générateur `tools/assets/gen_siege_scene.py`) : la
  scène POSSÈDE l'image (composition façon HoMM3), la grille s'y pose. Le
  script compose hors-ligne, depuis la matière peinte existante
  (`backgrounds/combat-grass.jpg`/`combat-dirt.jpg`, `combat/siege-gate.png`,
  `town-<id>.jpg`), un **sol complet ancré sur la géométrie moteur** (douve
  col 10, remparts col 11, porte rangées 4–5) :
  `combat/siege-scene[-<factionId>].jpg` (champ + boue d'approche + fossé sec
  + chaussée de porte + cour/esplanade pavée + ville assiégée estompée),
  `combat/siege-moat.png` (bande d'eau RGBA posée seulement si douve moteur,
  Fort ≥ 2), pièces de rempart **par rangée** `combat/siege-piece-wall
  [-cracked|-razed].png` — **bande strictement périodique** (période = pas de
  rangée : façade continue pleine masse + crête crénelée côté assaillant ⇒
  raccords invisibles par construction, états mappés sur `siegeWallHp`,
  brèche = bande percée + gravats), **porte verticale**
  `combat/siege-piece-gate.png` (courtine double hauteur percée de l'arche
  peinte, dans l'axe du mur), **tour de tir** `combat/siege-piece-arrow-tower.png`
  (tour grise + baliste montée sur la plateforme — l'arme se voit), **tour
  d'extrémité** `combat/siege-piece-tower.png` (art `siege-tower` recoloré
  pierre grise), **sol hexagonal de cour** `combat/siege-tile-court-<1|2|3>.png`
  (« effet ville » : pavés par hex dans l'enceinte), et le layout de calage
  `assets/layouts/siege-scene.json` (consommé par `siegeSceneLayout()`).
  Client : sprites dans `stacksLayer` (zIndex = y ⇒ occlusion unités/mur
  correcte). **Mêmes clés ⇒ un art Gemini supérieur se substitue par
  simple dépôt** ; **repli gracieux** = habillage procédural historique
  complet si un asset manque. Déterministe (`random.Random(SEED)`).
- **Unité invoquée** (`assets/units/core/elementaire-de-terre.png`, 512²) :
  élémentaire de terre rocheux, résolu par `unitSpriteUrl` via le repli **core**
  (`units/core/<unitId>`, faction-agnostique) ; **repli** = jeton procédural.
- **Déterminisme** : formes vectorielles fixes → LANCZOS, aucun aléa (guidelines
  §8.2). **Clés opaques** : aucune faction/école connue du moteur (guidelines §8.1).
  `python3 tools/assets/gen_spell_assets.py`.

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

### 7.5 Props de relief forêt/montagne (planche variantes, remplace le repli procédural)
Billboards **verticaux** vus en légère plongée iso, **fond transparent**, base
au sol, destinés à peupler les tuiles `forest`/`mountain` de la carte (doc 02
§2.1). Générer une planche de **variantes** pour casser la répétition (déposer
les cellules découpées en `assets/tiles/props/forest-<n>.png` /
`mountain-<n>.png`, PNG à alpha).
```
Item sheet, [N] Heroes-of-Might-and-Magic map decorations in a [cols]x[rows] grid,
digital painting, painterly MTG illustration quality, each object standing on the
ground, viewed slightly from above (isometric map angle), tall enough to rise
above a tile, clear spacing, soft directional light from upper-left,
forest cells: dense clusters of conifers/broadleaf trees, varied silhouettes;
mountain cells: rocky peaks with snow caps and shaded faces, varied silhouettes;
fully transparent background (PNG alpha), no ground plane, no shadow baked wide,
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

## 10. Intégration dans le client (lot ouvert)

> **État** : lot d'intégration **ouvert**. Le client référence désormais
> `assets/` via un registre (`packages/client/src/render/assets.ts`).

### 10.1 Stratégie de service retenue

Registre **auto-découvert** par Vite : `import.meta.glob(['…/assets/**/*.png',
'!**/_preview.png'], { eager, query:'?url' })` construit une map
`clé → URL hashée`. **Ajouter un asset = déposer le PNG nommé par convention**
(§10.2) ; il est repris sans câblage manuel.

- **Hors bundle JS** : `build.assetsInlineLimit: 0` (vite.config.ts) force
  l'émission de **chaque** PNG en fichier séparé hashé (`dist/assets/*.png`).
  Le garde-fou budget CI ne mesure que `*.js`/`*.css` → les PNG en sont exclus.
  Sans ce réglage, les petites icônes UI (< 4 Ko) seraient inlinées en base64
  dans le JS et compteraient dans le budget. **Le garde-fou n'est pas
  contourné ni révisé** : budget mesuré à ~225 Ko gzip après intégration.
- **Lazy** (doc 07 §6) : les octets PNG ne sont fetchés qu'à l'affichage —
  `<img loading="lazy">` (DOM) ou `Assets.load` (PixiJS, préchargé une fois au
  bootstrap pour les tuiles + objets de carte, lecture synchrone du cache
  ensuite). L'atlasing (spritesheets @1x/@2x) reste une optimisation ultérieure.
- **Repli gracieux** : si un asset est absent/renommé ou échoue au chargement,
  le rendu retombe sur le placeholder procédural existant (`<AssetImg fallback>`
  côté DOM, `getTexture(...) ?? Graphics` côté PixiJS) — jamais d'image cassée.

### 10.2 Convention de nommage `assets/` → runtime

Les résolveurs de `render/assets.ts` sont **faction-agnostiques** (aucun nom de
faction en dur) et dérivent le chemin de la donnée :

| Famille | Chemin | Clé de résolution |
|---|---|---|
| Tuiles | `tiles/<terrain>-<1..3>.png`, `tiles/road-dirt.png` | terrain + variante déterministe |
| Tuiles ISO | `tiles/iso/<terrain>-<1..3>.png`, `tiles/iso/road-dirt.png` | `isoTileUrl`/`isoRoadUrl` (rendu carte iso, Lot A1) |
| Props de relief | `tiles/props/<terrain>-<1..3>.png` (forest/mountain) | `terrainPropUrl` + `terrainPropVariant` (billboard, extension carte) |
| Objets de carte | `mines/mine-<resource>.png` | `obj.resource` |
| Structures/props de carte | `map/<prop>.png` : `chest`/`camp`/`signpost`/`shrine` + lieux de bonus `fountain`/`stable`/`watchtower`/`mill` + `town-<faction>`/`hero-<faction>` | `mapPropUrl` — visitable : `VISITABLE_PROP[kind]` (luck→fountain, movement→stable, vision→watchtower, levelXp→shrine, resource→mill) |
| Camps d'habitation | `map/camp-<faction>.png` | `camp-<groupId de l'unité>` avec repli sur `camp` générique |
| Artefacts | `artifacts/<artifactId>.png` | id d'artefact |
| Bâtiments communs | `buildings/core/<buildingId>.png` | id de bâtiment |
| Bâtiments de faction | `buildings/<factionId>/<buildingId>.png` | id de bâtiment (fichier nommé exactement par l'id) |
| Unités | `units/<factionId>/<unitId>.png` | `unitSpriteUrl(unitId, groupId)` — **repli élite→base** : `<base>-elite` sans sprite propre réutilise `<base>` (armées améliorées peintes tant que l'art d'élite dédié n'est pas produit) |
| Machines de guerre | `units/core/<unitId>.png` | `unitSpriteUrl(unitId)` sans faction — pièces faction-agnostiques (ballista/catapulte/arrow-tower, doc 02 §5), repli `units/core/` |
| Avatars de héros | `heroes/<factionId>-<archetype>.png` | faction + archétype (might/magic) |
| Icônes UI | `ui/res-<id>_<size>.png`, `ui/stat-<id>_<size>.png`, `ui/ui-day_<size>.png` | id + mipmap ≥ taille voulue (16/24/32/48/64) |

Surfaces branchées : `render/tilemap.ts` (terrain), `render/mapObjects.ts`
(mines, coffres, artefacts au sol, lieux de bonus, camps d'habitation),
`ui/TownScreen.tsx` (vignettes de bâtiments), `ui/HeroInventory.tsx`
(icônes d'artefacts), `ui/shell.tsx` (icônes de la barre de ressources).
Preuve de non-régression : smoke « assets : PNG servis sans 404… » (desktop +
mobile) + budget vérifié vert en CI.
