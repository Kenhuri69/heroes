# Lot F-RESON.2 — Génération de Résonance intra-combat par « performeur »

> Backlog : `.claude/plans/game-feature-gaps.md` §2.3 F-RESON.2.
> Doc source : `docs/16-faction-vox-arcana.md` §3.2 (« génération de Résonance
> en cours de combat par les unités performeuses T1 Chœur, T4 Chasseuse-Idole »).

## But

Ouvrir **UNE** surface de combat générique : une pile portant la nouvelle
capacité `performer` **génère une ressource de faction pendant le combat**,
créditée au joueur du héros du camp de la pile, **plafonnée** au cap déjà déclaré
(réutilise F-RESON.1). Zéro nom de faction dans le moteur. Câbler les données Vox
(Chœur T1, Idole T4 + variantes élites).

## Décisions de conception (tranchées « au plus proche du doc »)

- **Cadence** : la pile génère `amount` **une fois par round, quand elle prend
  réellement son tour** (hook unique `afterAction`, `acted=true` ⇒ pas de
  double-comptage sur Attendre, pas de gain si immobilisée/moral négatif la fait
  sauter). Couvre le round 1 (tous les tours passent par `afterAction`).
- **Bénéficiaire** : le joueur du héros du camp de la pile (`attackerHeroId`/
  `defenderHeroId` → `playerId`). Arène / gardien / garnison sans héros ⇒ pas de
  crédit (no-op gracieux).
- **Cap** : partagé avec le gain post-victoire — lu du bonus
  `gainFactionResourceOnVictory` de `factionCatalog[hero.factionId]` (cap estampillé
  par le loader depuis `factionResources[].cap`). Absent ⇒ non plafonné.
- **Événement** : nouveau `StackResonated` (transient) — ligne de journal de
  combat côté client, **pas de toast** (éviter le spam par round ; la barre de
  ressources montre déjà la croissance).
- **Pas de nouvel état persisté** ⇒ **pas de bump `CURRENT_SAVE_VERSION`**,
  **golden inchangé** (combat golden = unités génériques sans `performer`).

## Étapes

1. `data/core/abilities.json` : `performer` au catalogue → vérif `content:check`.
2. Content `loader.ts` : cross-validation — unité `performer` ⇒ `resource` déclarée
   dans `manifest.factionResources`. → vérif : test content d'un paquet fixture.
3. Engine :
   - `faction/effects.ts` : extraire `creditFactionResource(player, resource,
     amount, cap)` partagé ; refactor du gain post-victoire dessus.
   - helper `performerParams(def)` + `factionResourceCap(state, factionId, resource)`.
   - `combat/actions.ts afterAction` : crédit + event `StackResonated`.
   - `core/events.ts` : ajouter `StackResonated`.
   - → vérif : nouveau test `combat-performer.test.ts` (crédit par round, cap,
     pas de double-comptage sur Attendre, no-op sans héros).
4. Données Vox : `performer` sur `t1-choeur(-elite)`, `t4-idole(-elite)`.
   → vérif `content:check` + garde-fou faction.
5. Client : `app/combat-log.ts` traduit `StackResonated` ; locales FR/EN de la
   ligne de journal. → smoke.
6. Docs : `docs/16` §3.2 — retirer le « différé », noter la surface `performer`
   livrée (État 16.x).
7. Pipeline complet : typecheck · lint · tests engine+content · content:check ·
   garde-fou faction · garde-fou couleurs · build · budget bundle · smoke.

## Journal

- Branche `claude/f-reson-2` créée depuis main (b0f52ba).
- **Livré.** Capacité générique `performer` (catalogue 28 → 29) : gain de ressource
  de faction intra-combat, hook unique `afterAction` gaté sur `wasFirstAction`
  (1×/round, jamais sur Attendre ni tour bonus de moral). Helper partagé
  `creditFactionResource` (refactor du gain post-victoire dessus) + `factionResourceCap`.
  Event `StackResonated` (transient) → journal de combat client (pas de toast).
  Données Vox : `performer` sur t1-choeur(-elite) `+1`, t4-idole(-elite) `+2`.
  Cross-validation contenu (resource déclarée). Doc 16 §3.2 + État 16.10.
- **Aucun état persisté** ⇒ pas de bump `CURRENT_SAVE_VERSION`, **golden inchangé**
  (combat golden = unités génériques sans `performer`).
- Vérifs : typecheck 5/5, lint, engine 584 tests (+6 `combat-performer`), content
  116 (+2 loader), content:check, garde-fou faction vert, garde-fou couleurs vert,
  build, bundle ~293 Ko gzip < 800, smoke 164 passed.
