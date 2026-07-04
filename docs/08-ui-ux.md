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

### 2.2 Écran de ville

- Vue peinte interactive (les bâtiments construits apparaissent) + **onglet liste** : `Construire · Recruter · Marché · Guilde · Garnison`. Sur mobile, la liste est l'entrée principale (la vue peinte reste, en scroll horizontal).
- Panneau construction : arbre visuel avec états (construit / disponible / verrouillé + prérequis manquants en rouge / plus tard : file du jour suivant). 1 bâtiment/jour → le bouton global affiche « Construction du jour utilisée ».
- Recrutement : slider quantité + boutons min/max, coût total live, « tout recruter » (achat max multi-tiers).

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
- Mobile : combat en **paysage recommandé** (suggestion de rotation), jouable en portrait (grille réduite à l'écran, pan).
- Vitesses d'animation ×1/×2/×4 + « combat auto » avec possibilité de reprendre la main à tout round (rejoue depuis l'état courant — gratuit grâce au déterminisme).

### 2.5 Autres écrans

Menu principal (Continuer / Scénarios / Escarmouche / Options), fiche de scénario (objectifs), fin de partie (stats, graphique de puissance), options (langue FR/EN, vitesse anims, taille UI, audio, daltonisme : cf. §4).

## 3. Navigation & flux

- Pile de modales max 2 niveaux ; bouton retour Android/geste = ferme la modale du dessus.
- Toutes les actions du tour sont annulables **tant qu'aucune information n'a été révélée** (déplacement sans découverte ni combat) — bouton « Annuler le déplacement » ; construction/recrutement non annulables (simplicité économique).
- Notifications de début de tour : file de toasts (croissance hebdo, revenus, événements) consultable dans un journal.

## 4. Accessibilité

- Mode daltonien : les couleurs des joueurs sont doublées de **motifs de bannière** ; états de combat doublés d'icônes (jamais couleur seule).
- Texte UI en DOM → zoom navigateur et lecteurs d'écran fonctionnent sur toute la gestion ; taille de police réglable (3 crans).
- Toutes les infos « hover » accessibles à l'appui long ; aucune action à double-clic ou clic droit obligatoire.

## 5. Direction artistique (cadrage)

- « **Gouache stylisée** » : décors peints aux contours doux, unités en spritesheets 2D (idle/move/attack/hit/death, 8–12 frames), lisibles à 64 px de haut.
- Chaque faction a sa palette et son langage de formes (Haven : verticales dorées ; Necropolis : aiguilles et voiles ; Arcane Hunters : violet nuit, argent, lanternes) — définis dans le paquet de faction.
- Placeholders : au MVP, des sprites génériques teintés + icônes suffisent ; la DA finale arrive par faction en Alpha/Beta.
