# Plan — Revue d'ergonomie complète & corrections (référence MMHO)

> Revue demandée : « revue complète de l'ergonomie du jeu en s'appuyant sur celle
> de l'application Flash *Might & Magic Heroes Online* (MMHO), proposer une
> correction sur tous les points pertinents ». Ce plan consigne l'état de
> référence (méthode outillée), les constats, et le plan de correction par lots.
> Lot **documentaire** (ce fichier) : pas de code modifié, smoke test omis
> (guideline §7, changement purement markdown).

## 1. Méthode

Trois sources croisées (2026-07-07) :

1. **Passe `ux-audit`** sur le build de prod (30 captures : 5 écrans — menu,
   aventure, ville, héros, combat — × desktop 1280×800 / mobile 360×640 × 3
   crans de police) + mesures automatiques des cibles DOM. Résultat brut :
   **0 cible DOM < 44 px**, aucun débordement au cran 3 (les correctifs A1/A6
   des lots précédents tiennent).
2. **Inventaire du code client** (interactions réellement câblées, fichier:ligne
   cités dans les constats).
3. **Reconstitution documentée de l'ergonomie de MMHO** (jeu fermé fin 2020) :
   presse (GameStar, MMOHuts, F2P.com, mmos.com, jeuxvideo.com), wiki
   heroes-online.fandom.com et guide officiel repris par la communauté
   (clb.heroes-online.com), via extraits indexés. Les points non confirmés par
   les sources sont signalés « non confirmé » et n'ont pas servi de référence.

## 2. Référence MMHO — ce qui est transposable (et ce qui ne l'est pas)

MMHO était un **hybride MMO temps réel** (monde partagé, pas de tours, pas de
points de mouvement, endurance par combat) **+ combats hex tour par tour**.
Notre jeu suit le modèle HoMM classique (tours, PM, jours/semaines) — choix de
design acté (docs 01/02, « fidélité au core loop HoMM avant toute innovation »).

**Conventions MMHO retenues comme référence de correction** :
- **Écran pré-combat** (« Battle Overview ») : avant d'engager, une fenêtre
  montre l'armée ennemie, une **estimation de menace**, et deux boutons
  **Attaquer / Se retirer** (retraite sans pénalité). C'est le meilleur pattern
  UX de MMHO — il rend chaque combat un choix informé (doc 08 §1.4).
- **Barres d'état du héros toujours visibles** (mana jaune, XP verte avec
  progression vers le niveau) dans le HUD.
- **Armée en bandeau bas-centre**, fiche héros dans un tiroir attenant (notre
  layout actuel est déjà proche).
- **Options de confort** : désactivation des animations dans les options du jeu
  (pas seulement au niveau OS).
- **Hotkey d'écran** (H = fiche héros chez MMHO) — transposé en petit jeu de
  raccourcis desktop.
- **Ville en interface liste** : MMHO n'avait *pas* de vue peinte cliquable —
  notre écran liste + bande peinte est déjà au niveau ; la vue peinte complète
  reste un objectif Beta hérité des HoMM canoniques, pas de MMHO.

**Non retenus** (contraires à nos invariants ou au modèle à tours) :
- Endurance/stamina, monétisation dans l'UI (sceaux, permis de construire,
  révélation payante de l'armée ennemie) — F2P hors scope (doc 01).
- Production continue à l'heure réelle (dwellings 1/h) — remplacée par la
  croissance hebdomadaire HoMM déjà implémentée.
