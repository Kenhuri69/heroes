# Lot L10 — souterrain / cartes multi-niveaux : **cadrage** (aucun code)

> Lot 10 du plan `.claude/plans/missing-features-2026-08.md` (**G3**). Le plan
> le marquait « **cadrage d'abord** » et le listait parmi les **décisions à
> trancher** (§5.1) : chantier transversal + **bump de sauvegarde** pour un gain
> d'exploration. Ce document est ce cadrage. **Il n'implémente rien** — il rend
> la décision prenable et l'exécution mécanique.

## 1. Ce qui manque, exactement

`docs/02-mechanics.md` §2.1 promet un **second niveau** de carte relié par des
escaliers. Aucune trace en code : `grep -i "underground|souterrain|level"` sur
`packages/engine/src/adventure/` ne rend rien. Les **monolithes appariés**
(M-NAV a, livrés) offrent déjà de la téléportation *intra-niveau* — c'est la
brique la plus proche, et le cadrage s'en sert.

## 2. Modèle de données proposé

**Une seule idée** : la position gagne une **couche**, tout le reste en découle.

```ts
// adventure/map.ts
interface GridPos { x: number; y: number; /** 0 = surface (défaut), 1 = souterrain */ level?: number }
interface AdventureMapDef {
  width: number; height: number;
  /** Nombre de couches (1 = carte plate d'aujourd'hui). */
  levels?: number;
  /** `terrain`/`road` deviennent des tableaux de `width × height × levels`. */
  terrain: string[]; road: boolean[];
}
```

- `tileIndex(map, pos)` devient `((pos.level ?? 0) * height + y) * width + x` —
  **un seul endroit** à changer ; tout ce qui indexe le terrain, le brouillard
  ou la carte passe déjà par lui (19 usages recensés).
- `createFog` dimensionne `width × height × levels`.
- **Escaliers** : réutiliser le patron `monolith`/`pairId` **sans le modifier** —
  un objet `stairs` est un monolithe dont le jumeau est sur l'autre couche. La
  règle de téléportation (fouler ⇒ sauter au jumeau, déplacement interrompu,
  pas de boucle) est **déjà écrite et testée**.
- **Adjacence** : aucune. Deux couches ne se touchent jamais ; on ne change de
  niveau **que** par un escalier. L'A\* n'a donc pas à raisonner en 3D — il
  refuse simplement les pas dont le `level` diffère.

## 3. Impact mesuré, par surface

| Surface | Travail | Risque |
|---|---|---|
| `adventure/map.ts` (`tileIndex`, `terrainAt`, `isPassable`) | couche dans l'index | faible — point de passage unique |
| `adventure/fog.ts` + `vision` | taille × `levels`, révélation bornée à la couche | faible |
| `adventure/path.ts` (A\*, BFS) | rejeter les pas inter-couches | faible |
| `core/state.ts` | `HeroState.pos` porte `level` (sérialisé) | **bump `CURRENT_SAVE_VERSION`** + golden re-fixé (forme) |
| `content/schemas.ts` + `loader.ts` | `levels`, taille des tableaux, validation croisée des escaliers | moyen |
| `content/mapgen.ts` | génération d'une 2ᵉ couche + placement des escaliers appariés | **moyen/élevé** (densités, garanties de connexité) |
| Client `render/tilemap`, `MiniMap`, jetons, picking | ne rendre que la couche du héros actif, bascule à l'escalier | **élevé** (chunking, cache de tuiles, tri de profondeur) |
| `ai/adventure.ts` | cibles filtrées par couche ; emprunter un escalier = objectif | moyen |
| UI | indicateur de couche, mini-carte par couche | moyen |

## 4. Découpage exécutable (5 sous-lots, chacun une PR)

1. ✅ **L10.1 — couche dans le modèle (moteur seul)** : `GridPos.level`,
   `tileIndex`, `createFog`, A\* qui refuse l'inter-couche. Cartes existantes =
   `levels: 1` ⇒ **comportement identique**. Bump save + golden re-fixé **une
   fois**. → verify: unitaires d'indexation/brouillard/chemin, golden re-fixé.
2. ✅ **L10.2 — escaliers en données** : objet `stairs` (monolithe inter-couches),
   validation croisée « exactement 2 par `pairId`, sur des couches distinctes ».
   → verify: unitaires de téléportation + `content:check`.
3. **L10.3 — carte éditée à deux couches** : `proto-03` avec un souterrain
   modeste, jouable de bout en bout. → verify: smoke dédié (descendre, remonter).
4. **L10.4 — rendu client** : rendre la couche active, basculer à l'escalier,
   mini-carte par couche, indicateur. → verify: smoke + budget images/bundle.
