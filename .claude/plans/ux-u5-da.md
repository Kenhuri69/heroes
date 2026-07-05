# Plan — U5 : DA « gouache stylisée » + vue de ville peinte (jalon Beta, doc 08 §5)

> Dernier lot du chantier UX (plan de remédiation §5.3, étape 5). **Jalon Beta**,
> large et artistique. doc 08 §5 : décors peints aux contours doux, unités en
> spritesheets 2D (idle/move/attack/hit/death, 8–12 frames, lisibles à 64 px),
> palette + langage de formes par faction. doc 08 §2.2 : vue de ville **peinte**.

## État des lieux
- Pipeline assets EN PLACE (doc 12) : staging `assets/` (156 fichiers — icônes UI,
  artefacts, **vignettes de bâtiments**, mines, tuiles) consommé par un registre
  auto-découvert (`render/assets.ts`, `import.meta.glob ?url`), repli procédural.
- **Manquent** : sprites d'unités (le combat rend des jetons procéduraux), avatars
  de héros, **vue de ville peinte** (l'écran de ville est une liste modale).
- Skills dispo : `asset-procedural` (tuiles/icônes), `asset-sheet` (planches LLM :
  unités/artefacts/bâtiments/avatars). `canvas-design` (moodboards) NON activée.

## Périmètre (à CADRER avec l'utilisateur AVANT de coder)

U5 est un jalon, pas un lot unique. Options de première tranche (AskUserQuestion) :
- **A — Vue de ville peinte** (client) : nouvelle surface de rendu composant la
  ville à partir des **vignettes de bâtiments existantes** (fond + bâtiments
  construits positionnés), remplaçant/complétant la liste. Buildable maintenant,
  zéro nouvelle génération d'art, testable au smoke. Réalise doc 08 §2.2/§5.
- **B — Fondations DA par faction** : moodboards / palette / langage de formes
  (doc 08 §5, doc 12) documentés + éventuellement une planche d'assets d'une
  faction via `asset-sheet`. Travail de design + génération d'images itérative.
- **C — Spritesheets d'unités + animation de combat** : génération des planches
  (idle/move/attack/hit/death) + système de lecture de frames dans `CombatScene`.
  Le plus lourd (art + moteur d'animation client).

**Décision (2026-07-05)** : cadrage AskUserQuestion interrompu (canal fermé),
l'utilisateur a demandé de continuer → on retient la **recommandation A — Vue de
ville peinte** comme 1ʳᵉ tranche (constructible, testable, zéro génération d'art).
Tranches B (fondations DA/planches par faction) et C (spritesheets + animation
combat) = tranches ultérieures du jalon Beta (avec artiste / skills asset-*).

## Invariants
- Assets hors bundle JS (`assetsInlineLimit: 0`), budget < 800 Ko gzip tenu.
- Repli procédural gracieux (une image manquante ne casse rien).
- doc = source de vérité : toute décision DA met à jour doc 08 §5 / doc 12.
- Moteur intact (l'art est côté client/données), golden stable.
- Touch-first, cibles ≥ 44 px, smoke étendu.

## Journal
- **2026-07-05** — Création. État des lieux fait. Périmètre à cadrer (A/B/C).
- **2026-07-05** — **U5 tranche A (vue de ville peinte) livrée.** Composant
  `TownView` (TownScreen) : les bâtiments construits en vignettes sur un décor
  gouache (dégradé CSS placeholder), bande à défilement horizontal touch-first,
  tap → onglet Construire ; réutilise `buildingUrl` (repli procédural gracieux).
  Clé `town.viewEmpty` fr/en. doc 08 §2.2 mise à jour. Smoke : la ville de départ
  (townHall + habitation T1) affiche ≥ 2 vignettes. Moteur intact, golden stable.
  **Différé (jalon Beta, tranches B/C)** : décors bespoke par faction, avatars,
  spritesheets d'unités + animation de combat, moodboards/palettes (skills
  asset-*/canvas-design). Vérif : typecheck 4/4, eslint, content:check, build,
  smoke.
