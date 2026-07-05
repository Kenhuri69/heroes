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

### (c) R7c — Classe `.btn` partagée
Évaluation : dedup des styles de boutons (~10 fichiers, paddings hétérogènes).
Si factorisation propre sans risque de régression visuelle → faite ; sinon skip
documenté (YAGNI, guideline §7, non vérifiable au smoke).

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
