# Plan — U5-D : avatars de héros + sprite du héros sur la carte (doc 08 §5)

> Suite du jalon Beta. 6 avatars de héros en staging : `assets/heroes/
> <factionId>-<might|magic>.png` (haven/necropolis/arcane-hunters × might/magic).
> `HeroState` porte `factionId` + `attributes` → l'archétype (might/magic) se
> dérive des attributs (might si attaque+défense ≥ pouvoir+savoir).

## Objectif
- **Tiroir héros** : le portrait placeholder devient l'**avatar** du héros
  (DOM, repli placeholder). Coût de rendu nul.
- **Carte d'aventure** : le sprite procédural du héros (écusson teinté) devient
  son **avatar** (sprite Pixi, chargé async, repli procédural). Anti-gel : 1 héros
  humain, petit sprite — faible risque (leçon U5-B/U5-C), à VÉRIFIER en CI.
- Invariants : moteur intact, golden stable, budget bundle, cibles ≥ 44 px.

## Contrat (pilote)
- `render/assets.ts` : `heroAvatarUrl(factionId, archetype)` →
  `heroes/<factionId>-<archetype>` (repli `undefined`).
- `app/game.ts` : `heroArchetype(attributes): 'might' | 'magic'` (présentation).

## Découpage
- **Pilote** : contrat ci-dessus + **carte** (`render/heroSprite.ts` +
  `scenes/adventure/AdventureScene.ts`, Pixi cycle de vie) :
  `heroSprites: Map<string, Container>` ; `buildHeroToken(hero)` = écusson de
  repli + avatar async (garde `destroyed`).
- **S-drawer (Sonnet)** : `ui/shell.tsx` (portrait tiroir → `AssetImg` avatar,
  repli `.hero-portrait-placeholder`).
- **Vérif** : typecheck 4/4, eslint, build, smoke (dont anti-gel carte ×4),
  capture.

## Journal
- **2026-07-05** — Création. Avatars en staging, factionId+attributs sur le héros.
- **2026-07-05** — **Implémenté.** Registre `heroAvatarUrl` + `heroArchetype`
  (app/game). **Tiroir** (S-drawer Sonnet) : portrait → `AssetImg` avatar (repli
  placeholder). **Carte** (pilote, Pixi) : `heroSprites: Map<string, Container>` ;
  `buildHeroToken(hero)` = écusson de repli + avatar async (garde `destroyed`) ;
  `tweenTo` re-typé `Container`. **Collision CSS attrapée à l'intégration** : le
  S-drawer avait réutilisé `.hero-portrait` (déjà pris par les boutons du
  `HeroStrip`, U4) → renommé la classe avatar en `.hero-avatar`. Repli gracieux :
  la partie par défaut (test-faction, sans avatar) reste sur l'écusson/placeholder
  → **anti-gel carte non impacté** ; les scénarios à faction connue (necropolis…)
  chargent 1 petit avatar. Vérif : typecheck 4/4, eslint, build 70,8 Ko gzip,
  smoke. Moteur intact, golden stable.
