# Lot F-SCHOOLS.5 — École de la Traque : Bannissement

> Backlog `.claude/plans/game-feature-gaps.md` §2.3 F-SCHOOLS.5+.
> Doc source : `docs/05-faction-arcane-hunters.md` §6 (« Bannissement — Retire du
> combat une pile invoquée/démoniaque, PV ≤ seuil Pouvoir », cercle 4).

## But (un sous-lot = une mécanique)

3ᵉ des sorts Traque restants : **Bannissement** — nouvelle mécanique de combat
**générique** « bannir » : un sort `banish` retire du combat une pile ennemie
portant la capacité générique `banishable` (unités invoquées/démoniaques) SI son
total de PV ≤ seuil (`base + perPower × Pouvoir`).

## Décisions de conception (« au plus proche du doc »)

- **Générique** : nouveau `SpellKind 'banish'` + capacité de données `banishable`.
  Le moteur ne lit qu'un id de capacité opaque ; aucun nom de faction.
- **« invoquée/démoniaque »** (doc) → capacité `banishable` posée sur les unités
  invoquées (squelette relevé par Nécromancie) et démoniaques (Pénitent
  `demonform` + élite). Data-driven, décidé par les données.
- **Seuil** : `base + perPower × Pouvoir` ≥ total de PV de la pile ⇒ bannie
  ENTIÈRE (retirée). Sinon fizzle (mana consommée, aucun effet) — patron HoMM.
- **Ciblage** : pile ENNEMIE — réutilise le ciblage de pile existant
  (`spellTargetsEnemy(kind)` gagne `banish`). Zéro nouvelle surface UI.
- **Retrait** = mort de pile existante (recordLoss + `StackDied` + splice, comme
  `damageOneStack`). **Aucun état persisté nouveau** ⇒ **pas de bump save**,
  **golden inchangé** (le golden ne bannit rien).

## Étapes

1. `data/core/abilities.json` : `banishable` au catalogue.
2. Engine `hero/types.ts` : `SpellKind += 'banish'`.
3. Engine `hero/spells.ts` : `spellTargetsEnemy` gagne `banish`.
4. Engine `combat/spell-effect.ts` : branche `banish` (seuil + `banishable` ⇒
   retrait de pile).
5. Content `schemas.ts` : `kind` enum `+= 'banish'`.
6. Données : `banishable` sur `t1-squelette` (Necropolis), `t8-penitent(-elite)`
   (AH) ; sort `bannissement` (school traque, cercle 4) + locales core FR/EN.
7. Doc 05 §6 : note « livré ».
8. Tests : engine (bannit une pile banishable ≤ seuil ; épargne non-banishable ;
   épargne banishable > seuil) ; content (le sort valide).
9. Pipeline complet.

## Journal

- Branche `claude/f-schools-5` créée depuis main (2629587).
- **Livré.** `SpellKind 'banish'` + capacité `banishable` (catalogue). Branche
  `banish` dans `applySpellToTargets` (seuil PV + `banishable` ⇒ retrait de pile,
  patron mort de pile). `spellTargetsEnemy += banish`. Schéma `kind += banish`.
  Données : `banishable` sur `t1-squelette`, `t8-penitent(-elite)` ; sort
  `bannissement` (cercle 4, seuil 40 + 20×Pouvoir) + locales FR/EN. Doc 05 §6.
- **Drive-by** : correction TS2783 héritée de main (helper `unit()` des tests
  `combat-silence`/`combat-banish` : `id` dupliqué par le spread) — masquée par le
  cache incrémental TS local en F-SCHOOLS.4, rouge en CI propre. Retiré l'`id`
  explicite (fourni par `...over`).
- Aucun état persisté nouveau ⇒ **pas de bump save, golden inchangé**.
- Vérifs : typecheck 5/5, lint, engine 605 (+3 `combat-banish`), content 116,
  content:check, garde-fous faction+couleurs verts, build, bundle ~294 Ko gzip
  < 800, smoke 168 passed.
