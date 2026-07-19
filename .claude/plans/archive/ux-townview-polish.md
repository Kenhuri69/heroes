# UX-TOWNVIEW Lot 3 — polish interactions (scène de ville)

Branche: claude/ux-townview-polish depuis origin/main. Lot 2 (art AS-TOWNBG) bloqué → on fait le Lot 3 client-pur.

## Objectif
Sur la scène composée (Lot 1): (A) indicateur dupgrade sur les bâtiments CONSTRUITS encore améliorables
(construit + buildStatus===available), badge non chromatique + data-upgradeable. (B) infobulle bâtiment
reachable au survol/focus ET appui long (parité tactile doc 08 §1.1): nom + niveau X/Y + statut + coût prochain.

## Invariants
- Zéro diff moteur, pas de bump save, golden inchangé, gardes faction+couleur=1, a11y >=44px + non chromatique + rem.
- Conserver testids/classes existants (.town-view-scene, .town-view-vignette, town-view-building, data-status).

## Étapes
1. Hook DOM useLongPress (parité tactile, suppress-click). → verify: typecheck.
2. TownView: upgradeable + badge/data-upgradeable + inspect (nom/niveau/statut/coût) survol/focus/long-press. → verify: rendu.
3. town.css: .town-view-upgrade (forme non chromatique), .town-view-inspect. → verify: garde couleur=1.
4. Smoke: data-upgradeable=true >=1 (townHall L1 start-town); focus batiment -> inspect montre nom+niveau. → verify: smoke.
5. Doc 08 §2.2: étendre note UX-TOWNVIEW (Lot 3). → verify: cohérence.
6. Pipeline complet -> commit -> rebase -> push -> PR draft -> CI -> merge -> resync.

## Avancement
- [x] 1 useLongPress DOM (parité tactile)
- [x] 2 TownSlotButton: upgradeable + badge/data-upgradeable + inspect (survol/focus/appui long)
- [x] 3 town.css .town-view-upgrade (chevron) + .town-view-inspect
- [x] locale town.upgradeAvailable FR/EN
- [x] 4 smoke: data-upgradeable + upgrade badge + inspect (focus)
- [x] 5 doc 08 (a faire)
- Hors-smoke VERT: tc0 lint0 test(822+144)0 content:check0 garde-faction=1 garde-couleur=1 build0 bundle=320618<819200
- [ ] 6 smoke + PR/merge/resync
