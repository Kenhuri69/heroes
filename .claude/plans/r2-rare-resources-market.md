# R2 — Les ressources rares ont un prix

> Lot R2 du plan `game-experience-enrichment.md` (§5bis.2), amendé par l'expert
> (§5bis.4) et tranché par l'utilisateur le 2026-10-08 (§5bis.5) : D-R2 **poids +
> courbe**, repli sur les poids seuls si l'IA recule de plus de 7 jours.

## 1. Constat

- Un taux unique pour toutes les ressources : vente 25 / achat 50
  (`data/core/config.json`, `town/market.ts`). Une gemme coûte 50 or.
- L'arbre complet core + Haven demande 341 ressources non-or, soit 17 050 or au
  marché (11 % du coût en or) : une mine de gemmes ne se dispute pas.
- Le facteur linéaire par marché (`perMarketBonus` 0,1, plafond 1,4) améliore peu
  le taux.

## 2. Décisions

- `config.market.resourceValue` (optionnel) multiplie la vente et l'achat de
  chaque ressource (absent ⇒ ×1). Données : cristal, gemmes, soufre, mercure ×2
  ⇒ une gemme s'achète 100 or à un marché (50 avant), se vend 50.
- Helper pur `marketRates(market, resource, marketCount)` ; `tradeQuote` le suit,
  donc l'aperçu client aussi. L'IA (`marketPlan`) en tire le montant d'or en
  forme fermée.
- Invariant : un poids se simplifie sur tout cycle de troc, l'invariant
  d'aller-retour du taux de base (`sellRate × maxMarketFactor² ≤ buyRate`) suffit.
  Schéma : poids > 0, sur une ressource connue.
- IA : l'or du marché pour une recrue, première pile comprise, ne puise plus dans
  la réserve du bâtiment prioritaire.
- **Courbe par nombre de marchés écartée** (repli prévu par D-R2) : voir journal.

## 3. Étapes

1. [x] Mesure de référence (bench jetable, 2 IA, 64², 60 graines, 90 jours)
2. [x] Moteur : `marketRates`, `tradeQuote`, IA ; tests
3. [x] Schéma et données
4. [x] Client : rien à coder (l'aperçu passe par `tradeQuote`)
5. [x] Mesure après ; repli sur les poids seuls
6. [x] Docs 02 §3 et §IA, CLAUDE.md, plan d'enrichissement
7. [ ] Vérifications

## 4. Vérifications

- [ ] typecheck (sans `-s`), lint, build ; garde-fous faction et couleurs
- [ ] tests moteur, contenu, client, serveur ; golden inchangé
- [ ] Playwright comme en CI

## 5. Journal

- 2026-10-08 : plan ouvert.
- 2026-10-08 : bench jetable (2 IA, 64², 90 jours, factions en rotation, 120
  sièges, 20 par faction ; jour de la 1ʳᵉ habitation T7 et du Capitole, 91 = non
  atteint). À 20 graines et 60 jours, les médianes étaient trop censurées pour
  conclure ; mesure refaite à 60 graines.

  | Variante | T7 atteinte | T7 moy. | Médiane T7 AH / Dungeon | Capitole atteint | Captures |
  |---|---|---|---|---|---|
  | Référence (main) | 41 | 77,6 | 53 / 53,5 | 55 | 29 |
  | Poids + courbe | 34 | 80,7 | 79 / 76,5 | 52 | 54 |
  | Poids + courbe, IA corrigée | 36 | 80,1 | 64 / 60 | 54 | 33 |
  | Poids seuls | 40 | 79,1 | 71,5 / 63,5 | — | 44 |
  | **Poids seuls, IA corrigée (retenu)** | **48** | **77,2** | 70,5 / 56 | **62** | **41** |

  - La courbe recule : moins de T7 atteintes, AH +11 jours de médiane même avec
    l'IA corrigée ⇒ repli (a) comme décidé.
  - Cause du recul : l'IA achetait au marché le mercure de toutes ses recrues
    avec l'or de son bâtiment prioritaire. Sans aucun achat pour les recrues, AH
    revenait à +10,5 ; le correctif garde l'achat mais hors réserve.
  - La médiane d'AH reste instable dans toutes les variantes (la 10ᵉ valeur d'une
    série de 20 tombe à la frontière atteint/non atteint) ; sa moyenne ne bouge
    que de +3,6 jours. Les autres factions et le total progressent.
