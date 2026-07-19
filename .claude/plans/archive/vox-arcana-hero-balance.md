# Plan — Équilibrage héros Vox Arcana + attaque/sorts + accès cercle 3

Retours de jeu (capture ville Vox Arcana). Quatre problèmes distincts.

## Problème 1 — Héros Vox Arcana non recrutables (DONNÉES)
**Cause** : les 5 fiches `data/factions/vox-arcana/heroes/*.json` sont *identity-only*
(pas de `attributes`) ⇒ `buildHeroRoster` (loader.ts:781) les ignore ⇒ Taverne
affiche « Aucun héros disponible ». Confirmé par la capture (« Héros : 1/8 »).

**Correctif** : doter les 5 héros du gameplay (`attributes`, `specialtyEffect`,
`startingSkills`, `startingSpells`) comme les héros canon Haven/Necropolis.
Compétences ⊆ core (manifest.heroSkills = []) ; sorts ⊆ core spells (scene inclus).
- rumi (might, Venari) : atk3/def2/pow1/kn1, spé rangedDamagePct, leadership+archery
- hermione (magic) : atk0/def1/pow3/kn2, spé manaCostReductionPct, wisdom+economy, 2 sorts
- celeste (might) : atk2/def2/pow1/kn1, spé meleeDamagePct, melee+luck
- iris (magic, badger, def) : atk0/def2/pow2/kn2, spé garrisonDefense, wisdom+armor, 2 sorts
- anastasia (magic, lion, off) : atk1/def1/pow3/kn2, spé luckBonus, wisdom+magic-fire, 2 sorts
- Ajouter clés loc `hero.{rumi,hermione,celeste}.specialty` (fr+en).

→ vérif : `pnpm --filter @heroes/content test` + build ; recrutables en Taverne.

## Problème 2 — Attaque du héros en combat (DONNÉES config)
**Cause** : `combat.heroAttack = {base:8, perPower:6, perAttack:2}` ⇒ pilotée par le
Pouvoir (28 dégâts pour pow3/atk1) ≫ sort cercle 1 (trait-de-feu = 12 à pow3).
**Attendu** : scaler sur l'ATTAQUE, ~magnitude cercle 1.
**Correctif** : `{base:3, perPower:0, perAttack:3}` ⇒ atk3 = 12 ≈ cercle 1, croît avec
l'attaque, faible pour un héros magie (atk bas). data/core/config.json uniquement.

→ vérif : golden inline (non affecté), combat-hero-attack.test (config locale, non affecté).

## Problème 3 — Sorts scalent sur le Pouvoir
**Constat** : DÉJÀ le cas — `castHeroSpell` passe `effectivePower(hero)` à
`applySpellToTargets` (index.ts:280/302), maths `base + perPower×Pouvoir`
(spells.ts:57). Aucun changement moteur. Le point 2+3 est un CONTRASTE : mêlée→Attaque,
sorts→Pouvoir. Rien à corriger, à documenter.

## Problème 4 — Tout le cercle 3 accessible dès le départ (MOTEUR const + DONNÉES + DOCS)
**Cause** : `BASE_LEARNABLE_CIRCLE = 3` (skills.ts:147) ⇒ tout héros apprend cercles
1-3 à la Guilde sans compétence. **Attendu (fidélité HoMM3)** : cercle 3 gaté par Sagesse ;
seuls les héros magie dotés de Sagesse / `startingSpells` ont un accès précoce.
**Correctif** :
- `BASE_LEARNABLE_CIRCLE` 3 → 2 (cercles 1-2 libres, 3+ via Sagesse).
- `data/core/skills.json` wisdom `learnCircle` [4,5,5] → [3,4,5] (basic=3, adv=4, exp=5).
- MàJ commentaires skills.ts / mage-guild.ts + docs 02 §1.3/§4.1 + note R5.
- Conséquence naturelle (voulue) : héros magie SANS Sagesse (markal, ornella…) perdent
  l'accès cercle 3 tant qu'ils ne prennent pas Sagesse. Héros magie AVEC Sagesse
  (isabel, sandro, hermione/iris/anastasia) gardent l'accès = « certains héros magie ».
- Fixtures locales mage-guild.test / hero-skills.test = catalogues privés → non touchés.

→ vérif : golden (aucun apprentissage dans le journal → non affecté), suite moteur,
mage-guild.test (guild1=c1, guild4 gaté — inchangés).

## Vérification globale — TOUT VERT ✅
- ✅ `pnpm -r typecheck` — Done
- ✅ `pnpm lint` (eslint .) — clean
- ✅ `pnpm --filter @heroes/engine test` — 701 → **704** (mage-guild 5→8 tests : gate cercle 3/4)
- ✅ `pnpm --filter @heroes/content test` — 126
- ✅ `pnpm content:check` — 6 paquets, 2 cartes, 13 scénarios valides
- ✅ build client (budget bundle tenu) + smoke Playwright headless : **89 desktop + 12 mobile**
  (browser local via `PW_CHROMIUM_PATH` — révision PW absente de l'env)
- ✅ garde-fou « zéro faction dans le moteur » : aucun id de faction ajouté à `packages/`
  (les tests ne nomment aucune faction — le grep CI scanne aussi `packages/**/test`)
- ✅ pas de bump `CURRENT_SAVE_VERSION`, golden inchangé

## Notes de couverture (guideline §7)
- **Issue 1** (recrutement) : DONNÉES pures ; vérifié que `buildHeroRoster` sort bien
  les 5 héros Vox Arcana (script jetable). Pas de test smoke faction-spécifique : le
  garde-fou CI interdit tout id de faction dans `packages/` (tests inclus), et une fiche
  identity-only reste un état de schéma légitime (staging) — un test « tous les héros
  jouables » serait donc faux. La régression future serait reprise par la revue de données.
- **Issue 2** (attaque héros) : DONNÉES config ; la formule
  `base + perPower×Pouvoir + perAttack×Attaque` est déjà testée (`combat-hero-attack.test`,
  config locale). Changement de valeurs uniquement.
- **Issue 3** : rien à coder (déjà branché).
- **Issue 4** (gate cercle 3) : 4 nouveaux cas dans `mage-guild.test.ts`.
