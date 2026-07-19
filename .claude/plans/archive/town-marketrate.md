# T-MARKETRATE — taux de marché dégressif + troc (doc 02 §3)

> « go next » autonome. Backlog `game-feature-gaps.md` T-MARKETRATE : taux
> fonction du nombre de marchés possédés (HoMM3) ; troc ressource↔ressource.

## Conception (additive, sans bump save, golden inchangé)
- **Taux dégressif** : plus le joueur possède de marchés (bâtiment à effet
  `market` construit dans ses villes), meilleur le ratio. Facteur déclaratif :
  `factor = min(maxMarketFactor, 1 + perMarketBonus × (nbMarchés − 1))`
  ⇒ `sellRate × factor`, `buyRate ÷ factor`. **1 marché ⇒ factor 1** (comportement
  actuel inchangé). Champs `config.market.perMarketBonus?` / `maxMarketFactor?`
  **optionnels** (absents ⇒ plat ; golden/fixtures inchangés).
- **Troc** : `tradeQuote` gère désormais ressource↔ressource (les deux non-or) via
  équivalence or : `floor(giveAmount × sellRate / buyRate)`. `validate` accepte le
  troc (rejette seulement or↔or).
- `tradeQuote(market, give, receive, giveAmount, marketCount = 1)` — param ajouté
  en fin (défaut 1 ⇒ appels existants inchangés). Helpers `effectiveMarketRates` +
  `ownedMarketCount(state, playerId)` exportés (client : aperçu sans réimplémenter
  le taux, leçon CL9).
- **Aucun nouvel état** ⇒ pas de bump save. Marché déterministe (aucun RNG) ⇒
  golden inchangé (config golden sans `market`).

## Client
- Onglet Marché : 3ᵉ mode **Troc** (2ᵉ sélecteur de ressource reçue) ; aperçu via
  `tradeQuote` avec `ownedMarketCount` ; ligne « Marchés possédés : N ». Locales.

## Vérif
- Tests moteur (`town-market.test.ts`) : troc (wood→ore via or), taux dégressif
  (2 marchés ⇒ meilleur ratio), 1 marché = plat inchangé, rejet or↔or. Golden
  inchangé, save-shape inchangée.
- Content (schéma market étendu optionnel). Typecheck/lint/build, garde-fou
  faction. Smoke : troc au marché (build market → wood→ore) + non-régression.
- doc 02 §3 + backlog.

## Différés
- Taux HoMM3 exact (courbe non linéaire), troc à taux pénalisé distinct de
  l'équivalence or.

## Journal
- Livré. `effectiveMarketRates(market, marketCount)` + `ownedMarketCount(state,
  playerId)` (`town/market.ts`, exportés) ; `tradeQuote(..., marketCount = 1)`
  gère vente/achat/troc via `factor` (multiplier avant diviser ⇒ pas de double
  arrondi flottant) ; `validate` accepte le troc (rejette or↔or). Config
  `perMarketBonus 0.1` / `maxMarketFactor 2` (optionnels). Client : 3ᵉ mode Troc
  (2ᵉ sélecteur, repli si give==receive) + ligne « Marchés possédés : N », aperçu
  via helper moteur. Locales FR/EN. **Pas de bump save, golden inchangé** (config
  golden sans market). Vérif : 504 tests moteur (dont troc, dégressif 2 marchés
  bout-en-bout, plafond), content 105, typecheck/lint/build (bundle < 800 Ko),
  garde-fou faction vert, smoke 146 (troc au marché ajouté). doc 02 §3 + backlog.
