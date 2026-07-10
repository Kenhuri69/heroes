# Élargissement du champ de bataille de combat (12 → 15 colonnes)

## Contexte

Retour utilisateur : en combat, l'ennemi « semble démarrer au milieu », ce qui
réduit la marge de manœuvre stratégique. Enquête (captures desktop + état
moteur) : le placement est en réalité correct — attaquant col 0, défenseur
col `COMBAT_COLS-1` (11), aux deux bords, avec no-man's land central. Décision
utilisateur : **élargir le champ** de 12 à ~15 colonnes (comme HoMM III) pour
plus d'espace de manœuvre et une meilleure séparation des camps.

## Décision de design

- Plateau **15 × 10** (au lieu de 12 × 10). 15 colonnes = largeur HoMM III.
- Rangées inchangées (10) — combats restant lisibles sur mobile.
- Point d'entrée unique : `COMBAT_COLS` (`packages/engine/src/combat/hex.ts`).
  Tout le reste (placement défenseur, bornes, boucles de rendu, bounds client)
  est **dérivé** de cette constante ⇒ aucun autre code de placement à toucher.
- Obstacles : la plage de colonnes est en dur (`3..8`). Sur 12 colonnes c'était
  3 tuiles de marge depuis chaque bord de spawn (symétrique). Pour préserver
  cette intention sur 15 colonnes ⇒ `3..11` (toujours 3 de marge de chaque
  côté, centré, jamais sur/adjacent aux colonnes de spawn 0 et 14).

## Impacts

- **Sauvegarde** : la FORME sérialisée du combat ne change pas (positions
  toujours `col/row`). Un combat sauvé sous l'ancienne largeur reste dans les
  bornes (col ≤ 11 < 15). ⇒ **pas de bump `CURRENT_SAVE_VERSION`**.
- **Golden replay** : le journal inclut un combat de gardien auto-résolu.
  Placement défenseur (11→14) + obstacles (plage RNG) changent ⇒ le hash
  **change légitimement** (comportement + forme). À re-fixer avec commentaire.
- **Client** : `render/hexgrid.ts` importe `COMBAT_COLS` ⇒ grille, picking et
  `computeBoardBounds` s'adaptent automatiquement. Aucune coordonnée en dur.
- **Docs (source de vérité, guideline §8.6)** : mettre à jour toutes les
  mentions « 12×10 » / « 120 hexes » et le rationnel de doc 02 §5.1.

## Étapes

1. `hex.ts` : `COMBAT_COLS = 12 → 15` + commentaire d'en-tête « 15×10 ».
   → verify : typecheck vert.
2. `setup.ts` : plage obstacles `3, 8 → 3, 11`.
   → verify : obstacles restent centrés/symétriques.
3. Docs : doc 02 §5.1 (dimension + rationnel), 01/08/09/10/11, commentaires
   `hexgrid.ts` (12×10, « 120 hexes » → « 150 hexes »).
   → verify : plus aucune mention « 12×10 » factuelle obsolète.
4. Golden : lancer les tests, récupérer le nouveau hash, mettre à jour
   `GOLDEN_HASH` + note explicative. Vérifier que les assertions de valeurs
   (armée survivante > 0 et ≤ borne) tiennent toujours ; ajuster la borne si le
   combat plus large change l'issue.
   → verify : `pnpm test` vert.
5. Smoke headless (guideline §7) : combat s'ouvre, unités aux deux bords.
   → verify : capture arène desktop, défenseur au nouveau bord (col 14).
6. typecheck + lint + build + garde-fou « zéro faction » + budget bundle.

## Suivi

- [x] Étape 1 — `COMBAT_COLS = 15`, commentaire d'en-tête `hex.ts` mis à jour.
- [x] Étape 2 — obstacles `3..COMBAT_COLS-4` (= 3..11), commentaire de symétrie.
- [x] Étape 3 — docs 01/02/08/09/10/11 + commentaires `hexgrid.ts` (« 150 hexes »).
- [x] Étape 4 — **golden hash INCHANGÉ** : `rollRange` consomme 1 pas RNG quelle
      que soit la borne ⇒ flux aligné ; le combat de gardien du journal aboutit
      aux mêmes survivants malgré défenseur col 11→14 et obstacles recentrés.
      401/401 tests moteur verts, aucune borne d'assertion à ajuster.
- [x] Étape 5 — smoke desktop+mobile : 27 combats verts (gardien, arène, siège,
      auto, sort, attaque héros, fuite…). État vérifié : défenseur col 14,
      obstacles cols 6/8/10, plateau visiblement élargi (capture desktop).
- [x] Étape 6 — typecheck ✓, lint ✓, build client ✓, garde-fou « zéro faction »
      ✓, bundle inchangé (constante, zéro code neuf), pas de bump save version.
