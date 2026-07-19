# Lot UX-REORDER — Réorganisation des 7 slots d'armée

> Backlog : `game-feature-gaps.md` §2.9 (UX-REORDER). Doc source : **doc 08 §2.1/§2.3**.
> Branche `claude/cities-screen-ux-wemh1n` (repart de `main`).

## Constat

L'armée du héros (`hero.army`) est affichée en **lecture seule** (`ArmyBand`/
`ArmySlots`, `shell.tsx`). L'ordre des slots **influe sur le placement de combat**
(`combat/setup.ts` place par slot) ⇒ pouvoir réordonner est du gameplay, pas de
la présentation : il faut une **commande moteur** déterministe.

## Spec

- Commande générique `ReorderArmy { heroId, from, to }` — déplace la pile de
  l'index `from` à `to` dans `hero.army` (tableau compact ≤ 7). Générique, zéro
  faction.
- Validation : héros connu, héros du **joueur actif** (`notYourHero`), `from`/`to`
  entiers dans `[0, army.length-1]` (`invalidReorder`), hors combat / hors partie
  terminée (`GAME_OVER_BLOCKED`).
- **Pas de nouveau champ d'état** (`army` déjà sérialisé) ⇒ **pas de bump save**.
  Commande **absente du golden** ⇒ **golden inchangé**.
- UI : dans le bandeau d'armée / tiroir héros, **tap-tap** (touch-first, pas de
  drag obligatoire) — 1er tap sélectionne un slot, 2ᵉ tap sur un autre slot
  permute (déplace). Cibles ≥ 44px. Client dispatch `ReorderArmy`.
- Locales FR/EN pour l'aide/aria.

## Étapes / vérif

1. Engine : commande + error code + validate/handle (`hero/`) + câblage engine.ts
   → `pnpm --filter @heroes/engine test` (nouveau `army-reorder.test.ts`).
2. Client : UI tap-tap de réordonnancement → typecheck/lint.
3. Locales FR/EN parité → content test.
4. Smoke : un test qui réordonne deux piles et vérifie l'ordre de `hero.army`.
5. Vérifs complètes : typecheck 5/5, lint, engine, content, build (< 800 Ko),
   garde-fous zéro-faction + couleurs, smoke. Golden inchangé (vérifié), pas de
   bump save.
6. Doc 08 §2.1/§2.3 : noter la réorg livrée. Backlog UX-REORDER ✅.

## Journal

- plan créé ; exploration engine (commands/engine/transfer, army = `ArmyStack[]`
  compact) + client (ArmyBand lecture seule).
- **Livré** : commande `ReorderArmy` + error `invalidReorder` + validate/handle
  (`hero/index.ts`) + câblage `engine.ts` (validate case, handler, GAME_OVER_BLOCKED) ;
  UI tap-tap dans `ArmySlots` (bouton « Réorganiser », sélection→déplacement,
  `heroId` passé aux 2 usages) + CSS (toggle + `.army-slot.picked`, tokens) ;
  locales FR/EN `army.reorder.*`.
- **Note rebase** : le drive-by initial (repointer `.resource-income` sur
  `--ok-text` pour débloquer le garde-fou couleurs violé par UX-RAIL #256) est
  devenu **caduc** — une session parallèle (commit `4ab778e`) a défini le token
  `--gain` dans `tokens.css` sur `main`. Résolu au rebase en gardant la version de
  `main` (`var(--gain)`) ; mon diff ne touche plus `.resource-income`.
- Smoke : nouveau test réorganise 2 piles (scopé au bandeau — le testid existe
  aussi dans le tiroir desktop) et vérifie l'inversion de `hero.army`.
- Vérifs vertes : typecheck 5/5, lint, engine **539** (+6 `army-reorder`,
  golden + save-shape inchangés), content **114** (parité), build (JS gzip
  ≈ 285 Ko < 800), garde-fous zéro-faction + couleurs, smoke **150 passed**
  (2 skipped). **Pas de bump save, golden inchangé.**
