# Plan — UXD-7 : micro-interactions & transitions

> Lot 7 du plan maître `.claude/plans/ux-design-overhaul.md` (§3). Joué après
> UXD-3 en sautant UXD-6 (audio, bloqué sur la décision de sourcing de
> l'utilisateur). **100 % CSS** (aucune logique TSX, zéro risque testid),
> s'appuie sur les tokens UXD-1. Traite le constat §1.2 (« quasi aucune
> micro-interaction : 1 seule transition CSS, pas d'états hover/active/
> focus-visible cohérents, pas de transitions d'écran »).

## Constat

- Une seule `transition` CSS (tiroir héros). Boutons sans état `:hover`/
  `:active`/`:focus-visible` cohérent → l'UI paraît figée, et surtout le
  **focus clavier n'est pas visible** (défaut a11y).
- Aucune transition d'écran/de modale (apparition sèche).
- Toasts qui apparaissent sans animation.

## Étapes

- [x] `ui/interactions.css` (importé après `tokens.css` dans `shell.tsx`) :
  - **États interactifs globaux** sur tout `button` de l'UI DOM : `:hover`
    (éclaircissement `filter: brightness`), `:active` (léger enfoncement
    `translateY`), **`:focus-visible` (contour doré `--gold`, a11y clavier)**.
    `outline` (pas de reflow), transitions courtes (`--dur-fast`). Non invasif :
    marche quelle que soit la couleur de fond posée par chaque composant.
  - **Modale animée** : `.modal-backdrop` fondu, `.modal` scale+fade-in.
  - **Écrans** : fondu court à l'apparition de `.menu-screen` et `.combat-ui`.
  - **Toast** : glisse+fond à l'apparition.
- [x] **`prefers-reduced-motion`** : media query globale coupant toutes les
      animations/transitions (les états `:focus-visible` restent — a11y).
- [x] Vérif finale : re-passe `ux-audit` 30 captures 0 WARN, smokes verts
      (aucun testid touché), anti-gel (transitions DOM composées, coût
      par-frame nul), build + budget, garde-fou couleurs intact.

## Hors périmètre (notés)

- **Toasts icônisés par type** (succès/erreur/info) : demande de plomber un
  `type` depuis `notify()`/`pushToast` — reporté (touche la logique TSX ;
  UXD-7 reste CSS-only). Accent visuel générique posé en attendant.
- Crossfade complet menu⇄aventure (le HUD d'aventure est un fragment sans
  racine unique) : fondu limité aux écrans à racine unique.
- Sons d'interface (UXD-6), refonte de layout (UXD-5/8).

## Vérification (2026-07-07)

- **Focus clavier** : capture — contour doré net sur le bouton focalisé au Tab
  (avant : aucun focus visible ; vrai gain a11y).
- **Animations** : modale scale+fade, écrans menu/combat en fondu, toast qui
  glisse — coupées par `prefers-reduced-motion` (media query globale).
- Re-passe `ux-audit` **0 WARN/FAIL sur 30 captures** ; smokes **98 verts +
  2 skipped** (aucun testid touché) ; anti-gel carte 5,3 / arène 11,0 fps
  (plancher ≥ 5) ; typecheck/lint/build verts ; garde-fou couleurs intact.
