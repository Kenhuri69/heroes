# Lot 7b (P2) — Habiller les moments forts : fin de partie plein écran (I10)

> Plan `game-ergonomics-immersion-review.md` §5 Lot 7, item 2. L'overlay de fin
> de partie peint `victory/defeat.jpg` comme **fond du petit panneau** (360px). On
> le passe en **fond plein écran** avec un **panneau chrome** par-dessus ;
> graphique de puissance + récap **conservés**. **Client uniquement — zéro moteur,
> zéro asset** (les jpg existent déjà), pas de bump save.

## Changement (client)
- `OutcomeOverlay.tsx` : le `backgroundImage` passe du **panneau** au **backdrop**
  plein écran (`outcome-backdrop`) ; le panneau devient `chrome-framed` (cadre
  laiton, fond quasi opaque) sans image propre. Titre/stats/graphique/bouton
  inchangés.
- `OutcomeOverlay.css` : `.outcome-backdrop` (image `cover` centrée + voile de
  lisibilité `::before` en `--veil-*`) ; `.outcome-overlay` perd son image/voile
  propre et gagne un fond opaque de panneau. Tokens uniquement (garde couleurs).

## Vérification
- Smoke @core existant (gagner un scénario ⇒ `outcome-overlay`) : le backdrop
  porte l'image plein écran, le panneau + graphique restent visibles/lisibles.
- typecheck · lint · engine (client-only) · content · client · build · bundle ·
  smoke @core + mobile · gardes faction/couleurs.

## Journal
- [x] Image → `outcome-backdrop` plein écran (style inline) + voile `::before`
      `--veil-deep` ; panneau `chrome-framed` fond `--veil-92` opaque + padding ;
      graphique/récap conservés. Capture visuelle validée (art plein cadre, panneau
      laiton centré lisible).
- [x] Smoke : test « gagner survie » **tagué @core** + assertion `outcome-backdrop`
      porte `background-image: url(...)`. Recette : typecheck · lint · engine 906
      (client-only ⇒ golden inchangé) · content 154 · client 13 · build · bundle
      342 345 ≤ 819 200 · smoke @core 31 + mobile 13 · gardes faction/couleurs propres.
