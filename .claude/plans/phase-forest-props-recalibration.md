# Recalibrage des props de forêt (Option A — rendu client seul)

## Problème (capture mobile)
Les tuiles `forest` posent un billboard d'arbre sur **100 %** des tuiles, mis à la
largeur de tuile mais à **hauteur libre** → en zone dense, mur d'arbres opaque qui
enterre ville/héros/routes. Variantes hétérogènes (échelle/saison), et hash de
variante `x*13+y*7` **symétrique** → répétition en miroir visible.

Fichiers : `packages/client/src/render/terrainProps.ts`, `.../render/assets.ts`.
Contrainte : **zéro diff moteur**, zéro bump `CURRENT_SAVE_VERSION` (pur rendu).

## Étapes

1. **Hash déterministe décorrélé** (`terrainProps.ts`) : helper `tileHash(x,y,salt)`
   + `tileRand` (uint32 bien mélangé, asymétrique x↔y). Aucun `Math.random`.
   → vérif : typecheck.

2. **Variante non miroir** (`assets.ts`) : remplacer `terrainPropVariant` par un
   hash asymétrique (multiplicateurs distincts x/y).
   → vérif : plus de symétrie axiale (revue visuelle smoke).

3. **Placement épars** (`terrainProps.ts`, constructeur) : densité par terrain
   `{ forest: 0.62, mountain: 1 }` ; tuile sans prop = clairière. Mountain
   **inchangé** (densité 1) → surgical.
   → vérif : forêt aérée, on voit à travers.

4. **Échelle plafonnée + jitter** (`placeProp`) : largeur ~0,72 tuile, **hauteur
   plafonnée** à ~1,4× largeur de tuile (les bouleaux géants rétrécissent),
   jitter déterministe de position et d'échelle par tuile.
   → vérif : fin des arbres géants, grille brisée.

5. **Non-régression** : typecheck + lint + build + smoke Chromium headless.
   → vérif : CI verte localement.

## Avancement
- [x] Étape 1 — hash `tileHash`/`tileRand` ajoutés (`terrainProps.ts`).
- [x] Étape 2 — `terrainPropVariant` asymétrique (`assets.ts`).
- [x] Étape 3 — densité éparse forêt 0,62 (mountain inchangé = 1).
- [x] Étape 4 — largeur 0,72 tuile, hauteur plafonnée 1,4×, jitter pos/échelle.
- [x] Étape 5 — typecheck ✅, lint ✅, build ✅ (<800 Ko gzip tenu), tests engine+content 401 ✅.
      Smoke : en cours (binaire Playwright pré-installé = build 1194 vs 1228 attendu →
      relancé avec `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`).

## Écarts / décisions
- Montagne laissée à densité 1 (comportement inchangé) : le lot ne vise que la forêt (surgical).
- Placement/jitter dérivés d'un hash déterministe de tuile (pas de `Math.random`, pur rendu client).
- Aucun diff moteur, pas de bump `CURRENT_SAVE_VERSION`.
