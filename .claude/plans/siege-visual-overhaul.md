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
- 2026-07-19 — Retour porteur (itération 2) : « la porte ne va pas, mal
  cadrée » + « il manque du sol côté ville ». Livré : (a) **chaussée de
  pierre bakée** qui franchit la douve devant l'ouverture (scène + bande
  d'eau — la tour ouest du gatehouse ne mord plus sur l'eau nue), (b) porte
  recadrée **140 bp** (domine la courtine) avec **ombre de contact** bakée,
  (c) **esplanade pavée bakée** sur toute la bande de ville (les tuiles hex
  s'y fondent, plus de terre nue au-delà des cases), (d) vignettage adouci
  (70→44) — le sol côté ville n'est plus mangé par le cadre sombre.
- 2026-07-19 — Retour porteur (itération 3) : « la porte n'est pas calée
  dans le bon sens » (sol validé). Cause : gatehouse frontal étalé EN
  TRAVERS de l'enceinte verticale. Livré : **pièce de porte VERTICALE**
  `siege-piece-gate` (courtine double hauteur rangées 4–5, même appareil/
  merlons que les pièces, ARCHE + vantaux de l'art peint incrustés dans la
  face, 72 bp de large), z entre les 2 rangées d'ouverture (une unité entre
  dans le tunnel par le nord, en ressort par le sud) ; ombre de contact
  resserrée. Repli = art frontal si la pièce manque.
- 2026-07-19 — Retour porteur (itération 4) : « la tour derrière la porte
  n'est pas cohérente avec le mur et bien trop petite ». En mode scène, la
  tour de tir (structure S6) est rendue avec le sprite de TOUR PIERRE GRISE
  de la muraille (`siegeSceneTowerUrl`), plantée à sa base (ancre 0.94) à
  **86 bp** (elle domine la courtine, échelle des tours d'extrémité) + ombre
  de contact au sol. Hors scène : rendu structure historique inchangé
  (socle + arrow-tower). Zéro moteur (habillage pur, ciblage/stats intacts).
- 2026-07-19 — Retour porteur (itération 5, exigence de qualité globale) :
  « pas une tour de tir » + « intégration tours/murs = quick win moyen bof ».
  Deux refontes de fond : (a) **tour de tir dédiée**
  `siege-piece-arrow-tower` — tour grise + BALISTE peinte montée sur la
  plateforme (couronne re-superposée devant le châssis), l'arme se voit ;
  (b) **courtine re-conçue en bande strictement périodique** (période = pas
  de rangée, façade continue pleine masse + crête crénelée côté assaillant,
  ombre portée sur la cour) ⇒ raccords entre rangées invisibles PAR
  CONSTRUCTION, fini l'effet « tourelles empilées » ; brèche = bande PERCÉE
  (trou d'alpha déchiqueté + lèvres brisées + gravats). Variante -2
  supprimée (la périodicité exige des pièces identiques ; repli client déjà
  en place). Première passe « vue de dessus » (face/dents/chemin de ronde
  étroits) auto-rejetée au QC : rendu frise abstraite — non livrée.
- 2026-07-19 — Itération 6 INTERROMPUE par le porteur (« résultat laid, la
  porte encore une approche dégueulasse — trouve une solution qualitative
  avant de faire quoi que ce soit »). Kit procédural unifié (blocs-prismes
  par hex, porte 2-hex, tours rondes, baliste dessinée) : langage cohérent
  mais **plafond de qualité du dessin procédural < niveau de l'art peint du
  jeu** — constat racine de tous les rejets. STOP art/code. Deux voies
  qualitatives proposées au porteur, décision attendue :
  **A (recommandée)** — planche Gemini dédiée « kit de siège » via LE
  pipeline d'art du projet (gabarit géométrique + prompt de bande murale
  continue avec gatehouse/tours/baliste intégrés + jumelle « brèches »
  pixel-alignée + script d'extraction vers les clés existantes) ; toute
  l'architecture de rendu livrée (états par rangée, ancrage layout,
  profondeur, replis) sert telle quelle.
  **B** — bake hors-ligne UNIQUE et continu depuis les pièces peintes
  existantes (courtine+gatehouse+tours fusionnés, jumelle détruite
  pixel-alignée) — sans nouvel art, plafond = art existant.
  Ce commit fige l'état kit procédural comme BASE TECHNIQUE (non validée
  visuellement) ; aucun nouveau changement visuel avant l'arbitrage.
