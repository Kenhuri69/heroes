# Plan — Lot N4b : barks de combat (doc 13 §6.3)

Deuxième increment de **N4 — La Chasse & le vivant**. « Barks » de combat : **1
ligne** au début d'un combat de campagne, choisie dans un **pool localisé**
(aléa **client**, hors simulation déterministe), affichée dans le bandeau de
combat existant. Jamais au milieu d'un round. **Zéro diff moteur** (pure
présentation, le pool est dépouillé avant tout embarquement moteur).

## Portée

- **Contenu** : le scénario gagne `combatBarks?: locRef[]` (pool de répliques de
  l'antagoniste de la scène). Optionnel, comme `dialogs`/`cutscenes`.
- **Client** :
  - `store` : `NarrativeCatalog.combatBarks` (pool) + champ `combatBark: string |
    null` (réplique affichée).
  - `narrative` : `loadScenarioNarrative` peuple le pool ; `initCombatBarks()`
    (abonné au store) détecte l'apparition d'un combat (null→set) → tire une
    réplique au hasard **côté client** (`Math.random`, autorisé hors moteur) ;
    la retire à la fin du combat (set→null) et à tout rechargement de scénario.
  - `ui/combat.tsx` : affiche `combatBark` dans le bandeau haut (`combat-bark`).
- **Données** : pools sur `arcane-ch1` (voix de la Nécropole) et `haven-ch2`
  (voix d'Heresh) ; locales fr/en.
- **Smoke** : démarrer `arcane-ch1` → déclencher un combat → un bark s'affiche
  (non vide) ; fin du combat → le bark disparaît.

## Vérification par lot

typecheck 4/4 · moteur (golden **inchangé**) · content + `content:check` ·
garde-fou faction + garde-fou couleurs · build < 800 Ko · smoke desktop + mobile.

## Vérification par lot

- [x] typecheck 4/4
- [x] moteur 321 (golden **inchangé** — barks = présentation client pure)
- [x] content 77 + `content:check` (parité fr/en des clés `bark.*`)
- [x] garde-fou faction + garde-fou couleurs (grep local : propres)
- [x] lint · build client (253 Ko gzip < 800 Ko)
- [x] smoke desktop + mobile (bark s'affiche au combat, disparaît à la fin)

## Décisions / écarts

- **Pool au niveau du SCÉNARIO** (`combatBarks`) plutôt qu'attaché à un personnage/
  gardien : l'état de combat ne porte pas d'identité d'adversaire au-delà des piles
  d'unités ; le pool de scène = interprétation fidèle et data-driven de « pool
  localisé » (doc 13 §6.3), sans nouveau champ moteur.
- **Aléa client** : `Math.random` est utilisé DANS le client (présentation), jamais
  dans le moteur — le déterminisme de la simulation reste intact (le bark n'entre
  pas dans `GameState`).
- **Bug corrigé (boucle de rendu)** : l'abonné store de `initCombatBarks` appelait
  `setState` avant de mettre à jour `prevInCombat` → la re-notification synchrone
  ré-entrait et bouclait (`Maximum call stack size exceeded`). Corrigé : garde de
  transition `if (inCombat === prevInCombat) return;` + mise à jour de `prevInCombat`
  AVANT le `setState`.
- Pools posés sur `arcane-ch1` (voix de la Nécropole) et `haven-ch2` (voix
  d'Heresh) ; extensibles à toute scène par pure donnée.
