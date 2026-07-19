# Lot F-SCHOOLS.4 — École de la Traque : Silence Scellé (mécanique de silence)

> Backlog `.claude/plans/game-feature-gaps.md` §2.3 F-SCHOOLS.4+.
> Doc source : `docs/05-faction-arcane-hunters.md` §6 (« Silence Scellé — Cible
> `spellcaster` : capacités magiques désactivées », cercle 2).

## But (un sous-lot = une mécanique)

2ᵉ des 5 sorts Traque restants : **Silence Scellé** — nouvelle mécanique de
combat **générique** « statut de silence » : une pile silenciée ne peut plus
lancer son sort embarqué (`spellcaster`) pendant `Pouvoir` rounds. Nouveau `kind`
de sort `silence` + champ persisté `SpellStatus.silenced`.

## Décisions de conception

- **Générique** : nouveau `SpellKind 'silence'` + `SpellStatus.silenced: boolean`.
  Le moteur ne lit qu'un booléen ; aucun nom de faction. Réutilise le pipeline
  de statuts temporaires (durée = `spellStatusDuration(Pouvoir)`, décrément et
  retrait au round déjà en place).
- **Effet** : gate le lancer de sort d'unité (`spellcaster`, A2h) — une pile
  silenciée ne peut plus caster (validate joueur + IA `maybeUnitCast`). Le silence
  n'affecte QUE le `spellcaster` (les capacités passives restent).
- **Ciblage** : pile ENNEMIE — réutilise le ciblage de pile existant.
  Helper partagé `spellTargetsEnemy(kind)` (dédup des 3 définitions inline :
  hero/validate, unit/validate, IA) pour que le nouveau kind reste cohérent.
- **Save** : `SpellStatus.silenced` sérialisé ⇒ **bump `CURRENT_SAVE_VERSION`
  26→27** (précédents v15/v19 = ajouts de champ SpellStatus). Golden re-fixé
  UNE fois SI la forme change le hash (sinon inchangé — combat null en fin de
  golden). Doc 07 §4 mise à jour.

## Étapes

1. Engine `hero/types.ts` : `SpellKind += 'silence'` ; `SpellStatus.silenced`.
2. Engine `hero/spells.ts` : helper `spellTargetsEnemy(kind)`.
3. Engine `combat/spell-effect.ts` : branche silence (push status `silenced:true`) ;
   `silenced:false` sur les autres créations de statut.
4. Engine `combat/damage.ts` : `silenced:false` sur les créations de statut
   (curse, poison).
5. Engine gate : `combat/state-helpers.ts` `isSilenced(stack)` ; brancher dans
   `combat/actions.ts` (validate castSpell) + `combat/ai.ts` (`maybeUnitCast`).
6. Engine : remplacer les 3 `targetsEnemy` inline par `spellTargetsEnemy`.
7. `core/state.ts` : bump 26→27 + commentaire v27. `save-shape.test.ts` : 27.
   `docs/07` §4.
8. Content `schemas.ts` : `kind` enum `+= 'silence'`.
9. Données `data/core/spells.json` : `silence-scelle` (school traque, cercle 2,
   kind silence) + locales core FR/EN.
10. Client : indicateur « silenciée » sur la fiche de pile (parité `immobilized`)
    + locales.
11. Doc 05 §6 : note « livré ».
12. Tests : engine (silence gate le cast unité + expire + IA saute) ; golden/
    save-shape re-fixés.
13. Pipeline complet.

## Journal

- Branche `claude/f-schools-4` créée depuis main (dd3954c).
- **Livré.** `SpellKind 'silence'` + `SpellStatus.silenced` (bump save **26→27**,
  doc 07 §4). Gate `isSilenced` dans la validation du cast d'unité (joueur) et
  dans l'IA (`chooseSpellcast`/`maybeUnitCast`). Refactor : helper
  `spellTargetsEnemy(kind)` remplace les 3 contraintes de camp inline (héros,
  unité, IA). Données : `silence-scelle` (cercle 2) + locales FR/EN. Client :
  aucun diff — la fiche de pile rend déjà les statuts génériquement, `SpellBook`
  cible déjà l'ennemi (heal/buff = allié). Doc 05 §6 note « livré ».
- Golden re-fixé UNE fois (`15b26649`→`2d4de0ae`, **forme seule** — le champ
  `silenced:false` s'ajoute à chaque statut sérialisé ; le golden ne lance aucun
  silence). save-shape → 27.
- Vérifs : typecheck 5/5, lint, engine 602 (+4 `combat-silence`), content 116,
  content:check, garde-fous faction+couleurs verts, build, bundle ~294 Ko gzip
  < 800, smoke 168 passed.
