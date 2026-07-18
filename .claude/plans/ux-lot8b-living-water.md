# Lot 8b (P2) — Un monde qui respire : eau vivante (I12, item 8.2)

> Plan `game-ergonomics-immersion-review.md` §5 Lot 8, item 2. Les tuiles d'eau
> sont statiques. On ajoute un **miroitement** : un voile clair sur les tuiles
> d'eau dont l'**alpha oscille lentement** (respiration), **sans re-tesselation** —
> l'animation ne touche qu'une propriété `alpha` (coût O(1)/frame). Coupé en
> reduce-motion. **Client uniquement — zéro moteur, zéro asset**, pas de bump save.

## Contrainte anti-gel
Le `Tilemap` **aplati** (`cacheAsTexture`, petites/moyennes cartes) empêche
d'animer une tuile isolée ; les grandes cartes (128²/256²) sont chunkées/culées.
Pour éviter tout risque sur l'anti-gel ×4 des grandes cartes, le voile n'est
construit **que sur les cartes aplaties** (`Tilemap.flattened`) — sur une carte
géante, la mer périmétrique + le rivage suffisent déjà. Décision documentée.

## Changement (client)
- `render/waterSheen.ts` : `buildWaterSheen(map)` (Graphics de losanges clairs sur
  `water`/`river`, `alpha=0` au repos, invisible si pas d'eau) ; `waterSheenAlpha(t,
  reduced)` **pur** (sinus lent borné, 0 en reduce-motion) ; `waterSheenStats`
  (hook de test).
- `Tilemap` : `readonly flattened` (= `!culled`).
- `AdventureScene` : construit le voile si `tilemap.flattened`, l'ajoute au-dessus
  de la tuile ; `onTick` met à jour `sheen.alpha = waterSheenAlpha(now, reduce)`.
- `main.ts` : hook `waterSheen() → { alpha }`.

## Vérification
- **Unitaire client** (`waterSheen.test.ts`) : `waterSheenAlpha` borné [0, max],
  0 en reduce-motion, varie dans le temps.
- Smoke @core : aventure (carte proto-01 aplatie) ⇒ `waterSheen().alpha > 0` en
  motion, `=== 0` en reduce-motion.
- **@perf aventure ×4 inchangé** ; typecheck · lint · engine · content · client ·
  build · bundle · smoke @core + mobile · gardes.

## Journal
- [x] `waterSheen.ts` (`buildWaterSheen` + `waterSheenAlpha` pur + `waterSheenStats`).
      Géométrie **cuite en texture** (`cacheAsTexture`) ⇒ un seul blit alpha/frame.
      `Tilemap.flattened` ; câblage `AdventureScene` (voile si aplatie, `onTick`
      anime l'alpha, reset à `destroy`) ; hook `waterSheen()`.
- [x] Unitaire client `waterSheenAlpha` (3 tests : borné / varie / 0 reduce) +
      smoke @core I12 (alpha > 0 motion, 0 reduce-motion).
- [x] **Perf validée par A/B** : dans cet environnement (dégradé/bruité au moment
      du test — la machine a chuté de ~9 à ~5-11 fps), l'aventure ×4 mesure
      5.0-11.7 fps AVEC le voile vs 4.8-11.1 fps SANS (baseline `stash -u`) ⇒
      **indiscernables** (le voile est perf-neutre ; le baseline flake AUSSI sous 5).
      Le bruit est environnemental, pas le changement ; `smoke-perf` CI (gate ≥ 5)
      reste l'arbitre. Recette : typecheck · lint · engine 908 (client-only ⇒ golden
      inchangé) · content 154 · **client 23** · build · bundle 343 751 ≤ 819 200 ·
      smoke @core 33 + mobile 13 · gardes faction/couleurs propres.
- Décision assumée : voile **seulement sur carte aplatie** (`Tilemap.flattened`) —
      sur une carte géante culée, la mer périmétrique suffit, anti-gel ×4 protégé.
