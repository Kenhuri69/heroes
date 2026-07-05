# Plan — U6 : écrans manquants (doc 08 §2.2/§2.5)

> Lot U6 du chantier UX (plan de remédiation §5.3, étape 4). doc 08 prévoit une
> **fiche héros typée**, un **marché/guilde** et une **fin de partie avec
> graphique de puissance**. Constat moteur : **aucune commande de marché**,
> **aucun apprentissage de sort**, **pas de slot d'artefact typé**, **pas de 2ᵉ
> héros** (donc pas de transfert héros↔héros). La plupart de ces écrans exigent
> du moteur/données nouveaux sans chemin de contenu (spéculatif).

## Décision de périmètre (cadrée utilisateur — AskUserQuestion 2026-07-05)

**Option retenue : fin de partie + graphique de puissance ET marché
fonctionnel.** Différés (documentés) : guilde (apprentissage de sort), slots
d'artefact typés, transfert héros↔héros — chacun = moteur+données nouveaux sans
chemin de contenu au MVP.

**Scindé en 2 sous-lots / 2 PR** (isole le changement moteur du chart client) :

### U6a — Marché fonctionnel (moteur + UI)
Nouveau **point d'extension moteur générique** : commande `TradeResources`
(échange ressource ↔ or au bâtiment marché, taux data-driven, déterministe, zéro
faction, zéro RNG). + onglet Marché dans l'écran de ville.

### U6b — Fin de partie + graphique de puissance (client + dataviz)
`OutcomeOverlay` enrichi d'un graphique de puissance par joueur (skill
`dataviz`), calculé depuis l'état final (`playerPower` = Σ force d'armée héros +
garnisons). Pur client (helper `playerPower` exposé par le moteur).

## Invariants (U6a touche le MOTEUR PUR)
- Aucun nom de faction dans le moteur ; RNG seedé (le marché n'utilise aucun
  RNG) ; zéro dépendance rendu.
- **Golden replay STABLE** : le golden n'utilise pas `TradeResources` ; ajouter
  un type de commande n'altère pas la séquence rejouée → hash inchangé
  (à VÉRIFIER explicitement après implémentation).
- Chaque correctif de règle a son test unitaire dans le même commit (§7).

## U6a — Contrat & découpage

**Moteur (pilote — cœur invariant-critique)** :
- `AdventureConfig.market = { sellRate, buyRate }` (or par unité de ressource
  non-or vendue / achetée ; `buyRate ≥ sellRate` = spread réaliste) + schéma
  `gameConfigSchema.adventure.market` + `data/core/config.json`.
- Commande `TradeResources { townId, give, receive, giveAmount }` (exactement un
  côté = `gold`) + code d'erreur `invalidTrade`.
- `town/market.ts` : `validateTradeResources` (ville connue+possédée, hors
  combat, marché construit, un côté or, montant > 0, ressource suffisante) +
  `handleTradeResources` (débite `give`, crédite `receive` via `tradeQuote`) +
  helper pur exporté `tradeQuote(config, give, receive, giveAmount): number`.
- Enregistrement dans `core/engine.ts` ; exports `@heroes/engine` (`tradeQuote`).
- `town/market.test.ts` : vente/achat, rejets (pas de marché, pas propriétaire,
  fonds insuffisants, deux côtés non-or, en combat). Golden inchangé.

**Client (Sonnet) — S-market-ui** : onglet « Marché » dans `TownScreen`
(sélection donner/recevoir + quantité, aperçu du reçu via `tradeQuote`, confirmer
→ `dispatch(TradeResources)`), sans réimplémenter le taux (leçon CL9).

**i18n (Sonnet) — S-i18n** : clés `town.market*`, onglet, libellés.

**Smoke + doc (pilote)** : smoke marché (vendre du bois → or crédité, aperçu),
`docs/08-ui-ux.md` §2.2 (onglet Marché implémenté).

## Journal
- **2026-07-05** — Création. Périmètre cadré (option C : marché + fin de partie).
  Scindé U6a (marché moteur) / U6b (chart). Démarrage U6a — cœur moteur.
- **2026-07-05** — **U6a cœur moteur livré & vérifié.** Point d'extension
  générique : effet de bâtiment `{ type: 'market' }` (aucun id en dur) + commande
  `TradeResources` (validate/handle dans `town/market.ts`) + config
  `adventure.market {sellRate,buyRate}` (schéma REQUIS, type moteur optionnel pour
  fixtures/golden) + helper pur exporté `tradeQuote`. Code d'erreur `invalidTrade`.
  Tests : `town-market.test.ts` (9 : tradeQuote, vente/achat, rejets marché/
  propriétaire/troc/fonds). **Golden STABLE `be72de4b`** (market optionnel ⇒
  config du golden inchangée). Vérif : engine 242, content 70 (fixtures config +
  market), content:check OK, typecheck 4/4. Fan-out Sonnet : S-market-ui (onglet
  Marché TownScreen) + S-i18n (clés). Reste : intégration + smoke marché + doc +
  PR U6a. Puis U6b (graphique de fin, dataviz).
