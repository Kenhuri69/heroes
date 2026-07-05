# 08 — UI / UX

## 1. Principes

1. **Touch-first** : cibles ≥ 44 px, aucune information exclusive au hover (tout tooltip a un équivalent « appui long » ou « 1er tap = inspecter »), gestes standards (pinch-zoom, drag-pan).
2. **Deux couches** : le canvas (carte, combat) est plein écran ; l'UI de gestion est en DOM par-dessus (panneaux, modales) — cf. doc 07.
3. **Modèle d'interaction « tap-tap »** partout où une action est irréversible : 1er tap = sélection + prévisualisation (chemin, cible, coût), 2ᵉ tap = confirmation. À la souris : hover = prévisualisation, clic = action (parité avec HoMM).
4. **Lisibilité d'état** : tout ce qui influence une décision (portées, initiative, moral, coûts) est affichable sans quitter l'écran courant.

## 2. Écrans principaux

### 2.1 Carte d'aventure (écran pivot)

```
┌────────────────────────────────────────────────┬──────────┐
│                                                │ RESSOURCES│  desktop :
│                                                │ (colonne) │  barre à droite
│               CANVAS carte                     ├──────────┤
│         (pan/zoom, plein écran)                │ portraits │
│                                                │ héros (8) │
│                                                ├──────────┤
│   [héros sélectionné : armée en 7 slots]      │ villes    │
│                                                ├──────────┤
│ [Fin de tour]  [Ville]  [Sorts]  [Menu]        │ mini-map  │
└────────────────────────────────────────────────┴──────────┘
```

- **Mobile portrait** : ressources en bandeau haut compact (tap = détail), héros/villes dans un tiroir latéral gauche, gros bouton « Fin de tour » en bas à droite, armée du héros en bandeau bas repliable. Mini-map dans le tiroir.
- Sélection héros → tap destination : trace le chemin avec jours nécessaires ; 2ᵉ tap : exécute. Interception d'événements en chemin = arrêt standard HoMM.
- Appui long sur tout objet de carte = fiche (tooltip riche).

> 🚧 **État U4** : **multi-héros / multi-villes** implémentés (lot UX U4). Le
> tiroir héros ouvre un **bandeau de portraits** (un par héros du joueur ; tap =
> sélectionner) — le héros **sélectionné** (`selectedHeroId`, repli 1er héros)
> pilote le tiroir, le bandeau d'armée, les points de mouvement et
> l'interaction carte ; la carte rend **un sprite par héros** avec un anneau sur
> le sélectionné. La barre d'actions liste **toutes les villes possédées** (une
> entrée par ville, badge de faction) — la 2ᵉ ville capturée est donc
> accessible. Le contenu MVP ne donne qu'un héros par joueur (pas de recrutement
> de héros au moteur) ; l'UI se généralise à N sans diff moteur. Le **transfert
> d'armée/artefacts** entre héros (doc §2.3) reste différé à U6.

### 2.2 Écran de ville

- Vue peinte interactive (les bâtiments construits apparaissent) + **onglet liste** : `Construire · Recruter · Marché · Guilde · Garnison`. Sur mobile, la liste est l'entrée principale (la vue peinte reste, en scroll horizontal).
- Panneau construction : arbre visuel avec états (construit / disponible / verrouillé + prérequis manquants en rouge / plus tard : file du jour suivant). 1 bâtiment/jour → le bouton global affiche « Construction du jour utilisée ».
- Recrutement : slider quantité + boutons min/max, coût total live, « tout recruter » (achat max multi-tiers).

