# Plan — Rendre accessibles tous les héros de la faction Donjon

## Symptôme
Écran « Nouvelle partie », faction Donjon : le menu de héros de départ ne liste
que **Raelag** et **Shadya**. **Olivier** (héros original du Donjon) n'apparaît
pas, alors qu'il est déclaré dans le manifeste et doté d'attributs.

## Diagnostic (cause racine)
Trois héros **distincts** (archétypes/spécialités/avatars différents) partagent
le **même `id: "olivier"`** dans trois paquets :
- `data/factions/arcane-hunters/heroes/olivier.json` (might, lames empoisonnées)
- `data/factions/necropolis/heroes/olivier.json` (magic, givrepeste)
- `data/factions/dungeon/heroes/olivier.json` (might, poison certain)

Deux fusions globales indexées par id écrasent silencieusement les doublons :
1. `buildHeroRoster` (loader.ts) fait `roster[h.id] = …` ⇒ un seul « olivier »
   survit (le dernier paquet chargé). L'ordre `data/factions/index.json` met
   `dungeon` en dernier ⇒ actuellement le donjon gagne, mais necropolis et
   arcane-hunters **perdent** leur Olivier.
2. `i18n.ts:29` `Object.assign(merged, pack.locales)` ⇒ les clés
   `hero.olivier.{name,bio,specialty}`, **différentes selon le paquet**,
   collisionnent aussi (mauvais texte de spécialité affiché).

Même classe de bug que la collision de nom de faction (phase 3.7) et l'unicité
globale des ids d'unités (R5 CO2) — mais **aucun garde-fou** n'existait pour les
ids de héros.

## Correctif (données + un garde-fou générique, zéro cas de faction moteur)
1. Rendre les ids de héros **globalement uniques** : renommer chaque Olivier en
   `olivier-<faction>` (fichier + champ `id` + entrée manifeste + clés locales
   `hero.olivier-<faction>.*` + refs `@loc:`). → verify: `content:check` vert.
2. Ajouter un **garde-fou d'unicité globale des ids de héros** dans `loader.ts`,
   calqué sur celui des unités. → verify: test unitaire loader (doublon rejeté).
3. Mettre à jour `dungeon-recruit.test.ts` (`h.id === 'olivier-dungeon'`).
4. Vérifs : `content:check`, `typecheck`, tests contenu, probe `buildHeroRoster`
   liste les 3 oliviers, smoke Chromium.

## État — LIVRÉ ✅
- [x] 2ᵉ bug découvert en cours de route : **clé JSON `"heroes"` en double** dans
  `arcane-hunters/manifest.json` (ligne 6 masquée par la ligne 124) ⇒ l'olivier
  arcane n'était même pas chargé. Fusionné en un seul tableau.
- [x] Renommage des 3 Olivier en ids globalement uniques (+ fichiers, refs, clés).
- [x] Garde-fou d'unicité globale des ids de héros (loader) + test unitaire.
- [x] `dungeon-recruit.test.ts` mis à jour.
- [x] Vérifs vertes : `content:check`, `typecheck`, `lint`, golden moteur (758),
  tests contenu (131), smoke Chromium (102). Probe : les 3 Olivier chargent
  sous leur bonne faction.

## Écarts / décisions
- Renommer les 3 (pas seulement le donjon) : sinon necropolis/arcane restent en
  collision (bug silencieux résiduel) et le garde-fou ajouté échouerait au build.
- Ids `olivier-<faction>` plutôt que namespacer la clé du roster : les ids de
  héros sont des poignées opaques (StartGame/save/taverne) — renommer la donnée
  est l'approche idiomatique du projet (cf. unicité des unités), sans toucher au
  moteur ni bump de save.
