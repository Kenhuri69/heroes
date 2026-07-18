# Lot 4b (P1) — Confort de gestion : marché tactile (E6)

> Plan `game-ergonomics-immersion-review.md` §5 Lot 4, item 2 (E6 🟡). Le marché
> n'a qu'un `<input type=number>` — pénible au doigt. Le taux/total (`received`) est
> DÉJÀ réactif ⇒ il ne manque que des **steppers**. **Client uniquement — zéro
> moteur, pas de bump save.**

## Changement (client)
- `MarketTab` : autour de l'input « quantité », ajouter **`−` / `+` / `Max`**
  (cibles ≥ 44 px). `Max` = stock du joueur de la ressource DONNÉE (`give`) —
  `gold` en mode achat, la ressource en vente/troc. L'input reste pour la saisie
  directe ; le total reçu se met à jour en continu (déjà le cas).

## Vérification
- Smoke @core (marché) : `+` incrémente la quantité et le total reçu augmente ;
  `Max` porte la quantité au stock. Cibles ≥ 44 px.
- typecheck · lint · content (i18n) · build · bundle · smoke @core · gardes.

## Journal
- [x] Steppers −/+/Max autour de l'input (input conservé) ; `Max` = `giveStock`
      (stock de la ressource donnée) ; i18n `town.marketMax/Dec/Inc` ; CSS
      `.town-market-stepper`.
- [x] Smoke @core (+/− ajustent, Max porte au stock). Recette : typecheck · lint ·
      content 152 · client 13 · build · bundle 334 355 ≤ 819 200 · smoke @core 32 +
      mobile 13 · gardes faction/couleurs.
