# Plan — Format d'identité de héros + séparation canon / original

## Demande
Séparer les héros **venus d'un univers existant** (Hermione ↔ Harry Potter,
Rumi ↔ KPop Demon Hunters) de ceux **inventés / inspirés de joueurs** (Céleste).
→ Introduire un **format d'identité de héros** structuré portant cette origine.

## Décisions (utilisateur)
- **Périmètre : format + fiches (données)**. Couche **content** (schéma Zod +
  fiches JSON validées par le pipeline), **zéro diff moteur**. Affichage in-game
  différé (système de héros nommés du moteur non ouvert — cf. doc 16 État 16.6/16.8).
- **Origine : `canon` / `original`** (`origin` = champ discriminant).

## Format retenu (`heroIdentitySchema`, couche content)
Fiche `data/factions/<faction>/heroes/<id>.json` (convention miroir des unités) :
- `id` (kebab, = nom de fichier)
- `name` (@loc:), `bio` (@loc:)
- `archetype` : `might` | `magic`
- `origin` : `canon` | `original`
- `source` : nom de l'univers/œuvre — **requis ssi `canon`**, interdit sinon
  (nom propre, non localisé)
- `avatar` : clé du registre d'assets (`heroes/<clé>`)
- `avatarStyle` : `painterly` | `photoreal` (défaut `painterly`, doc 12 §7)
- `specialty?` (@loc:), `startingHouseId?` — indicatifs, non consommés (différé moteur)

Le manifeste déclare `heroes: string[]` (défaut `[]`, comme `units`). Le loader
charge/valide chaque fiche, vérifie id↔fichier, parité locale, houseId connu si
présent, et expose `FactionPack.heroes`. Consommateurs futurs filtrent par `origin`.

## Étapes
1. [x] Schéma : `HERO_ORIGINS`, `heroIdentitySchema`, type `HeroIdentity`, `manifest.heroes`. ✓ typecheck.
2. [x] Loader : charge `heroes/<id>.json`, règles croisées, `FactionPack.heroes`, collectLocRefs. ✓
3. [x] Fiches : rumi (canon/KDH), hermione (canon/HP), celeste (original) + `manifest.heroes`. ✓ content:check + faction:validate.
4. [x] Locales fr/en : `hero.<id>.name` + `hero.<id>.bio`. ✓ parité (loader).
5. [x] Test content : 3 héros exposés, séparables par origine (2 canon, 1 original). ✓ 110 tests verts.
6. [x] Docs : doc 16 État 16.9 + doc 06 (structure + checklist).
7. [x] Vérifs : typecheck, lint, build (budget 291 Ko), garde-fou faction vert, smoke 148/2 skip. Golden inchangé.
8. [ ] Commit + push branche `claude/vox-arcane-hunter-hero-g9jtcw` (PR #251 open/draft).

## Invariants
- Zéro diff moteur, zéro nom de faction en dur (garde-fou CI).
- Pas de bump `CURRENT_SAVE_VERSION` (rien en sauvegarde).
- Golden inchangé (héros de contenu hors replay inline).
