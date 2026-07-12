# Lot M-VISIT (tranche) — Sanctuaire de sort visitable

> Backlog : `.claude/plans/game-feature-gaps.md` §2.5 M-VISIT (« Différé :
> sanctuaire de **sort** (apprend un sort) »). Doc de design : doc 02 §2.2.

## Objectif

Ouvrir **UN** effet de lieu visitable **générique** de plus : `learnSpell` —
un sanctuaire de la carte enseigne un sort précis au héros qui le foule (en
passant, comme les autres lieux de bonus). Classique HoMM (« Sanctuaire de
Magie »). Réutilise entièrement le pipeline visitable existant
(`visitBonus` → `BonusVisited`) et le champ **déjà sérialisé** `hero.spells`.

## Contraintes / invariants

- **Zéro nom de faction** dans le moteur (guidelines §8) : effet déclaratif pur.
- **Zéro bump `CURRENT_SAVE_VERSION`** : `hero.spells: string[]` existe déjà ;
  une nouvelle variante de l'union `VisitableEffect` est rétrocompatible (les
  sauvegardes anciennes n'en contiennent jamais).
- **Golden inchangé** : le golden-replay utilise une carte INLINE sans
  visitable ⇒ hash inchangé. À vérifier (ne PAS re-fixer).
- Zone **isolée** (adventure/map), hors zones chaudes (hero/combat/F-/NET-).

## Étapes (avec vérif)

1. **engine/map.ts** — ajouter `| { kind: 'learnSpell'; spellId: string }` à
   `VisitableEffect`. → verify: typecheck.
2. **engine/visitable.ts** — brancher `learnSpell` dans `visitBonus` : pousser
   `spellId` dans `hero.spells` s'il est absent (idempotent), `amount = 1`
   (appris) / `0` (déjà connu), visite consommée dans tous les cas. → verify:
   test moteur.
3. **engine/events.ts** — `BonusVisited.effect: VisitableEffect` déjà générique
   ⇒ aucun changement (vérifier).
4. **content/schemas.ts** — variante `learnSpell { spellId }` dans l'union
   `discriminatedUnion` du visitable. → verify: content:check.
5. **content/loader.ts** — étendre l'union `effect` de `ResolvedMapObject`
   (visitable) avec `learnSpell`. → verify: typecheck.
6. **client/notifications.ts** — branche `BonusVisited` `learnSpell` →
   `toast.bonusSpell` (nom de sort résolu). → verify: typecheck client.
7. **client/MapObjectCard.tsx** — cas `learnSpell` → `mapCard.effectLearnSpell`
   (nom de sort). → verify: typecheck.
8. **client/render/mapObjects.ts** — prop/teinte/silhouette `learnSpell`
   (glyphe livre + étincelle, distinct). → verify: smoke render.
9. **locales core fr/en** — `toast.bonusSpell`, `mapCard.effectLearnSpell`.
10. **data/maps/proto-01.map.json** — `sanctuaire-1` (7,7) `learnSpell`
    `eclair-magique`, `oncePerHero`.
11. **engine test** `map-visitables.test.ts` — apprend le sort + idempotent
    (2ᵉ visite d'un autre sanctuaire du même sort ⇒ pas de doublon) + visite
    consommée. → verify: `pnpm --filter @heroes/engine test`.
12. **doc 02 §2.2** + backlog M-VISIT : tranche livrée.

## Vérif finale (guidelines §4/§7)

- typecheck 5/5, lint, tests moteur (+ cas learnSpell), content:check.
- golden **inchangé** (vérifié, pas de re-fix), **pas de bump save**.
- garde-fou « zéro faction » vert, budget bundle < 800 Ko gzip.
- smoke Playwright : proto-01 charge/rend avec le nouveau lieu (couverture de
  la zone de rendu). Le déclenchement du flux (héros foulant le lieu) reste
  **couvert en unitaire** (comme arène/permanentStat) — noté explicitement.

## Journal

- **2026-07-12** — **Livré**. Effet visitable générique `learnSpell { spellId }`
  ouvert (engine `map.ts`/`visitable.ts`, content `schemas.ts`/`loader.ts`),
  client (toast `bonusSpell`, fiche `effectLearnSpell`, silhouette grimoire +
  prop/teinte), data proto-01 `sanctuaire-1` (7,7 → `eclair-magique`), doc 02
  §2.2 + backlog M-VISIT. Vérifs **toutes vertes** : typecheck 5/5, lint,
  656 tests moteur (+1 `map-visitables` learnSpell : apprend + idempotent +
  visite consommée), content:check, garde-fou « zéro faction » vert, bundle
  306 Ko gzip < 800, smoke 102/102. **Golden inchangé** (pas de visitable au
  golden-replay), **pas de bump `CURRENT_SAVE_VERSION`** (`hero.spells` déjà
  sérialisé, variante d'union rétrocompatible). Zéro nom de faction moteur.
