# Lot E-mechanics — doc sync mécaniques/modularité/GDD (E2, E3, E4)

Sous-lot du Lot E (doc sync). Corrige docs **02 / 06 / 01** vers le code
livré. Toutes les affirmations vérifiées contre le code (agent de
fact-checking), y compris là où le **plan lui-même** était périmé.

## Vérifications qui ont corrigé le plan

- « terrain natif ×1,0 » : en réalité **+1 vitesse en combat** (state-helpers)
  et **aucun** bonus de terrain natif sur la carte — documenté tel quel.
- « 4 scénarios » : en réalité **12** fichiers (`data/scenarios/index.json`).

## E2 — docs/02-mechanics.md

- §1.1/§1.2 : profil d'attributs **global unique** 30/30/20/20 (classes
  différées) ; un **seul** choix de compétence visible (chaîne écrase).
- §1.5 : **1 héros/joueur** (multi-héros, échanges, duel héros différés) ;
  pas de bonus terrain natif carte ; artefacts ne donnent **pas** de PM.
- §2.2 : ramassage **en passant** (ressource/artefact/mine) ; seul le coffre
  interrompt ; sémantique d'interception de gardien.
- §3 : marché **ressource↔or à taux plats** (vente 25 / achat 50, un côté or) ;
  troc ressource↔ressource & taux dégressif différés.
- §4.1 : Taverne effet `none` (aucune mécanique) ; Guilde des mages **sans
  consommateur moteur** ; coûts hôtel de ville réels (niv 3/4 gemmes/cristal,
  `uniquePerPlayer`).
- §4.1 : grâce/élimination **scénario-only** (`RETAKE_GRACE_DAYS`=7 constante).
- §5.4 : **9 capacités** au catalogue (`abilities.json`) listées + sémantique
  de `consumeMarks`/`demonform`/`symbiosis` ; les capacités riches nommées
  dans les lineups (`taunt`/`shieldWall`/`charge`/`lifeDrain`…) **déclarées
  en données mais pas encore interprétées** par le moteur (inertes).
- XP à la **victoire** uniquement (héros du camp vainqueur).

## E3 — docs/06-modularity.md

- §1/§2 : structure de paquet **réelle** (manifest + units/ + buildings.json +
  locales/ + story/) ; ni `spells/`/`heroes/`/`abilities/*.ts`/`assets/` par
  paquet ; sorts d'école de faction au **catalogue CORE**.
- §3 : manifeste réel (schemaVersion 1, `factionBonuses` type réel
  `gainFactionResourceOnVictory`, `abilityModules`/`hooks` **vides** forcés).
- §4 : `AbilityModule`/`AdventureHook` **n'existent pas** (schéma `.max(0)`) ;
  mécanisme livré = capacités génériques inline + effets déclaratifs. Pas de
  package `@heroes/engine-api`.
- §5.6 : `faction:sim` **existe** (`tools/faction-sim.ts`), pas « à écrire ».
- §7 : migrations de paquet différées ; suivi version par paquet différé.

## E4 — docs/01-gdd-overview.md

- Carte **32×32** (`proto-01`), pas ~72×72 ; scénarios livrés bien au-delà de 3.
- Autosave **à chaque fin de tour** (pas chaque action).
- **Hot-seat** livré (Alpha 4.15), multi en ligne différé.

## Vérification

Docs seuls (aucun code). Suite complète (garde-fou §7) : typecheck, lint,
engine+content, content:check, guards, build < 800 Ko, smoke desktop+mobile.

## État : livré.
