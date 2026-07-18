# D2 (partiel) — Marchand d'artefacts : VENTE (doc 18 D2)

## Contexte

D2 « commerce avancé » : le troc ressource↔ressource est **déjà livré**
(`TradeResources`). Reste le **marchand d'artefacts** (achat/vente). Ce lot =
**vente** (offloader un artefact contre or) : self-contained, zéro nouvel état,
zéro risque d'équilibrage. L'**achat** (exige un stock/pool = nouvel état de
ville) est différé (D2-buy).

## Design (extension du marché)

- Gaté par le bâtiment **marché** existant (effet `market`, comme `TradeResources`)
  + un **héros présent** à la ville (le vendeur).
- **Prix** data-driven, dérivé : `artifactBaseValue(def, market)` =
  `def.value ?? Σ|bonus| × market.artifactValuePerPoint`. Vente rapporte
  `floor(base × market.artifactSellFactor)`. ⇒ tout artefact est vendable sans
  édition de masse ; `value?` reste un override de contenu.
- Commande `SellArtifact { townId; heroId; source: 'equipped'|'backpack'; index }`
  → retire l'artefact (slot équipé → null, sac → splice), crédite l'or, émet
  `ArtifactSold`. Module `town/artifact-merchant.ts`.

## Invariants

- `ArtifactDef.value?` + champs config = **données/config** (catalogue, non
  sérialisé) ⇒ golden inchangé ; la commande mute `hero.artifacts`/`backpack`
  (champs existants) ⇒ **pas de bump save**. Zéro faction.

## Étapes

1. `config.ts` MarketConfig + `config.json` : `artifactValuePerPoint`,
   `artifactSellFactor`. `hero/types.ts` : `ArtifactDef.value?`. Schéma. → typecheck/content:check.
2. `town/artifact-merchant.ts` : valeur + validate + handle. Commande + event +
   dispatch + export. → tests moteur.
3. Client : section « Marchand » de l'onglet Marché (héros présent ⇒ liste
   artefacts équipés+sac, prix, bouton Vendre) + locales FR/EN. → smoke/typecheck.
4. Docs 02 §4.1 + 18 D2 (vente livrée, achat différé) + ce plan.

## Statut

- [x] **LIVRÉ**. `ArtifactDef.value?` + `market.artifactValuePerPoint`/
      `artifactSellFactor` (config.json activé 500/0.5) + schéma. Module
      `town/artifact-merchant.ts` (`artifactBaseValue`/`artifactSellPrice` exportés,
      `validate`/`handleSellArtifact`). Commande `SellArtifact` + event
      `ArtifactSold` + dispatch + gating. Client : section « Marchand » de l'onglet
      Marché (héros présent ⇒ artefacts équipés+sac, prix via helper moteur, bouton
      Vendre) + locales FR/EN. 5 tests `town-artifact-merchant.test`. Docs 02 §4 +
      18 D2. Vérif : typecheck ✓, lint ✓, 915 engine + content ✓, content:check ✓,
      garde-fou ✓, build ✓, budget 332 Ko ✓, smoke @core 32/32 ✓, golden + save-shape
      **inchangés**. **Achat différé** (stock de ville).
- [x] **ACHAT LIVRÉ (D2-buy)** : `merchantBuyStock` (stock dérivé déterministe par
      `townId`, RNG **local** hors `draft.rng` ⇒ golden intact) + `merchantAvailable`
      (moins `TownState.artifactsBought?`, optionnel ⇒ pas de bump save) ;
      `market.artifactStockSize` (config.json 4) ; commande `BuyArtifact` + event
      `ArtifactBought` + validate/handle (or, marché, héros présent, stock). Client :
      liste d'achat de la section « Marchand » + locales. 3 tests. Docs 02/18 (**D2
      clôturé**). Vérif : typecheck ✓, lint ✓, **918 engine** + content ✓, content:check
      ✓, garde-fou ✓, build ✓, budget 333 Ko ✓, smoke @core 33/33 ✓, golden + save-shape
      **inchangés**.
