# Lot 6b (P1) — Chasse aux placeholders : composition d'armée en pré-combat (item 2)

> Plan `game-ergonomics-immersion-review.md` §5 Lot 6, item 2. Le pré-combat
> remplaçait déjà les pavés hachurés par l'avatar du héros / le sprite de l'unité
> de tête (livré). Reste : **afficher la composition des deux armées** (rangée de
> vignettes + effectifs) — fidélité HoMM, sans fuite d'info. **Client + locales —
> zéro moteur, zéro asset**, pas de bump save.

## Changement (client)
- `PreBattleScreen` : composant `CompositionRow` sous chaque puissance — une
  vignette d'unité par pile (`unitSpriteUrl`, repli gracieux) + effectif.
  - Côté **joueur** (`combat.playerSide`) : effectif **exact**.
  - Côté **ennemi** : quantité **approximative** bucketisée façon HoMM
    (`few/several/pack/lots/horde/throng`) ⇒ aucune fuite au-delà de la puissance
    déjà arrondie.
- i18n : `preBattle.qty.*` + `preBattle.composition` (FR/EN).
- CSS `.pre-battle-comp*` (rangée flex, vignettes 34px, tokens only).

## Vérification
- Smoke @core (étend le test pré-combat) : rangées `pre-battle-comp-attacker`
  (chiffre exact) et `-defender` (descripteur approximatif, jamais le nombre brut).
- typecheck · lint · content (i18n parité) · engine (client-only) · client ·
  build · bundle · smoke @core + mobile · gardes.

## Journal
- [x] `CompositionRow` (exact joueur / bucket ennemi via `approxQuantity`) câblé
      aux deux camps ; i18n `preBattle.qty.*` FR/EN ; CSS `.pre-battle-comp*`.
- [x] Smoke @core étendu (comp attaquant chiffré, comp défenseur bucketisée).
      Recette : typecheck · lint · content 154 (i18n parité) · engine 897
      (client-only ⇒ golden inchangé) · client 13 · build · bundle 341 055 ≤
      819 200 · smoke @core 29 + mobile 13 · gardes faction/couleurs propres.
