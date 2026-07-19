# Plan — UX finitions (aspects UX restants)

> Directive utilisateur : « traite bien tous les aspects UX restants en
> committant chaque point traité. » Un commit par point.

## Points

### (a) U5-E — Toile de combat via couche DOM  ✅ (voir commit)
Refait proprement le fond de combat retiré en U5-B (le sprite Pixi plein écran
faisait chuter l'arène throttlée ×4 sous 5 fps). Approche **coût par-frame nul** :
- `main.ts` `app.init` : `background: '#1a1c22'` → `backgroundAlpha: 0` (canvas
  transparent ; `#canvas-root`/`body` gardent `#1a1c22` → aventure/menu identiques).
- `ensureScenes` : en entrée de combat, pose `#canvas-root.style.backgroundImage`
  = toile du terrain (`combatBackgroundUrl(game.combat.terrain)`, `cover`) ; en
  sortie / retour menu, la retire. Composé une fois par le navigateur → **anti-gel
  tenu** (VÉRIFIER CI). La toile apparaît autour du plateau (hexes opaques) =
  champ de bataille encadré.

### (b) R7c — Toast victoire/défaite par `playerSide`
`notify`/toast utilisait `winner === 'attacker'` en dur → faux en combat
défensif. Ajout de `playerSide` à l'événement `CombatEnded` (events.ts + emit
turns.ts) ; `notify` calcule `won = winner === playerSide`. Golden non impacté
(événements non hashés) — re-vérifié `be72de4b` + tests combat/notify.

### (c) R7c — Classe `.btn` partagée  ⏭️ SKIP documenté
Évaluation faite. La famille de boutons est **hétérogène** : padding `8px 14px`
(actions/combat) / `8px 10px` (vitesses) / `10px 18px` (menu) / `6px 14px`
(ville), `min-height` 44/48/56, deux teintes (secondaire gris `#262a33` vs
primaire rouge `#7a2d22`). Seuls `.actions button` et `.combat-actions button`
sont strictement identiques (~6 lignes de « reset bouton »), mais dans deux
feuilles chargées par composant. Factoriser en `.btn` global imposerait : (1) un
passage sélecteur d'élément → classe = **changement de spécificité** (risque de
régression sur les surcharges) ; (2) des modificateurs (`--primary`, `--lg`)
pour conserver les 4 variantes ; (3) ~6 CSS + ~10 sites d'appel touchés — pour un
rendu **non vérifiable au smoke** (§7). Rapport risque/gain défavorable →
**skip** (YAGNI, §2/§3). Les styles restent colocalisés avec leur composant
(bonne localité). À reconsidérer si un design system Beta arrive.

## Déjà satisfaits (documentés, sans code)
- A1 cibles ≥ 44 px (audit : 0 warning) ; A5 jamais la couleur seule ;
  daltonisme (motifs `FactionBadge` par conception) ; A2 aucun tooltip
  hover-exclusif. « Appui long = fiche d'objet de carte » = feature Beta (notée).
- Hors portée : animation frame-par-frame des unités (le tooling `asset-sheet`
  ne produit pas de planches d'animation).

## Invariants
Moteur pur, golden `be72de4b` stable, zéro faction moteur, budget < 800 Ko,
cibles ≥ 44 px, anti-gel ×4, docs à jour.

## Journal
- **2026-07-05** — Création. Base propre après merge #62 (U5-D).
- **2026-07-05** — (a) livré (commit toile DOM), (b) livré (commit playerSide).
- **2026-07-05** — (c) évalué → skip documenté (hétérogénéité + risque
  spécificité + non vérifiable smoke). Lot prêt pour smoke complet + PR.
