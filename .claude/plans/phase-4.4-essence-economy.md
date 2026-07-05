# Plan — Phase 4.4 : ressource de faction Essence (gain) — Arcane Hunters

Sous-lot Alpha (plan 4.1). Point d'extension : **brancher une ressource de
faction au gameplay** (doc 05 §3.3 : l'Essence, « vivre de ses combats »).
Générique — le moteur ne connaît pas « essence », seulement des ressources de
faction déclarées en données.

Périmètre resserré : **côté GAIN** (accumulation + persistance + affichage).
La **dépense** (coût T8/upgrades) viendra avec ses consommateurs (4.6). Les
**Contrats de chasse** (hook d'aventure hebdomadaire) = lot **4.5** (autre
point d'extension). Un lot = un point.

## Étapes

1. **État** : `PlayerState.factionResources: Record<string, number>` (générique,
   `{}` par défaut, initialisé à la création des joueurs `StartGame`). Bump
   `CURRENT_SAVE_VERSION` **2→3** (nouveau champ requis) + golden **re-fixé**.
2. **Effet déclaratif** : nouvelle variante `FactionBonus`
   `gainFactionResourceOnVictory { resource, amount }` (`faction/types.ts` +
   schéma contenu `factionBonusSchema`), interprétée dans
   `applyFactionVictoryEffects` → crédite le joueur du héros vainqueur ; event
   `FactionResourceGained { playerId, resource, amount }`. Loader : la ressource
   doit exister dans `manifest.factionResources` (règle croisée).
3. **Données** : manifeste AH `factionBonuses += { gainFactionResourceOnVictory,
   resource: 'essence', amount: 10 }`.
4. **Client** : barre de ressources affiche les ressources de faction du joueur
   (itère `player.factionResources`, testid `faction-resource-<id>`) ; toast
   `FactionResourceGained` i18n fr/en.
5. **Tests** : moteur (`faction-effects.test.ts`) — victoire ⇒ +essence sur le
   joueur ; golden re-fixé ; serialize (couvert). Contenu — le bonus AH résout
   (par propriété). **Vérif** complète, docs, PR.

## Vérification

typecheck, lint, garde-fou (effet générique, zéro littéral ; test par
propriété), tests moteur+contenu, content:check, smoke (build copie data),
budget. Golden **re-fixé** (nouveau champ d'état). Seul diff moteur = variante
déclarative générique (doc 06 §5.8).

## Écarts

- Dépense d'Essence (T8/upgrades) : 4.6. Contrats de chasse (hook weekStart) :
  4.5. Cap de la ressource (`factionResources[].cap`) non imposé au gain pour
  l'instant (documenté ; à ajouter avec la dépense si utile).
