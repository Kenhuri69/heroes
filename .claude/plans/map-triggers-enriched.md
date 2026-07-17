# Plan — Lot 2.4 (doc 18) : triggers de carte enrichis (A5)

> **Statut** : ✅ livré (2026-07-17).
> Écart couvert : **A5** (doc 18 §2.A) — « triggers de carte limités ». Étape 2
> du plan de comblement. Lots 2.1/2.2/2.3 livrés.

## 0. Objectif & critère de sortie

Trois nouvelles variantes d'effet déclaratif `TriggerEffect`, interprétées
génériquement par le moteur (« ajouter un effet = une variante + un cas ») :
**don d'artefact** (`grantArtifact`), **don d'armée** (`grantArmy`) et
**embuscade** (`ambush` — combat scripté sur tuile). La richesse « événement de
carte » HoMM au service des campagnes N3/N4.

**Critère de sortie mesurable** : un héros qui foule la tuile reçoit
l'artefact (slot libre puis sac) / la pile (fusion ou 8ᵉ slot refusé) / ouvre
un combat contre l'armée scriptée qui interrompt son chemin — one-shot dans
les trois cas ; cartes existantes bit-identiques (aucune n'utilise ces effets).

## 1. Périmètre — décisions de cadrage

- **Inclus** : `grantArtifact { artifactId }`, `grantArmy { unitId, count }`,
  `ambush { army: [{unitId, count}] }` — moteur + schéma Zod + toasts client +
  tests + doc 02 §2.1.
- **Différé** (noté doc 02/18) : **message à choix** (exige un état d'attente
  type `pendingTreasure` ⇒ bump `CURRENT_SAVE_VERSION` + modale client — lot
  dédié) ; **téléport scripté** et **retrait** d'artefact/armée (aucun
  consommateur identifié) ; **usage campagne** : `proto-02` est partagé par 4+
  chapitres (équilibrage) — le premier consommateur réel arrive avec un lot
  narratif, pas ici.
