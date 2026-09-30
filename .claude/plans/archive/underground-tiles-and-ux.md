# Souterrain : tuiles dédiées + revue d'ergonomie

Deux demandes, un plan : (A) le souterrain doit **ressembler** à un souterrain —
des tuiles PNG produites pour lui, pas de la terre battue et des rochers
empruntés à la surface ; (B) une revue d'ergonomie du client.

## A — Tuiles du souterrain

### Constat

L10.3/L10.5 ont livré la couche, mais elle est peinte avec les terrains de
surface : `dirt` (terre labourée, sillons clairs) pour le sol, `rocks` (éboulis
gris froid) pour la roche. À l'écran, le souterrain est une **plaine de terre
tachetée de cailloux** — rien n'indique qu'on est sous terre. Et le bord de
monde y peint toujours un **océan** : la caverne flotte sur la mer.

### Ce qu'on livre

1. **Deux terrains data-driven** — `cave` (sol de caverne, franchissable) et
   `cave-wall` (paroi, infranchissable). Aucun diff moteur : `isPassable` lit
   `moveCost` de la config comme pour n'importe quel terrain.
2. **Tuiles PNG procédurales** (`gen_tiles.py`, règle P de la doc 12 :
   déterministe, tileable, 3 variantes) — carrées **et** iso, plus un **prop de
   relief** pour la paroi (stalagmites/piliers) : c'est ce qui donne la lecture
   « je suis dans une grotte » plutôt qu'un aplat sombre.
3. **Bord de monde souterrain** : au-delà du losange, de la roche noire, pas
   l'océan — le fond DOM suit la couche affichée.
4. **Câblage** : repli gouache de la tilemap, couleurs de mini-carte, densité de
   props, générateur (`TERRAIN_CHARS` + caverne), carte `proto-03`.

### Étapes

1. `config.json` : les deux terrains → vérif `content:check`.
2. `gen_tiles.py` : recettes `cave` / `cave-wall` + prop `cave-wall`, régénérer
   → vérif `_preview.png` (tileabilité) et **re-run = octets identiques**.
3. Client : `TERRAIN_COLORS`, `MiniMap`, `PROP_TERRAINS`, bord de monde par
   couche → vérif typecheck + smoke.
4. Contenu : `TERRAIN_CHARS`, caverne générée en `cave`/`cave-wall`, `proto-03`
   → vérif tests contenu + `content:check`.
5. Docs 12 (recettes) et 02 §2.1 (terrains de couche 1).

## B — Revue d'ergonomie

Audit via le skill `ux-audit` : captures par écran / viewport / cran de police,
confrontées aux principes du doc 08 (cibles ≥ 44 px, parité hover / appui long,
pile de modales ≤ 2, jamais la couleur seule, prévisualisation avant action
irréversible). Le souterrain ajoute deux surfaces neuves à passer au crible :
l'**indicateur de couche** et le **réglage « Souterrain »** de « Nouvelle
partie ».

Livrable : constats **priorisés** (P1 bloquant / P2 gênant / P3 confort) avec,
pour chacun, l'écran, la règle violée et le correctif proposé. Les correctifs
eux-mêmes ne sont pas dans ce lot sauf s'ils sont triviaux et sûrs.

## Journal

- **2026-09-01** — plan écrit.

---

## A — Journal

- **2026-09-01 — livré.**
  - **Terrains** `cave` / `cave-wall` dans `config.json` : le souterrain ne
    peint plus avec la terre et l'éboulis de la surface. Aucun diff moteur.
  - **Recettes** `gen_tiles.py` : sol de caverne (roche polie, flaques
    d'infiltration, gravier, deux éclats de minerai) et paroi (facettes froides,
    fissures). Contrôlé au damier 2×2 puis **rendu iso réel** — c'est cette
    seconde vue qui a tranché : la 1ʳᵉ passe de props était une **pelote
    d'aiguilles** (colonnes hautes et claires) qui masquait la carte. Repris en
    masses **basses et larges**, plus sombres que le sol.
  - **Bord de monde par couche** : la caverne flottait sur l'océan (frange de
    bas-fonds + fond DOM bleu). `buildWorldBorder(view, level)` et
    `applyWorldBackdrop` peignent de la **roche mère** en couche 1.
  - **Recadrage caméra à la bascule de couche** (trouvé en capture) : le héros
    arrivait collé au bord, face à une couche entièrement sous brouillard —
    écran quasi noir. Recadrage immédiat (un escalier est un téléport).
  - **Câblage** : repli gouache `TERRAIN_COLORS`, couleurs de mini-carte, densité
    de props, `TERRAIN_CHARS` du générateur, légende de `proto-03`.
  - Tests : contenu **176** (+1 : la caverne générée n'utilise QUE les terrains
    de couche 1, et la surface ne les emprunte pas) ; client **89** (+2 : fond de
    vide océan/roche). Déterminisme des deux scripts d'assets re-vérifié
    (re-run ⇒ octets identiques).

