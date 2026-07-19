# Héros original Donjon — Olivier, assassin de l'ombre

## Demande
Ajouter un héros **original** (`origin: original`) à la faction **Donjon** :
- prénom **Olivier**, **elfe noir**, **assassin de l'ombre au poison** ;
- thème « **ne laisse pas de place à la chance** » (certitude, pas de coup de chance) ;
- le reste (épithète, spécialité, compétences) tranché par moi ;
- livrer un **prompt photo réaliste** pour griser (grimer) une vraie personne en cet elfe noir.

## Contraintes projet (guidelines §8, doc 06/17)
- **Zéro diff moteur** : un héros nommé = **données pures** (comme Raelag/Shadya/Garrick).
  → réutiliser uniquement le vocabulaire d'effets générique déjà branché
  (`specialtyEffect` : `conditional`, etc.). Pas de nouveau point d'extension.
- **Pas de bump `CURRENT_SAVE_VERSION`**, golden inchangé (héros hors replay inline).
- Garde-fou « zéro faction dans le moteur » reste vert.

## Design retenu
- **id** : `olivier` (fichier `heroes/olivier.json`, `manifest.heroes`).
- **archetype** : `might` (poison physique, tueur au corps-à-corps/tir).
- **origin** : `original` (donc **pas** de champ `source`).
- **attributs** : attack 3 / defense 1 / power 1 / knowledge 1 (assassin offensif).
- **spécialité** (`specialtyEffect`) : `conditional` sur `t1-eclaireur` (la lignée
  éclaireur/assassin qui porte `poisonSting`), `attack:+1 speed:+1`, `perLevels:4`
  → létalité qui croît avec le niveau. Générique, interprété par `conditionalUnitBonus`.
- **startingSkills** : `{ "archery": 1 }` (ses empoisonneurs sont des tireurs) —
  **volontairement PAS `luck`** : « ne laisse pas de place à la chance ».
- **startingSpells** : `[]` (héros might, comme Raelag).
- **avatar** : `dungeon-olivier` (repli gracieux `dungeon-might` → procédural).
- **épithète** : « Olivier, la Coupe Silencieuse » (nom = Olivier, épithète en bio).

## Étapes
1. `data/factions/dungeon/heroes/olivier.json` → verify: schéma content OK.
2. Enregistrer `olivier` dans `manifest.heroes` → verify: loader charge le héros.
3. Locales FR/EN (`hero.olivier.name/bio/specialty`) → verify: parité FR/EN, 0 clé en dur.
4. `content:check` + typecheck + tests contenu → verify: vert.
5. Fournir le prompt photo réaliste (grimage) à l'utilisateur.

## Vérifications
- [x] `pnpm content:check` : 7 paquets valides (dungeon inclus).
- [x] Tests contenu (130) + moteur (758) verts ; golden inchangé, garde-fou faction vert.
- [x] `pnpm typecheck` + `pnpm lint` verts.
- [x] Doc 17 §5 mise à jour (héros original Olivier).
- [x] Prompt photo (grimage elfe noir) livré à l'utilisateur en réponse.

## Écarts / décisions
- Spécialité ciblée sur `t1-eclaireur` (base, dispo dès le départ + porte `poisonSting`)
  plutôt que l'élite « Assassin » : le `conditional` moteur matche un `unitId` exact,
  et la base est recrutable immédiatement (meilleur gameplay). Flavor « assassin »
  porté par la bio/épithète.
- Un test existant figeait « 2 héros canon » → mis à jour en « 3 héros, 2 canon +
  1 original, tous gameplay-résolus » (changement de test légitime lié à l'ajout).
- Avatar `dungeon-olivier` non stagé (PNG) : repli gracieux `dungeon-might` →
  procédural. L'utilisateur générera le portrait via le prompt photo fourni.
