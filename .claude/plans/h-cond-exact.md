# Lot H-COND-EXACT — signatures exactes des spécialités conditionnelles différées

> Branche `claude/h-cond-exact` (repart de `origin/main`). Docs source : doc 04 §5
> (Mère Corbeau), doc 14 §5 (Faelar), doc 05 §7 (Alwin). Suite du lot H-COND
> (`.claude/plans/h-cond.md`) qui avait livré des VARIANTES unit-scopées faute
> d'un point d'extension adéquat. Ici : les **signatures fidèles**, chacune = **UN
> point d'extension moteur générique distinct** (autorisé par la consigne).

## Objectif

Remplacer les 3 variantes actuelles par les signatures canoniques des docs, en
ouvrant pour chacune un point d'extension moteur **générique** (zéro faction,
zéro nom de héros en dur) :

| Héros | Faction | Variante actuelle (H-COND) | Signature exacte (ce lot) | Point d'extension |
|-------|---------|----------------------------|---------------------------|-------------------|
| Mère Corbeau | necropolis | `conditional` +1 att `t1-squelette`/2 niv | **Nécromancie +2 %/niveau** (doc 04 §5) | `raiseUndeadPctPerLevel` |
| Faelar | sylvan-court | `conditional` +1 déf `t6-treant`/2 niv | **Symbiose démarre à 1 palier** (doc 14 §5) | `startingSymbiosisStacks` |
| Alwin | arcane-hunters | plat −15 % coût mana | **Familier T2 gratuit au jour 1** (doc 05 §7) | `startingArmyBonus` |

## Points d'extension (génériques)

Trois nouveaux champs OPTIONNELS du vocabulaire d'effets déclaratifs de héros
(`heroEffectFields` schéma contenu + `SkillRankEffect` moteur, partagé Maison/
spécialité). Aucun ne nomme de faction/héros.

1. **`raiseUndeadPctPerLevel?: number`** (scalaire). Lu dans
   `applyRaiseUndeadOnVictory` (`faction/effects.ts`) : `percent +=
   Σ(effets).raiseUndeadPctPerLevel × hero.level`. Générique — `raiseUndead` est
   le nom du **mécanisme** déjà présent au moteur (effet de faction déclaratif),
   pas un id de faction. Ne touche pas le cap. Repli 0 = comportement historique.
2. **`startingSymbiosisStacks?: number`** (scalaire). Appliqué dans
   `openPlacementOrBattle` (`combat/setup.ts`, hook unique des 3 `begin*Combat`) :
   pour chaque camp portant un héros (`attackerHeroId`/`defenderHeroId`), les
   piles du camp DOTÉES de la capacité `symbiosis` démarrent à
   `min(valeur, maxStacks)` paliers au lieu de 0. `symbiosis` est un module de
   capacité générique (pas une faction).
3. **`startingArmyBonus?: { unitId: string; count: number }`** (objet). Appliqué
   à la création du héros (`StartGame`, `core/engine.ts`) : fusionné dans
   `hero.army` (empile si `unitId` déjà présent, sinon ajoute une pile si < 7).
   `unitId` = id opaque. Générique.

### Agrégation / genericité

- Les 2 scalaires restent dans `NumericEffectField` mais ne sont JAMAIS lus par
  les accesseurs génériques (`heroMovementBonus`… ) : uniquement dans leur code
  dédié via un helper `sumHeroEffectField` (somme houseEffects + specialtyEffects).
- L'objet `startingArmyBonus` est EXCLU de `NumericEffectField`
  (`Exclude<…, 'conditional' | 'startingArmyBonus'>`), comme `conditional`, pour
  ne pas casser `sumHouseField` (`total += number`).
- **Zéro nouveau champ d'état** : les 3 effets vivent dans `specialtyEffects`
  (déjà sérialisé) ; l'armée/les symbiosisStacks/le percent sont des champs
  existants ou des calculs. ⇒ **pas de bump `CURRENT_SAVE_VERSION`**.
- **Golden inchangé** : les héros du golden ont `specialtyEffects: []` ⇒ aucun
  effet, aucun combat/StartGame du replay n'est affecté (à re-vérifier).

## Étapes / vérif

1. Moteur : 3 champs sur `SkillRankEffect` ; `sumHeroEffectField` ;
   `raiseUndeadPctPerLevel` dans `applyRaiseUndeadOnVictory` ;
   `startingSymbiosisStacks` dans `openPlacementOrBattle` ;
   `startingArmyBonus` dans `StartGame`. → tests moteur dédiés (3 fichiers ou 1)
   + golden inchangé.
2. Contenu : 3 champs dans `heroEffectFields` (schéma) + cross-validation
   (`startingArmyBonus.unitId` connu). content:check vert.
3. Données : réécrire les 3 fiches héros + locales FR/EN (nom inchangé, bio +
   specialty MAJ pour refléter l'effet exact). Parité FR/EN.
4. Tests : nécromancie/niveau (Mère Corbeau relève plus haut à haut niveau) ;
   symbiose de départ (Faelar : piles symbiotiques à 1 palier au tour 1) ;
   armée de départ (Alwin : +1 `t2-familier` à la création). Smoke : escarmouche
   arcane-hunters + Alwin ⇒ le héros démarre avec le familier (assert army).
5. Vérifs complètes : typecheck, lint, engine, content, content:check, build
   (< 800 Ko), garde-fous faction+couleurs, smoke complet. Golden inchangé, pas
   de bump save.
6. Docs : doc 04 §5 / 05 §7 / 14 §5 (variante → signature exacte livrée) ;
   `h-cond.md` (marquer les 3 exacts livrés) ; CLAUDE.md (récap au lot final).

## Journal

- Plan créé ; exploration : `heroEffectFields` (schéma), `SkillRankEffect`
  (moteur), `sumHouseField`/`NumericEffectField` (hero/skills.ts),
  `applyRaiseUndeadOnVictory` (faction/effects.ts), `placeSide`/
  `openPlacementOrBattle` (combat/setup.ts), boucle StartGame (core/engine.ts).
  Familier arcane = `t2-familier`.
- **Livré** : 3 champs sur `SkillRankEffect` + schéma `heroEffectFields`
  (`startingArmyBonus` exclu de `NumericEffectField`) ; helper exporté
  `sumHeroEffectField` ; `raiseUndeadPctPerLevel` dans `applyRaiseUndeadOnVictory`
  (percent += valeur × niveau) ; `applyStartingSymbiosis` dans
  `openPlacementOrBattle` ; `startingArmyBonus` fusionné à `StartGame` ;
  cross-validation loader `startingArmyBonus.unitId`. 3 fiches héros réécrites +
  locales FR/EN (specialty + bio) ; docs 04/05/14 mis à jour.
- Tests : `hero-specialty-exact.test.ts` (11 cas : nécromancie/niveau, symbiose
  de départ ciblée sur les piles symbiotiques, familier de départ empile/ajoute/
  coexiste) ; smoke `H-COND-EXACT` (Alwin familier bout en bout). Engine 625,
  content 116, golden inchangé, PAS de bump save.
- Vérifs vertes : typecheck 5/5, lint, engine 625, content 116, content:check
  (12 scénarios), build 295 Ko gzip, garde-fous faction+couleurs, smoke complet
  **170 passed / 0 failed**.
