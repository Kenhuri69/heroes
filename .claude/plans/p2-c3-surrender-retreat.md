# P2 / C3 — Reddition & fuite en combat

> Backlog `gap-audit.md` C3 : aucune commande surrender/retreat — impossible de
> quitter un combat. Feature HoMM iconique. Décision utilisateur : la préparer
> après C1.

## Design

Quand le joueur PERD normalement, `applyConsequences` (turns.ts) **retire le héros
de la carte** (`draft.heroes.splice`). Reddition/fuite = chemins dédiés où le
**héros survit** :

- **Fuite (`Retreat`)** : le combat se termine (l'ennemi l'emporte), le héros
  **abandonne son armée** (`hero.army = []`) mais **survit** sur la carte. Gratuit.
- **Reddition (`Surrender`)** : payer de l'or (= valeur en or de l'armée survivante,
  `Σ count × recruitCost.gold`) ; le héros **conserve son armée** (survivants) et
  survit. Requiert l'or.

Communs : combat en cours, tour du joueur (pile active = camp joueur), combat
d'aventure (`combat.heroId` non nul — jamais en arène). N'appliquent PAS les
conséquences du vainqueur (le gardien reste, la ville n'est pas prise). Émettent
`CombatLeft { mode }` + `CombatEnded (winner = ennemi)`. `draft.combat = null`.

**Aucun état persistant nouveau** ⇒ pas de bump `CURRENT_SAVE_VERSION`, golden
inchangé (commandes absentes du journal golden). Le devenir « taverne » du héros
ayant fui relève de M1 (différé) : ici le héros reste sur la carte.

## Étapes & vérif

- [x] `combat/leave.ts` : `validateRetreat`/`handleRetreat`,
      `validateSurrender`/`handleSurrender`, `surrenderCost(state)`.
- [x] Commandes `Retreat` / `Surrender` (commands.ts) + codes d'erreur ; event
      `CombatLeft` (events.ts) ; dispatch engine.ts ; exports index.
- [x] Client : boutons « Fuir » / « Se rendre (coût) » + **confirmation** (action
      irréversible, doc 08 §2.4), locales FR/EN.
- [x] Tests moteur : fuite (héros survit, armée vide, combat perdu) ; reddition
      (or débité, armée gardée) ; refus si or insuffisant / arène / hors tour.
      Golden inchangé (aucun nouvel état). Smoke : fuir un combat.

## Invariants
- Moteur faction-agnostique, déterministe. Aucun état nouveau ⇒ save/golden
  inchangés.

## Journal
- 2026-07-09 — Plan créé après merge de C1 (#165).
- 2026-07-09 — **C3 livré** : module `combat/leave.ts` (`validateRetreat`/
  `handleRetreat`, `validateSurrender`/`handleSurrender`, `surrenderCost`),
  commandes `Retreat`/`Surrender`, event `CombatLeft`. Le héros SURVIT (pas de
  splice) ; fuite = armée vide, reddition = or débité + armée gardée. Client :
  boutons Fuir / Se rendre (coût) + modale de confirmation, locales FR/EN.
  Vérif : typecheck 5/5, lint, 385 tests moteur (dont combat-leave) + 92 contenu,
  content:check, garde-fous, build. Golden + save version INCHANGÉS (aucun état
  persistant nouveau). Smoke : fuir un combat (héros survit, armée vide).
