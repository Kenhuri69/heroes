# A5b — Trigger message-à-choix (doc 18 A5, suite de A5 téléport)

## Contexte

Dernier effet de trigger manquant (A5, P2) : le **message à choix** (branches).
Interactif ⇒ exige un **état d'attente moteur** + un **choix joueur** + une
**modale client**. Template EXACT déjà en place : `pendingTreasure` /
`ResolveTreasure` / `TreasureChoice.tsx` (choix or/XP d'un trésor).

## Design (miroir de pendingTreasure)

- **Effet** `{ kind: 'choice'; textKey; options: { labelKey; effect }[] }` où
  `effect` = **effet-feuille** (`grantResource`/`message`/`grantArtifact`/
  `grantArmy`) — pas de choix imbriqué ni d'ambush/teleport (bornage).
- **`fireVisitTrigger`** : sur `choice`, pose `draft.pendingTriggerChoice`
  (heroId/playerId/triggerId/textKey/options) et retourne l'outcome `'choice'`.
- **`movement.ts`** : outcome `'choice'` ⇒ `options.onTriggerChoice?.()` (IA
  résout tout de suite, déterministe) puis `return` (interrompt le chemin, comme
  ambush/teleport).
- **`resolveTriggerChoice(draft, optionIndex, events)`** (nouveau module
  `adventure/trigger-choice.ts`) : applique l'effet de l'option choisie via
  `applyEffect`, émet `TriggerChoiceResolved`, vide `pendingTriggerChoice`.
  Partagé handler humain / callback IA.
- **Commande `ResolveTriggerChoice { heroId; optionIndex }`** → handler appelle
  le helper. IA : `onTriggerChoice: () => resolveTriggerChoice(draft, 0, events)`
  (option 0, déterministe — comme l'IA trésor choisit l'or).
- **Gating** : `pendingTriggerChoice` posé ⇒ refuse MoveHero/EndTurn/etc (miroir
  du gating `pendingTreasure`).
- **Client** : modale `TriggerChoice.tsx` (patron `TreasureChoice`) lisant
  `store.game.pendingTriggerChoice`, dispatch `ResolveTriggerChoice`. Montée dans
  `shell.tsx`. Locales génériques (le texte vient des `textKey`/`labelKey` du
  contenu, résolus i18n).

## Invariants

- `pendingTriggerChoice?` **optionnel non initialisé** (jamais posé en
  `createEmptyState`) ⇒ omis du JSON ⇒ **golden inchangé** ; hors garde
  save-shape (HeroState/CombatStack) ⇒ **pas de bump save**. Opt-in par données.
  Zéro faction.

## Étapes

1. `map.ts` : `SimpleTriggerEffect` (sous-type feuille) + `choice` dans
   `TriggerEffect`. → typecheck.
2. `state.ts` : `pendingTriggerChoice?` sur GameState (non initialisé). → typecheck.
3. `trigger-choice.ts` : helper `resolveTriggerChoice`. `triggers.ts` : pose le
   pending + outcome `'choice'` ; `applyEffect` switch exhaustif (copie). → tests.
4. `movement.ts` : `AdvanceOptions.onTriggerChoice?` + branche outcome.
5. `commands.ts` + `events.ts` : `ResolveTriggerChoice` + `TriggerChoiceResolved`.
6. `engine.ts` : handler + gating pendingTriggerChoice ; ai/adventure.ts callback.
7. `schemas.ts` + `loader.ts` : `choice` (+ options) dans l'union trigger.
8. Client : `TriggerChoice.tsx` + shell + dispatch + locales.
9. Tests moteur `triggers.test` (choix humain + résolution ; IA auto-résout) ;
   smoke facultatif (état déterministe requis, gate mirroré ⇒ documenté).
10. Docs 02 §2.1 + 18 A5 (choix livré ⇒ A5 clôturé) + ce plan.

## Statut

- [x] **LIVRÉ**. Effet `choice` (map.ts + schéma + loader) ; `pendingTriggerChoice?`
      optionnel (state.ts, non initialisé ⇒ golden/save intacts) ; helper partagé
      `resolveTriggerChoice` (`trigger-choice.ts`) ; `applyEffect`→exporté
      `applyTriggerEffect` ; `fireVisitTrigger` pose le pending + outcome `choice` ;
      `movement.ts` interrompt + callback IA ; commande `ResolveTriggerChoice` +
      événements `TriggerChoiceOffered`/`Resolved` + gating `choicePending` (5 sites)
      ; IA `onTriggerChoice`→option 0 ; modale client `TriggerChoice.tsx` + shell +
      locales `triggerChoice.title` FR/EN. 2 tests (`triggers.test`). Docs 02 §2.1
      + 18 A5 (**A5 clôturé**). Vérif : typecheck ✓, lint ✓, 910 engine + content ✓,
      content:check ✓, garde-fou ✓, build ✓, budget 331 Ko ✓, smoke @core 32/32 ✓,
      golden + save-shape **inchangés** (pas de bump). **A5 = LIVRÉ.**
