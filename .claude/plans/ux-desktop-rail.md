# Plan — colonne droite persistante (desktop)

> Dernier gros morceau UX (plan maître §1.5 « desktop sous-exploité » ; doc 08
> §2.1 : colonne droite ressources/portraits/villes/mini-map). Choix utilisateur :
> **colonne droite persistante**.

## Approche

Réutiliser le **tiroir héros** existant : sur desktop (≥ 900px) il devient une
**colonne toujours ouverte** ancrée à droite (plus de hamburger), contenant déjà
portraits (`HeroStrip`) + héros + armée + mini-map. La barre de ressources et le
HUD bas se **confinent à gauche de la colonne**. La **mini-map se consolide dans
la colonne** : on retire le widget flottant `fixed` (redondant) et on garde la
seule `MiniMap variant="drawer"` (affichée en tiroir mobile ET en colonne
desktop). Mobile inchangé (tiroir en bascule).

Surtout du CSS ; réversible. Les **villes** (boutons dans la barre d'actions)
restent où elles sont — les déplacer dans la colonne = raffinement noté.

## Étapes

- [x] `shell.tsx` : retirer le mount `<MiniMap />` flottant (la version colonne
      `variant="drawer"` suffit sur les deux viewports).
- [x] `styles.css` : widget `fixed` `.mini-map` supprimé ; `.mini-map-drawer`
      + `.hero-minimap-title` toujours affichés. `@media (min-width: 900px)` :
      `.drawer-toggle { display:none }` ; `.hero-drawer` persistante
      (`right:0; transform:none; width:300px; box-sizing:border-box`) ;
      `.resource-bar`, `.bottom-hud` → `right: 300px`.
- [x] `tests/smoke.spec.ts` : clic sur `hero-drawer-toggle` **conditionné à sa
      visibilité** (desktop = colonne persistante, plus de bascule ; mobile = on
      ouvre) — 3 sites.
- [x] Vérif (2026-07-07) : capture **desktop 1280** — colonne droite (portrait,
      mini-map « Adventure map », niveau/XP/mana, attributs, armée) ; barre de
      ressources et actions (dont END TURN) **non masquées** (bord colonne = 980,
      ressources/END TURN ≤ 980, **0 chevauchement**) ; **mobile 390** inchangé
      (bascule visible, colonne repliée hors écran, mini-map dans le tiroir) ;
      0 erreur console. Smokes **104 verts + 2 skipped** ; typecheck/lint/build
      verts ; garde-fou couleurs vert ; budget 253 Ko gzip.

## Hors périmètre / suivi

- Boutons de villes déplacés dans la colonne (aujourd'hui dans la barre d'actions).
- Redimensionnement du canvas Pixi pour ne pas dessiner sous le rail (la carte
  s'étend sous le bord droit opaque — acceptable, style HoMM).
