# UX-ENDSTATS — récapitulatif de fin de partie (doc 08 §2.5)

> « go next » autonome. Backlog `game-feature-gaps.md` UX-ENDSTATS : durée +
> stats manquantes sur l'overlay de fin (le graphique de puissance existe déjà).
> **Client pur** — zéro moteur, zéro save, zéro golden.

## Conception
- Composant `StatsSummary` dans `OutcomeOverlay.tsx`, au-dessus du graphique :
  lit DIRECTEMENT l'état final (aucun suivi). Affiche **durée** (`Jour N ·
  Semaine W`, `weekOf` moteur), **villes possédées**, **héros** (nombre + niveau
  max), **unités en armée** (armées de héros + garnisons possédées).
- Locales `outcome.*` FR/EN + CSS `.outcome-stats` (tokens uniquement).

## Décision de périmètre
- **Pertes cumulées différées** : les compter exactement suppose un suivi côté
  MOTEUR (les événements `CombatEnded` ne portent pas le joueur ⇒ un accumulateur
  client mécompterait les combats IA-vs-IA / multi-joueurs). Hors périmètre d'un
  lot client pur ; noté au backlog.

## Vérif
- Typecheck/lint/build (bundle < 800 Ko), garde-fou couleurs (var() only) + faction.
  Content 108 (parité locale FR/EN). Smoke : le scénario « survie » gagné affiche
  le récap (durée `Jour N · Semaine W`) — 146 passed.
- doc 08 §2.5 + backlog.

## Journal
- Livré. `StatsSummary` (durée + avoirs finaux) + locales FR/EN + CSS. Client pur.
  Vérif : typecheck/lint/build, content 108, smoke 146 (assertion récap au
  scénario survie). doc 08 §2.5 + backlog UX-ENDSTATS ✅. Pertes cumulées différées.
