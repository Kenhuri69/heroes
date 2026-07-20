# Audit ergonomique — menus de départ (accueil + Nouvelle partie + Options)

> Demande utilisateur (2026-07-20) : « audit complet des menus au début du jeu
> pour améliorer l'UX et la lisibilité, approche ergonomique. La création d'une
> carte est lourde avec beaucoup d'options. »
>
> Skill `ux-audit` : source de vérité `docs/08-ui-ux.md` (checklist A1–A8).
> **Passe d'audit** = consigner les constats (pas corriger). Périmètre : écran
> d'accueil (`menu`), modale **Nouvelle partie** (`newgame`, cœur du retour),
> Options (`options`). Desktop 1280×800 + mobile 360×640, 3 crans de police.

## Méthode

1. [ ] Captures de référence (`capture.mjs`) : menu/newgame/options × 2 viewports
   × 3 crans + mesures A1 (< 44 px = WARN).
2. [ ] Inventaire code (file:line) des composants : MainMenu, NewGameScreen,
   OptionsPanel, LoadingOverlay — nombre et regroupement des options.
3. [ ] Confrontation doc 08 (§1 principes, §2 écrans, §4 accessibilité).
4. [ ] Constats priorisés P0/P1/P2 + recommandations (surtout allègement de la
   création de carte : progressive disclosure, presets, regroupement).

## Méthode exécutée

- 96 captures `capture.mjs` (build prod + preview), desktop 1280×800 + mobile
  360×640, 3 crans de police. **A1 (cibles ≥ 44 px) : 0 warning** — le problème
  n'est PAS la taille des cibles mais la **charge cognitive / densité / lisibilité**.
- Inventaire code : `MenuScreen.tsx`, `NewGameScreen.tsx`, `OptionsPanel.tsx`,
  `newgame.css`, `options.css`.

## Constats priorisés

### Écran d'accueil (`MenuScreen.tsx`)

- **M-P1a — Contraste du menu sur l'art de fond** (A5/lisibilité). Le panneau
  d'actions est **translucide** au-dessus d'une illustration très détaillée
  (`menu.css` `.menu-actions` sur `titleBackgroundUrl`). Résultat mesuré sur
  captures desktop+mobile : « Continuer » (désactivé) et le sous-libellé « Aucune
  sauvegarde » sont **quasi illisibles**, les titres de section (« CAMPAGNES »)
  aussi. → besoin d'un fond opaque/assombri derrière la colonne de boutons.
- **M-P1b — Libellé « Chargement des ressources… » résiduel** derrière le menu
  (bleed-through visible desktop ET mobile, `menu-*-font1`). Un overlay/label de
  chargement reste monté sous le panneau translucide ⇒ artefact visuel permanent.
  À investiguer (`LoadingOverlay`/label de boot vs z-index/opacité du menu).
- **M-P2a — Deux entrées concurrentes** « Nouvelle partie » vs « Escarmouche »
  (`MenuScreen.tsx:84-97`) : distinction non évidente pour un nouveau joueur
  (les deux lancent une partie configurable). Clarifier libellé/description ou
  fusionner.
- **M-P2b — Pas de hiérarchie primaire/secondaire** : Continuer / Nouvelle partie
  / Escarmouche / Éditeur / Options + Campagnes + Scénarios + Événements empilés
  à poids visuel égal, colonne qui s'allonge (scroll). Distinguer l'action
  primaire (Continuer/Nouvelle partie) du reste.

### Nouvelle partie (`NewGameScreen.tsx`) — cœur du retour « lourde, trop d'options »

- **NG-P0a — Aucune divulgation progressive.** **11 sections plates** toujours
  visibles (`NewGameScreen.tsx:169-374`) : Joueurs, Sièges, Taille, Ressources,
  **4 curseurs de densité** (Gardiens/Mines/Bâtiments/Ramassables = **20 boutons**),
  Difficulté, Graine, Lancer. L'essentiel (ta faction, nb d'adversaires, taille)
  est noyé dans du réglage avancé. Preuve : mobile font1, le viewport ENTIER est
  consommé par nb-joueurs + le seul siège « Vous » ; le siège Joueur 2 commence à
  peine (`newgame-mobile-font1.png`).
