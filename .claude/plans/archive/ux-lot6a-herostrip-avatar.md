# Lot 6a (P1) — Chasse aux placeholders : avatar du HeroStrip (I7)

> Plan `game-ergonomics-immersion-review.md` §5 Lot 6, item 1. Le bandeau de
> portraits (`HeroStrip`) affiche un **cercle gris** (`hero-portrait-mini`) au lieu
> de l'avatar du héros — alors que le tiroir résout déjà l'avatar. On réutilise la
> MÊME source. **Client uniquement — zéro moteur, zéro asset**, pas de bump save.

## Changement (client)
- `HeroStrip` : remplacer le `<span class="hero-portrait-mini">` par un `AssetImg`
  `heroAvatarUrl(factionId, archetype, name)` (identique au tiroir), **fallback**
  gracieux sur le cercle mini si l'asset est absent. Niveau/sélection inchangés.
- `styles.css` : `.hero-portrait-avatar` (rempli l'écusson 48px, rond, `cover`).

## Vérification
- Smoke @core : le portrait du HeroStrip monte un avatar (img) OU son fallback
  (aucune régression de rendu ; le tap sélection reste couvert par E4).
- typecheck · lint · engine (client-only) · content · client · build · bundle ·
  smoke @core + mobile · gardes.

## Journal
- [x] `AssetImg` avatar (`heroAvatarUrl(factionId, archetype, name)`) dans
      `HeroStrip`, fallback `hero-portrait-mini` + CSS `.hero-portrait-avatar`.
- [x] Smoke @core I7 (portrait monte `.hero-portrait-avatar` OU `.hero-portrait-mini`).
      Recette : typecheck · lint · engine 897 (client-only ⇒ golden inchangé) ·
      content 154 · client 13 · build · bundle 340 790 ≤ 819 200 · smoke @core 29 +
      mobile 13 · gardes faction/couleurs propres.
