# Plan — UXD-5 : écrans de gestion habillés

> Lot du plan maître `.claude/plans/ux-design-overhaul.md` (§3). Traite le
> constat §1.4 (vignettes trouées) et la promesse doc 08 §2.2 (ville « peinte »,
> le joueur voit la ville se construire).
> **Tranche livrée** : la vue de ville devient un **plan de construction** sur le
> décor peint — chaque bâtiment du catalogue est un emplacement à l'état
> **construit / disponible / verrouillé** (2ᵉ canal non chromatique A5),
> tap = onglet Construire.

## Périmètre & choix

- **Livré ici** : `TownView` passe de « seulement les bâtiments construits » à
  **tout le catalogue**, chaque emplacement portant son statut. On voit d'un
  coup d'œil ce qui est bâti, ce qu'on peut bâtir aujourd'hui, ce qui reste
  verrouillé — la ville « se remplit » (doc 08 §2.2).
- **Hors périmètre (suivis notés)** :
  - **Poupée d'équipement typée par slot** (doc 08 §2.3) : ✅ **livrée** au lot
    de suivi `.claude/plans/ux-d5b-poupee-equipement.md` — champ de données
    `slot` optionnel (présentation pure, jamais lu par le moteur) + poupée à 10
    emplacements nommés + sac. (À l'origine reportée faute de champ `slot` dans
    `data/core/artifacts.json` ; ce lot l'ajoute en donnée, sans toucher au
    comportement moteur.)
  - **Réalignement Menu/Options/Journal/SpellBook/Skirmish sur UXD-1** : le
    garde-fou couleurs CI (UXD-1) interdit déjà tout `#hex`/`rgba()` hors
    `tokens.css` ⇒ ces écrans sont déjà sur tokens. Pas de dette résiduelle
    mesurée ; rien à refactorer.
  - Amélioration graphique du **repli de vignette** (dessin de donjon au lieu
    du carré à liseré) : marginal, le repli est déjà tokenisé.

## Étapes

- [x] `TownView` : rendre **tout** `catalog` (plus seulement les construits),
      chaque bâtiment avec un statut d'affichage :
      `constructed` (niveau ≥ 1), `available` (`buildStatus === 'available'`),
      `locked` (`buildStatus === 'locked'`). Tri par priorité de statut puis id.
- [x] **2ᵉ canal A5** (jamais la couleur seule) : pastille de **forme distincte**
      (disque plein / anneau pointillé / carré) + opacité + désaturation
      (verrouillé) de la vignette. `aria-label` = « nom — statut ».
- [x] Tap sur un emplacement → onglet Construire (comportement conservé).
- [x] CSS `town.css` : styles des 3 statuts sur `.town-view-building`
      (tokens uniquement).
- [x] i18n : réutiliser `town.built/available/locked` existants ;
      `town.viewEmpty` conservé (catalogue vide seulement).
- [x] Doc 08 §2.2 : noter que la vue de ville est un plan de construction
      (construit/disponible/verrouillé) et non plus la seule liste des bâtis.

## Vérification (2026-07-07)

- [x] Capture ville desktop (seed 42, `?seed=42`) : plan de construction rendu —
      **2 construits** (disque laiton), **6 disponibles** (anneau pointillé),
      **34 verrouillés** (désaturés, carré) triés en fin de bande. Pastilles de
      forme distincte lisibles, **0 erreur console**.
- [x] Tap emplacement → onglet Construire (comportement conservé, un
      verrouillé y détaille ses prérequis via `missingRequirements`).
- [x] Smokes **102 verts + 2 skipped** ; typecheck/lint/build verts ; garde-fou
      couleurs vert ; bundle ~258 Ko gzip JS/CSS (< 800). Anti-gel inchangé
      (écran DOM modal, aucun coût par-frame canvas).
