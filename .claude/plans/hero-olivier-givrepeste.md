# Héros Olivier Givrepeste — Necropolis (glace + putréfaction)

Ajout d'un héros nommé **original** à la faction Necropolis, thématique
glace nécrotique + putréfaction, avatar **photoréaliste** (photo fournie par
l'utilisateur). Data-driven pur — **zéro diff moteur** attendu.

## Décisions

- **Nom** : Olivier Givrepeste (FR) / Olivier Frostblight (EN).
- **origin** : `original` (pas canon ⇒ pas de champ `source`).
- **avatarStyle** : `photoreal` (divergence assumée avec la règle painterly,
  choix utilisateur — schéma le supporte déjà).
- **archetype** : `magic`.
- **attributes** : 0/1/3/2 (att/déf/pouvoir/savoir) — profil caster,
  cohérent avec Sandro (0/0/3/3) sans doublon.
- **specialtyEffect** : `givrepeste` → `manaCostReductionPct: 10`
  (le gel nécrotique rend ses sorts moins coûteux ; distinct des 15 % de Sandro).
- **startingSkills** : `necromancy 1`, `magic-water 1` (glace).
- **startingSpells** : `jet-de-glace` (glace), `fletrissure` (putréfaction).

## Étapes

1. Avatar `assets/heroes/necropolis-olivier.png` (256×256, < 150 Ko) depuis la
   photo fournie → **vérif** : dimensions + poids conformes.
2. Fiche `data/factions/necropolis/heroes/olivier.json` → **vérif** : parse JSON.
3. Enregistrer `olivier` dans `manifest.json` (`heroes[]`) → **vérif** : présent.
4. Locales FR/EN (`hero.olivier.*` + `hero.specialty.givrepeste.*`) → **vérif** :
   parité FR/EN, 0 clé manquante.
5. `pnpm content:check` / typecheck / lint / tests → **vérif** : vert,
   garde-fou « zéro faction moteur » vert, recrutement du roster OK.
6. Smoke Playwright headless → **vérif** : app démarre.
7. Commit + push branche `claude/necromancer-hero-olivier-pdz23o` + PR draft.

## Écarts constatés

- Avatar produit à **118 Ko / 256×256** (photo utilisateur recadrée buste,
  décalage vertical 15 % pour garder le visage). ✅ sous plafond 150 Ko.
- Aucun diff moteur (`git status` : data + assets + locales + plan seulement).
- content:check ✅ ; typecheck ✅ ; lint ✅ ; tests 546 moteur + 114 content ✅
  (dont `faction-recruit`, `hero-identity` : original sans `source`) ; build ✅
  budget bundle tenu ; smoke **152 passed** (via `PW_CHROMIUM_PATH` — le binaire
  Playwright par défaut du sandbox est en version décalée, sans rapport avec la modif).

## État : livré, prêt à pousser.
