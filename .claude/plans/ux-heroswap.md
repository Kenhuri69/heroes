# Lot UX-HEROSWAP — Transfert d'armée/artefacts entre héros

> Plan vivant (guidelines §5). Source de vérité : doc 02 §1.5 (multi-héros,
> échanges), doc 08 §2.3 (écran double-colonne tap-tap, « équilibrer »/« tout
> donner »). Backlog : `.claude/plans/game-feature-gaps.md` §2.9 UX-HEROSWAP.

## Objectif

Deux héros du **même joueur** sur des **tuiles adjacentes** peuvent s'échanger
des piles d'armée et des artefacts. Point d'extension moteur : **une commande
générique** `TransferBetweenHeroes` + une UI de rencontre (modale double-colonne
tap-tap).

## Invariants (guidelines §8)

- Zéro faction dans le moteur (garde-fou CI) — la commande ne connaît que des ids.
- RNG seedé uniquement — cette commande est purement déterministe (aucun RNG).
- Moteur sans rendu.
- Touch-first : transfert tap-tap (pas de drag obligatoire).
- **Pas de bump `CURRENT_SAVE_VERSION`** : `army`/`artifacts` existent déjà sur
  `HeroState`. Aucun champ d'état nouveau ⇒ forme inchangée, golden inchangé.

## Décisions / arbitrages

- **Commande générique unique** `{ type: 'TransferBetweenHeroes'; fromHeroId;
  toHeroId; kind: 'army' | 'artifact'; slot }` — miroir de `GarrisonTransfer`
  (transfert d'une entité par commande ; l'UI enchaîne pour « tout donner »).
- **Adjacence 8 directions** (`isAdjacent`), cohérente avec le mouvement — doc
  dit « tuiles adjacentes ».
- **« Tout donner »** = enchaîne les transferts de piles + artefacts (UI). ✅
- **« Équilibrer »** (split d'une pile en deux) = **différé à UX-SPLIT** (lot
  séparé du backlog §2.9 : nécessite une commande `SplitStack`). Documenté ici
  comme arbitrage ; l'UI ne montre pas ce bouton pour l'instant.
- **Fusion** de piles de même unité à l'arrivée (comme `GarrisonTransfer`) ;
  cap 7 piles respecté sur la destination.
- **Artefacts** : transfert du slot source vers le 1er slot libre de la cible.
- Pas d'événement dédié (surface `events.ts` figée, comme `GarrisonTransfer`) :
  le rendu observe la mutation `hero.army`/`hero.artifacts`.

## Étapes

1. **Moteur — commande** (`core/commands.ts`, `hero/transfer.ts`, `engine.ts`).
   - Ajouter le variant `TransferBetweenHeroes` à l'union `Command`.
   - `validateTransferBetweenHeroes` + `handleTransferBetweenHeroes`.
   - Câbler validate/handler + `GAME_OVER_BLOCKED`.
   - Vérif : `pnpm --filter @heroes/engine typecheck`.
2. **Tests moteur** (`hero-transfer.test.ts`) : transfert de pile (avec fusion
   + cap plein), transfert d'artefact (slot libre / aucun slot libre), rejets
   (héros non adjacents, héros d'un autre joueur, combat en cours, slot vide).
   → verify: `pnpm --filter @heroes/engine test`.
3. **Client — UI de rencontre** (`ui/HeroSwap.tsx`, modale `heroswap`,
   `HeroDrawer` bouton « Échanger »). Double-colonne, tap-tap, « tout donner ».
   Locales FR/EN. → verify: `pnpm build`.
4. **Docs** : doc 02 §1.5 + doc 08 §2.3 (état livré), `game-feature-gaps.md`
   (UX-HEROSWAP ✅), CLAUDE.md en fin de chantier (lot 5).
5. **Smoke** : start-town doté d'une Taverne (data) ⇒ recruter un 2ᵉ héros
   (adjacent au héros de départ) ⇒ ouvrir la modale ⇒ transférer une pile ⇒
   vérifier l'armée du 2ᵉ héros. → verify: `pnpm smoke`.
6. **Vérif complète** : typecheck, lint, test, content:check, garde-fous grep,
   budget bundle, smoke. PR draft → ready → CI verte → merge.

## Journal

- Moteur : commande `TransferBetweenHeroes` (`hero/transfer.ts`), code d'erreur
  `notAdjacent`, câblée dans `engine.ts` (validate + handler + GAME_OVER_BLOCKED).
  10 tests unitaires (`hero-transfer.test.ts`) verts. Aucun bump save.
- Client : `HeroSwap.tsx` (+ .css) double-colonne tap-tap, modale `heroswap`
  (router), bouton `HeroSwapButton` dans le tiroir héros (helper
  `adjacentFriendlyHeroes`). Locales FR/EN. typecheck client OK.
- Data : **aucun** changement de données finalement — une 1ʳᵉ tentative
  (Taverne prébâtie au `start-town`) cassait le smoke M-TAVERN.2 (qui vérifie
  l'absence initiale de Taverne). Revert : le smoke heroswap BÂTIT la Taverne
  via le hook (`BuildStructure` + 2 `EndTurn` + `RecruitHero`), comme M-TAVERN.2.
- Docs : doc 02 §1.5 + doc 08 §2.3 (état livré), backlog `game-feature-gaps.md`
  (UX-HEROSWAP ✅).
- Smoke : test dédié (recrutement au jour 2 → transfert de pile) vert desktop +
  mobile. Vérifs locales : typecheck, lint, test (556), content:check,
  garde-fous grep, budget bundle (297 Ko), suite smoke en cours.