- 2026-07-19 — **Option A validée par le porteur** (planche Gemini dédiée).
  Livré : gabarit `assets/prompts/siege-kit-template.png` (grille 3×2, les
  volumes EXACTS du kit actuel en silhouettes-guides contrastées ⇒ le modèle
  repeint une géométrie déjà câblée, calage garanti), prompt + procédure
  `assets/prompts/combat-siege-kit.md`, extracteur
  `tools/assets/extract_siege_kit.py` (chroma-key, ajustement dans les
  canvas/ancres EXISTANTS, `--dry-run` avec aperçu ⇒ zéro changement client
  au dépôt de l'art). En attente : génération de la planche par le porteur
  (2048×1536, gabarit joint en image de référence), puis extraction +
  capture de vérification.
- 2026-07-19 — **Planche Gemini livrée par le porteur** (option A) : qualité
  au niveau du reste du jeu. Extraction appliquée (`extract_siege_kit.py` +
  décontamination magenta : unpremultiply, suppression de dominante,
  érosion 1 px) → les 6 pièces peintes remplacent le kit procédural dans
  les canvas/ancres EXISTANTS (zéro diff client). Garde anti-écrasement :
  `assets/combat/siege-kit-source.json` ⇒ `gen_siege_scene.py` ne ré-émet
  plus les pièces (le procédural reste le repli d'avant-art). Planche
  source committée (`assets/prompts/_incoming/siege-kit.png`, filigrane
  effacé). Smoke siège vert, captures rafraîchies.
- 2026-07-19 — Retour porteur (itération 7) : approche palette Gemini
  VALIDÉE, mais « les hexagones n'ont pas été réfléchis pour se
  connecter » — exact : le gabarit v1 faisait dessiner des OBJETS finis
  (4 côtés fermés), pas des pièces de raccord ⇒ porte déconnectée de l'eau
  et du mur, segments isolés. **v2 « run de muraille »** : gabarit
  `siege-run-template.png` (4 cellules, le mur SORT des cellules haut/bas,
  brèche aux extrémités raccordables, porte DANS le run + seuil vers la
  chaussée), extracteur `extract_siege_run.py` (échelle commune, courtine
  rendue tuilable verticalement, fenêtres d'exactement 1 rangée, layout
  patché piece/gate), client recalé en colonne DROITE (le zigzag par hex
  isolait les blocs). Tours v1 conservées (validées). En attente :
  planche v2 du porteur.
- 2026-07-19 — Retour porteur (itération 8, ferme) : la méthode gabarit→LLM
  est la bonne MAIS le gabarit doit être **ensembliste** — tout dessiner
  ensemble (mur+porte+tours+tour de tir+états) avec les connexions, puis
  seulement repasser au LLM. Bake intermédiaire jeté (rejeté à raison).
  Livré : **gabarit-tableau** `siege-ensemble-template.png` (fond = vrai
  décor du jeu : douve/chaussée/esplanade ; silhouettes v1 assemblées EN
  SITUATION — fissures r1, brèche r7, porte+seuil sur la chaussée, tours,
  tour de tir) + masque + cuts JSON ; **extracteur**
  `extract_siege_ensemble.py` (masque → run complet 2 px/bp + bandes-étalons
  d'état + tour de tir, layout "run") ; **client mode tranches**
  (`syncRunSlices` : frames du tableau par rangée, bande-étalon quand l'état
  réel diffère de l'état peint, caps/tours du tableau) — prioritaire dès que
  l'asset existe, replis intacts. En attente : peinture 1152×2048 du porteur
  (prompt v3 : « les blocs empilés = guide de masse, peindre UNE muraille
  continue », décor à ne pas repeindre).
- 2026-07-19 — Retour porteur (itération 9, en trois temps) : (1) capture du
  gabarit v2 — « un gabarit qui prévoit TOUS les éléments de la muraille —
  tour et tour de tir cassées » ; (2) rejet de l'extension du tableau sur
  décor (« cette approche ne marche pas ») ; (3) cadrage ferme : « gabarit
  complet sur fond violet présentant tous les cas possibles — porte,
  pont-levis, tour connectée au mur, mur cassé, tour de tir en retrait ; la
  tour seule c'est de la merde ; je veux une approche ENSEMBLE de la
  muraille ». Une planche à cellules v5 (objets isolés) a été écrite puis
  JETÉE en cours de route (rejet explicite des tours en cellules).
  **Livré — gabarit v6 = l'ENSEMBLE sur MAGENTA** (`gen_siege_ensemble_template.py`
  réécrit, `siege-ensemble-template.png` 1152×2048 + cuts JSON ; le masque
  d'extraction disparaît — chroma-key) : muraille d'un seul tenant ancrée sur
  la géométrie moteur — tours d'extrémité FUSIONNÉES au mur, rangée 1
  fissurée et rangée 7 CASSÉE (brèche) en situation, porte + **PONT-LEVIS**
  (tablier bois + chaînes, dans la région du run), **tour de tir EN RETRAIT**
  derrière la porte + sa **RUINE** derrière la brèche (hors région du run —
  la v3 bakait la tour dans les tranches). **Extraction**
  (`extract_siege_ensemble.py` réécrit : chroma-key `keyed_cutout(crop=False)`
  partagé + découpes géométriques) : `siege-run.png`, bandes-étalons
  intact/cracked/razed, `siege-piece-arrow-tower.png` + **nouvelle clé**
  `siege-piece-arrow-tower-razed.png`, patch layout bloc `run` (mode
  tranches client existant, zéro diff). **Client** : une tour de tir
  DÉTRUITE laisse sa ruine peinte sur son hex (`structureSpots` +
  `syncStructureRuins`, sprite `ruin:<id>` dans `wallStructures`, zIndex
  profondeur, purgé fin de combat ; no-op sans asset) ; détection structure
  factorisée `isSiegeStructure(stack)` (capacités `warMachine`+`immobile`,
  zéro id en dur). Prompt/procédure `combat-siege-kit.md` réécrits v6.
  Dry-run d'extraction validé sur le gabarit lui-même (run 340×1132, bandes
  73 px = 1 rangée, 2 tours de tir détourées). En attente : peinture
  1152×2048 du porteur sur le gabarit v6.
- 2026-07-19 — Peinture v6 du porteur REJETÉE (« les murs ne se connectent
  pas ») : les guides de courtine par rangée (pièces v1 empilées, chacune
  avec sa plateforme crénelée) ont fait peindre des BLOCS EMPILÉS — défaut
  du gabarit, pas de la peinture. Extraction v6 annulée (aucun asset
  écrit au dépôt). **Gabarit v7** : le guide de courtine devient UNE BANDE
  CONTINUE dessinée (66 bp, créneaux en ligne ininterrompue côté
  assaillant, ligne de parapet filante, fissures r1 EN SITUATION, brèche r7
  taillée DANS la bande — lèvres déchiquetées + gravats) ; tours/porte/
  pont-levis/tours de tir inchangés (validés dans la peinture v6). Prompt
  v7 durci : interdiction explicite des blocs empilés et de toute couronne
  crénelée EN TRAVERS du mur (critère d'acceptation dédié). Géométrie
  d'extraction inchangée (mêmes boîtes). En attente : peinture v7.
- 2026-07-19 — Guides v7/v7b (bande + volumes pseudo-3D dessinés) REJETÉS en
  bloc par le porteur (« tout est dégueulasse — revois pour une vue de
  dessus, et dans le prompt demande la profondeur avec petite
  inclinaison »). **Gabarit v8** : le gabarit devient un **PLAN vue de
  dessus** (empreintes au sol, géométrie pure sans volume) — bande de
  courtine continue à merlons marqués, **cercles de tours à cheval sur la
  bande** (fusion évidente en plan), fissures r1, brèche r7 déchiquetée +
  gravats, porte en travers de l'axe (tunnel + vantaux) + pont-levis bois,
  tours de tir en retrait (baliste vue de dessus) + ruine. La 3D est
  déléguée au **prompt v8** : caméra quasi zénithale, PETITE inclinaison,
  dessus dominants + fine bande de face sud, bases sur les empreintes.
  Géométrie d'extraction inchangée (mêmes boîtes, mêmes clés). En attente :
  peinture v8 du porteur.
- 2026-07-19 — Précision porteur (référence capture HoMM3) : « la tour doit
  aussi connecter APRÈS, pour un tout fermé en visuel ». v8b : la bande du
  plan va désormais de BORD À BORD de l'image (le mur entre par le haut,
  sort par le bas — l'enceinte se referme hors champ) ; les tours sont des
  points de passage SUR le mur (il les traverse), merlons interrompus
  seulement sous les couronnes et à la brèche ; annotations déplacées en
  marge ouest. Prompt aligné (ne pas terminer les extrémités du mur, le mur
  traverse les tours). Extraction inchangée.
- 2026-07-19 — **Peinture v8 du porteur INTÉGRÉE** (plan vue de dessus →
  Gemini : muraille d'un seul tenant de bord à bord, tours traversées, porte
  + pont-levis à chaînes, brèche, tours de tir — qualité au niveau du jeu).
  Intégration mesurée au pixel : (a) filigrane-étincelle effacé au masque
  (pas au rectangle — première tentative rognait l'épave) ; (b) boîtes de
  découpe RECALÉES sur la peinture (frontière porte 759.5 / baliste 765.2 bp,
  gravats ouest jusqu'à 569 bp, ruine 752..858×312..420) ; (c) l'extracteur
  EXCLUT les boîtes des tours de tir de la source du run (la pointe de
  baliste chevauchait la frontière) ; (d) étalon INTACT déplacé r8→r3 (r8
  contaminé par les gravats de brèche — les rangées « propres » recevaient
  des gravats) ; (e) **zones d'état** (`run.zones` : cracked [1,3], razed
  [6,9]) — le dégât peint déborde de sa rangée-étalon, la zone bascule d'un
  BLOC (tableau si l'étalon a vraiment l'état, bandes propres sinon) ⇒ mur
  net au round 1, brèche peinte de retour quand r7 tombe ; (f) client :
  pièces de tour de tir en VUE DE DESSUS posées à l'échelle du tableau
  (1/layout.scale, empreinte centrée) en mode run — ruine comprise.
  Vérifs : typecheck/lint/build, smoke siège+capture+gardien 3/3, captures
  `after-plan-v8-round1.jpg` / `after-plan-v8-auto.jpg` (rangées rasées par
  la catapulte = matière de brèche, intactes = bandes propres). Planche
  source committée (`_incoming/siege-ensemble.png`, filigrane effacé).
- 2026-07-19 — Retour porteur (« pas vu le mur sain ; les éléments cassés
  semblent coupés ; marge d'amélioration ») — trois causes distinctes
  corrigées : (1) le « mur jamais sain » venait du COMBAT FORGÉ S-TEST
  (héros à catapulte ⇒ C-SIEGE2.2 retire les rangées 3/6 dès le départ —
  comportement moteur voulu, pas un bug d'affichage) ⇒ hook
  `startSiege({ catapult: false })` (muraille complète indestructible) +
  capture `after-plan-v8-intact.jpg` ; (2) l'étalon INTACT (r3) était
  contaminé par une écornure peinte au-dessus de la porte ⇒ déplacé r9 +
  purge du déversement ouest à l'extraction (`wallWestBp`) — étalon
  garanti sain ; (3) BANDE RASÉE ÉTENDUE (`razedBandRows: 3`, layout +
  client) : une rangée rasée hors zone peinte tamponne désormais le TAS de
  gravats ENTIER (rangées haute/basse de la bande = déversement ouest
  seul, mur limité à sa rangée, profondeur au bas de la rangée rasée) —
  fini les tas coupés net. Captures rafraîchies (intact / round 1 avec
  catapulte / manche 7). Vérifs : typecheck, build, smoke siège 2/2.

## Suite (backlog validé porteur, post-merge — 2026-07-19)

Base actée : peinture v8 intégrée (« globalement on est bon »), marge
d'amélioration reconnue. À traiter dans l'ordre :

1. [x] **Coloration de la muraille par FACTION assiégée** (demande porteur) :
   donner une identité visuelle par maison — variantes teintées du run et
   des pièces (`siege-run-<factionId>` etc., repli générique inchangé),
   par recoloration déterministe hors-ligne façon `siege-piece-tower`
   (désaturation + LUT de teinte par faction : toits/bannières/liserés
   plutôt que la pierre entière) ; zéro moteur, clés registry + chaîne de
   repli déjà en place (`siegeSceneUrl` fait déjà ce motif par faction).

   **LIVRÉ (2026-07-19, branche `claude/siege-wall-faction-colors-zbg4ql`)** —
   décisions au fil de l'eau :
   - Vérif préalable : branche = `main`, aucune PR ouverte, aucune session
     parallèle sur cet item ⇒ démarrage.
   - Le run peint (`siege-run.png`) est de la pierre grise pure (aucun toit /
     bannière ; seuls accents = pont-levis bois + mousse). « Toits/bannières/
     liserés, pas la pierre entière » se réalise donc en **split-tone pondéré
     par la luminance** : les HAUTES LUMIÈRES (crêtes de merlons, liserés de
     blocs, arêtes qui accrochent la lumière) prennent la teinte de faction,
     la pierre mi-ton reste neutre ⇒ identité de maison sans repeindre le mur.
   - LUT de teinte par faction (`tools/assets/tint_siege_faction.py`, hors
     `packages/` ⇒ ids opaques autorisés) : 6 teintes bien séparées en teinte
     (haven bleu roi · necropolis vert spectral · arcane-hunters indigo ·
     sylvan ambre · vox-arcana turquoise néon · dungeon magenta), dérivées de
     la palette des écus (`gen_faction_badge.py`). `test-faction` exclue
     (placeholder, comme les scènes `siege-scene-*`).
   - Assets teintés : run + 3 bandes-étalons + tour de tir + ruine (chemin
     RUN live) ET pièces de repli (mur ×3, tour, porte). Variantes
     `<name>-<factionId>.png` déposées dans `assets/combat/` (auto-découvertes,
     hors bundle JS ⇒ budget épargné).
   - Client : résolveurs `siege*Url` gagnent un `factionId?` opaque
     (résolution `<clé>-<factionId>` ?? générique, calquée sur `siegeSceneUrl`) ;
     `this.siegeFactionId` mémorisé dans `syncSiegeScene`, consommé par
     `syncWalls`/`syncWallStructures`/`syncRunSlices` + jeton tour de tir + ruine.
   - Hook de test `startSiege({ factionId })` : param opaque optionnel (défaut
     `''`) pour capturer une muraille teintée en QC (aucune règle moteur).
   - Calibrage QC : split-tone sur pierre grise pure ⇒ variance perceptuelle
     forte selon la teinte (magenta/ambre ressortent, bleu/vert/turquoise
     s'effacent). Correctif : amplification de chroma (×1.35) autour du gris ⇒
     parité inter-faction. Réglages finaux : desat 0.78, force teinte
     0.12→0.50 (montée luminance 0.42→0.95). Captures in-app
     `docs/captures/siege/after-faction-tint-{necropolis,dungeon,haven}.jpg`
     (les 3 hues lisibles et distincts, pierre crédible, bois du pont-levis
     préservé). Tuiles de cour (`siege-tile-court-*`) laissées neutres (sol,
     pas muraille) — contraste avec le mur teinté.
   - **Vérifs (recette complète) VERTES** : `pnpm -r typecheck`, `pnpm lint`,
     vitest engine **935** (golden inchangé) + content **163** + client **33**,
     build OK, budget bundle **352.7 Ko** gzip ≤ 800, garde-fou faction ✓
     (aucun id dans `packages/`), garde-fou couleurs ✓ (aucune couleur hors
     tokens.css), smoke `@core` desktop + mobile **42/42**. **Zéro moteur,
     pas de bump `CURRENT_SAVE_VERSION`, golden inchangé.**
2. **Raccords de bandes** : quand plusieurs rangées adjacentes sont
   remplacées par des bandes-étalons, la phase des merlons saute d'une
   copie à l'autre — fondu/roll type `vtile` ou 2-3 variantes d'étalon.
3. **FX de bombardement recalés** : l'impact `WallBombarded` (éclats,
   secousse) doit viser la matière peinte de la rangée touchée (aujourd'hui
   calé sur l'ancienne géométrie de pièces).
4. Lot 3 historique (inchangé) : rochers d'obstacles peints, sprites des
   machines de guerre assaillantes, porte ouverte/brisée, marqueurs de
   douve aux rangées impaires.
