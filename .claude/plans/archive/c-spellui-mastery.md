# C-SPELLUI.4 — Indication de maîtrise d’école dans le grimoire

Backlog game-feature-gaps.md « C-SPELLUI » (dernier item : maîtrise/cercle).
Le cercle est déjà affiché (en-têtes « Cercle N »). Il manquait la MAÎTRISE :
le rang du héros dans l’école active (compétence Magie du Feu/Eau/…), qui
pilote la réduction de coût de mana (A6). Doc 02 §1.3 / doc 08 §2.3.

## Constat
`heroManaCostReduction` itère déjà hero.skills en filtrant `def.school`. Aucun
helper n’exposait le RANG de maîtrise. Le grimoire ne montrait pas la
proficience du héros par école.

## Étapes
1. Engine: helper pur `heroSchoolMastery(hero, catalog, school)` (rang max des
   compétences de cette école, 0 sinon) à côté de `heroManaCostReduction`,
   exporté. Pur ⇒ golden inchangé, pas de bump save.
   → verif: unit test moteur (hero-skills : rang école, 0 hors école/à vide).
2. Client SpellBook: badge de maîtrise dans le panneau d’onglet (rang localisé
   `skill.rank.N`, « de base » si 0). Toujours affiché ⇒ smoke-testable.
3. Locales fr/en (spellbook.mastery / spellbook.masteryNone). CSS.
4. Smoke: onglet neutre ⇒ maîtrise « de base » (héros de départ sans magie).
5. Doc 08 §2.3.

## Portée
Helper moteur PUR + client. Golden inchangé, pas de bump save, zéro faction.

## Statut
Étapes 1-5 implémentées. Non-smoke vert (typecheck·lint·engine 816 golden+save-shape inchangés·content·content:check·gardes 1/1·build·bundle 319Ko). Smoke en cours.