- Sémantique `on: day` × effets liés à un héros : `grantArtifact`/`grantArmy`/
  `ambush` exigent un héros visiteur ⇒ **no-op sur un trigger de jour**
  (documenté ; le schéma reste orthogonal, pas de croisement d'unions).
- Héros **sans armée** sur une embuscade : pas de combat, trigger **non
  consommé** (même garde-fou B5 que le gardien — le piège attend une proie).

## 2. État des lieux (points d'ancrage vérifiés)

- `adventure/triggers.ts` : `applyEffect` (2 kinds) + `fireVisitTrigger`
  (appelé de `movement.ts:172`, APRÈS l'entrée sur la tuile) +
  `fireDayTriggers`. `fireVisitTrigger` retourne `void` — l'embuscade impose
  de signaler « combat ouvert » pour stopper le chemin.
- `combat/setup.ts → beginGuardianCombat` (`:257`) : jumeau à factoriser —
  défenseur = armée fournie, `guardianObjectId: null` ; la fin de combat
  générique (`checkCombatEnd` : XP `grantHeroCombatXp`, survivants, mort du
  héros vaincu, `evaluateOutcome`) fonctionne déjà sans gardien/ville/héros
  adverse.
- Don d'artefact : patron butin de gardien (`guardian-reward.ts:69-72`) — 1er
  slot équipé libre, sinon `backpack`.
- Don d'armée : patron habitation (`visitable.ts:126-133`) — fusion même
  `unitId`, sinon nouveau slot si `< MAX_ARMY_STACKS` (7), sinon refus.
- Schéma : union `effect` de `triggers` (`content/schemas.ts:1095`), miroir
  figé du moteur.
- Client : `notifications.ts:160` suppose 2 kinds (ternaire) — à passer en
  switch ; `resolveArtifactName`/`resolveUnitName` existent.
- Tests : `engine/test/triggers.test.ts` — harnais `apply` + `testMap()` à
  étendre (accepte `unitCatalog`/`startingArmy`).

## 3. Étapes

- [ ] a. **Moteur — types** (`adventure/map.ts`) : 3 variantes ajoutées à
      `TriggerEffect`.
- [ ] b. **Moteur — interprétation** (`adventure/triggers.ts`) :
      `fireVisitTrigger(draft, player, hero, pos, events): boolean` (combat
      ouvert ?) ; `applyEffect` gagne le héros (null sur trigger de jour ⇒
      no-op des effets héros) ; clones d'événement étendus ; embuscade ⇒
      `beginAmbushCombat` + `fired` + `true`.
- [ ] c. **Moteur — combat** (`combat/setup.ts`) : `beginAmbushCombat(draft,
      heroId, army, events)` — jumeau de `beginGuardianCombat` (terrain de la
      tuile du héros, défenseur = armée scriptée, `guardianObjectId: null`).
- [ ] d. **Moteur — mouvement** (`adventure/movement.ts`) : si
      `fireVisitTrigger` retourne `true` ⇒ `options.onCombatEngaged?.()` +
      arrêt du chemin (le héros EST sur la tuile — piège, à la différence de
      l'interception de gardien).
- [ ] e. **Schéma** (`content/schemas.ts`) : 3 variantes miroir dans l'union
      `effect`.
- [ ] f. **Client** (`app/notifications.ts`) : switch sur `effect.kind` —
      toasts `toast.triggerArtifact`/`toast.triggerArmy` (clés FR/EN) ;
      `ambush` ⇒ pas de toast (l'ouverture du combat EST le feedback).
- [ ] g. **Doc** : `docs/02-mechanics.md` §2.1 (triggers) — 3 effets, no-op
      jour, différés.
- [ ] h. **Tests** (unitaires moteur, `triggers.test.ts` étendu — pas de
      smoke : aucune surface UI nouvelle, le combat ouvert est générique) :
      artefact slot→sac ; armée fusion/nouveau slot/cap 7 ; embuscade ⇒
      combat ouvert + chemin interrompu + one-shot après victoire ; armée
      vide ⇒ non consommé ; effets héros sur trigger de jour ⇒ no-op.
- [ ] i. **Vérifs standard** : typecheck, lint, moteur (golden inchangé),
      contenu, `content:check`, garde-fou faction, budget, smoke `@core`.

## 4. Risques

| Risque | Mitigation |
|---|---|
| Golden | aucune carte existante n'utilise les nouveaux kinds ; fixtures inchangées |
| Chemin non interrompu après embuscade (état incohérent) | retour booléen + `return` immédiat, patron interception existant ; test dédié |
| L'IA bloquée sur une embuscade | même chemin `onCombatEngaged` que le gardien (auto-résolution IA existante) |
| Clone d'événement oublié (proxy immer révoqué) | le switch de clonage est exhaustif sur l'union (le compilateur casse si un kind manque) |

## 5. Suivi

- [x] Plan rédigé (2026-07-17)
- [x] a→g implémentés — union `TriggerEffect` +3 variantes (moteur + miroir
      `ResolvedTriggerEffect` du loader + schéma Zod), `fireVisitTrigger`
      retourne « combat ouvert » et reçoit le héros, `beginAmbushCombat`
      (setup), arrêt de chemin dans `movement.ts`, `MAX_ARMY_STACKS` exporté,
      toasts client (switch exhaustif + `return null` anti no-fallthrough),
      clés FR/EN, doc 02 §2.1. Écart au plan : le no-op « effet héros sur
      trigger de jour » émet quand même `TriggerFired` (consommation tracée) —
      un `return` anticipé qui l'avalait a été corrigé en revue de tests.
- [x] h tests verts — `triggers.test.ts` étendu (+6 cas, 11/11) : artefact,
      fusion/nouveau slot, cap 7 (don perdu mais consommé), embuscade
      (combat SUR la tuile + chemin interrompu + one-shot après victoire),
      héros sans armée (piège non consommé), no-op tracé sur trigger de jour.
- [x] i vérifs — typecheck ✅ lint ✅ moteur 852/852 (golden inchangé) ✅
      contenu 148/148 ✅ `content:check` ✅ garde-fou faction ✅ budget
      328 Ko/800 Ko ✅ smoke `@core` 19/19 ✅.
