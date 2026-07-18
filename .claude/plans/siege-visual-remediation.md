# Plan — Remédiation visuelle du combat de siège

> **Source** : audit `docs/19-analyse-graphique-siege.md` (captures
> `docs/captures/siege/`). Constats validés par l'utilisateur ; ce plan est la
> feuille de route d'exécution. **Plan vivant** (guidelines §5) : cocher chaque
> étape, noter écarts et décisions au fil de l'eau.
>
> **Invariants à respecter sur TOUS les lots** (guidelines §8) : moteur sans
> faction (ids opaques), RNG seedé uniquement, moteur sans dépendance au rendu,
> touch-first, docs = source de vérité (mettre à jour `docs/02`/`08`/`12` dans
> le même commit quand un lot change l'habillage spécifié). Budget bundle
> < 800 Ko gzip (les PNG restent hors bundle via le registre d'assets).
> Un seul lot touche le moteur (S5b) — générique, zéro bump
> `CURRENT_SAVE_VERSION` attendu, golden inchangé attendu (le replay golden
> n'exerce ni machines de guerre ni siège).

## Ordre d'exécution recommandé

1. **Vague 1 — câblages purs client, gros impact/petit coût** : S2, S3, S8
2. **Vague 2 — assets & habillage** : S4, S1, S5a, S6
3. **Vague 3 — moteur générique + UI** : S5b, S7
4. **Vague 4 — polish & investigation** : S9

Chaque lot = une branche `claude/siege-<lot>` + une PR draft dédiée (ou un
groupe cohérent par vague), vérifiée avant push : `pnpm typecheck && pnpm lint
&& pnpm test` (golden inclus), garde-fou « zéro faction », budget bundle,
smoke ciblé. Tout nouveau test suit le skill `test-authoring`. Vérification
visuelle : rejouer la recette de l'annexe du doc 19 (état de siège forgé) et
comparer aux captures de référence.

---

## Lot S2 — Bombardement visible (P1, client seul) ✅ priorité 1

L'événement moteur `WallBombarded { col, row, destroyed }` existe
(`engine/combat/turns.ts`, `bombardWalls`) mais n'est écouté nulle part.

- [x] S2.1 `CombatScene.onEvent` : sur `WallBombarded`, jouer un **projectile**
      catapulte → hex du mur (réutiliser `spawnProjectile` de
      `render/combatFx.ts`, arc balistique simple) puis un impact
      (`spawnSpellImpact` ou variante « éclats de pierre »). Coupé en
      reduce-motion comme les autres FX.
- [x] S2.2 État « mur endommagé » : superposer au sprite de rempart un overlay
      de fissures (asset `combat/siege-wall-cracked`, repli teinte assombrie)
      dès que `combat.siegeWallHp[key] < SIEGE_WALL_HP`. `syncWalls` doit
      intégrer les PV dans sa signature de reconstruction.
- [x] S2.3 `destroyed: true` : le segment tombe avec un petit fondu/secousse
      (patron `animateDeath`/`boardShake` existants) au lieu de disparaître au
      sync.
- [x] S2.4 Journal de combat : ligne i18n FR/EN « La catapulte frappe le
      rempart (−N) / Le rempart s'effondre » (`app/combat-log.ts` + locales
      core).
- Vérif : test smoke siège (voir S-TEST ci-dessous) — le compteur
  `combatFx.projectiles` s'incrémente à chaque round avec catapulte ; golden
  inchangé ; captures avant/après.

## Lot S3 — Douve lisible (P1, client seul)

- [x] S3.1 `drawBoard` (`render/hexgrid.ts`) : **cumuler** les canaux au lieu
      de remplacer — un hex douve atteignable garde sa teinte/texture douve
      SOUS le pip vert (fill douve d'abord, surbrillance en calque
      translucide par-dessus, pip conservé). Un hex douve garde TOUJOURS son
      marqueur non chromatique propre (vaguelettes dessinées, pattern A5).
- [x] S3.2 Rendre la douve comme un décor : fill plus opaque + vaguelettes
      procédurales déterministes (patron `drawBoulder`), ou sprite
      `combat/moat` s'il est produit (repli procédural gracieux).
- [x] S3.3 Dégâts annoncés : quand la destination sélectionnée (tap 1) est un
      hex de douve, afficher « −{moatDamage} PV » dans la prévisualisation
      (readout existant de `combatPreview`) — lecture de `combat.moatDamage`,
      aucune règle nouvelle.
- Vérif : capture avant/après (douve visible même sous surbrillance) ; test
  unitaire de `drawBoard`? non — smoke visuel + assertion préviz (S-TEST).

## Lot S8 — Popups de dégâts (P2, client seul, trivial)

- [x] S8.1 Décaler le spawn des chiffres flottants au-DESSUS du sprite
      (ancre haute du jeton) pour ne plus recouvrir badges d'effectif ni
      voisins immédiats.
- [x] S8.2 Lier la durée de vie du popup au jeton : si la pile meurt et que
      son fondu se termine, accélérer/écourter le popup orphelin (plus de
      « −38 » flottant sur herbe nue).
- Vérif : captures avant/après sur la mêlée à la brèche ; aucun test dédié
  (FX purs), le smoke anti-gel couvre la non-régression.

## Lot S4 — Fond de ville de siège (P1, assets + client)

- [~] S4.1 Assets (prompts déposés — `combat-siege-backgrounds.md` ; art à générer) : toiles `backgrounds/siege-<factionId>.jpg` pour les
      factions livrées + une générique `backgrounds/siege.jpg` (skill
      `asset-sheet`/prompts doc 12 ; cadrage : champ devant des murailles,
      silhouette de la ville de la faction à l'horizon, gouache du projet).
      Prompts déposés dans `assets/prompts/`.
- [x] S4.2 Client : `combatBackgroundUrl` prend un contexte — si
      `combat.townId != null`, résoudre `backgrounds/siege-<factionDeLaVille>`
      → repli `backgrounds/siege` → repli terrain actuel (`main.ts`, câblage
      du fond DOM existant, zéro moteur, id de faction opaque).
- [x] S4.3 Doc 12 (guide assets) + doc 08 §2.4 : documenter la convention.
- Vérif : recette doc 19 ⇒ le siège Necropolis n'est plus sur prairie ;
  combats de plaine inchangés ; budget bundle inchangé (JPEG hors bundle).

## Lot S1 — Rempart continu (P1, assets + client)

- [~] S1.1 Assets (prompts déposés — `combat-siege-set.md` ; art à générer) : jeu de sprites de rempart orientés colonne —
      `siege-wall-top / -mid / -bottom / -stub` (moignon détruit) + **porte**
      `siege-gate` (et variante brisée `siege-gate-breached`), même gouache
      (skill `asset-sheet`, prompts doc 12 §7).
- [ ] S1.2 `syncWalls` : choisir le sprite par position dans la colonne
      (extrémités/segments), ancrer bord-à-bord pour absorber le zigzag de
      l'offset hex (léger décalage x par parité de rangée, chevauchement
      vertical) ⇒ muraille visuellement continue.
- [ ] S1.3 Habiller l'OUVERTURE : hexes de porte (`SIEGE_GATE_ROWS`) avec le
      sprite de porte (ouverte = franchissable) ; hexes de brèche catapulte
      avec des gravats/moignons — la porte légitime et la brèche deviennent
      discernables. Les positions viennent de l'état (`siegeWalls` absents +
      géométrie connue), aucune règle nouvelle.
- [ ] S1.4 Repli gracieux conservé (aucun asset ⇒ rocher actuel).
- Vérif : captures avant/après aux manches 1 et 4 ; smoke siège (S-TEST) vert ;
  doc 08 §2.4 mis à jour.

## Lot S5a — Sprites des machines manquantes (P1, assets seuls)

- [~] S5a.1 (prompt déposé — `war-machines-support.md` ; art à générer) `assets/units/core/first-aid-tent.png` et
      `assets/units/core/ammo-cart.png` (skill `asset-sheet`, planche
      « machines de guerre » cohérente avec catapulte/baliste existantes).
- [~] S5a.2 QC (à faire au retour de l'art) : vignettes pré-combat + jetons en bataille remplacent cases
      vides/fanions (aucun code à changer — le registre auto-découvre).
- Vérif : recette doc 19, écran pré-combat sans case vide.

## Lot S5b — Placement dédié des machines (P1, **moteur générique**)

Seul lot moteur. Les machines (`warMachine`) sont placées comme des piles
ordinaires par `placeSide` (débordement du chariot en 1ʳᵉ ligne, capture 2).

- [x] S5b.1 `placeSide`/appelants (`combat/setup.ts`) : les piles dont la déf
      porte `warMachine` sont placées sur des **emplacements réservés hors
      formation** — colonne derrière la ligne de départ du camp (attaquant :
      col 0 reste aux créatures, machines en « rangée arrière » : mêmes hexes
      qu'aujourd'hui MAIS réservés en fin de colonne sans débordement sur la
      colonne de front ; choix simple : caper la formation créatures à
      `COMBAT_ROWS − nbMachines`). Générique : décision par capacité
      `warMachine` (donnée), aucun id en dur.
- [x] S5b.2 Tests moteur : placement avec 7 piles + 4 machines ⇒ aucune
      machine en colonne de front ; ordre de la formation créatures inchangé
      sans machines (non-régression guardian/héros-vs-héros).
- [x] S5b.3 Docs : doc 02 §5 (placement) aligné.
- Vérif : golden **inchangé** (replay sans machines) ; 835+ tests moteur
  verts ; pas de bump save (aucune forme nouvelle) ; captures avant/après.
- ⚠️ Si l'implémentation révèle un impact replay/golden : s'arrêter et
  re-scoper avec l'utilisateur (ne pas re-fixer le golden en silence).

## Lot S6 — Tour de tir = structure (P2, client seul)

- [x] S6.1 `buildStackToken` : une pile dont la déf porte `warMachine` +
      `immobile` côté défenseur de siège (ou marqueur d'habillage générique
      dans les données de l'unité, ex. `presentation: "structure"` — décision
      à l'implémentation, zéro id en dur) est rendue SANS ellipse de camp ni
      socle « créature » : socle de pierre procédural + sprite, badge
      d'effectif remplacé par une jauge/omission (une tour n'est pas « 1 »).
- [x] S6.2 La tour reste ciblable/inspectable comme aujourd'hui (aucune règle
      changée) ; l'appui long garde la fiche.
- Vérif : capture avant/après ; smoke siège vert.

## Lot S7 — Pré-combat « Siège » (P2, client seul)

- [x] S7.1 `PreBattleScreen` : si `combat.townId != null`, titre
      « Siège de {ville} » (nom localisé existant de la ville), blason/bandeau
      de la faction de la ville, et rangée « défenses » : Fort niveau N ⇒
      icônes rempart/douve/tour (données déjà dans l'état :
      `town.buildings.fort`, `combat.siegeWalls/moat`, tour présente).
- [x] S7.2 Locales FR/EN (`preBattle.siegeTitle`, libellés défenses).
- [x] S7.3 Améliorer le repli d'avatar héros (constat 3.2 du doc 19) : le
      médaillon vide reprend le motif `FactionBadge` (pattern déterministe)
      au lieu du disque noir — même repli qu'ailleurs dans l'UI.
- Vérif : capture avant/après ; audit i18n (0 chaîne en dur) ; doc 08 §2.4.

## Lot S9 — Polish & investigation (P3)

- [ ] S9.1 Investiguer la surbrillance « attaquable » sur hex vide (capture 4
      du doc 19) : reproduire via la recette + rounds auto ; suspect =
      interaction mort-différée (`pendingDeathIds`)/redraw. Corriger si bug
      confirmé, sinon documenter la cause.
- [ ] S9.2 Rochers d'obstacles : remplacer le polygone procédural par des PNG
      props (patron `assets/tiles/props/`), repli procédural conservé.
- [ ] S9.3 Projectile de baliste : remplacer le trait par un carreau orienté
      (petit sprite ou forme dessinée), traînée courte.
- [ ] S9.4 Cadrage d'ouverture : marge du fit initial pour que badges des
      piles extrêmes (rangée 9) ne soient pas rognés par la barre d'actions.
- Vérif : captures ; smoke anti-gel inchangé.

## S-TEST — Couverture de test transverse (avec la vague 1)

- [x] Un test smoke « siège » dédié (`@core`, skill `test-authoring`) : forge
      l'état de l'annexe doc 19 via `__HEROES_TEST__` (même recette IndexedDB),
      déclenche `CaptureTown`, assert : écran pré-combat visible → « Combattre »
      → un round auto → `combatFx.projectiles > 0` (S2), combat toujours
      vivant, pas de gel. Coût ~1 smoke ; couvre S1/S2/S3/S6 en non-régression.
- [x] Étendre la recette en helper partagé si plusieurs tests l'utilisent.

## Journal des décisions

### 2026-07-18 — Cadrage & Vague 1 (S2, S3, S8, S-TEST)

**État réel du code vs audit doc 19** (relevé au démarrage) :
- `CombatScene.animateEvent` écoute DÉJÀ `WallBombarded` — mais uniquement
  `if (event.destroyed) this.redrawBoard()` (ouvre l'hex sur le plateau). **Aucun
  FX, aucun overlay de fissures, aucune ligne de journal** ⇒ S2.1/S2.2/S2.3/S2.4
  restent à faire. `MoatDamaged` est déjà loggé en chiffre flottant (≠ S3).
- Le contrat harness impose la branche unique `claude/siege-visual-remediation-fcr6cf`
  (« NEVER push to a different branch »). Je livre donc les **vagues en commits
  successifs** sur cette branche + **une PR draft** (le plan autorise « par vague
  cohérente »), au lieu d'une branche par lot.

**Décisions Vague 1 :**
- **S2.4 sans « −N »** : l'événement moteur `WallBombarded { col,row,destroyed }`
  ne porte PAS la valeur des dégâts (calculée dans `bombardWalls` mais non
  exposée). S2 est cadré « client seul » ⇒ je logue « la catapulte pilonne le
  rempart » / « un pan de rempart s'effondre » sans le nombre, plutôt que d'ouvrir
  l'événement moteur (hors scope de la vague). Réévaluable si on veut le chiffre.
- **S2 impact = éclats de pierre** : nouveau `spawnRubbleImpact` dans
  `combatFx.ts` (anneau pierre + éclats déterministes) plutôt que de détourner
  `spawnSpellImpact` (familles de sorts). Projectile catapulte = `spawnProjectile`
  existant (arc balistique), origine = flanc attaquant à la hauteur de l'hex visé.
- **S2.2/S2.3 = `syncWalls` refactoré en map keyée par hex** : diff par clé
  (ajout/retrait/conservation) au lieu d'un rebuild total. Permet (a) l'overlay de
  fissures sur les segments à `siegeWallHp < SIEGE_WALL_HP`, (b) l'animation de
  chute (fondu + bascule) d'un segment retiré — seul cas de retrait de mur en
  combat = bombardement. Signature de reconstruction intègre les PV.
- **S3 cumul canaux** : dans `drawBoard`, l'hex de douve garde TOUJOURS son décor
  (fill douve + vaguelettes déterministes, patron `drawBoulder`) SOUS l'overlay de
  surbrillance translucide et le pip vert. Chemin non-douve **inchangé au pixel**
  (deux couches uniquement pour la douve) ⇒ combats de plaine intacts.
- **S3.3 préviz douve** : `combatPreview` devient une union
  `DamagePreview | MoatMovePreview` ; à la sélection d'une destination de douve
  (tap 1), lecture de `combat.moatDamage` ⇒ « Entrer dans la douve : −N PV ».
- **S-TEST = hook `__HEROES_TEST__.startSiege()`** (test-scaffold client, patron
  des forges existantes `importAiTurnSave`) : reprend la partie `?seed=42` vivante,
  dote le héros d'un `siege-cat` (catalogue + `warMachines`), pousse une ville
  neutre `fort:3` + garnison à la position du héros, puis `CaptureTown`. Le smoke
  passe le pré-combat → Combattre → `AutoCombat{rounds:1}` → assert
  `combatFx().projectiles > 0` (tir catapulte OU tir garnison) + combat vivant.

**Statut :** Vague 1 livrée (commit « Siège Vague 1 », PR #477 draft).

### 2026-07-18 — Vague 2/3 client (S4 wiring, S6, S7)

Deuxième lot **client pur** sur la même branche/PR (aucun art requis, repli
gracieux partout) :
- **S4** — `siegeBackgroundUrl(factionId)` (`assets.ts`) + câblage du fond DOM
  `main.ts` : un siège (`combat.townId`) prend `backgrounds/siege-<faction>` →
  `siege` → repli terrain. Prompts d'art déposés (`combat-siege-backgrounds.md`).
  Sans JPEG ⇒ comportement **inchangé** (terrain), donc sûr à livrer avant l'art.
- **S6** — tour de tir rendue en **structure** (`buildStackToken`) : détection
  GÉNÉRIQUE `warMachine`+`immobile` côté défenseur (zéro id en dur), socle de
  pierre + sprite figé hors idle + pas de badge « 1 ». Repli procédural
  `buildStructureGraphic` (tourelle) si le sprite `arrow-tower` manque.
- **S7** — pré-combat siège : titre « Siège de \<ville\> » + rangée de défenses
  (Fort N / rempart / douve / tour, lues dans l'état) ; locales FR/EN. **S7.3** :
  médaillon de héros canvas = teinte déterministe (hash faction, `factionTint`) +
  initiale, au lieu du disque noir (constat 3.2). Vérifié en capture
  (`after-vague2-prebattle.jpg` : « SIÈGE DE LA VILLE » + Fort 3/Rempart/Douve/
  Tour + médaillon « H » ; `after-vague2-combat.jpg` : tour = structure de pierre).
- **Assets art (S4.1/S5a.1/S1.1)** : je ne peux pas peindre les PNG en headless
  ⇒ **prompts déposés** dans `assets/prompts/` (conventions doc 12), à générer et
  déposer plus tard (substitution par simple dépôt, clés stables). Le code
  consommateur (S4 câblé, S2.2 cracks câblé) est prêt ; le repli gracieux tient.
- **Restant** : S1.2/S1.3 (sélection de sprite de rempart par position — code
  client, mais visible seulement une fois l'art `siege-wall-*` produit) ; **S5b**
  (seul lot moteur, placement des machines — à traiter avec soin, golden) ; **S9**
  (polish/investigation). Docs 08 §2.4 + 12 §9 alignées dans ce lot.

**Statut :** Vagues 1 + 2/3(client) livrées.
