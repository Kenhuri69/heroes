# Plan — U5-C : sprites d'unités dans le combat (jalon Beta, doc 08 §5)

> Suite de U5 (jalon Beta « gouache stylisée »). L'utilisateur a choisi
> « spritesheets d'unités + animation ». **Réalité du tooling** (`asset-sheet`,
> doc 12) : le pipeline produit des **sprites STATIQUES** (un PNG par unité), pas
> des planches d'animation frame-par-frame. Or **23 sprites d'unités existent
> déjà** dans `assets/units/<faction>/` (haven, necropolis, arcane-hunters,
> test-faction), produits par un lot art antérieur. Et le combat **anime déjà**
> les jetons par transformation (déplacement tweené, fente d'attaque, fondu de
> mort). → Voie réaliste et à forte valeur : **remplacer les jetons procéduraux
> par les vrais sprites d'unités**, animés par les tweens existants.

## Objectif & critères de succès
- Chaque pile de combat affiche le **sprite de son unité** (`assets/units/
  <factionId>/<unitId>.png`) au lieu du polygone procédural, avec **repli
  procédural gracieux** (unité sans sprite → jeton actuel).
- **Distinction des camps** conservée par un **second canal non chromatique**
  (anneau de base coloré sous le sprite + les bandeaux d'armée DOM), pas la seule
  couleur (accessibilité §4).
- Les animations existantes (`animateMove`/`animateAttack`/`animateDeath`)
  continuent de fonctionner sur le conteneur de jeton.
- **Anti-gel ×4 tenu** (doc 01 §5) : les sprites d'unités sont petits (~1 hex),
  pas plein écran comme la toile de combat (leçon U5-B) — coût de remplissage
  borné (≤ 14 piles). **À VÉRIFIER en CI** (le garde-fou a déjà attrapé U5-B).
- Invariants : moteur intact, golden stable, budget bundle (sprites hors JS via
  registre `?url`), cibles ≥ 44 px.

## Découpage
- **Pilote (registre)** : `render/assets.ts` — résolveur `unitSpriteUrl(unitId,
  factionId?)` → `units/<factionId>/<unitId>` (repli `undefined`).
- **Pilote (CombatScene — Pixi, cycle de vie sensible, leçon U5-B)** :
  - `stackTokens: Map<string, Container>` (au lieu de `Graphics`) : chaque jeton =
    un `Container` avec un **anneau de camp** (Graphics, coloré attacker/defender)
    + le **sprite d'unité** (chargé async via `Assets.load`, garde `destroyed`) OU
    le polygone procédural en repli.
  - `syncStacks` crée/positionne les conteneurs ; les animations opèrent sur le
    conteneur (transform) — inchangées.
  - `destroy` : container.destroy({children:true}) libère les jetons (textures
    Assets-cachées non détruites).
- **Vérif (pilote)** : typecheck 4/4, eslint, build, **smoke dont l'arène
  anti-gel ×4** (le point de vigilance), captures visuelles combat.

## Différé (jalon Beta ultérieur)
Animation frame-par-frame (idle/move/attack/hit/death) via vraies spritesheets
(le tooling ne les produit pas encore) ; avatars de héros dans le tiroir/fiche ;
sprites du héros sur la carte d'aventure.

## Journal
- **2026-07-05** — Création. Réalité tooling (sprites statiques) + 23 sprites
  déjà en staging. Voie : sprites statiques animés par tweens existants. À impl.
- **2026-07-05** — **Implémenté.** Registre : `unitSpriteUrl(unitId, factionId)`.
  CombatScene : `stackTokens` = `Map<string, Container>` ; `buildStackToken(stack)`
  compose une **base de camp** (ellipse colorée attaquant/défenseur) + le **sprite
  d'unité** (chargé async `Assets.load`, garde `destroyed`/`token.destroyed`) OU un
  **polygone de repli** (renommé `buildStackTokenGraphic`) tant que le sprite n'est
  pas chargé / absent. Les animations (move/attack/death) opèrent sur le Container
  (`.position`/`.tint`/`.alpha` — tint v8 cascade). Capture arène : Recrue/Élève en
  sprites sur bases colorées, repli polygone pour les non chargés. **Anti-gel local
  arène 22,6 fps** (≫ 5 ; sprites petits, pas plein écran — leçon U5-B respectée) ;
  vérité = CI (rendu logiciel). Vérif : typecheck 4/4, eslint, build 70,7 Ko gzip,
  smoke. Moteur intact, golden stable.
