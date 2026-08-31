# Lot L7 — le butin des cartes générées est réellement gardé

> Lot 7 du plan `.claude/plans/missing-features-2026-08.md` (**G5**).

## 1. Constat

Le moteur sait verrouiller un butin derrière une sentinelle (**M-GUARDLINK** :
champ `guardedBy` sur `resource`/`treasure`/`artifact`, ramassage inerte tant que
le gardien lié vit) et les cartes **éditées à la main** s'en servent
(`proto-01`, `gold-2`). Mais `generateMap` ne pose **jamais** ce champ : sur une
carte procédurale — le mode « Nouvelle partie » par défaut — le joueur contourne
la sentinelle plantée à côté d'un artefact et ramasse la récompense sans
combattre. Le générateur avait donc l'**intention** (une sentinelle est bien
posée à côté des artefacts et des habitations) sans l'**effet**.

## 2. Étapes

1. `placeSentinel` rend l'**id** du gardien posé (ou `null` s'il n'a pas pu, cf.
   `guardianDensity = 0`, tuiles voisines occupées) → verify: typecheck.
2. **Artefacts** : lier la sentinelle existante (`guardedBy`) — **zéro tirage
   RNG nouveau**, donc carte identique à graine égale.
3. **Coffres** : ils n'avaient aucune garde alors que leur or grimpe jusqu'à
   ×2 en profondeur ⇒ sentinelle + lien. **Ceci change les cartes générées à
   graine égale** (tirages RNG supplémentaires) : c'est un changement de contenu
   assumé, pas une régression.
4. Test contenu : sur plusieurs graines, tout `guardedBy` produit désigne un
   gardien réel de la carte, et une carte générée « riche » en produit au moins
   un → verify: `packages/content/test`.
5. Docs 02 §2.2 (M-GUARDLINK) alignée.
6. Vérification complète.

## 3. Invariants

Générateur **pur et déterministe** (RNG seedé auto-contenu) · carte toujours
valide par construction (`loadMap` la revalide, y compris la contrainte croisée
« le gardien lié existe ») · zéro diff moteur · pas de bump de sauvegarde.

## 4. Journal

- **2026-08-31 — livré**. Décisions :
  - Le lien passe par un helper `lockBehindSentinel(cible)` : il pose la
    sentinelle **et** estampille le butin trouvé sur la case — un seul endroit
    où la règle « la récompense est gardée » est écrite.
  - **Artefacts** : lien pur, aucun tirage RNG nouveau.
  - **Coffres** : ils gagnent une sentinelle, donc les cartes générées
    **changent à graine égale**. Assumé et documenté : un coffre profond vaut
    jusqu'à 3000 or, il se mérite comme l'artefact. Le curseur **Gardiens** de
    « Nouvelle partie » pilote le tout (densité 0 ⇒ aucun verrou, carte
    pacifique inchangée — couvert par un test).
  - *Limite* : les tas de ressources restent libres (le champ les accepte) —
    verrouiller aussi les ramassages courants transformerait chaque carte en
    parcours d'obstacles.

## 5. Vérification (rejouée en entier le 2026-08-31)

- [x] `pnpm typecheck` (5 projets) · `pnpm lint`
- [x] tests moteur 968/968, **contenu 167/167** (+2 `mapgen.test.ts`), client 85
- [x] `pnpm content:check` · garde-fous faction & couleurs
- [x] `pnpm build` + budget bundle **367 795 o gzip** (cap 819 200)
- [x] smoke `@core` **55/55** · `@e2e` **3/3**
- [x] **golden inchangé** (aucun fichier moteur touché)
