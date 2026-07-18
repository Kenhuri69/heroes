# Lot 1b (P0) — Combat : pan borné + re-fit conservateur (E10)

> Plan `game-ergonomics-immersion-review.md` §5 Lot 1, **item 4** (E10 🟡). Décision
> utilisateur : « E10 + harnais client » — on monte un **harnais de tests unitaires
> client** (vitest) au passage. **Client uniquement — zéro moteur, pas de bump save.**

## Changements

1. **Harnais vitest client** (nouveau) : `packages/client` gagne `vitest` (devDep) +
   `"test": "vitest run"` ; racine `pnpm test` inclut `--filter @heroes/client` ⇒ la
   CI (`quality` → `pnpm test`) joue les unitaires client. Premier test client du repo.
2. **Fonction pure `clampWorldPosition`** (`render/cameraClamp.ts`) : borne la position
   du `world` pour que le contenu (plateau) reste **sur** l'aire (s'il est plus grand ⇒
   il la couvre toujours ; plus petit ⇒ il reste dedans). + `isContentPointVisible`
   (re-fit conservateur). **9 tests unitaires** (`cameraClamp.test.ts`).
3. **`Camera.setClampBounds(content, view)`** (opt-in) : applique `clampWorldPosition`
   après chaque pan/pinch/molette. **Non défini ⇒ pan libre** (carte d'aventure
   inchangée). Le combat le règle à chaque `layout()`.
4. **`CombatScene` — re-fit conservateur** : au RESIZE (et non plus à chaque fois),
   on **préserve le cadrage utilisateur** (le point de contenu au centre de l'aire y
   reste au changement d'échelle), on borne, et on ne recentre sur la pile active
   QUE si le resize l'a rendue invisible. Ouverture inchangée (centrage sur l'actif
   si débordement). Plancher d'échelle 44 px inchangé.

## Vérification
- [x] `clampWorldPosition`/`isContentPointVisible` : 9 unitaires client verts.
- [x] Pan borné end-to-end : drag mobile portrait (bas-droite ET haut-gauche) ⇒ le
      plateau reste bord-à-bord, jamais perdu (captures).
- [x] Non-régression combat : smoke @core 27, mobile 13.
- [x] typecheck · lint · engine 876 (**golden inchangé**) · content 152 · **client 9**
      · build · bundle 331 253 ≤ 819 200 · gardes faction/couleurs.

## Journal
- [x] Harnais vitest client + racine `pnpm test`.
- [x] `cameraClamp.ts` + 9 tests.
- [x] `Camera.setClampBounds` (clamp pan/zoom, opt-in).
- [x] `CombatScene` re-fit conservateur + bornage.
- [x] Recette + captures.
