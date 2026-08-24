# A5d — Condition de trigger `flagCaptured` (doc 18 A5, dernier reste)

## Contexte

Clôt la famille de triggers A5. Jusqu'ici deux **conditions** (`on.kind`) :
`visit` (tuile) et `day` (jour). L'audit A5 note `onFlagCaptured` comme dernier
reste : déclencher un effet quand un **objet capturable** (mine / habitation /
ville) change de main. C'est une nouvelle *condition*, pas un effet.

## Design (chirurgical, non-interrompant)

- **Nouvelle condition** `on: { kind: 'flagCaptured'; objectId: string }` —
  déclenchée (one-shot) quand l'objet/ville d'id `objectId` est capturé par un
  joueur. `objectId` = id opaque (MapObjectDef.id d'une mine/habitation, ou
  TownState.id) ; le moteur ne fait que comparer.
- **Effet restreint aux `SimpleTriggerEffect`** (grantResource / message /
  grant|removeArtifact / grant|removeArmy) — appliqués directement, **sans
  interruption**. Pas d'`ambush`/`teleport`/`choice` sur une capture (ceux-ci
  exigent une interruption de chemin ; hors périmètre, un tel effet ne serait
  qu'appliqué à moitié). Garde-fou : **superRefine** de schéma (flagCaptured ⇒
  effet simple).
- **Helper** `fireFlagCaptureTrigger(draft, objectId, player, hero, events)` dans
  `triggers.ts` : trouve le trigger `flagCaptured` non tiré pour `objectId`,
  l'applique via `applyTriggerEffect` (réutilise tout l'acquis A5/A5c), le marque
  `fired`. No-op si aucun trigger.
- **Sites de capture** (4, tous appellent le helper après le changement de main) :
  mine + habitation (`adventure/movement.ts`), ville non défendue
  (`town/capture.ts`), ville prise au siège (`combat/turns.ts`).

## Invariants

Générique (zéro faction/scénario en dur). Nouvelle condition **ignorée** par
`fireVisitTrigger` (garde `=== 'visit'`) et `fireDayTriggers` (garde `!== 'day'`)
⇒ aucune interférence. Opt-in par données : aucune carte n'emploie `flagCaptured`
⇒ **golden inchangé**, **pas de bump save** (aucun champ d'état neuf ; `fired`
existait déjà sur `MapTriggerDef`).

## Étapes

1. `map.ts` : variante `flagCaptured` dans `MapTriggerDef.on` → verify: typecheck.
2. `triggers.ts` : helper `fireFlagCaptureTrigger` → verify: typecheck.
3. `movement.ts` (mine + habitation), `capture.ts`, `turns.ts` : appels → verify: typecheck.
4. `content/schemas.ts` : union `on` + superRefine (flagCaptured ⇒ effet simple) → verify: content:check.
5. `content/loader.ts` : `ResolvedMapTrigger.on` + résolution (ternaire → 3 cas) → verify: typecheck.
6. Tests `triggers.test.ts` : flagCaptured sur capture de mine (octroi + one-shot) → verify: engine test.
7. Docs 18 (A5 clos) + 02 §2.1 → verify: relecture.
8. Vérif complète.

## Statut

- [x] **LIVRÉ.** Condition `flagCaptured` dans `MapTriggerDef.on` (`map.ts`) ;
      helper `fireFlagCaptureTrigger` (`triggers.ts`) ; hooks aux 4 sites de
      capture (`movement.ts` mine + habitation, `capture.ts` ville non défendue,
      `turns.ts` ville prise au siège). Schéma content : union `on` + **superRefine**
      (flagCaptured ⇒ effet-feuille simple, rejette ambush/teleport/choice) ;
      loader (`ResolvedMapTrigger.on` + résolution 3-cas). Tests :
      `triggers.test.ts` (capture de mine ⇒ octroi + one-shot ; objet non ciblé ⇒
      no-op) et `loader.test.ts` (résolution + rejet effet interrompant). Docs 18
      (A5 clos) + 02 §2.1 alignées.
- **Vérif** : typecheck ✓ · lint ✓ · **928 engine** (+2) ✓ · **156 content** (+2) ✓ ·
  **golden inchangé** · content:check ✓ · garde-fou faction ✓ · build ✓ · bundle
  **336.5 Ko** < 800 ✓ · smoke `@core` **35/35** ✓. Zéro moteur-faction, **pas de
  bump save**.
- **Couverture** : chemin exercé par 2 unitaires moteur + 2 content. Non
  smoke-couvert (aucune carte de jeu n'emploie `flagCaptured` ⇒ pas de surface UI ;
  lot data/moteur).
