# Lot M-VISIT — lieu visitable `morale` (Temple / Point d'eau)

## Objectif
Ouvrir un nouveau `VisitableEffect` **générique** `morale { amount }` : un lieu
visitable (classique HoMM « Temple »/« Watering Place ») accorde un bonus de
**moral** jusqu'à la fin du prochain combat — miroir exact de l'effet `luck`
déjà livré. Comble le fait que le moral de combat n'a AUCUNE source liée à la
carte, alors que la chance en a une (`visitLuck`).

## Coût (assumé)
Nécessite un champ persistant `HeroState.visitMorale` (comme `visitLuck`) ⇒
**bump `CURRENT_SAVE_VERSION` 29 → 30** + mise à jour save-shape + golden re-fixé
(forme seule : les héros golden auront `visitMorale:0`, aucune valeur ne change).
UN seul bump, permis (≤ 1/lot). Pas de faction:sim (aucun équilibrage faction).

## Invariants
- Zéro nom de faction moteur/tests (ids opaques). Déterministe (aucun RNG).
- Réutilise le pipeline `visitBonus`/`BonusVisited` + le calcul de moral existant
  (`heroMoraleForSide`), miroir de `visitLuck`/`heroLuckOf`.

## Étapes & vérifs
1. **state.ts** : `HeroState.visitMorale: number` (après `visitLuck`) +
   `CURRENT_SAVE_VERSION` 29→30 + commentaire. → typecheck.
2. **engine.ts** + **hero/recruit.ts** : init `visitMorale: 0` à la création du héros.
3. **combat/state-helpers.ts** `heroMoraleForSide` : `+ hero.visitMorale`.
4. **combat/turns.ts** + **combat/leave.ts** : reset `visitMorale = 0` (mêmes 2
   sites que `visitLuck`, fin de combat).
5. **adventure/map.ts** : variante `{ kind: 'morale'; amount }` de `VisitableEffect`.
6. **adventure/visitable.ts** : handler (`hero.visitMorale += amount`).
7. **content** `schemas.ts` + `loader.ts` : variante Zod + union du loader.
8. **client** : `MapObjectCard`, `notifications`, `render/mapObjects` (teinte +
   silhouette temple) + locales FR/EN.
9. **données** proto-01 : `temple-1` (morale, oncePerHeroPerWeek).
10. **doc** 02 §2.2 (liste des lieux) + doc 07 §4 (note v30).
11. **save-shape.test** : `'visitMorale'` dans HeroKey + version 30.
12. **golden-replay.test** : re-fix du hash + commentaire (forme v29→30).
13. **tests** : `map-visitables` (moral posé, nourrit `moraleOf` en combat, reset
    après combat, oncePerHeroPerWeek).

## Pipeline complet (avant push)
typecheck 5/5 · lint · vitest engine (golden + save-shape re-fixés une fois,
bump assumé) · vitest content · content:check · garde-fou faction ==1 · garde-fou
couleur ==1 · build · bundle < 819200 · smoke. Pas de faction:sim.

## Journal
- plan créé, branche `claude/m-visit-morale` depuis origin/main.
