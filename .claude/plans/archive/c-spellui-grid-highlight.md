# C-SPELLUI.3 — Surbrillance Pixi de la zone d’effet sur la grille

Backlog game-feature-gaps.md « C-SPELLUI » (3e sous-lot). Doc 08 §2.3.
Item « ciblage d’hex sur la grille (surbrillance de la zone) ». Additif au
flux de ciblage texte (a11y préservée). Réutilise `spellAffectedStacks` (#384)
et le motif de surbrillance de la téléportation (combatSpellTarget→drawBoard).

## Design
Sur l’écran de ciblage : (1) la modale se DOCK en bas, fond transparent ⇒
plateau visible ; (2) choisir une cible surligne en Pixi les hexes de la zone
(cible + splash/all/chaîne). Highlight = vue seule ; la cible se choisit
toujours via les puces texte (≥44px). Sort de téléportation exclu (son propre
flux combatSpellTarget). Zéro géométrie hex réimplémentée côté client.

## Étapes
1. store.ts: champ `combatSpellZone: {spellId,targetStackId}|null` (init null).
2. dispatch.ts: le vider aux 2 points début/fin de combat (avec combatSpellTarget).
3. hexgrid.ts: DrawBoardOptions.zone + rendu (teinte violette distincte +
   marqueur non-chromatique A5). → verif: typecheck.
4. CombatScene.ts: bloc combatSpellZone dans redrawBoard (gardes = téléport)
   + ajout à lastSync (sinon pas de redraw). Import spellAffectedStacks.
5. SpellBook.tsx: set combatSpellZone à selectTarget (sauf teleport) ; clear
   à backToList/selectSpell ; useEffect cleanup au démontage ; classe
   `targeting` (dock bas) quand def défini.
6. SpellBook.css: dock bas + fond transparent en mode targeting.
7. Smoke: la modale passe en mode targeting (classe/testid) sur écran de
   ciblage. NB: le highlight Pixi n’est pas assertable en smoke DOM — dit
   explicitement ; non-régression = le cast passe toujours via la barre dockée.
8. Doc 08 §2.3.

## Portée
Client + 1 champ store présentation. ZÉRO moteur (helper déjà livré #384),
pas de bump CURRENT_SAVE_VERSION, golden inchangé, gardes faction/couleur verts.

## Statut
Étapes 1-8 implémentées. Non-smoke vert (typecheck·lint·engine 815 golden+save-shape inchangés·content·content:check·gardes 1/1·build·bundle 319Ko). Smoke en cours.
