# Lot UX-SPLIT — Séparation de piles d'armée

> Backlog : `game-feature-gaps.md` §2.9 (UX-SPLIT). Doc source : **doc 08 §2.1/§2.3**.
> Branche `claude/map-design-issues-jhjdy6` (repart de `origin/main`).

## Constat

L'armée du héros (`hero.army`) se réordonne (UX-REORDER ✅) et se transfère entre
héros (UX-HEROSWAP ✅), mais **aucune commande ne sépare une pile** : impossible
de scinder « 20 Piquiers » en « 12 + 8 » pour occuper deux slots (utile pour
garnisons multiples, sacrifices, moral multi-groupes). UX-HEROSWAP note d'ailleurs
« Équilibrer » (split) comme différé → UX-SPLIT.

Le split modifie `hero.army` (placement de combat) ⇒ **commande moteur**
déterministe, pas de la présentation.

## Spec

- Commande générique `SplitStack { heroId, from, count }` — retire `count`
  créatures de la pile d'index `from` et crée une **nouvelle pile** du même
  `unitId` **ajoutée** à `hero.army` (tableau compact ≤ 7). Générique, zéro faction.
- Validation :
  - héros connu (`unknownHero`), héros du **joueur actif** (`notYourHero`) ;
  - armée non pleine : `army.length < 7` sinon `invalidSplit` (« armée pleine ») ;
  - `from` entier dans `[0, army.length-1]` sinon `invalidSplit` ;
  - `count` entier dans `[1, source.count-1]` sinon `invalidSplit` (laisse ≥ 1 à
    la source, déplace ≥ 1).
  - hors combat (`combatActive`) / hors partie terminée (`GAME_OVER_BLOCKED`).
- **Pas de nouveau champ d'état** (`army` déjà sérialisé) ⇒ **pas de bump save**.
  Commande **absente du golden** ⇒ **golden inchangé**.
- UI : dans le tiroir héros / bandeau, action « Séparer » sur une pile ⇒ modale
  curseur de répartition (touch-first, boutons ± + slider), aperçu « X | Y »,
  confirmer dispatch `SplitStack`. Désactivé si armée pleine ou pile de 1.
  Cibles ≥ 44px.
- Locales FR/EN pour libellés/aria.

## Étapes / vérif

1. Engine : type de commande + error code `invalidSplit` + validate/handle
   (`hero/index.ts`) + câblage engine.ts (validate case, handler, GAME_OVER_BLOCKED)
   → `pnpm --filter @heroes/engine test` (nouveau `army-split.test.ts`).
2. Client : modale de split tap-tap + point d'entrée dans `ArmySlots`.
3. Locales FR/EN parité → content test.
4. Smoke : sépare une pile et vérifie `hero.army.length` +1 et les comptes.
5. Vérifs complètes : typecheck 5/5, lint, engine, content, build (< 800 Ko),
   garde-fous zéro-faction + couleurs, smoke. Golden inchangé (vérifié), pas de
   bump save.
6. Doc 08 §2.1/§2.3 : noter le split livré. Backlog UX-SPLIT ✅.

## Journal

- Plan créé ; exploration engine (mirroir de `ReorderArmy`/`TransferBetweenHeroes`,
  army = `ArmyStack[]` compact ≤ 7) + client (`ArmySlots` avec « Réorganiser »).
- **Livré** : commande `SplitStack` + error `invalidSplit` + validate/handle
  (`hero/index.ts`) + câblage `engine.ts` (validate case, handler,
  GAME_OVER_BLOCKED) ; client — mode « Séparer » exclusif du mode réorg dans
  `ArmySlots` (`army-actions` wrapper), modale `SplitDialog` curseur tap-tap ;
  CSS `.army-actions`/`.split-*` (tokens seuls) ; locales FR/EN `army.split.*`.
- Smoke : sépare la pile de départ (t1-recruit ×20) et vérifie +1 slot + total
  conservé (desktop + mobile).
- Vérifs vertes : typecheck 5/5, lint, engine **585** (+7 `army-split`, golden +
  save-shape inchangés), content **114** (parité), content:check, build (JS+CSS
  gzip ≈ 300 Ko < 800), garde-fous zéro-faction + couleurs (vérifiés sur le
  diff), smoke ciblé 6 passed. **Pas de bump save, golden inchangé.**
