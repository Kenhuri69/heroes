# Plan — Audit MVP 3.x (combler les écarts) puis ouverture Alpha 4.x

> Directive utilisateur : « tu as sous-estimé le plan d'implémentation 3.X,
> vérifie que tout est implémenté, sinon lance le plan 4.X, délégation aux
> sous-agents quand c'est possible. »

## Cadre
- **3.x = MVP** (doc 11, roadmap Phase 1). **4.x = Alpha** (doc 09 Phase 2) :
  Arcane Hunters 4.1→4.10 **livré** ; RESTE d'Alpha **sans plan** : upgrades
  d'unités ×3 factions, machines de guerre, sièges v1, escarmouche vs IA,
  hot-seat, sorts d'aventure, `faction:sim`, éditeur de carte.
- Distinguer **écart MVP réel** (à combler maintenant) vs **différé assumé à
  l'Alpha** (doc 09 L19-20 + doc 11 « Écarts assumés ») : sorts d'aventure,
  upgrades, capacités spéciales avancées, hot-seat, assets peints, faction:sim.

## Étape 1 — Audit (délégué, read-only, EN COURS)
5 sous-agents Sonnet parallèles, un par tranche, comparant doc 11 + doc 02/03/04
au code :
- [ ] 3.1 Villes (TownState, 1 build/jour, recrutement, capture 7-jours, effets
      de bâtiment déclaratifs, revenu/croissance).
- [ ] 3.2 Héros (12 compétences câblées, ~20 sorts vs 10, écoles, 10 artefacts).
- [ ] 3.3/3.4 Factions Haven/Necropolis (lineup doc 03/04, bonus, héros nommés,
      modularité Nécromancie, garde-fou faction).
- [ ] 3.5 Scénarios/IA + **triggers `onVisit`/`onDay`** (suspecté différé).
- [ ] 3.6 Finitions (équilibrage, anti-gel, i18n parité, critères de sortie).

## Étape 2 — Synthèse + tri
Fusionner les rapports → tableau ÉCART / MVP-requis / Alpha-différé. Présenter.

## Étape 3 — Combler les écarts MVP-requis
Lots par surface disjointe, délégués aux sous-agents Sonnet quand indépendants ;
pilote fige les surfaces (types/commandes/événements/schémas), intègre, smoke,
docs, PR. Invariants : moteur pur, golden stable (re-fixé si évolution moteur
explicite), zéro faction moteur, budget < 800 Ko, anti-gel ×4, touch-first.

## Étape 4 — Ouvrir l'Alpha 4.x
Selon le tri, démarrer les lots Alpha manquants (plan par lot), même méthode.

## Journal
- **2026-07-06** — Création. Base `32e92f2` (main, après #64). Audit 5 agents
  lancé.
