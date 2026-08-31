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

1. **L10.1 — couche dans le modèle (moteur seul)** : `GridPos.level`,
   `tileIndex`, `createFog`, A\* qui refuse l'inter-couche. Cartes existantes =
   `levels: 1` ⇒ **comportement identique**. Bump save + golden re-fixé **une
   fois**. → verify: unitaires d'indexation/brouillard/chemin, golden re-fixé.
2. **L10.2 — escaliers en données** : objet `stairs` (monolithe inter-couches),
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
