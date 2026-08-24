# Lot R5b — Le jeton de héros procédural entre dans le décor

> Plan vivant (guidelines §5). **Suite du lot R5** (`.claude/plans/r5-carte-lisible.md`,
> PR #524) : y était noté « repli procédural du HÉROS laissé tel quel (hors
> périmètre) ». Demande utilisateur de le traiter.
>
> **Périmètre** : client (rendu Pixi) + docs. **Zéro diff `packages/engine`**, pas
> de bump `CURRENT_SAVE_VERSION`, golden inchangé, aucun id de faction dans
> `packages/`.
>
> **Base de branche** : `origin/main` = `5f27c21` (R5 mergé, PR #524).

## 0. État de référence observé (AVANT)

Capture rapprochée du chemin dev `?seed=42` (faction de test, sans art de carte),
héros en (3,3), zoom par défaut.

| Constat | Détail |
|---|---|
| **Registre** | Le jeton est un **écusson plat** (aplat rouge, disque blanc, liseré épais) posé au milieu d'assets **peints et ombrés** en 3/4 (coffre, tente, gardien, hôtel de ville). Il lit comme un marqueur d'UI tombé sur la carte, pas comme une figure debout sur le terrain. |
| **Identité** | Aucun indice de faction ni de « héros » : un disque blanc. À comparer au marqueur de ville, qui depuis U4 montre une **vignette peinte**. |
| **Taille / calage** | **Corrects** : ~42 px de haut (sous le budget de 1,5 rangée posé par R5) et bord bas au niveau du contact-sol. **Rien à corriger ici** — ce lot ne touche pas à l'échelle. |
| **Portée** | Les 6 factions livrées ont leur `map/hero-<faction>` ⇒ en partie réelle ce repli **ne s'affiche jamais**. Il concerne le chemin dev (moitié des captures d'audit) et **toute faction future** avant que son art n'arrive. |

## 1. Décisions de rendu (⇒ `docs/08-ui-ux.md` §2.1)

1. **Un cran de repli générique avant le dessin.** La chaîne devient
   `map/hero-<faction>` → **`map/hero`** (générique) → dessin. C'est le patron
   déjà en place pour les habitations (`camp-<faction>` → `camp`) : déposer **un
   seul** fichier couvre toutes les factions sans art dédié, sans toucher au code.
   Aucun asset n'est produit dans ce lot — le cran est **ouvert**, pas rempli.
2. **Le dernier repli garde l'écu, mais cesse de flotter et devient parlant.**
   *(Décision amendée en cours de lot : la première version tentait une figure
   humanoïde debout — illisible à cette taille, voir §3.)* Dessin procédural
   déterministe, dans la maison de style des autres replis (aplats + liseré
   `--ink-900`) : **ombre au sol** posée sur le losange et **hampe plantée** —
   c'est ce qui manque le plus par rapport aux assets peints et ombrés — plus une
   **épée en pal** à la place du disque nu, qui dit « héros/armée ». La couleur du
   joueur reste le canal d'appartenance, doublée par la forme d'écu (2ᵉ canal,
   doc 08 §4).
3. **Budget d'encombrement inchangé** : le jeton tient dans la même allocation
   de **1,5 rangée** de losange que les jetons peints (règle du lot R5), bord bas
   au contact-sol. Le lot ne rouvre pas U3 — la mesure préalable montre que la
   taille et le calage étaient déjà conformes.

## 2. Étapes & critères de vérification

- [x] **R5b.1** — cran de repli générique `map/hero`.
      → *vérif* : lecture — la chaîne est un `??` d'une ligne sur le registre
      d'assets, comme `camp-<faction>` → `camp` (voir §3, pourquoi pas de test).
- [x] **R5b.2** — écu posé au sol (ombre + hampe) et emblème parlant.
      → *vérif* : mesure — la hauteur dessinée reste ≤ 1,5 rangée et le bord bas
      tombe au contact-sol ; capture rapprochée avant/après.
- [x] **R5b.3** — doc 08 §2.1 alignée.
- [x] **R5b.4** — pipeline complet : `typecheck`, `lint`, `test`, `content:check`,
      garde-fous CI, `build` (budget), smoke.

## 3. Journal / écarts constatés

- **Trois essais avant que le jeton lise.** (1) Une **figure humanoïde debout**
  (corps/cape, tête, bannière) : rejetée sur capture — à 48 px de haut pour ~26 de
  large, elle se réduit à un cône rouge surmonté d'une boule. La forme d'**écu**
  est le bon choix à cette taille, l'erreur d'analyse était de croire que la forme
  était le problème. (2) Écu + ombre + hampe + **épée sans pommeau** : l'épée
  lisait comme une **flèche vers le bas** — une lame triangulaire sur une barre
  fine, c'est un chevron. (3) Retenu : **garde épaissie + fusée + pommeau**, ce
  qui bascule la lecture vers « épée ». Les captures des trois états sont dans le
  scratchpad de session.
- **Ce qui n'était PAS le défaut** : la taille et le calage. Mesure faite avant de
  toucher au code — le repli faisait déjà ~42 px de haut (sous le budget de
  1,5 rangée) avec le bord bas au contact-sol. Le lot ne rouvre donc pas U3 ; il
  ne traite que le **registre** (flotter parmi des assets ombrés) et l'**identité**
  (un disque nu ne dit rien).
- **Fuite corrigée au passage** : `buildHeroSprite` rendait un `Graphics`, il rend
  désormais un `Container` de 4 enfants. L'appelant faisait `fallback.destroy()`,
  qui **ne détruit pas les enfants** par défaut (Pixi v8) — passé à
  `destroy({ children: true })`, comme les deux autres replis-conteneurs du
  projet. Les deux replis restés en `Graphics` simple (artefact, gardien) gardent
  leur `destroy()` nu, qui est correct pour eux.
- **Pas de test unitaire pour la chaîne de replis** : c'est un `??` d'une ligne
  sur le registre d'assets (`import.meta.glob`), et le patron identique des
  habitations (`camp-<faction>` → `camp`) n'en a pas non plus. Le rendre testable
  demanderait d'injecter une fonction de lookup — une abstraction créée pour le
  seul test (guidelines §2). Le dessin, lui, est du canvas Pixi : sa
  non-régression est couverte par le smoke (toute exception à la construction du
  jeton ferait échouer les parcours d'aventure via `collectErrors`), sa qualité
  par les captures.
- **Aucun asset produit** : le cran `map/hero` est **ouvert**, pas rempli.
  Produire un jeton générique peint relève des skills `asset-*` et d'un lot d'art,
  pas de celui-ci.

## 4. Bilan

Livré.

| Vérification | Résultat |
|---|---|
| `pnpm typecheck` / `pnpm lint` | ✅ |
| `pnpm test` (moteur + contenu) | ✅ 935 tests |
| Tests unitaires client | ✅ 74 tests |
| `pnpm content:check` | ✅ 7 paquets, 2 cartes, 16 scénarios |
| Garde-fous CI (faction, couleurs) | ✅ |
| `pnpm build` + budget bundle | ✅ **355 Ko gzip** / 800 |
| Smoke Playwright | ✅ (desktop + mobile) |

### Avant / après

| | Avant | Après |
|---|---|---|
| Ancrage au terrain | écu **flottant**, sans ombre | **ombre au sol** + **hampe plantée** |
| Emblème | disque blanc **muet** | **épée en pal** (héros/armée) |
| Chaîne de replis | `map/hero-<faction>` → dessin | `map/hero-<faction>` → **`map/hero`** → dessin |
| Encombrement | ~42 px (déjà conforme) | **inchangé**, borné à 1,5 rangée |
