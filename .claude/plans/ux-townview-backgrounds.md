# UX-TOWNVIEW — fonds composables régénérés + emplacements calés

Branche claude/ux-townview-backgrounds. Client + assets, zéro moteur/content/save.
Déclencheur: utilisateur a régénéré les 6 fonds via les prompts révisés (lots de construction vides).

## Livré
- 6 fonds régénérés intégrés (PNG->JPEG 1920x1080 q85 <320Ko) assets/backgrounds/town-*.jpg.
- 6 layouts calés sur les lots davant-plan assets/layouts/town-*.json (grille 3 rangées, par faction).
- Libellés permanents retirés (TownScreen + CSS orphelin) : identite via vignette + ligne dinspection (lot3) + title/aria.
- Vérif VISUELLE screenshots Playwright des 6 factions — bâtiments posés sur les lots, look ville HoMM.
- Docs 08 §2.2 + backlog AS-TOWNBG ✅.

## Invariants: gardes faction/couleur=1, golden inchangé, pas de bump save. Pipeline complet vert avant push.