## B — Revue d'ergonomie (2026-09-01)

Référence : `docs/08-ui-ux.md`. Méthode : captures `capture.mjs` (11 écrans ×
2 viewports × 3 crans = 96 images) + deux captures dédiées aux surfaces neuves
du souterrain, aux crans 1 et 3. **État final : 3 warnings**, tous la même
pastille de combat (U-6) — le reste est propre, cibles comme troncatures.

### Constats

| # | Sév. | Règle | Écran / condition | Constat | Suite |
|---|---|---|---|---|---|
| U-1 | **P1** | A6/A1 | « Nouvelle partie », mobile 360 px, **cran 3** | Les rangées de 5 crans (`.segmented`, `overflow-x: visible`) débordaient du viewport : `newgame-guardians-random` mesuré à **x=528 pour 360 px de large** — « Abondant » et « Aléatoire » invisibles, hors de tout affordance (idem difficulté). *Précision après vérification* : la modale, elle, défile (`overflow: auto`), donc un glissement horizontal les atteindrait — mais rien ne l'annonce, ni scrollbar ni troncature visible : en pratique, le réglage n'existe pas pour le joueur. L'audit A1 ne le voyait pas : il mesure la **taille** des cibles, pas leur **débordement**. | **Corrigé** : `.segmented` passe en `flex-wrap: wrap` + base `4.5rem` (crans à la ligne, largeurs égales conservées sur desktop). Re-mesuré : 0 débordement aux deux crans. |
| U-2 | P2 | A5 | Barre de tour, toutes tailles | L'indicateur de couche était un libellé seul dans un cadre laiton pleine largeur : il se lisait comme un **champ de saisie désactivé**. | **Corrigé** : icône dédiée (`ui-surface` / `ui-underground`, générée) + `inline-flex` calé à gauche. |
| U-3 | P2 | A3 | Fiche d'objet (appui long) sur un escalier | Un escalier affiche la fiche générique du monolithe — « Téléporte vers son jumeau. » — **sans dire qu'il change de couche**. Le joueur ne peut pas distinguer un téléport local d'une descente. | **Corrigé** : la fiche lit la couche du jumeau et titre « Escalier », ligne « Descend au souterrain » / « Remonte à la surface ». |
| U-4 | ~~P3~~ | A7 | Aventure, mobile, cran 3 | **Non reproduit — constat erroné.** Mesure au ruban (360×640) : barre de ressources 52 px, bandeau d'armée 48 px, HUD bas **129 px au cran 1 / 149 px au cran 3** ⇒ bande de carte libre **407 → 387 px**, soit 60 % de la hauteur. Les « 230 px » venaient d'une capture où **deux toasts empilés** (« Semaine 1 commencée » + « Téléporté par le monolithe ») couvraient le haut de la carte — transitoires, pas une occupation permanente du HUD. | **Aucun correctif** : il n'y a rien à corriger. Entrée conservée barrée plutôt que supprimée — un constat faux dans un audit envoie le suivant à la chasse au fantôme. |
| U-6 | ~~P3~~ | A1 | Combat, mobile 360 px | **Faux positif de mon propre détecteur.** La pastille déborde bien (299→407 px), mais sa file `.combat-order` est en `overflow-x: auto` **avec fondu de bord et auto-scroll de la puce active** : un défilement horizontal délibéré, documenté (lot R6/E3). Le détecteur ne regardait que le **parent direct** — ici un `<li>` — et manquait le scroller d'un cran au-dessus. | **Détecteur corrigé** (voir Outillage) ; aucun défaut dans le jeu. |
| U-5 | P3 | — | Props de relief sous brouillard | Un prop posé sur une tuile **non explorée** dépasse au-dessus du voile des tuiles explorées devant lui (le brouillard est plat, le prop a 90 px de haut pour un losange de 32). Mesuré au souterrain : **224 props vivants, 150 sur des cases inexplorées**. | **Corrigé** : `TerrainProps.updateFog` masque les props des tuiles inexplorées, mémoïsé sur la référence du tableau (coût nul tant que le brouillard ne bouge pas). *Gain réel mesuré au diff d'écran : **2 671 px*** — la plupart des 150 étaient déjà couverts par le brouillard de leurs voisins ; ce qui fuyait, c'est la **frange** juste au-delà de la limite. Verrouillé en smoke. |

