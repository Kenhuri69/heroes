# Héros original « Olivier » — Arcane Hunters

Ajout d'un héros nommé **original** à la faction Arcane Hunters : Olivier,
assassin de l'ombre affûté au poison. Avatar photoréaliste (à partir d'une
photo de l'utilisateur), fiche de données recrutable à la Taverne.

Contrainte non négociable (guidelines §8) : **zéro diff moteur**. Un héros
nommé = données pures + un avatar en staging, exactement comme les héros canon
(Anton, Sandro) et Iris (vox-arcana). Le système d'identité de héros nommé est
déjà en place (schéma `heroIdentitySchema`, résolution `resolveHeroName`,
Taverne). On n'ouvre aucun point d'extension.

## Étapes

1. **Avatar** : redimensionner l'image 1024² en **256×256** (< 150 Ko) →
   `assets/heroes/arcane-hunters-olivier.png`.
   → vérifier : fichier présent, 256², poids OK.
2. **Fiche de données** : `data/factions/arcane-hunters/heroes/olivier.json`
   (`archetype: might`, `origin: original`, `avatarStyle: photoreal`,
   attributs total 6 comme les autres, spécialité poison/ombre via effets
   génériques `meleeDamagePct` + `armorReductionPct`, compétences de départ
   melee/luck).
   → vérifier : conforme `heroIdentitySchema`.
3. **Manifeste** : ajouter le tableau `heroes: ["olivier"]` au manifeste AH.
   → vérifier : loader accepte, héros listé.
4. **Locales** : `hero.olivier.name/bio/specialty` en FR **et** EN
   (parité i18n, guidelines / doc R4).
   → vérifier : clés présentes dans les deux fichiers.
5. **Validation** : `pnpm typecheck`, `pnpm lint`, `content:check`,
   tests unitaires (dont garde-fou « zéro faction »), golden inchangé,
   smoke Playwright.
   → vérifier : tout vert.
6. **Livraison** : commit descriptif, push `-u origin`, PR draft.

## Décisions

- **might** (assassin à dagues, mêlée) ; attributs `attack 3 / defense 1 /
  power 1 / knowledge 1` (total 6, parité avec Anton 2/2/1/1 et Sandro 0/0/3/3).
- Spécialité **« Lames empoisonnées »** : `meleeDamagePct: +10`,
  `armorReductionPct: +10` (le poison ronge l'armure) — effets déclaratifs
  déjà interprétés par le moteur, aucun nouveau champ.
- `origin: original` (interdit `source`) — inspiré d'un vrai joueur (doc schéma).
- `avatarStyle: photoreal` (déjà utilisé par Iris) — divergence assumée vs
  doc 12 §3 (painterly), choix utilisateur.

## Écarts constatés

- Aucun écart de conception. Avatar 256² = 110 Ko (< 150 Ko).
- Env. sandbox : le smoke exige `PW_CHROMIUM_PATH` (révision Playwright pinnée
  absente) → relancé sur `/opt/pw-browsers/chromium-1194/.../chrome`.

## État final

Toutes les étapes vertes : content:check ✓, typecheck ✓, lint ✓,
tests 552 (engine) + 114 (content) ✓, build ✓ (JS gzip ~288 Ko < 800 Ko),
smoke **154 passed** (dont chargement Arcane Hunters desktop + mobile).
Zéro diff moteur. Commit + push + PR draft.
