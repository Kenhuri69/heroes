# Lot F-SCHOOLS.3 — École de la Traque : Volée de Dagues Spectrales (sort mange-Marques)

> Backlog `.claude/plans/game-feature-gaps.md` §2.3 F-SCHOOLS.3+.
> Doc source : `docs/05-faction-arcane-hunters.md` §6 (« Volée de Dagues
> Spectrales — Dégâts à la cible +50 % par charge de Marque consommée », cercle 3).

## But (un sous-lot = une mécanique)

Compléter l'école Traque avec le **1ᵉʳ des 6 sorts restants** : **Volée de Dagues
Spectrales** — nouvelle mécanique générique **« sort qui CONSOMME les Marques de
la cible pour amplifier ses dégâts »** (jusqu'ici seules des *capacités* d'unité
consommaient des Marques — `consumeMarks`/`devourMarks` ; aucun *sort* ne le
faisait). Champ de sort déclaratif `marksDamagePct` : dégâts × (1 + passif Marque
+ `marksDamagePct/100 × charges`), puis les Marques de la cible sont remises à 0.

## Décisions de conception

- **Générique** : `SpellDef.marksDamagePct?` — le moteur ne lit qu'un nombre ;
  aucun nom de faction. Réutilise le système de Marque (`CombatStack.marks`) + le
  pipeline de dégâts de sort existant.
- **Empilement** : le bonus de consommation **s'ajoute** au bonus passif de
  Marque (+8 %/charge sur les sorts de Traque, doc 05 §3.1) — les deux sont des
  amplificateurs de Marque, pas exclusifs.
- **Consommation** : à la résolution (pas en préviz), la cible touchée par un
  sort `marksDamagePct` voit ses Marques **remises à 0** (dépense de la ressource).
- **Préviz** (`estimateSpell`) reflète le bonus de consommation (déterministe,
  sans RNG) mais ne touche pas l'état.
- **Ciblage** : pile ennemie — **réutilise le ciblage de pile existant**
  (`TargetList`), zéro nouvelle surface UI.
- **Aucun état persisté nouveau** (Marques déjà sérialisées, catalogue de sorts
  hors save) ⇒ **pas de bump `CURRENT_SAVE_VERSION`**, **golden inchangé** (le
  sort n'est pas dans le replay golden).

## Étapes

1. Engine `hero/types.ts` : `SpellDef.marksDamagePct?: number`.
2. Engine `combat/spell-effect.ts` (path `damage`) : ajouter le bonus de
   consommation au `markBonus`, puis remettre `t.marks = 0` si `marksDamagePct`.
3. Engine `hero/index.ts` `estimateSpell` (path `damage`) : mirroir du bonus.
4. Content `schemas.ts` : `marksDamagePct: z.number().nonnegative().optional()` ;
   `loader.ts buildSpellCatalog` : propagation conditionnelle.
5. Données `data/core/spells.json` : sort `volee-de-dagues` (school traque,
   circle 3, kind damage, base/perPower, `marksDamagePct: 50`).
6. Locales core FR/EN : `spell.volee-de-dagues` (+ `.lore`).
7. Doc 05 §6 : note « livré » sur la Volée de Dagues (école Traque).
8. Tests : engine (dégâts amplifiés par Marques + Marques consommées + préviz),
   content (le sort valide, `content:check`).
9. Pipeline complet (typecheck/lint/tests/content:check/garde-fous/build/budget/smoke).

## Journal

- Branche `claude/f-schools-3` créée depuis main (43ed5b0).
- **Livré.** `SpellDef.marksDamagePct` : sort de dégâts mange-Marques (bonus
  %/charge + passif de Marque, puis Marques consommées). Threadé dans
  `applySpellToTargets` (résolution) + `estimateSpell` (préviz). Schéma+loader
  propagent le champ (spread conditionnel, pont exactOptional). Données :
  `volee-de-dagues` (cercle 3, base 12 + 3×Pouvoir, marksDamagePct 50) + locales
  FR/EN (+lore). Doc 05 §6 note « livré ».
- Aucun état persisté nouveau ⇒ **pas de bump save, golden inchangé**.
- Vérifs : typecheck 5/5, lint, engine 598 (+3 `combat-spell-marks`), content 116,
  content:check, garde-fous faction+couleurs verts, build, bundle ~294 Ko gzip
  < 800, smoke 168 passed.
