# Plan — UXD-0 : correctifs ergonomiques immédiats + outillage d'audit

> Lot 0 du plan maître `.claude/plans/ux-design-overhaul.md` (§3). Corrige les
> 6 régressions mesurées à la revue du 2026-07-07 (§1.6 : R1→R6) sans aucune
> refonte de style — le design system arrive en UXD-1.

## Étapes

- [x] R6b — `capture.mjs` : ajouter l'écran **héros** (tiroir ouvert), promis
      par SKILL.md §2 mais absent du script.
      → vérif : la passe produit 30 captures (5 écrans × 2 × 3).
- [x] R1 — boutons du livre de sorts d'aventure ≥ 44 px : `.adventure-spell-*`
      n'avait AUCUN CSS (bouton nu 134×21). Styles alignés sur les boutons du
      tiroir. → vérif : plus de WARN `adventure-spell-*` dans la passe.
- [x] R2 — barre de ressources : `flex-wrap` + padding latéral qui dégage le
      bouton tiroir (44 px + marges) ; ne déborde plus à aucun cran.
      → vérif : captures mobile font1–3, aucune valeur tronquée.
- [x] R3 — HUD bas de la carte : `ArmyBand` + `TurnBar` regroupés dans un
      conteneur `bottom-hud` en colonne (armée au-dessus, statut+actions en
      dessous) — les 3 blocs `position: fixed` indépendants se recouvraient au
      cran 3. → vérif : captures mobile font3, zéro chevauchement.
- [x] R4 — bandeau d'armées du combat : en viewport étroit (≤ 640 px), round
      en tête pleine largeur puis une rangée par camp — plus de chevauchement
      du titre ni de vignette hors écran. → vérif : capture combat mobile.
- [x] R5a — consigne/prévisualisation de dégâts : regroupée avec la barre
      d'actions dans un conteneur bas en colonne (`combat-bottom`) — plus de
      recouvrement quand la barre passe sur 2 rangées.
- [x] R5b — caméra de combat : au début du combat, si le plateau déborde de
      l'écran (échelle plancher 44 px, mobile portrait), **centrage sur l'hex
      de la pile active** au lieu du centre du plateau (aucune unité n'était
      visible). Le pan/pinch reste maître ensuite (recentrage uniquement à
      l'ouverture). → vérif : capture combat mobile font1 montre des unités.
- [x] Vérification finale : `pnpm build` + re-passe `ux-audit` **0 WARN/FAIL
      sur 30 captures** (5 écrans, héros inclus, × 2 viewports × 3 crans) +
      typecheck/lint verts + smokes Playwright.

## Écarts constatés en cours de route

- La nouvelle capture `hero` n'a révélé **aucune** cible < 44 px dans le
  tiroir : R1 (livre de sorts d'aventure) était bien la seule zone en défaut.
- Smokes : 81/84 verts + 1 flaky (`fin de tour`, tap-tap chronométré comme
  préparation d'état — pattern flaky déjà documenté dans `moveHeroToGold`) qui
  passe isolément ; sans lien avec le lot (la CI a `retries`, R6). 2 skipped
  pré-existants.
- `damage-preview` : le smoke vérifie le testid, pas la position — RAS.
- Le smoke « combat » ne tape jamais le canvas (dit explicitement guideline
  §7) : le recentrage R5b ne casse aucune coordonnée scriptée.

## Hors périmètre (renvoyé aux lots suivants)

- Tout changement de couleur/typo/icône (UXD-1/2), mini-map et layout desktop
  (UXD-8), bandeau de ressources « tap = détail » complet (doc 08 §2.1).
