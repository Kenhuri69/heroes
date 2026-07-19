# Plan — Refonte visuelle du combat de siège (approche globale)

> **Contexte** : après ~10 itérations de remédiation (plan
> `siege-visual-remediation.md`, PR #477/#480/#481/#483/#486/#488), le rendu du
> siège reste jugé inacceptable par le porteur. Ce plan repart de la
> **composition d'ensemble**, pas des détails. Plan vivant (guidelines §5).
>
> **Invariants** : zéro moteur (sauf arbitrage explicite), zéro faction dans
> `packages/`, RNG seedé, golden inchangé, pas de bump `CURRENT_SAVE_VERSION`,
> budget bundle < 800 Ko gzip (PNG hors bundle), touch-first ≥ 44 px, i18n
> FR/EN, docs 19/02/08/12 mises à jour dans les mêmes lots.

## 1. Diagnostic — pourquoi chaque tentative reste laide

Relecture chronologique des captures `docs/captures/siege/` :

| Capture(s) | Tentative | Pourquoi ça ne marche pas |
| --- | --- | --- |
| 01→03 (état audité doc 19) | murs = 1 sprite frontal identique par hex | Blocs épars qui zigzaguent dans un pré fleuri ; douve invisible ; aucune ville ; machines = fanions. |
| after-vague1 / -vague2 | douve en tuiles d'eau, tour = structure | La douve devient une **rangée de tuiles UI** bleues qui zigzague — lisible mais ce n'est pas un fossé creusé devant un mur ; le reste inchangé (prairie, murs épars). |
| after-wall-continuous | muraille procédurale continue (courtine + tours vectorielles) | Enfin continue, mais **dessin vectoriel plat** (aplats + traits) posé sur un décor peint : troisième langage graphique, ça se lit comme un placeholder. Échelle tours/unités incohérente. |
| after-wall-painted | pièces peintes (tours 512²) sur la colonne | Sprites **frontaux** plaqués sur un plateau **iso** : perspective en collision ; le même sprite se répète ; la courtine disparaît entre les tours ; ça « flotte » sur les tuiles d'eau. |
| after-iso-siege | tours peintes rapprochées | Un **totem de tours empilées** qui se chevauchent ; brèche = ellipse noire plate collée SUR le sprite ; échelle énorme vs unités. |
| after-wall-receding | muraille penchée (fuite iso simulée) | La rotation du sprite se lit comme un **accident de rendu** (escalier de tours qui se chevauchent, porte = rectangle flottant) — une fuite de perspective ne se simule pas en penchant des sprites frontaux. |
| after-breach-jagged | brèche déchiquetée | Toujours une **tache sombre plate** posée sur l'empilement penché ; l'intégration matière/lumière est impossible par-dessus un sprite qui n'a pas été peint troué. |

### Racines communes (le vrai problème, indépendant des pièces)

- **R1 — Composition inversée.** On part d'une grille de gameplay nue et on
  boulonne du décor dessus. HoMM3 fait l'inverse : un **champ de bataille
  peint d'un seul tenant** (terrain, douve creusée, enceinte avec porte et
  tours, cour/ville derrière, ciel) dans **une** perspective et **une**
  lumière — la grille se pose discrètement DANS ce tableau.
- **R2 — Trois langages graphiques superposés** : fond gouache peint + sprites
  peints + dessin vectoriel procédural plat (courtines, rochers, vaguelettes)
  + chrome UI saturé. Rien ne se fond avec rien.
- **R3 — La grille crie.** Aplat vert + pip blanc sur ~60 hexes en permanence
  (portée de déplacement toujours affichée) : le plateau se lit comme un
  surligneur de debug qui recouvre n'importe quel décor. HoMM3 : fine grille
  translucide, surbrillance seulement au survol/chemin.
- **R4 — Perspectives incompatibles.** Plateau iso (squash 0.68), sprites
  muraux frontaux, puis fuite diagonale simulée : trois systèmes de projection
  en collision dans la même image.
- **R5 — Aucune ville.** Rien derrière le mur : on ne voit jamais CE qu'on
  assiège (alors que des peintures de ville par faction existent déjà,
  `backgrounds/town-*.jpg`).