- **Flanc/dos** (+25 %/+50 % selon l'angle) : signature *mécanique* de MMHO,
  pas un correctif d'ergonomie — changerait le moteur de combat et
  l'équilibrage. Noté comme piste design (doc 02) hors de ce plan.
- Ordre d'initiative *aléatoire* par round (MMHO) : notre moteur a des vagues
  d'initiative déterministes ; on corrige l'**affichage** de l'ordre, pas la
  règle.

## 3. Constats

Colonnes : gravité (**P0** = promesse doc 08 non tenue ou accessibilité ;
**P1** = écart de parité HoMM/MMHO à forte valeur ; **P2** = confort),
référence (checklist A1–A8 de la skill `ux-audit`, doc, ou MMHO).

### 3.1 Transversal

| # | P | Constat | Preuve / référence |
|---|---|---|---|
| C1 | P0 | **Aucun appui long nulle part** : aucune fiche/tooltip riche n'existe (pas de `contextmenu`, pas de timer de maintien ; `input/pointer.ts:14-52` ne reconnaît que le tap). Le seul `title=` du client (`TownScreen.tsx:236`) est même **hover-only**, donc invisible au doigt. | A2, doc 08 §1.1/§4 |
| C2 | P2 | **Un seul raccourci clavier** (Échap, `shell.tsx:66-72`). MMHO avait au moins H = fiche héros ; HoMM vit au clavier sur desktop. | MMHO (MMOHuts), doc 08 §4 |
| C3 | P2 | **Pas de bascule « réduire les animations » dans les Options** — seul `prefers-reduced-motion` système est respecté (`interactions.css:90-100`, `CombatScene.ts:573-577`). MMHO offrait ce réglage en jeu. | MMHO (guide officiel) |
| C4 | P2 | L'option « daltonisme » promise par doc 08 §2.5 n'existe pas en tant que réglage — en pratique les **motifs sont toujours actifs** (FactionBadge, pips, pas de couleur seule) : c'est mieux qu'une option. **Correction = aligner le doc**, pas le code. | doc 08 §2.5 vs §4 |

### 3.2 Carte d'aventure

| # | P | Constat | Preuve / référence |
|---|---|---|---|
| C5 | P0 | **La prévisualisation de chemin n'affiche pas les jours** : points verts (aujourd'hui) / jaunes (plus tard) seulement (`render/pathPreview.ts:11-12`, `AdventureScene.ts:220-225`). Doc 08 §2.1 promet « trace le chemin **avec jours nécessaires** ». En plus l'info aujourd'hui/plus-tard est portée par la **couleur seule** (A5). | doc 08 §2.1, A5 |
| C6 | P0 | **Aucune fiche d'objet de carte** : mines, coffres, habitations, lieux, gardiens n'ont ni tooltip ni fiche (`render/mapObjects.ts` : aucun handler). Un gardien n'expose qu'une bande de force dans la barre de statut (`shell.tsx:163-166`). Doc 08 §2.1 : « appui long sur tout objet de carte = fiche ». | doc 08 §2.1, A2 |
| C7 | P0 | **Pas de bouton « Annuler le déplacement »** : promis par doc 08 §3 (« actions annulables tant qu'aucune information n'a été révélée »), et le déplacement en cours n'est pas interruptible (`AdventureScene.ts:167`). | doc 08 §3 |
| C8 | P1 | **Ressources sans détail ni revenu** : icône + valeur brute, « tap = détail plus tard » en commentaire (`shell.tsx:131-161`). Ni +X/jour, ni provenance (mines). HoMM/MMHO affichent le revenu. | doc 08 §2.1 (« tap = détail »), §1.4 |
| C9 | P1 | **Points de mouvement bruts** (« PM 1700 », `shell.tsx` barre de statut) : aucune jauge, aucun ordre de grandeur (1700 sur combien ?). MMHO affichait des **barres** (endurance/mana/XP) toujours lisibles. | MMHO (HUD), doc 08 §1.4 |
| C10 | P1 | **HUD mobile envahissant** (captures `adventure-mobile-*`) : bandeau ressources sur **2 lignes ≈ 190 px**, barre d'actions sur **2 rangées** (⚙ 🔔 Sauvegarder Charger Ville Fin de tour) + statut sur 3 lignes à gauche — la carte est réduite à ~50 % de l'écran, l'armée dépliée recouvre le centre. Doc 08 §2.1 : « ressources en bandeau haut **compact** ». | doc 08 §2.1, capture |
| C11 | P2 | **Sauvegarder/Charger occupent la barre de tour** (`shell.tsx:354-366`) alors que l'autosave existe — deux gros boutons de faible fréquence au niveau du geste le plus fréquent (fin de tour). | hiérarchie des actions |
| C12 | P2 | **Fin de tour sans garde-fou** (`shell.tsx:378-384`, dispatch direct) : pas d'avertissement si un héros a encore tous ses PM (convention HoMM). | HoMM, doc 08 §1.3 (esprit) |

### 3.3 Combat