Le reste de la checklist ressort **conforme** : cibles ≥ 44 px partout (mesuré),
tap-tap conservé pour la descente (le déplacement standard), pile de modales
≤ 2, parité FR/EN des clés neuves, 3 crans sans troncature après U-1.

### Outillage

L'audit A1 mesurait la **taille** des cibles mais pas leur **débordement** :
c'est pour ça qu'il rendait « 0 warning » sur un écran où deux réglages étaient
hors champ. `capture.mjs` signale désormais une cible interactive **tronquée**
par le bord de l'écran, et la checklist du skill l'énonce.

Le prédicat a demandé **deux** passes de réglage, chacune révélée par un faux
positif :
1. « tout ce qui sort du viewport » signalait 36 écrans — les boutons du
   **tiroir héros fermé**, volontairement hors-canvas. Retenu : l'élément doit
   **chevaucher** le bord (commencer dedans, finir dehors) ; entièrement hors
   champ = panneau escamoté.
2. il restait 21 écrans, tous le même bouton « Couper le son » : sa rangée
   (`.actions-nav`) est en `overflow-x: auto` et **défile** — la cible est
   atteignable d'un glissement annoncé. Retenu : on ignore le cas où la
   **rangée porteuse** défile réellement. Volontairement le parent direct, pas
   la chaîne d'ancêtres : une modale scrollable plus haut ne rend pas
   découvrable un bouton sorti d'une rangée qui, elle, ne défile pas — c'était
   exactement U-1.

Vérifié dans les deux sens à 360 px / cran 3 : **0** sur le build corrigé
(aventure et « Nouvelle partie »), et **7 contrôles tronqués** dès qu'on
réinjecte `flex-wrap: nowrap` — le détecteur voit la régression qu'il est censé
voir, et rien d'autre.

---

## C — Traitement des constats P3 (2026-09-01)

Demande : « traite les problèmes ». Les trois entrées laissées ouvertes ont été
reprises une par une — et deux d'entre elles n'étaient pas ce que j'avais écrit.

- **U-5 — corrigé.** Le seul vrai défaut des trois. Instrumenté avant de coder
  (`TerrainProps.stats()` → surface de test `propStats`), parce que mon premier
  diff avant/après ne montrait rien : il comparait deux builds mal séquencés.
  Refait proprement (masquage neutralisé → capture → rétabli → capture) : 150
  props sur cases inexplorées, **2 671 px** de terrain qui cessent de fuir.
  Chiffre modeste et annoncé comme tel : la majorité de ces props était déjà
  couverte par le brouillard de leurs voisins, seule la **frange** de la limite
  était visible. Smoke étendu (`hiddenByFog > 0` au souterrain) : la régression
  serait attrapée si quelqu'un débranchait l'appel.
- **U-6 — faux positif, détecteur corrigé.** La file d'ordre de combat défile
  horizontalement **par conception** (fondu de bord + auto-scroll). Mon
  détecteur n'inspectait que le parent direct et manquait le scroller. Nouveau
  discriminant, validé sur les deux cas : un ancêtre qui déborde **en largeur
  sans déborder en hauteur** est un scroller horizontal délibéré ⇒ cible
  atteignable ; U-1, lui, avait pour seul scroller une **modale verticale**
  (`scrollHeight` 1 076 px de trop) dont le débordement latéral n'était qu'un
  accident. Re-vérifié : muet sur combat / aventure / « Nouvelle partie »
  corrigée, **7 contrôles** rattrapés dès qu'on réinjecte `flex-wrap: nowrap`.
- **U-4 — non reproduit.** Mesure au ruban : la bande de carte fait **387 px sur
  640** au cran 3 (60 %), pas 230. Mon chiffre venait d'une capture où deux
  toasts empilés couvraient le haut de l'écran. Rien à corriger ; l'entrée reste
  au tableau, barrée, avec la mesure.

Bilan : **1 correctif de jeu, 1 correctif d'outil, 1 constat retiré**.
