# UX-TOWNVIEW — Vraie vue de ville peinte (Lot 1)

Doc: 08 §2.2/§5 ; backlog game-feature-gaps.md ~942. Branche: claude/ux-townview-painted-scene-mr2kez (= origin/main).
Décision utilisateur: **A/a** — layout déterministe client (zéro schéma/moteur/contenu) + verrouillés en empreinte dombre discrète.

## Objectif
Remplacer la BANDE horizontale de vignettes (TownView, flex overflow-x) par une SCÈNE COMPOSÉE:
bâtiments positionnés en absolu (left/top en %) sur le décor peint, à un emplacement déterministe.
constructed=opaque · available=fantôme/échafaudage · locked=ombre discrète. Tap-routing conservé.

## Invariants
- Zéro diff moteur, pas de bump CURRENT_SAVE_VERSION, golden inchangé.
- Garde faction (statut 1) + garde couleur UI (toute couleur dans tokens.css).
- a11y: cibles >=44px, pastille non chromatique (2e canal), 3 crans police via rem.
- Préserver classes/testids consommés par smokes: .town-view-scene (style bg), .town-view-vignette,
  town-view (testid), town-view-building + data-status.

## Étapes
1. Layout déterministe client (fonction pure townLayout: ordre stable -> {x%,y%}). → verify: positions distinctes, pas de chevauchement grossier.
2. Refonte TownView JSX: scène ratio fixe, boutons en absolu, ombre pour locked. → verify: typecheck + rendu.
3. town.css: .town-view-scene devient position:relative ratio fixe (plus flex), .town-view-building absolu. → verify: garde couleur statut 1.
4. Smoke: étendre assert (positions composées + statuts) sans casser existants. → verify: smoke vert.
5. Doc 08 §2.2/§5: ajouter État UX-TOWNVIEW. → verify: cohérence.
6. Pipeline complet vert (exits réels) → commit → rebase origin/main → push → PR draft → CI → merge → resync.

## Avancement
- [x] 1 Layout déterministe (render/townLayout.ts)
- [x] 2 Refonte TownView (scène absolue composée)
- [x] 3 town.css (scene relative ratio fixe, building absolu)
- [x] 4 Smoke étendu (positions composées + statut construit)
- [x] 5 Doc 08 §2.2 (État UX-TOWNVIEW)
- Pipeline hors-smoke VERT: typecheck0 lint0 test(822)0 content:check0 build0 garde-faction=1 garde-couleur=1 bundle=319885<819200
- [ ] 6 smoke + push/PR/merge/resync