- **R6 — Échelles incohérentes.** Tour ≈ 3 hexes, courtine plus fine qu'une
  unité, brèche plus large qu'une tour, catapulte = fanion.

Conclusion : aucune retouche de pièce ne peut réparer R1–R4. Il faut décider
**qui possède l'image** : la scène peinte (la grille s'y glisse) ou la grille
(le décor s'y adapte). Toutes les tentatives passées ont choisi la grille.

## 2. Directions proposées (validation porteur AVANT implémentation)

### Direction A — Scène de siège peinte sur gabarit (recommandée)

Le décor de siège devient **une peinture plein-cadre** générée sur un
**gabarit géométrique dérivé du moteur** (géométrie fixe et connue : douve
col 10, remparts col 11, porte rangées 4–5, tour col 12, plateau 15×10 iso) :
champ de bataille aux 2/3 gauches, douve creusée puis enceinte crénelée avec
gatehouse central dans le tiers droit, **ville de la faction assiégée
au-dessus des remparts**, une seule lumière. Par-dessus, seules les parties
**dynamiques** restent des sprites : segments de rempart avec 3 états
(intact/fissuré/brèche béante) et porte, générés dans la **même perspective**
que la peinture (dérivés par édition d'image de la peinture maîtresse), ancrés
aux hexes moteur. La grille est apaisée (R3) : contour fin, surbrillances au
survol/sélection.

- **À quoi ça ressemble** : une capture HoMM3 — le joueur voit une ville
  assiégée, pas une grille décorée.
- **Coût** : génération + calage d'art (nouveauté : cette session PEUT générer
  les images elle-même — FLUX/Qwen + édition Kontext via outillage HF — plus
  besoin de déposer des prompts et d'attendre) ; itérations de QC visuelles ;
  un lot client de re-câblage (`syncWalls` → pièces ancrées au gabarit,
  suppression du procédural mural en présence d'art, repli conservé).
- **Impact archi rendu** : la peinture vit dans le **monde** (elle panne/zoome
  avec le plateau, ancrée aux coordonnées hexes) ; le fond DOM actuel reste le
  repli. Zéro moteur.
- **Risques** : alignement peinture↔hexes (mitigé : c'est la peinture qui est
  calée sur la géométrie exportée du gabarit, et la grille discrète tolère
  ±¼ hex) ; cohérence de style avec la gouache existante (mitigé : QC contre
  `town-*.jpg`, régénération au besoin).

### Direction B — Reconstruction géométrique 100 % client (zéro art nouveau)

Garder la composition dynamique mais la rendre cohérente avec l'existant :
bande de ville = `town-<faction>.jpg` recadrée/estompée derrière la ligne de
mur ; douve = **canal continu** (polygone lissé le long de la colonne, berges
sombres) au lieu de tuiles ; courtine continue redessinée **dans la vraie
projection iso du plateau** (squash appliqué au dessin, plus de fuite
simulée) ; grille apaisée (R3) ; échelles normalisées (R6).

- **Coût** : faible (client seul), livrable vite.
- **Limite assumée** : le procédural a déjà prouvé 10 fois qu'il ne « fait pas
  peint » — ça règle R1/R4/R5 mais pas R2 ; plafond nettement sous HoMM3.

### Direction C — Séquencement A avec lot 0 transversal

La direction A, découpée pour de-risquer : **Lot 0** = apaisement
grille/surbrillances + normalisation d'échelles (bénéficie à TOUS les combats,
y compris plaine, validable en 1 capture) ; **Lot 1** = scène peinte générique
+ pièces dynamiques ; **Lot 2** = variantes par faction ; **Lot 3** = polish
(machines, FX). Chaque lot = 1 PR + capture + retour porteur.

## 3. Décisions à valider

1. Direction (A / B / C) — recommandation : **C** (A séquencée).
2. Génération d'art par la session (FLUX/Qwen HF) acceptable, ou le porteur
   préfère générer lui-même (Gemini) sur mes gabarits/prompts ?

## 4. Lots d'exécution (direction C retenue)

- [x] **Lot 0 — Apaiser la grille** (client pur, tous combats). `hexgrid.ts` :
      aplat de portée 0.34→0.13, pip 4px/0.9→2.5px/0.55, liserés discrets
      (alpha 0.55), base 0.16→0.08 ; états rares (attaquable/zone/sélection)
      inchangés. A5 conservé (pip + liseré).
- [x] **Lot 1 — Scène de siège peinte** (`gen_siege_scene.py` + câblage).
      RÉALISÉ EN COMPOSITION HORS-LIGNE depuis la matière peinte existante
      (génération LLM d'images indisponible dans l'environnement — invoke HF
      désactivé) : scène = combat-grass + cour combat-dirt + fossé/eau
      procéduraux peints + ville town-<id> estompée ; ancrage exact via
      `assets/layouts/siege-scene.json` (géométrie moteur répliquée).
      **Écart au plan initial (en mieux)** : le rempart n'est PAS baké dans
      la scène — pièces PAR RANGÉE (`siege-piece-wall*`, 3 états + variante)
      dans `stacksLayer` avec `zIndex=y` ⇒ destruction par segment ET
      occlusion unités/mur correctes par construction. Porte/tours = art
      peint existant. Client : `syncSiegeScene`/`syncWallStructures`,
      `moatDecor` (A5 douve conservé), hexes de mur exclus de la teinte
      obstacle en mode scène, fond DOM = aplat sombre (une 2ᵉ toile plein
      écran recréerait l'incohérence).
- [x] **Lot 2 — Variantes par faction assiégée** : les 6 scènes
      `siege-scene-<factionId>.jpg` sortent du même générateur (bande de
      ville par faction). Livré avec le Lot 1 (même script).
- [ ] **Lot 3 — Polish** (après retour porteur) : props d'obstacles peints,
      FX de bombardement calés sur la scène, tour de tir intégrée à
      l'enceinte, porte ouverte/brisée, machines de guerre.

## Journal des décisions

- 2026-07-19 — Diagnostic rédigé (7 tentatives relues, racines R1–R6).
  Découverte : outillage de génération/édition d'images disponible dans cette
  session (change le coût de la direction A).
- 2026-07-19 — Session non-interactive (AskUserQuestion indisponible) :
  poursuite en autonome sur la recommandation **C** + art généré par la
  session. Clés de fichiers stables ⇒ le porteur peut substituer l'art
  (Gemini) par simple dépôt s'il rejette le rendu. Livraison Lot 0 + Lot 1
  en PR draft avec captures, puis STOP pour retour visuel du porteur.
- 2026-07-19 — Génération LLM d'images finalement INDISPONIBLE (invoke des
  spaces HF désactivé par l'environnement) ⇒ pivot : **composition
  hors-ligne déterministe** depuis la matière peinte du repo (toiles de
  combat, gatehouse, vues de ville). 3 itérations visuelles (tuiles
  mouchetées → toiles peintes ; eau « pont de navire » → eau procédurale ;
  pièces délavées → crops du gatehouse) avant l'état livré. Vérifs : 926
  tests moteur (golden inchangé), lint/typecheck, garde-fou faction,
  bundle 356 Ko gzip < 800, smoke siège+arène 4/4, captures
  `after-scene-*.jpg`. **Pas de bump `CURRENT_SAVE_VERSION`, zéro moteur.**
  Restant : retour visuel du porteur ⇒ Lot 3 (polish) ou itération scène.
- 2026-07-19 — Retour porteur (itération 1) : « sol hexagonal pour l'effet
  ville » + « tour à la bonne couleur ». Livré : pavage PAR HEX de la cour
  (`siege-tile-court-1..3`, hex aplati iso + débord anti-jointure, variante
  déterministe par case, posé dans `sceneLayer` z2 pour les cols à l'est du
  rempart) et tour d'extrémité recolorée pierre grise du gatehouse
  (`siege-piece-tower`, désaturation + refroidissement, alpha conservé,
  repli sur l'art crème). Clés stables ⇒ substituables par dépôt.
