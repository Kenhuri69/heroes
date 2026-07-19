# Plan — UXD-3 (tranche A) : bord de monde

> Tranche **code/procédurale** du lot 3 du plan maître
> `.claude/plans/ux-design-overhaul.md` (§3). Traite le constat §1.5
> « letterbox noir » : la carte 32×32 flotte dans du `#1a1c22` pur (le vide au-
> delà des tuiles). Les **remplacements d'assets peints** de UXD-3 (sprite héros
> monté, château de ville, objets de carte) exigent une génération d'images LLM
> (règle A/C doc 12) et relèvent d'une passe `asset-*` dédiée → tranche B, notée
> hors périmètre ici.

## Constat

- `#canvas-root`/`body` = `#1a1c22` ; au-delà des tuiles (0,0)→(W·64,H·64), le
  canvas est transparent ⇒ on voit ce fond sombre uni. La carte « flotte dans
  le noir » (audit §1.5), sans bord de monde, sans vignette.
- La **caméra n'a aucun clamp** : on pane indéfiniment dans le vide.

## Étapes

- [x] `render/worldBorder.ts` : **océan** derrière la tuile — grand aplat d'eau
      profonde couvrant très largement autour de la carte (on ne peut plus
      atteindre le noir), **liseré de côte** autour du périmètre jouable
      (lecture « rivage »), teinte cohérente avec les tuiles `water`. Ajouté en
      **1er enfant** de la scène (sous la tuile). Coût : quelques draw calls
      statiques, sous le plancher anti-gel.
      → vérif : capture aventure desktop — plus de bandes noires ; pan = mer.
- [x] **Vignette** DOM pendant l'aventure (`.map-vignette`, radial-gradient,
      `pointer-events:none`, composée une fois — coût par-frame nul comme la
      toile de combat U5-E) ; absente en menu/combat.
      → vérif : bords assombris, profondeur ; retirée hors aventure.
- [x] Vérif finale : re-passe `ux-audit` 30 captures 0 WARN, smokes verts,
      build + budget, anti-gel carte re-mesuré (plancher ≥ 5), garde-fou
      couleurs intact.

## Hors périmètre → tranche B (génération d'assets)

- Sprite **héros monté** par faction (remplace l'écusson `heroSprite.ts`).
- **Ville** peinte sur carte (remplace le donjon `townsLayer.ts`).
- Objets restants (coffre, camp, tente, artefact au sol).
- **Clamp caméra** (l'océan couvre déjà le vide atteignable ; clamp fin = petit
  suivi si besoin).

## Vérification (2026-07-07)

- **Océan** : capture aventure desktop/mobile — le vide au-delà de la carte est
  désormais une **mer profonde** (navy `#14243a`, fond DOM de `#canvas-root`,
  coût par-frame nul) au lieu du fond noir. Le noir restant à droite/bas est le
  **brouillard de guerre** (intérieur de carte non exploré, le héros démarre
  près du coin haut-gauche), pas le letterbox.
- **Anti-gel** : 1ʳᵉ implémentation (grand rect Pixi 8000² rempli par frame) a
  fait chuter la carte à **3,4 fps** (< plancher) → refonte en fond DOM + seul
  le rivage en Pixi (fill borné) ⇒ carte **7–14 fps** (plancher ≥ 5) selon la
  charge du runner. Arène 15,5 fps.
- **Vignette** : bords assombris (radial-gradient DOM), adventure-only.
- Smokes **90 verts + 2 skipped**, typecheck/lint/build verts, garde-fou
  couleurs intact.