- **NG-P0b — Pas de préréglage / départ rapide + bouton « Lancer » enterré.**
  Un joueur qui veut « moi vs 1 IA, carte standard » doit parcourir tout le
  formulaire ; « Lancer » est la **dernière** section (`:365`), après un long
  scroll (surtout mobile). → besoin d'un « Partie rapide » (1 tap) et/ou d'un
  pied collant avec « Lancer ».
- **NG-P1a — Sur-habillage par siège.** Chaque siège affiche 2 selects + **8
  pastilles de couleur** + **4 boutons d'équipe** (`:242-267`), même en solo où
  couleur/équipe sont hors-sujet ⇒ un siège ≈ un demi-écran mobile. Replier
  couleur/équipe/héros derrière un « détails » par siège.
- **NG-P1b — Selects ambigus non étiquetés** (lisibilité). Les deux `<select>`
  empilés d'un siège (faction puis héros, `:213-241`) sont **visuellement
  identiques** sans étiquette « Faction »/« Héros » (capture : « Havre » puis
  « Aléatoire » côte à côte, on ne sait pas lequel est quoi).
- **NG-P1c — Contrôles de densité redondants en apparence.** Un niveau
  « Ressources » (bas/standard/riche) **plus** 4 curseurs par catégorie = 5
  réglages de densité concurrents, forte charge cognitive. Regrouper sous
  « Options avancées », garder « Ressources » comme réglage simple par défaut.
- **NG-P2a — Rangées segmentées trop denses** (A6). Taille de carte = **6**
  colonnes égales, densités = **5** ; libellés (Petite/Moyenne/Grande/Immense/
  Colossale/Aléatoire) serrés dans un modal de 480 px, risque de retour à la
  ligne aux crans 2/3.
- **Positifs** : A1 vert partout (≥ 44 px), i18n complète (FR/EN basculent),
  pastilles de couleur avec `aria-pressed` (2ᵉ canal pour la sélection), modal
  `max-height:86vh; overflow-y:auto` (scroll interne propre).

### Options (`OptionsPanel.tsx`) — RAS majeur
- 6 sections structurées (langue, police, vitesse combat, accessibilité, audio,
  télémétrie), longueur raisonnable, réutilise proprement `options.css`. Pas de
  constat bloquant.

## Recommandations (ordre d'impact)

1. **NG — Divulgation progressive + Partie rapide** (P0) : en-tête « Partie
   rapide » (moi vs 1 IA, carte moyenne standard, 1 tap) ; sections
   « Essentiel » (joueurs, ma faction, taille) visibles ; **« Options
   avancées »** repliable (densités par catégorie, ressources fines, difficulté,
   graine, couleurs/équipes). Pied collant avec « Lancer ».
2. **NG — Sièges compacts + étiquettes** (P1) : faction + contrôleur en ligne ;
   couleur/équipe/héros derrière un « détails » par siège ; étiqueter les selects.
3. **Menu — Contraste & résidu** (P1) : fond opaque/assombri derrière la colonne
   d'actions ; corriger le label « Chargement… » résiduel ; hiérarchiser
   primaire/secondaire.
4. **Menu — Clarifier Nouvelle partie vs Escarmouche** (P2).

## Journal

- 2026-07-20 — Ouverture de l'audit après merge #512. Skill ux-audit lancé.
- 2026-07-20 — Audit exécuté : 96 captures (A1 vert), inventaire code. Constats
  consignés ci-dessus. Le retour « création lourde » est confirmé
  empiriquement (NG-P0a/b). Recommandations priorisées. Décision d'implémentation
  attendue de l'utilisateur (audit-only vs. quel lot d'abord).