5. **L10.5 — génération & IA** : `generateMap` produit une 2ᵉ couche connexe ;
   l'IA emprunte les escaliers. → verify: property « N graines ⇒ `loadMap` OK »,
   property « IA vs IA se termine » sur carte à deux couches.

## 5. Recommandation

**Faisable, mais à ne pas précipiter.** C'est le seul lot du plan qui touche
**à la fois** la forme de sauvegarde, le pipeline de contenu, le rendu et l'IA ;
les quatre autres surfaces ont chacune leur budget de vérification (golden,
`content:check`, budget d'images, smoke). Le livrer d'un bloc, c'est prendre le
risque d'un demi-souterrain — une couche que l'on traverse sans la voir, ou une
carte générée qui piège un héros sans escalier de retour.

**Ordre conseillé** : L10.1 et L10.2 (moteur + données, peu risqués, un seul
bump de save à eux deux), puis arbitrage sur la suite au vu de l'état réel —
L10.3 suffit déjà à rendre le souterrain **jouable** sur carte éditée, L10.4/5
étant ce qui le rend *beau* et *généré*.

## 6. Journal

- **2026-08-31** — cadrage écrit (aucun code). Décision d'implémentation laissée
  au porteur du projet : le plan `missing-features-2026-08` §5.1 la listait déjà
  comme un arbitrage, et rien dans les lots L1-L9/L11 n'en dépend.

## 7. Journal d'exécution

> Décision utilisateur du 2026-08-31 : « go souterrain ». Le cadrage devient un
> plan vivant, un sous-lot par PR.

- **L10.1 livré (2026-08-31)** — la couche entre dans le modèle.
  - `GridPos.level` + `AdventureMapDef.levels` (tous deux **optionnels**),
    `tileIndex` empilé, `inBounds`, et deux règles qui font toute la différence :
    `samePos` et `isAdjacent` comparent désormais la couche — sans quoi un héros
    de surface « toucherait » l'objet du souterrain sous ses pieds.
  - `createFog` dimensionne toutes les couches ; `revealAround` ne révèle que
    celle de la position.
  - A\* **confiné à la couche de départ** (cible d'une autre couche ⇒ `null`,
    `octileLowerBound` ⇒ `Infinity` pour écarter la cible des pré-filtres sans
    lancer de recherche). Idem pour les autres parcours de voisinage : BFS
    d'exploration de l'IA, gardiens errants, atterrissage de Ville-portail,
    tuile d'eau du chantier naval — tous estampillent la couche de leur origine.
  - Deux indexations plates oubliées corrigées (clé de tuile du déplacement,
    condition de quête `visitTile`) : elles auraient superposé les couches.
  - **Écart au cadrage — aucun bump de sauvegarde.** Le cadrage en prévoyait un ;
    les champs étant optionnels et par défaut « surface », une sauvegarde
    d'avant le lot se recharge à l'identique. C'est la convention du dépôt
    (`grailPos`, `moat`, `siegeWalls`…). **Golden inchangé** (973 tests verts
    avant l'ajout des 7 nouveaux).
  - Tests : `packages/engine/test/map-levels.test.ts` (**7**) — indexation,
    carte plate inchangée, superposition non adjacente, brouillard par couche,
    chemin confiné, et la preuve d'indépendance : un mur infranchissable en
    surface n'empêche pas le trajet souterrain.

- **L10.2 livré (2026-09-01)** — le pipeline de contenu sait décrire un souterrain.
  - Format : bloc `underground { tiles, roads }` (mêmes dimensions, même
    légende) plutôt qu'un doublement des tableaux existants — les cartes plates
    ne bougent pas d'un octet. Le loader **empile** et pose `levels: 2`.
  - `level` sur chaque variante d'objet (13 au total), résolu en `pos.level` ;
    un objet de surface garde une position **sans** champ (forme historique).
  - **L'escalier n'est pas un type d'objet** : c'est une paire de monolithes
    dont les extrémités changent de couche. Le téléport apparié de M-NAV (a)
    fait déjà le travail dans les deux sens — zéro règle moteur nouvelle,
    exactement ce que le cadrage promettait.
  - Validation croisée : rangées/légende du souterrain, franchissabilité **de la
    couche de l'objet** (un mur sous terre ne juge pas la surface), objet en
    couche 1 refusé sans souterrain, et **carte à souterrain sans escalier
    rejetée** — sinon un héros descendu y resterait piégé.
  - Tests : 5 cas dans `loader.test.ts` (contenu **172**), dont la carte plate
    qui doit rester sans `levels`.