> 🚧 **État U6a** : l'onglet **Marché** est fonctionnel — échange ressource ↔ or
> au bâtiment marché, taux data-driven (`config.market` : `sellRate`/`buyRate`,
> spread réaliste), via la commande moteur générique `TradeResources` (point
> d'extension : un effet de bâtiment `{ type: 'market' }`, aucun id en dur). UI :
> direction Vendre/Acheter + ressource + quantité, **aperçu de la contrepartie**
> (`tradeQuote`, pas de réimplémentation du taux). La **Guilde** (apprentissage
> de sort) reste différée (pas de commande moteur au MVP).

> 🚧 **État U5 (tranche A)** : **vue de ville peinte** — les bâtiments construits
> apparaissent en vignettes sur un décor gouache (dégradé placeholder), en bande
> à défilement horizontal (touch-first), au-dessus des onglets ; tap sur un
> bâtiment ⇒ onglet Construire. Réutilise les vignettes existantes (repli
> procédural). Décors bespoke par faction + spritesheets d'unités = tranches
> ultérieures du jalon Beta.

### 2.3 Écran héros

- Portrait, attributs, XP ; **poupée d'équipement** 10 slots + sac ; compétences (6 slots, rangs) ; grimoire (filtré par école/cercle, coût mana visible, sorts indisponibles grisés avec raison).
- Transfert d'armée/artefacts entre 2 héros : écran double-colonne, drag & drop (souris) / tap-tap (mobile), boutons « équilibrer » et « tout donner ».

> 🚧 **État 3.2** : l'« écran héros » est réconcilié avec le **tiroir héros** existant (`shell.tsx`) plutôt qu'un écran plein séparé — sections Compétences (`HeroSkills`) et Inventaire 10 slots (`HeroInventory`) ajoutées, mana affichée. Le **grimoire** est le livre de sorts **en combat** (`SpellBook`, bouton `[Sort héros]`) : sélection sort → cible → prévisualisation obligatoire → `CastSpell`. La modale de **choix de compétence** à la montée de niveau (`SkillChoice`, non annulable comme HoMM) se monte sur `pendingSkillChoices`. Poupée d'équipement **typée par slot** et transfert d'artefacts entre héros = raffinements ultérieurs (10 slots génériques en 3.2).

### 2.4 Écran de combat

```
┌────────────────────────────────────────────────────────────┐
│  [armée A: 7 vignettes]      round 3       [armée B: 7]    │  ← ordre du round
│                                                            │    (vitesse décroissante)
│                  CANVAS grille hex 12×10                   │
│        (surbrillance : hexes atteignables, cibles,         │
│         prévisualisation dégâts min–max & ripostes)        │
│                                                            │
│ [Attendre] [Défendre] [Capacité] [Sort héros]   [Auto ▶▶]  │
└────────────────────────────────────────────────────────────┘
```

- **Prévisualisation de dégâts obligatoire** avant confirmation : « 12–18 dégâts, ~3 morts · riposte estimée : 5–8 ».
- Mobile : combat **jouable en portrait** de plein droit — le plateau est rendu à une **échelle plancher** garantissant des hexes ≥ 44 px (touch-first, §1), puis **déplaçable au pan et zoomable au pinch** (parité avec la carte d'aventure) quand il déborde de l'écran. Le paysage reste possible mais n'est plus imposé par un overlay de suggestion de rotation.
- Vitesses d'animation ×1/×2/×4 + « combat auto » avec possibilité de reprendre la main à tout round (rejoue depuis l'état courant — gratuit grâce au déterminisme).

### 2.5 Autres écrans

Menu principal (Continuer / Scénarios / Escarmouche / Options), fiche de scénario (objectifs), fin de partie (stats, graphique de puissance), options (langue FR/EN, vitesse anims, taille UI, audio, daltonisme : cf. §4).

> 🚧 **État U6b** : l'écran de **fin de partie** (`OutcomeOverlay`) affiche un
> **graphique de puissance par joueur** — barres horizontales SVG triées par
> puissance décroissante, une par joueur, calculées sur l'état final via le
> helper moteur pur `playerPower` (Σ force d'armée héros + garnisons). Palette
> catégorielle validée (skill `dataviz`, thème sombre) ; **double encodage**
> libellé + valeur (jamais la couleur seule, §4) ; le joueur humain est mis en
> évidence. Stats détaillées (durée, pertes cumulées…) = raffinement ultérieur.

## 3. Navigation & flux

- **Routeur d'écrans** (source unique de navigation, lue par le DOM et les
  scènes Pixi) : une route de base `menu ⇄ adventure`. Le **combat n'est pas une
  route** : il est dérivé de l'état moteur (`game.combat ≠ null`) pour rester en
  phase avec l'auto-combat et le déterminisme (aucune désync route/état). Les
  overlays **forcés non annulables** (choix de compétence à la montée de niveau,
  fin de partie) sont dérivés de l'état moteur et vivent hors de la pile de
  modales (on ne peut pas les « fermer » par un retour arrière).
- Pile de modales max 2 niveaux ; bouton retour Android/geste (et Échap au
  clavier) = ferme la modale du dessus.
- Toutes les actions du tour sont annulables **tant qu'aucune information n'a été révélée** (déplacement sans découverte ni combat) — bouton « Annuler le déplacement » ; construction/recrutement non annulables (simplicité économique).
- Notifications de jeu : file de **toasts** éphémères (croissance hebdo, revenus, ramassage, construction/recrutement, niveau, fin de combat…) **filtrées au joueur humain** (les actions des IA ne notifient pas), doublées d'un **journal consultable** (bouton cloche du HUD avec badge de non-lus) — modale de la pile listant l'historique daté, la plus récente en tête. Le feedback positif inclut la **sauvegarde manuelle réussie**.

## 4. Accessibilité

- Mode daltonien : les couleurs des joueurs sont doublées de **motifs de bannière** ; états de combat doublés d'icônes (jamais couleur seule).
- Texte UI en DOM → zoom navigateur et lecteurs d'écran fonctionnent sur toute la gestion ; taille de police réglable (3 crans).
- Toutes les infos « hover » accessibles à l'appui long ; aucune action à double-clic ou clic droit obligatoire.

## 5. Direction artistique (cadrage)

- « **Gouache stylisée** » : décors peints aux contours doux, unités en spritesheets 2D (idle/move/attack/hit/death, 8–12 frames), lisibles à 64 px de haut.
- Chaque faction a sa palette et son langage de formes (Haven : verticales dorées ; Necropolis : aiguilles et voiles ; Arcane Hunters : violet nuit, argent, lanternes) — définis dans le paquet de faction.
- Placeholders : au MVP, des sprites génériques teintés + icônes suffisent ; la DA finale arrive par faction en Alpha/Beta.

> 🚧 **État U5-B (décors peints branchés)** : les fonds peints du staging
> (`assets/backgrounds/*.jpg`, logo) sont câblés via le registre d'assets
> (résolveurs `townBackgroundUrl`/`combatBackgroundUrl`/`outcomeBackgroundUrl`/
> `titleBackgroundUrl`/`logoUrl`, faction-agnostiques, repli gracieux) : **menu**
> (logo + fond de titre), **vue de ville** (fond peint par faction, dégradé en
> repli), **fin de partie** (victoire/défaite, voile de lisibilité) — tous en
> **DOM** (composés une fois par le navigateur, coût de rendu par-frame nul). La
> **toile de combat** est d'abord restée **différée** (le sprite Pixi plein écran
> faisait passer l'arène sous le plancher anti-gel ×4, doc 01 §5) puis livrée en
> U5-E via la couche DOM (cf. ci-dessous). Restent (jalon Beta) : spritesheets
> d'unités animées, fonds bespoke des factions/terrains encore sans asset.

> 🚧 **État U5-C (sprites d'unités en combat)** : les piles de combat affichent
> le **sprite statique de leur unité** (`assets/units/<faction>/<unitId>`, chargé
> hors bundle) sur une **base de camp colorée** (second canal, avec la position
> plateau + les bandeaux d'armée), animé par les tweens existants
> (déplacement/attaque/mort) ; **repli procédural** (polygone) si le sprite est
> absent/en cours de chargement. L'**animation frame-par-frame** (idle/move/
> attack/hit/death) reste différée : le pipeline `asset-sheet` produit des sprites
> statiques, pas des planches d'animation.

> 🚧 **État U5-E (toile de combat peinte, coût par-frame nul)** : le canvas Pixi
> passe en **transparent** (`backgroundAlpha: 0`) ; pendant un combat, le fond
> peint du terrain (`combatBackgroundUrl(terrain)`, repli gracieux) est posé en
> **`background-image` DOM de `#canvas-root`** — composé une fois par le
> navigateur, donc **coût de rendu par-frame nul**, contrairement au sprite plein
> écran retiré en U5-B qui cassait l'anti-gel ×4. Le champ de bataille peint
> apparaît autour du plateau (hexes semi-opaques) ; retiré à la sortie du combat
> et au retour menu. Anti-gel ×4 re-vérifié (arène ~23 fps, carte ~14 fps, rendu
> logiciel CI, plancher ≥ 5).
