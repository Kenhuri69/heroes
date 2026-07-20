# Plan — Lieux d'entraînement (boost d'attribut du héros) sur cartes générées

> **Constat utilisateur (2026-07-20)** : « il manque des lieux event qui boost
> les stats du héros en attaque/défense/magie, présents dans tous les HoMM3 & co »
> (Marletto Tower +Défense, Camp de mercenaires +Attaque, Jardin de la
> révélation +Savoir, Axe stellaire +Pouvoir…).

## Diagnostic (racine exacte)

Le moteur **sait déjà** appliquer un boost d'attribut permanent :
- `VisitableEffect` porte `{ kind: 'permanentStat'; attribute: 'attack'|'defense'|'power'|'knowledge'; amount }`
  (`packages/engine/src/adventure/map.ts:84`).
- `visitBonus` l'interprète : `hero.attributes[effect.attribute] += effect.amount`,
  `oncePerHero` (`adventure/visitable.ts:57`).
- Client : la carte d'objet (`MapObjectCard` → `visitableEffectLine`), le toast
  (`notifications.ts` → `toast.bonusPermanentStat`) et les locales
  (`mapCard.effectPermanentStat`, `attribute.*`, FR+EN) **existent déjà**.
- Utilisé dans **1 carte écrite à la main** (`data/maps/proto-01.map.json:324`).

**Le seul trou** : `generateMap` (`packages/content/src/mapgen.ts`) ne pose
**jamais** de `permanentStat`. Sa rotation de lieux de bonus ne connaît que
fontaine (`luck`), écurie (`movement`), tour de guet (`vision`), sanctuaire
(`levelXp`), moulin (`resource`). ⇒ **aucune** carte « Nouvelle partie » aléatoire
ne contient de lieu d'entraînement. Secondaire : le sprite client de
`permanentStat` retombe sur le panneau gris générique (`signpost`), pas d'identité
visuelle.

## Contraintes (guidelines §8)

Zéro diff moteur (l'effet existe), zéro id de faction, RNG seedé, pas de bump
`CURRENT_SAVE_VERSION`, golden replay inchangé (mapgen hors replay), budget
bundle ≤ 800 Ko, docs = source de vérité (doc 02 §2.2). Invariants mapgen à
préserver : `eventBuildingDensity: 0 ⇒ aucune visitable` (test l.430) et
`standard == facteurs 1 explicites` (test l.459).

## Étapes

1. [x] **mapgen** (`@heroes/content`) : après la rotation de lieux de bonus,
   boucle bornée de lieux d'entraînement `permanentStat` — comptée
   `scaledCat(randBetween(1,2), eventBuildingDensity)` (⇒ 0 à densité 0 : invariant
   tenu ; échelle ≈ habitations, rares car permanents), attribut **aléatoire seedé**
   par site (`randInt(4)` sur `[attack,defense,power,knowledge]`), `amount: 1`,
   `frequency: 'oncePerHero'`.
   → vérif : nouveau test « pose des lieux d'entraînement (permanentStat) » +
   suite mapgen existante verte (property tests robustes au décalage de flux RNG).
2. [x] **client** (`render/mapObjects.ts`) : identité visuelle de `permanentStat`
   — clé `VISITABLE_COLORS.permanentStat` (cramoisi martial, hex Pixi hors CSS ⇒
   garde-fou couleurs non concerné) + `VISITABLE_PROP.permanentStat`
   (`training-ground`, sans PNG ⇒ repli procédural) + `case 'permanentStat'` dans
   `buildVisitableFallback` (monument : épée dressée sur un socle).
   → vérif : typecheck + build + smoke (registre d'assets = `import.meta.glob`,
   non unit-testable côté client).
3. [x] **doc 02 §2.2** : noter que les cartes générées posent désormais des
   lieux d'entraînement (`permanentStat`), plus seulement les cartes écrites.

## Vérification (recette complète, avant push) — VERTE

- [x] `pnpm -r typecheck` ; `pnpm lint`
- [x] vitest engine **935** (golden inchangé) + content **164** (+1 nouveau test) + client **33**
- [x] build + budget bundle **353.8 Ko** gzip ≤ 800
- [x] garde-fou faction ✓ (aucun id dans `packages/`) + garde-fou couleurs ✓
      (hex Pixi en `.ts`, aucun ajout `ui/*.css`)
- [x] smoke `@core` desktop + `@mobile` **43/43**
- [x] golden inchangé (aucun fichier moteur touché)

## Journal

- 2026-07-20 — Reprise après constat « backlog de code pur épuisé » (tous les
  plans ouverts déjà mergés) ; l'utilisateur pointe cette vraie lacune. Audit :
  effet moteur + UI + locales déjà là, seul `mapgen` ne génère pas. Branche
  `claude/session-842v9w`, PR draft vers `main`.
- 2026-07-20 — LIVRÉ. mapgen pose des lieux d'entraînement `permanentStat`
  (attribut seedé, `amount 1`, `oncePerHero`, comptés sur `eventBuildingDensity`
  ⇒ 0 à densité 0, invariant préservé). Client : sprite dédié (épée sur socle,
  cramoisi). Test content ajouté (grande carte ⇒ ≥ 1 site, attribut valide,
  frequency). Doc 02 §2.2 alignée. Recette complète verte (voir ci-dessus).
  **Zéro moteur, pas de bump `CURRENT_SAVE_VERSION`, golden inchangé.**
