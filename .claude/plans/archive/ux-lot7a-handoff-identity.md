# Lot 7a (P2) — Habiller les moments forts : identité du siège au handoff (I9)

> Plan `game-ergonomics-immersion-review.md` §5 Lot 7, item 1. L'overlay « passez
> l'appareil » (hot-seat) n'affiche qu'un numéro de siège nu. On l'habille aux
> **couleurs du joueur** (voile teinté `store.playerColors`) + **blason de faction**
> + pastille, avec **second canal non chromatique** (numéro + motif du blason).
> **Client uniquement — zéro moteur, zéro asset**, pas de bump save.
>
> Contrainte B34 : le backdrop du handoff DOIT rester **opaque** (pas de fuite du
> plateau du joueur suivant) ⇒ la teinte est une nuance posée SUR l'encre opaque
> (color-mix), jamais une transparence.

## Changement (client)
- `HandoffOverlay` : résout `playerColor(game.players, active.id)` (couleur du
  siège) + `factionId` du siège (hero puis town du joueur). Pose `--seat-color`
  en style inline ; ajoute un **bandeau de crête** (FactionBadge + pastille de
  couleur) au-dessus du titre ; liseré supérieur teinté sur le panneau.
- `HandoffOverlay.css` : voile radial teinté `color-mix(--seat-color)` SUR
  `--ink-900` (reste opaque), liseré `.handoff-tinted`, `.handoff-seat-crest`,
  `.handoff-seat-swatch` (tokens + var seat, zéro hex littéral).

## Vérification
- Smoke @core : partie 2 humains (hot-seat) ⇒ `handoff-overlay` visible, contient
  un `hero-faction-badge`/FactionBadge et la pastille de couleur ; « Continuer »
  ferme. (Le voile est décoratif — l'identité tient au badge + numéro.)
- typecheck · lint · engine (client-only) · content · client · build · bundle ·
  smoke @core + mobile · gardes faction/couleurs.

## Journal
- [x] Crête (`FactionBadge` + `.handoff-seat-swatch`) + voile radial `color-mix`
      `--seat-color` sur `--ink-900` (opaque préservé) + liseré `.handoff-tinted`.
      Couleur = `playerColor(players, active.id)` ; faction du siège = héros puis ville.
- [x] Smoke : test hot-seat existant **tagué @core** (gate PR) + assertions blason
      (`faction-badge`) & pastille dans l'overlay. Recette : typecheck · lint ·
      engine 901 (client-only ⇒ golden inchangé ; un test non-golden *flaky* de
      `main` — hors périmètre — repassé au re-run) · content 154 · client 13 ·
      build · bundle 341 584 ≤ 819 200 · smoke @core 30 + mobile 13 · gardes
      faction/couleurs propres.
