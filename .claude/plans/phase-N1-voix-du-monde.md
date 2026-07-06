# Plan — Lot N1 : « La voix du monde » (doc 13 §7)

Premier lot du polishing narratif (doc 13). Le moins cher, le plus rentable :
**armer tout le contenu existant d'un texte d'ambiance** (`loreKey`), affiché
dans les écrans déjà là. **Zéro diff moteur.**

## Périmètre (doc 13 §3.5, §7 tableau N1)

- Champ **optionnel** `loreKey` (`@loc:`) sur unités / bâtiments / artefacts /
  sorts (schémas rétro-compatibles : contenu sans lore reste valide).
- Textes FR/EN écrits **du point de vue de la faction** (§3.5), ton §1.1
  (phrases courtes ≤ ~200 car., mobile-lisibles, humour de caractère).
- Les 4 factions (Haven, Necropolis, Arcane Hunters, Sylvan Court) + le cœur
  (bâtiments communs, sorts, artefacts).
- Écrans existants affichent le lore : fiche/tuile d'unité, vignette de
  bâtiment, infobulle d'artefact, description de sort.
- `content:check` / audit i18n : si `loreKey` présent, **parité FR/EN**
  obligatoire ; rapport de couverture.
- Smoke : une chaîne de lore s'affiche (desktop + mobile).

## Invariants (doc 13 §0)

Moteur ignore le lore (pur contenu) ; déterminisme intact (golden inchangé,
le lore n'entre pas dans `GameState`) ; touch-first ; i18n parité ; budget
(texte = locales, déjà hors bundle JS).

## Étapes

1. **Schéma** : `loreKey: locRef.optional()` sur `unitSchema`, `buildingSchema`,
   `spellSchema`, `artifactSchema`. Types résolus (`ResolvedSpell` etc.)
   excluent `name` — vérifier que `loreKey` n'y fuit pas côté moteur (le lore
   est pur affichage, pas besoin côté moteur → l'exclure des formes résolues).
   → vérif : content typecheck, loader accepte le champ.
2. **Données** : ajouter `loreKey` + textes locales FR/EN à chaque entité.
   Convention `@loc:unit.<id>.lore`, `building.<id>.lore`, `spell.<id>.lore`,
   `artifact.<id>.lore`.
   → vérif : `content:check` vert, parité FR/EN.
3. **Validation** : étendre `content:check` (parité `loreKey` + couverture
   affichée « N/M entités ont un texte »).
   → vérif : le rapport liste la couverture.
4. **Client** : afficher le lore dans les 4 surfaces existantes.
   → vérif : typecheck client, smoke.
5. **Docs** : doc 13 (N1 ✅), roadmap 09.
6. Vérification par lot complète.

## Vérification par lot (obligatoire)

- [x] typecheck 4/4
- [x] tests moteur 289 (golden inchangé — le lore n'entre pas dans `GameState`)
- [x] tests content 73 (+ parité loreKey via `checkLoreParity`)
- [x] `content:check` — « 58/60 unités, 97 textes », parité fr/en
- [x] garde-fou faction (grep CI local : propre)
- [x] build client (JS ~78 Ko gzip, < 800 Ko ; locales hors bundle)
- [x] smoke desktop + mobile (lore de bâtiment affiché en ville)

## Décisions / écarts

- **97 textes** authoring parallélisé (5 sous-agents : 1/faction + core), QC +
  intégration mécanique par moi (script : `loreKey` sur unités par insertion de
  ligne = format compact préservé ; locales par round-trip JSON = format flat
  préservé).
- **Champ `loreKey` posé sur les UNITÉS seulement** (cohérent avec leur `name`
  explicite). Sorts/artefacts/bâtiments utilisent la **convention** `<prefix>.
  <id>.lore` sans champ (cohérent avec leur nom-par-convention). Le client dérive
  la clé par convention dans les deux cas — pas de plomberie `loreKey` dans les
  formes résolues moteur.
- **`test-faction` non couvert** (stub) : 2 unités sans lore — attendu, la
  couverture l'affiche (58/60).
- Un texte EN corrigé (« Ashgard » → « the Marches ») pour cohérence du cadre.
- Golden **inchangé** : le lore est pur affichage, hors `GameState`.
