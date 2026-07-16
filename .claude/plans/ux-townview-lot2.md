# UX-TOWNVIEW Lot 2 — bâtiments calés sur le décor peint

Branche claude/ux-townview-painted-layout. Client + données (assets/), zéro moteur/content/save.
Déclencheur: retour utilisateur — les fonds peints des 6 factions EXISTENT déjà; le vrai manque = caler
les emplacements sur le tableau au lieu du scatter plein-cadre.

## Livré
- townLayout: défaut « au sol » (bande avant-plan y52-88) au lieu du plein cadre + param anchors.
- assets.ts: townLayoutAnchors(factionId) via glob assets/layouts/town-*.json (registre, id opaque).
- TownScreen passe les ancres de la faction.
- assets/layouts/town-haven.json (16), town-necropolis.json (13) bespoke, calés sur la peinture.
- Vérif VISUELLE par screenshots Playwright (haven/necropolis/test-faction) — OK, bâtiments au sol.
- Docs 08 §2.2 (note Lot 2), 12 §5 (règle D layouts), backlog UX-TOWNVIEW ✅ / AS-TOWNBG partiel.

## Invariants
- Garde faction=1 (ids en data/ + assets/, pas packages/), garde couleur=1, golden inchangé, pas de bump save.

## Pipeline: tc/lint/test/content:check/gardes/build/bundle/smoke tous verts avant push.
