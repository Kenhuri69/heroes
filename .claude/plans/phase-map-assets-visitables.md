# Assets des nouveaux éléments de carte — plan vivant

Suite de la PR #184 (variété d'objets sur les cartes générées). Les nouveaux
lieux de bonus (écurie, tour de guet, moulin, fontaine) et les habitations
partageaient un visuel générique. Demande utilisateur : leur donner des assets
distincts. Choix (AskUserQuestion) : **bonus places + camps par faction**, et
**« je prépare tout, tu génères »** (prompt Gemini + extraction + câblage client,
repli procédural distinct en attendant).

## 1. Constat (vérifié dans le code)

`render/mapObjects.ts` mappait les 5 saveurs de `visitable` sur **2 props**
peints (`shrine`, `signpost`) et **omettait `vision`** (ni prop ni couleur).
Écurie / tour de guet / moulin étaient donc identiques (panneau), fontaine /
sanctuaire identiques (autel). Les habitations utilisaient un `camp` générique
unique.

## 2. Livré

### Pipeline d'assets (skill asset-sheet — prompt + extraction, pas de génération)
- `tools/assets/gen_prompts.py` : deux nouvelles familles de planches (règle C,
  fond gris clair) :
  - `map_bonus_places_sheets()` → `assets/prompts/map-bonus-places.md`
    (fontaine, écurie, tour de guet, moulin — grille 4×1, ids
    `fountain,stable,watchtower,mill`, dest `assets/map/`).
  - `map_dwellings_sheets()` → `assets/prompts/map-dwellings.md`
    (camp par faction, ids `camp-<faction>`, dest `assets/map/`).
- Prompts régénérés. **Restauré** tout le reste des prompts (le regen a révélé
  une dérive pré-existante — vox-arcana ajouté après coup fait éclater plusieurs
  planches en -p1/-p2) : hors périmètre, non committé (noté §4).

### Câblage client (repli procédural distinct + consommation des PNG)
- `VISITABLE_PROP` : luck→`fountain`, movement→`stable`, vision→`watchtower`,
  levelXp→`shrine`, resource→`mill` (signpost reste le repli d'une nature
  inconnue). `VISITABLE_COLORS` : ajout de `vision`.
- `buildVisitableFallback` : silhouette procédurale DISTINCTE par nature (grange,
  tour, moulin, fontaine, obélisque) — lisible immédiatement, sans image LLM.
- `buildDwelling` : camp teinté à la faction de l'unité (`camp-<groupId>`) si
  l'art est présent, repli sur `camp` générique puis tente procédurale.
- Auto-découverte : `mapPropUrl` glob déjà `assets/map/*` — déposer les PNG suffit.

### Docs
- `docs/12` §10.2 : lignes de registre pour `map/<prop>` (lieux de bonus) et
  `map/camp-<faction>`, surfaces branchées mises à jour.

## 3. Étapes & vérifications

1. [x] Constat rendu (mapObjects.ts) → 2 props pour 5 saveurs, `vision` absente.
2. [x] gen_prompts.py : 2 familles + regen ; drift pré-existant restauré (surgical).
3. [x] Client : VISITABLE_PROP/COLORS, fallbacks distincts, camp par faction →
   typecheck + lint OK.
4. [x] Docs 12 mises à jour.
5. [x] Smoke (chromium local, workers=1) : « le client démarre », « lieu de bonus
   & habitation » (écurie + habitation) et « assets : PNG sans 404 » verts —
   repli procédural, aucun PNG requis.
6. [x] Branche redémarrée depuis `main` (PR #184 mergée) ; commit + push + PR draft.

## 3bis. Extraction & intégration des PNG (images fournies par l'utilisateur)

- Deux planches Gemini reçues. **Bonus places** : 4×1 conforme au prompt
  (fountain/stable/watchtower/mill). **Dwellings** : le LLM a produit un **3×2**
  (3 en haut, 2 en bas) au lieu du 4×2 demandé, et a **inversé** vox-arcana /
  sylvan-court en bas → extraction relancée avec `--cols 3 --rows 2` et l'ordre
  row-major réel (`camp-haven,camp-arcane-hunters,camp-necropolis,camp-vox-arcana,
  camp-sylvan-court`, 6ᵉ cellule vide tolérée).
- `sheet_extract.py` : **9/9 PASS** (QC verte, fonds retirés, tente+totem+feu
  conservés). PNG copiés `raster_src/` → `assets/map/` (fountain, stable,
  watchtower, mill, camp-<5 factions>). Tailles 104–284 Ko, hors bundle JS.
- Build : les 9 PNG sont hashés dans `dist/assets/` (glob auto-découvert), le
  client les consomme sans câblage. **Effet de bord bénéfique** : les 5 lieux de
  bonus de proto-01 redeviennent des sprites texturés (au lieu du repli
  procédural), ce qui **lève le risque FPS** relevé en CI (#185).
- Smoke (chromium local) : client + bonus/habitation + assets-no-404 + les **deux
  planchers FPS ×4** verts (arène 36 fps, carte 18,9 fps).

## 4. Décisions & écarts

- **Deux planches dédiées** plutôt qu'un ajout dans `map-props` : éviter de
  faire éclater les cellules de villes existantes en -p1/-p2.
- **Dérive pré-existante non traitée** : régénérer les prompts montre que
  plusieurs planches (units, buildings, avatars, mines, backgrounds) ont dérivé
  depuis l'ajout de vox-arcana. Restaurées telles quelles — ce nettoyage mérite
  son propre lot, hors sujet ici. À signaler à l'utilisateur.
- **Génération d'images = étape utilisateur** : je livre le prompt + la commande
  d'extraction QC ; le repli procédural distinct rend le jeu lisible sans image.
- Zéro diff moteur (rendu client + outils + docs). `signpost`/`camp` génériques
  conservés comme replis.