| # | P | Constat | Preuve / référence |
|---|---|---|---|
| C13 | P0 | **Pas d'ordre d'initiative affiché** : le bandeau du haut liste les deux armées **triées par slot** (`combat.tsx:34-35`), pas l'ordre de passage. Doc 08 §2.4 (wireframe) : « ordre du round (vitesse décroissante) » ; le moteur a déjà des vagues d'initiative déterministes. | doc 08 §2.4 |
| C14 | P0 | **Aucune stat d'unité consultable en combat** : ni les chips (`combat.tsx:114-120`) ni les jetons Pixi (`CombatScene.ts:230-258`) n'exposent attaque/défense/PV/vitesse/statuts. Décider d'une cible sans pouvoir inspecter viole « lisibilité d'état » et A2. | doc 08 §1.4, A2 |
| C15 | P0 | **Pas de reprise de main pendant l'auto-combat** (`combat.tsx:42-47` : délégation sèche). Doc 08 §2.4 : « possibilité de reprendre la main à tout round ». | doc 08 §2.4 |
| C16 | P1 | **Pas d'écran pré-combat** : l'interception d'un gardien lance le combat directement ; la seule info est la bande de force du hint. MMHO ouvrait un **Battle Overview** (armée ennemie, niveau de menace, Attaquer/Se retirer sans pénalité). | MMHO (wiki « Engaging in a Battle ») |
| C17 | P1 | **Pas de retraite/fuite en combat** : aucune action pour interrompre un combat mal engagé (HoMM : fuite au prix de l'armée ; MMHO : retraite pré-combat). | HoMM/MMHO |
| C18 | P2 | **Chips d'armée tronquées** (« Élève de Sombr… », captures combat) et **hint volumineux** qui recouvre le plateau en mobile (`Sélectionnez une cible…`, capture `combat-mobile-font1`). | capture, doc 08 §2.4 |

### 3.4 Ville

| # | P | Constat | Preuve / référence |
|---|---|---|---|
| C19 | P1 | **« Tout recruter » absent** : recrutement par habitation (slider + Min/Max, `TownScreen.tsx:335-419`) mais pas d'achat max multi-tiers promis par doc 08 §2.2. | doc 08 §2.2 |
| C20 | P1 | **Liste Construire triée par id alphabétique** (`TownScreen.tsx:266`) : les bâtiments **verrouillés passent avant les disponibles** (capture town-desktop : 4 « Cercle… » verrouillés en tête). La bande peinte, elle, trie par statut (`TownScreen.tsx:217-219`) — incohérent. | §1.4, capture |
| C21 | P2 | **En-tête de ville anonyme** (« Ville », `TownScreen.tsx:94-101`) : ni nom de la ville, ni revenu quotidien, ni prochaine croissance hebdo — informations de décision (doc 02 §4) invisibles depuis l'écran. | HoMM, doc 08 §1.4 |
| C22 | P2 | **Vignettes de bâtiments manquantes** (carrés ocres pour Habitation : Recrue, Tableau des Contrats — captures town) : repli visuel pauvre au premier écran de gestion vu par le joueur. | doc 12 §10 |

### 3.5 Héros

| # | P | Constat | Preuve / référence |
|---|---|---|---|
| C23 | P1 | **Inventaire lecture seule, 10 slots non typés** (`HeroInventory.tsx:7-40`, « équiper/déséquiper = raffinement ultérieur ») : pas de poupée d'équipement, pas de sac, pas de choix d'artefact. Doc 08 §2.3 la promet (suivi déjà noté UXD-5). | doc 08 §2.3 |
| C24 | P1 | **XP sans progression** : « Niveau 1 · XP 0 » (`shell.tsx:251-259`) sans seuil du prochain niveau ni jauge. MMHO : barre d'XP verte permanente. | MMHO (HUD) |
| C25 | P2 | **Tiroir héros mal hiérarchisé en mobile** (capture `hero-mobile-font1`) : la mini-carte (grande, en tête) précède l'identité du héros ; portrait placeholder gris ; tout le contenu (armée, compétences, inventaire, grimoire, quêtes) en un seul scroll très long. | capture, doc 08 §2.3 |
| C26 | P2 | **Transfert armée/artefacts entre héros absent** (aucun code) — différé U6 de longue date ; le contenu actuel ne donne qu'un héros par joueur, mais l'escarmouche/hot-seat rend le cas atteignable. | doc 08 §2.3 |

### 3.6 Conforme (à préserver, aucune action)

Tap-tap + prévisualisation de dégâts obligatoire (A3) ; pile de modales ≤ 2 +
Échap/retour Android (A4) ; motifs/pips non chromatiques (A5) ; 3 crans de
police sans casse (A6) ; plancher hex 44 px + pan/pinch en combat (A7/CL7
corrigé) ; i18n FR/EN (A8) ; cibles DOM ≥ 44 px (A1) ; toasts filtrés + journal
à badge ; `:focus-visible` ; `prefers-reduced-motion` ; grimoire avec raison
d'indisponibilité (`SpellBook.tsx:202`).

## 4. Plan de correction par lots

Chaque lot est livrable seul, ouvre son plan `.claude/plans/ux-m<η>-….md` au
démarrage, met à jour `docs/08-ui-ux.md` dans le même commit (docs = source de
vérité) et étend le smoke/les tests (guideline §7). Aucun lot n'introduit de
cas de faction dans le moteur (invariant §8).

### Lot M1 — Combat : lisibilité d'état (C13, C14, C18) — P0, client seul
1. **Bandeau d'ordre de passage** : remplacer le tri par slot par l'ordre réel
   du round (le moteur expose déjà les vagues d'initiative) — une rangée de
   chips dans l'ordre d'action, pile active en tête, camp indiqué par la base
   colorée + bord (2ᵉ canal A5).
   → *Vérif* : test unitaire d'ordre (état moteur → ordre affiché) + capture.
2. **Fiche de pile** : tap sur une chip ou un jeton (et hover desktop) ⇒
   panneau stats (effectif, PV restants de la tête de pile, attaque/défense,
   dégâts min–max, vitesse, initiative, statuts actifs, capacités). Aucun
   nouveau canal moteur : tout est dans l'état de combat.
   → *Vérif* : smoke « ouvrir la fiche d'une pile ennemie au tap » +
   fermeture Échap/retour.
3. **Chips lisibles** : effectif en gras + nom non tronqué sur 2 lignes ou
   défilement ; hint mobile réduit à une ligne ancrée à la barre d'actions
   (plus de recouvrement du plateau).
   → *Vérif* : captures mobile font1/font3 sans recouvrement.

### Lot M2 — Carte : chemin, annulation, fiches (C5, C6, C7) — P0
1. **Jours sur le chemin** : étiquette numérique (J1, J2…) au point d'arrêt de
   chaque journée + forme distincte du dernier pas (anneau) — la couleur cesse
   d'être le seul canal (A5). Coûts déjà calculés pas à pas
   (`AdventureScene.ts:220-225`).
   → *Vérif* : test unitaire découpage en jours ; capture chemin multi-jours.
2. **Bouton « Annuler le déplacement »** visible pendant la prévisualisation
   (efface l'aperçu) — et, conformément au doc 08 §3, pas d'undo après
   exécution (une découverte a pu être révélée) : le doc reste la règle.
   → *Vérif* : smoke tap-préviz → annuler → plus d'aperçu.
3. **Fiche d'objet de carte** : composant fiche générique (modale légère de la
   pile) ouvert par **appui long** (timer ~450 ms dans `input/pointer.ts`,
   nouveau geste `onLongPress`) et clic droit/hover long desktop, sur objets et
   villes : nom localisé, type, contenu (ressource/artefact), armée d'un
   gardien (bande de force + composition), propriétaire d'une mine.
   → *Vérif* : smoke « appui long sur une mine ⇒ fiche » ; A2 re-passe au vert.

### Lot M3 — Pré-combat & retraite (C16, C17) — P1, un point moteur
1. **Écran pré-combat** (pattern MMHO transposé) : à l'interception d'un
   gardien/héros/garnison ennemie, overlay AVANT le combat : composition
   ennemie (visible — pas de brouillard de composition au MVP), **estimation de
   menace** (rapport de forces via le helper moteur pur existant type
   `playerPower`, rendu en libellé + icône, jamais couleur seule),
   boutons **Attaquer / Se retirer** (se retirer = le héros reste sur place,
   déplacement dépensé — pas de pénalité supplémentaire, comme MMHO).
   → *Vérif* : test moteur « retraite pré-combat ne lance pas le combat » ;
   smoke desktop+mobile.
2. **Fuite en combat** : bouton « Fuir » (barre d'actions) — le héros perd son
   armée restante mais survit et réapparaît en ville (convention HoMM), ou
   version simplifiée « abandonner = défaite du combat » si le moteur ne gère
   pas encore le retour en ville. **Commande moteur générique** (`Flee`),
   zéro donnée de faction.
   → *Vérif* : test moteur golden (déterminisme préservé) + smoke.
3. Mettre à jour doc 02 §5 et doc 08 §2.4 (nouvel écran, nouvelle commande).

### Lot M4 — Auto-combat : reprise de main (C15) — P0, point moteur possible
1. Passer le bouton « Auto ▶▶ » en **bascule** : l'IA joue round par round
   (le moteur sait déjà jouer un camp) ; « Reprendre la main » interrompt à la
   fin du round courant. Si `AutoCombat` résout aujourd'hui tout le combat d'un
   bloc, ajouter une variante générique « jouer un round auto » (pas de règle
   nouvelle, réutilise l'IA de combat existante).
   → *Vérif* : test moteur « auto N rounds puis manuel = état identique au
   replay » (déterminisme) ; smoke bascule auto → reprise.

### Lot M5 — HUD mobile compact (C10, C11) — P1, client seul
1. **Bandeau ressources 1 ligne** : format compact (2 000 → « 2k » au-delà de
   4 chiffres), ressources de faction repliées derrière le **tap = détail**
   (voir M6.1) ; hauteur cible ≤ 56 px.
2. **Barre d'actions regroupée** : conserver ⚙ (options) / 🔔 (journal) /
   Ville / **Fin de tour** ; déplacer Sauvegarder/Charger dans le panneau
   Options (l'autosave couvre déjà la fin de tour) — corrige C11 aussi sur
   desktop.
3. **Statut compact** : « J1 S1 » + jauge PM (voir M6.2) sur une ligne.
   → *Vérif* : captures mobile font1–3 : la carte occupe ≥ 70 % de la hauteur ;
   mesures A1 toujours vertes ; smoke fin de tour inchangé.

### Lot M6 — Économie visible (C8, C9, C24) — P1, client seul
1. **Tap sur une ressource ⇒ détail** : popover (pile de modales) listant
   revenu/jour (villes + compétence Économie + mines possédées, calculés par
   helpers moteur purs existants ou nouveaux helpers purs), et le stock.
   Affichage « +X/j » sous la valeur en desktop.
2. **Jauge de PM** : barre fine sous le héros sélectionné dans le HUD
   (PM restants / PM max du jour) + chiffre au tap — même pattern que MMHO
   (barres toujours lisibles).
3. **Jauge d'XP** : dans le tiroir héros, barre XP → seuil du prochain niveau
   (le moteur expose déjà la table d'XP), libellé « XP 120 / 300 ».
   → *Vérif* : tests unitaires des helpers (revenu/jour, seuil XP) ; captures.

### Lot M7 — Ville : décision au premier écran (C19, C20, C21, C22) — P1
1. **« Tout recruter »** : bouton global de l'onglet Recruter (achat max
   multi-tiers, ordre du tier le plus haut au plus bas, borné par ressources) ;
   confirmation avec coût total (tap-tap, doc 08 §1.3).
   → *Vérif* : test unitaire de l'algorithme (pur, côté client sur helpers
   moteur) + smoke.
2. **Tri de la liste Construire par statut** (disponible → construit →
   verrouillé), réutilisant `VIEW_STATUS_ORDER` de la bande peinte.
   → *Vérif* : test unitaire de tri.
3. **En-tête de ville** : nom localisé de la ville + faction, revenu or/jour,
   compte à rebours de croissance (« croissance dans N jours »).
   → *Vérif* : capture + i18n FR/EN (A8).
4. **Vignettes manquantes** : compléter `assets/buildings/` (skill
   `asset-sheet`) pour Habitation : Recrue et Tableau des Contrats — suivi
   asset, hors code.

### Lot M8 — Confort desktop & finitions (C2, C3, C4, C12, C25) — P2
1. **Raccourcis desktop** : `E` fin de tour, `H` tiroir héros (hotkey MMHO),
   `T` ville, `Espace` = Attendre en combat, `D` = Défendre, Échap inchangé.
   Jamais requis (mobile intact), documentés dans Options.
   → *Vérif* : smoke clavier (E termine le tour).
2. **Option « Réduire les animations »** : bascule Options qui force le chemin
   `prefers-reduced-motion` existant (union OS ∪ option).
3. **Garde-fou fin de tour** : si ≥ 1 héros a tous ses PM, la fin de tour
   demande confirmation (modale légère, tap-tap) — désactivable dans Options.
4. **Tiroir héros réorganisé** : identité (portrait, niveau, jauges XP/mana) en
   tête, puis sections repliables (Armée, Compétences, Inventaire, Grimoire,
   Quêtes) ; mini-carte en dernier (elle a sa version fixe desktop).
5. **Doc 08 §2.5** : remplacer l'option « daltonisme » par la formulation
   réelle (motifs non chromatiques toujours actifs, §4) — C4.
   → *Vérif lots 2–5* : captures avant/après + A1/A6 re-passés.

### Différé (hors plan, re-noté)
- **Transfert armée/artefacts entre héros** (C26) et **équipement interactif à
  slots typés** (C23) : dépendent de commandes moteur nouvelles
  (`TransferArtifact`, `EquipArtifact`) — à cadrer dans un lot moteur+UX dédié
  (reprend le suivi UXD-5/U6 existant), après M1–M8.
- **Flanc/dos MMHO** : piste de design de combat (doc 02) — décision de
  gameplay, pas d'ergonomie.
- **Layout desktop en colonne droite complète** (doc 08 §2.1) : reste le suivi
  UXD-8 ; M5/M6 n'y touchent pas.

## 5. Ordre conseillé & critères de sortie

Ordre : **M1 → M2 → M4 → M5** (P0 + mobile, valeur immédiate) puis **M3 → M6 →
M7** (parité MMHO/HoMM) puis **M8** (confort). Chaque lot re-passe la skill
`ux-audit` (captures avant/après) ; critère de sortie global :

- A2 vert (appui long/fiches partout où une info existe au survol) ;
- A5 vert sur le chemin d'aventure (jours chiffrés, plus de couleur seule) ;
- promesses doc 08 §2.1/§2.4/§3 tenues (jours sur chemin, ordre du round,
  reprise d'auto-combat, annulation de déplacement) ou doc amendé ;
- budget bundle < 800 Ko gzip et anti-gel ×4 inchangés (CI).

## 6. Journal du plan

- 2026-07-07 : revue complète effectuée (captures + inventaire code + référence
  MMHO sourcée) ; constats C1–C26 ; plan M1–M8 rédigé. Aucun code modifié.
- 2026-07-08 : **Lot M8 livré** (plan `ux-m8-confort-desktop.md`) — DERNIER lot :
  C2 (raccourcis clavier desktop), C3 (option « réduire les animations » ∪ OS),
  C12 (garde-fou de fin de tour), C25 (tiroir héros réordonné), C4 (doc aligné
  sur les motifs non chromatiques toujours actifs). **Revue MMHO close** : tous
  les constats P0/P1 traités ; P2 traités ou re-notés (voir §5). Suivis restants
  hors plan : C22 (vignettes asset), transferts entre héros / équipement typé
  (commandes moteur, section « Différé »).
- 2026-07-08 : **Lot M7 livré** (plan `ux-m7-ville.md`) — C19 (« Tout recruter »
  glouton borné par ressources), C20 (tri Construire par statut), C21 (en-tête
  ville nom/revenu `townIncome`/croissance). C22 (vignettes manquantes) = suivi
  asset.
- 2026-07-08 : **Lot M6 livré** (plan `ux-m6-economie-visible.md`) — C8 (fiche
  ressource stock + revenu/jour via helper moteur pur `dailyIncome`), C9 (jauge
  PM restants/max), C24 (jauge XP vers le prochain niveau).
- 2026-07-08 : **Lot M5 livré** (plan `ux-m5-hud-mobile.md`) — C10 (barre de
  ressources compacte 1 rangée, nombres abrégés) + C11 (Sauvegarder/Charger
  déplacés vers la section Données des Options). Client seul.
- 2026-07-08 : **Lot M4 livré** (plan `ux-m4-auto-combat-reprise.md`) — C15 :
  `AutoCombat{rounds}` moteur (générique, rétro-compatible) + bascule client
  « Auto ▶▶ » ⇄ « Reprendre la main » round par round ; l'Auto-Battle
  instantané reste sur l'écran pré-combat (#144). Le lot M3 est PARTIELLEMENT
  couvert par #144 (écran pré-combat) — reste M3.2 (retraite/fuite) à cadrer.
- 2026-07-08 : **Lot M2 livré** (plan `ux-m2-carte.md`) — C5 résiduel
  (étiquettes numériques J1/J2 aux points d'arrêt, A5 levé), C7 (bouton
  « Annuler le déplacement »), C6 (geste `onLongPress` + fiche d'objet de
  carte, 7 types, garde brouillard). Fiche des villes différée à M7.
- 2026-07-08 : **Lot M1 livré** (plan `ux-m1-combat-lisibilite.md`) — C13
  (ordre de passage via `roundActionOrder` moteur pur), C14 (fiche de pile au
  tap), C18 (chips 2 lignes, consigne mobile compacte). Couvre aussi le Lot 2
  du plan `homm-online-divergence-remediation.md`. Entre-temps, le lot C-3
  (#124) a livré le **compte de jours réel** de la préviz de chemin — M2.1 se
  réduit aux **étiquettes numériques** (la couleur par jour reste seule, A5).
