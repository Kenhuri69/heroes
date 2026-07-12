# Lot H-COND — Spécialités conditionnelles

> ⏭️ **Suite (lot H-COND-EXACT, livré)** : les 3 variantes différées ci-dessous
> (Mère Corbeau / Faelar / Alwin) portent désormais leurs **signatures exactes**
> via 3 nouveaux points d'extension moteur génériques (`raiseUndeadPctPerLevel`,
> `startingSymbiosisStacks`, `startingArmyBonus`). Voir `.claude/plans/h-cond-exact.md`.

> Plan vivant (guidelines §5). Source : doc 04 §5 (Vhalen, Mère Corbeau), doc 05
> §7 (Evadne, Alwin), doc 14 §5 (Faelar, Sylwen). Backlog H-NAMED.

## Objectif

**UN** point d'extension moteur **générique** : effet de spécialité CONDITIONNEL
scopé **par unitId** et/ou **par niveau** (format déclaratif). Puis les fiches
des 6 héros nommés différés, avec locales FR/EN et avatars sur archétypes
génériques (`<faction>-<might|magic>`).

## Point d'extension (générique, zéro faction/héros en dur)

- Nouveau champ OPTIONNEL `conditional?: { unitId?; perLevels?; attack?; defense?;
  speed? }` sur le vocabulaire d'effets déclaratifs `SkillRankEffect` (moteur) et
  `heroEffectFields` (schéma contenu — partagé Maison/spécialité).
- Interprété en **combat** : `conditionalUnitBonus(state, combat, side, unitId, key)`
  — le héros du camp accorde à SES piles de `unitId` un bonus d'attaque/défense/
  vitesse, mis à l'échelle par `ceil(level / perLevels)` (sinon ×1). Appliqué au
  niveau UNITÉ (attaque/défense de pile) dans `damage.ts` (frappe + riposte +
  préviz) et à la vitesse dans `state-helpers.ts` (initiative/portée).
- **Pas de bump save** : champ OPTIONNEL imbriqué dans `specialtyEffects`
  (clé de `HeroState` inchangée) ; **golden inchangé** (les héros du golden ont
  `specialtyEffects: []` ⇒ rien de sérialisé en plus). `sumHouseField` n'agrège
  que les clés scalaires ⇒ les entrées `conditional` ne polluent pas les sommes
  plates.

## Fiches héros (données pures + locales + avatars génériques)

| Héros | Faction | Spécialité livrée (extension) | Doc / arbitrage |
|-------|---------|-------------------------------|-----------------|
| Vhalen | necropolis (might) | +1 att/+1 déf aux `t4-vampire`, par 2 niveaux | EXACTE (doc 04 §5) |
| Mère Corbeau | necropolis (magic) | +att aux `t1-squelette` par niveau | doc = Nécromancie +%/niv (scaling d'effet de faction ⇒ **2ᵉ point non ouvert**) ; variante unit-scopée livrée, exact différé |
| Sylwen | sylvan-court (might) | +1 vitesse aux `t2-archer-sylvestre` | EXACTE (doc 14 §5 « +vitesse aux tireurs ») |
| Faelar | sylvan-court (magic) | +déf à une unité sylvestre | doc = Symbiose démarre à 1 palier (mécanique de départ de combat ⇒ différé) ; variante livrée |
| Evadne | arcane-hunters (might) | +att aux `t6-chasseresse` | doc « Maître de Chasse » (sans chiffre) ⇒ choix cohérent |
| Alwin | arcane-hunters (magic) | spécialité **plate** −% coût mana (existant) | doc = familier T2 gratuit (armée de départ ⇒ différé) ; variante livrée |

> Arbitrages notés : les mécaniques « scaling d'un effet de faction » (Mère
> Corbeau), « départ de Symbiose » (Faelar) et « unité gratuite au jour 1 »
> (Alwin) exigeraient CHACUNE un point d'extension distinct — hors périmètre
> (« UN point »). Les héros sont livrés jouables avec une spécialité fidèle à
> l'esprit ; l'exact est différé et documenté.

## Étapes

1. Moteur : `conditional` sur `SkillRankEffect` (types) + `conditionalUnitBonus`
   (damage.ts) câblé aux 4 attaque + 4 défense ; vitesse dans state-helpers.
2. Contenu : `conditional` dans `heroEffectFields` (schéma). Types HouseEffect
   suivent l'inférence ; buildHeroRoster passe l'effet tel quel.
3. Données : 6 fiches `heroes/<id>.json` + `manifest.heroes` (necropolis +2,
   sylvan +2, arcane +2) + locales FR/EN (nom/bio/spécialité) par paquet.
4. Tests moteur : conditionalUnitBonus (unit match, per-level scaling, hors cible),
   combat (Vhalen booste ses vampires). content:check vert.
5. Smoke : escarmouche necropolis + héros Vhalen ⇒ le tiroir/roster montre le
   héros ; (le bonus combat couvert en unitaire).
6. Docs : docs 04/05/14 §5/§7 (état livré) + doc 02 §1.2 + backlog. CLAUDE.md
   (récap chantier). Vérif complète + PR + merge.

## Journal

- Moteur : `conditional` sur `SkillRankEffect` (types) ; `conditionalUnitBonus`
  (state-helpers, évite le cycle avec damage.ts) câblé aux 4 attaque + 4 défense
  (damage.ts frappe/riposte/préviz) et à la vitesse (`effectiveSpeed` + threading
  `state` optionnel via moveRange/initiativeSpeed/compareInitiative/pickNext/
  roundActionOrder + client). `sumHouseField` restreint à `NumericEffectField`
  (exclut l'objet `conditional`). PAS de bump save, golden inchangé (578 tests).
- Contenu : `conditional` dans `heroEffectFields` (schéma) ; cross-validation
  loader (unitId doit exister). content:check vert.
- Données : 6 fiches héros + manifests (necropolis +2, sylvan +2, arcane +2) +
  locales FR/EN + avatars génériques `<faction>-<archétype>`. Arbitrages
  documentés (Mère Corbeau/Faelar/Alwin : signature exacte différée).
- Tests : `combat-conditional-specialty.test.ts` (5 cas) + smoke H-COND (Vhalen
  jouable, effet conditionnel résolu). Client combat.tsx passe `state` à
  roundActionOrder.
