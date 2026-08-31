# Lot L4 — l'IA défend et voyage

> Lot 4 du plan `.claude/plans/missing-features-2026-08.md` (famille **G1**,
> profondeur de l'IA). Suite de L2 (bâtir/recruter/ramasser) et L3 (économie).
> Périmètre : `engine/ai` uniquement — aucune règle nouvelle, l'IA se met à
> utiliser des commandes et des cibles que le moteur offre déjà.

## 1. Constats (vérifiés dans le code)

| # | Constat | Preuve |
|---|---|---|
| a | L'IA ne **défend** jamais : aucun héros ne rentre quand une ville à elle est menacée, alors qu'un héros posté sur la tuile **intercepte** l'assaillant (combat héros-vs-héros avant la capture) | `ai/adventure.ts` (5 priorités, aucune défensive) ; `adventure/movement.ts:118-128` (interception) |
| b | Elle ne lance **aucun sort d'aventure** (`CastAdventureSpell`) : Marche forcée, Vision et Cartographie existent et lui seraient utiles — d'autant qu'elle ne cible que ce qu'elle a **exploré** (B31) | `hero/index.ts:216-289` vs `ai/` |
| c | Elle ignore les **obélisques** (`isCollectible` ne les connaît pas) ⇒ le Graal ne lui est **jamais** révélé, `Dig` n'est jamais émise, le bâtiment Graal reste hors de portée | `ai/adventure.ts` `isCollectible` ; `core/engine.ts:283` (`Dig`) |
| d | « Refuser un combat perdu d'avance » : **déjà couvert** — l'IA n'engage gardien ou héros ennemi qu'avec une marge de force ≥ 1,5× | `GUARDIAN_STRENGTH_MARGIN`, `ENEMY_HERO_STRENGTH_MARGIN` |

## 2. Étapes

1. **Défense de ville** (priorité 0, avant le ramassage) → verify: unitaires
   « rentre quand la ville est menacée », « tient la position tant que la menace
   dure », « ne bouge pas sans menace ».
   - Menace = héros ennemi non allié, **sur une tuile explorée** (pas de triche
     d'information), à ≤ 8 cases de Tchebychev de ma ville, dont l'armée dépasse
     la défense sur place (garnison + mes héros postés).
   - **Hystérésis** pour éviter l'aller-retour : on rentre quand
     `menace > défense`, on **reste** tant que `menace ≥ 0,75 × défense`.
2. **Sorts d'aventure** → verify: unitaires « Marche forcée lancée en tête de
   tour », « réserve de mana respectée », « Vision lancée seulement faute
   d'objectif ».
   - `movementBonus` en tête de tour (plus de PM = plus d'objectifs).
   - `vision`/`revealMap` **seulement** quand aucun objectif n'a été trouvé
     (juste avant le repli exploration), puis **une** nouvelle passe de
     sélection : révéler la carte crée de vraies cibles.
   - **Réserve de mana** : ne jamais descendre sous la moitié de `manaMax` —
     la mana d'aventure est la même que celle du combat.
3. **Obélisques & Graal** → verify: unitaires « l'obélisque non visité est une
   cible », « fouille sur la tuile révélée », « ne fouille pas sans révélation ».
   - Obélisque non encore visité par ce joueur = objet collectable (tant que le
     joueur n'a pas le Graal).
   - Tuile du Graal **révélée** (`grailRevealedTo`) = cible de déplacement ;
     `Dig` dès que le héros y est avec des PM.
4. **Docs** : doc 02 §6 (bloc IA d'aventure) mise à jour dans le même commit.
5. **Vérification complète** : typecheck, lint, tests moteur/contenu/client,
   `content:check`, garde-fous faction & couleurs, build + budget, smoke `@core`
   + `@e2e`, golden inchangé (le replay golden n'a aucun joueur IA).

## 3. Invariants

Zéro faction / zéro id de contenu en dur (les sorts sont choisis par le **type
d'effet** déclaratif, jamais par id) · RNG seedé uniquement · aucun champ d'état
nouveau ⇒ **pas de bump `CURRENT_SAVE_VERSION`**.

## 4. Journal

- **2026-08-31 — livré**. Écarts et décisions notables :
  - La **fouille du Graal** existait comme mutation inline dans le handler `Dig`
    de `core/engine`, inaccessible à l'IA (`ai/` ne peut pas importer le moteur —
    cycle `AiTurn`). Extraite en helper partagé `adventure/grail.ts`
    (`canDigGrail`/`digGrail`), consommé par les **deux** appelants : la règle
    reste écrite une fois (patron `advanceHeroAlongPath`).
  - **Rayon de menace** de 8 cases : sur la carte de fixture 10×10 il couvre tout
    le plateau — sans effet de bord (les vraies cartes font 36² à 512²), mais le
    test d'hystérésis vérifie donc la **retombée de la menace** (l'assaillant
    perd son armée) plutôt que son éloignement.
  - « Refuser un combat perdu d'avance » : **rien à coder**, les marges de force
    1,5× (gardien et héros ennemi) le couvraient déjà — consigné plutôt
    qu'implémenté en double.
  - *Limites assumées* : la garde ne dépose pas de garnison minimale avant de
    repartir (le héros EST la défense) ; les cibles restent celles atteignables
    dans les PM du jour (heuristique gloutonne inchangée).

## 5. Vérification (rejouée en entier le 2026-08-31)

- [x] `pnpm typecheck` (5 projets) · `pnpm lint`
- [x] tests **moteur 963/963** (+6 `ai-defense.test.ts`), contenu 165, client 82
- [x] `pnpm content:check` · garde-fous faction & couleurs
- [x] `pnpm build` + budget bundle **367 517 o gzip** (cap 819 200)
- [x] smoke `@core` **55/55** · `@e2e` **3/3**
- [x] **golden inchangé** (aucun joueur IA dans le replay golden)
