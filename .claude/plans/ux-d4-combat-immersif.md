# Plan — UXD-4 : combat immersif

> Lot 4 du plan maître `.claude/plans/ux-design-overhaul.md` (§3), joué avant
> UXD-3 (ordre `0→1→2→4→3…` : le combat est le plus fort retour immersif par
> unité d'effort). Rend visible la toile de combat peinte (U5-E) masquée par des
> hexes opaques, et donne de l'impact au coup porté — sans casser l'anti-gel ×4
> (doc 10 §6) ni l'accessibilité (jamais la couleur seule ; `prefers-reduced-
> motion`).

## Constat (revue 2026-07-07, §1.5)

- Les hexes sont **opaques** (`hexgrid.ts` : `.fill(fill)` plein) → la toile
  peinte DOM posée en U5-E ne transparaît qu'entre les hexes.
- États d'hex (atteignable/attaquable/obstacle) portés par la **couleur seule**
  (A5 à consolider).
- Aucun **feedback de coup** : le seul retour est un tint rouge bref sur la
  cible ; pas de chiffres de dégâts flottants, pas d'impact.

## Étapes

- [x] Hexes **translucides** (`hexgrid.ts`) : remplissage de base très
      transparent (toile peinte visible), états à alpha modéré ; **second canal
      non chromatique** (A5) — stroke distinct par état + marqueur (pip
      atteignable, bord épais attaquable, hachures obstacle). Contour net
      conservé.
      → vérif : capture combat desktop/mobile — la toile peinte transparaît,
      états distinguables en niveaux de gris.
- [x] **Chiffres de dégâts flottants** (`CombatScene`) : sur `StackAttacked`
      (porte `damage`/`kills`/`lucky`), un texte monte et s'efface (~700 ms) à
      la position de la cible ; style « coup de chance » distinct ; skull +
      effectif si `kills > 0`. Couche `fxLayer` dans le monde (pan/zoom).
      → vérif : visible dans une capture d'animation ; se détruit (pas
      d'accumulation).
- [x] **Micro-secousse** de la cible au coup (≤ 150 ms) en complément du tint.
- [x] **`prefers-reduced-motion`** : secousse + flottement coupés (le nombre
      apparaît statique puis s'efface) — nouveau helper client.
- [x] Vérif finale : smoke **anti-gel ×4** arène (plancher ≥ 5 fps) re-mesuré,
      re-passe `ux-audit` 30 captures 0 WARN, smokes verts, build + budget,
      garde-fou couleurs intact.

## Hors périmètre (différés, notés au plan maître)

- **Bandeau d'initiative illustré** (portraits en ordre de round) : rework du
  bandeau DOM `combat.tsx` (aujourd'hui par camp, pas par initiative) qui
  toucherait le correctif R4 mobile — lot de suivi dédié.
- **Fonds de combat des terrains manquants** (montagne, route… règle D) :
  génération d'assets, relève d'un lot `asset-*`, pas de code moteur/client.

## Vérification (2026-07-07)

- **Hexes translucides** : capture combat desktop — la toile peinte (château,
  montagnes, rivière, forêt) transparaît complètement là où le plateau était un
  aplat gris. Seconds canaux A5 visibles : pips blancs sur atteignable, bord
  rouge épais sur cible attaquable, hachures sur obstacle.
- **Chemin de dégâts** : frappe mêlée manuelle scriptée dans l'arène (rapprochement
  tour-à-tour puis attaque) — l'ennemi encaisse (effectifs 20→16, riposte : mon
  Élève 12→2), **0 erreur console**. Le chiffre flottant est un transitoire de
  700 ms non figé à l'image (rafale 35 ms démarrée après drainage de la file
  d'animation ; l'auto-combat téléporte au résultat sans jouer les coups, et un
  coup fatal détruit la scène avant le rendu). Le rendu réutilise le `tween`
  éprouvé partout ailleurs.
- **Anti-gel ×4** : smoke arène re-mesuré **13,9 fps** (plancher ≥ 5).
- Smokes **86 verts + 2 skipped**, typecheck/lint/build verts, garde-fou
  couleurs intact.
