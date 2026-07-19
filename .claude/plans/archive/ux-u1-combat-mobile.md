# Plan — U1 : Combat mobile (CL7/A7) + correctif A6

> Lot U1 du chantier UX (plan de remédiation §5.3, étape 3). Corrige **CL7/A7** :
> en combat mobile portrait, le plateau 12×10 est écrasé (hexes ≈ 25 px < 44 px),
> aucun pan/pinch, et l'overlay « rotation paysage recommandée » est un
> contournement (doc 08 §2.4) au lieu d'une mise en page portrait jouable.
> Embarque aussi le petit correctif **A6** (barre d'onglets de ville qui déborde
> en mobile × font3, « Garnison » tronqué).

## 1. Objectif & critères de succès

- **Hexes ≥ 44 px effectifs** en portrait 360×640 : plancher d'échelle du plateau
  (`MIN_COMBAT_SCALE`) dérivé du pas horizontal hex (`HEX_SIZE·√3 ≈ 62 px`) →
  `44/62 ≈ 0,706`.
- **Pan + pinch** du plateau (parité avec la carte d'aventure) : quand le plateau
  déborde au plancher (portrait), on le déplace au doigt et on zoome au pinch.
- **Overlay rotation supprimé** (composant + CSS + clés locales + doc 08 §2.4).
- **A6** : les 3 onglets ville restent lisibles et tactiles ≥ 44 px en mobile ×
  font3 (aucune troncature).
- Invariants : moteur pur intact (aucun changement moteur), budget bundle,
  golden stable. Aucune régression sur la carte d'aventure (caméra partagée
  généralisée avec défauts identiques).

Vérif : `pnpm typecheck` 4/4 + lint + test + content:check + build + smoke ;
**re-passe `ux-audit` A7** (hexes ≥ 44 px mesurés) + **A6** (onglets).

## 2. Décision d'architecture (design d'interaction)

Direction déjà fixée par le plan §5.3 (« min-scale 44 px + pan/pinch du
plateau ») → pas de nouveau fork utilisateur. Choix d'implémentation retenus :

- **Réutiliser la `Camera` d'aventure** (généralisée) pour le plateau de combat
  plutôt qu'une caméra bespoke (DRY, esprit R7 : pan/pinch/molette partagés).
  Généralisation rétro-compatible : options `{ minZoom, maxZoom }` (défauts
  `0.5`/`2` = comportement carte inchangé) + `setEnabled(bool)`.
- **Combat dérivé de l'état moteur** (acquis U2) : la scène de combat vit tant
  que `game.combat ≠ null`.
- **Coexistence carte/combat** : pendant le combat, la caméra d'aventure garde
  ses listeners `app.stage` (elle n'est que `visible=false`). Sans garde, les
  gestes piloteraient DEUX caméras. → `main.ts` fait `camera.setEnabled(false)`
  en entrant en combat, `true` en sortant. Les taps de la carte sont déjà inertes
  en combat (`AdventureScene.handleTap` : `if (game.combat) return`).
- **Pan non borné** (parité avec la carte, « pan caméra non borné » déjà accepté
  en mineur R7c) : le plateau démarre centré ; le clamp de pan est un raffinement
  différé, noté.

## 3. Découpage (fan-out Sonnet, fichiers disjoints)

Interfaces figées par le pilote (§4). Deux surfaces indépendantes lancées en
parallèle, puis intégration + tests par le pilote.

- **S-A — rendu/caméra (client)** : `render/camera.ts` (généralisation),
  `scenes/combat/CombatScene.ts` (caméra de combat + plancher + fit/centre),
  `main.ts` (gating caméra aventure). Contrat détaillé §4.
- **S-B — UI/CSS/i18n** : `ui/combat.tsx` (retrait `LandscapeHint`),
  `ui/combat.css` (retrait `.landscape-hint`), `ui/town.css` (A6 : onglets
  wrap), `data/core/locales/{fr,en}.json` (retrait `combat.landscapeHint*`).
- **S-C — tests & doc (pilote, après intégration)** : smoke (combat pan +
  tap-hex toujours fonctionnel ; plus de `landscape-hint`), re-capture
  `ux-audit` A6/A7, `docs/08-ui-ux.md` §2.4 (portrait jouable, plus de nag).

## 4. Contrat figé S-A

`render/camera.ts` :
- `interface CameraOptions { minZoom?: number; maxZoom?: number }`
- constructeur `constructor(app, opts: CameraOptions = {})` : `this.minZoom =
  opts.minZoom ?? 0.5`, `this.maxZoom = opts.maxZoom ?? 2` ; `zoomAt` borne sur
  `this.minZoom/this.maxZoom` (retire les consts MIN_ZOOM/MAX_ZOOM ou garde-les
  comme défauts).
- champ `private enabled = true` + `setEnabled(e: boolean)` ; `onDown`/`onMove`/
  `onWheel` : `if (!this.enabled) return;` en tête ; `onUp` nettoie toujours le
  pointeur (pas de garde, évite un pointeur bloqué).

`scenes/combat/CombatScene.ts` :
- `const MIN_TAP_PX = 44; const MIN_COMBAT_SCALE = MIN_TAP_PX / (HEX_SIZE *
  Math.sqrt(3));` (import `HEX_SIZE`).
- Constructeur : `this.camera = new Camera(app, { minZoom: MIN_COMBAT_SCALE,
  maxZoom: MAX_SCALE });` ; `this.camera.world.addChild(this.boardLayer);
  this.container.addChild(this.camera.world);` (le plateau vit DANS `camera.world`).
- `layout()` transforme désormais `this.camera.world` (plus `this.boardLayer`) :
  `fit = min(availW/w, availH/h, MAX_SCALE)` ; `scale = max(fit, MIN_COMBAT_SCALE)` ;
  applique `camera.world.scale`/`position` (même centrage qu'avant).
- `handleTap` inchangé : `this.boardLayer.toLocal(global)` traverse la transfo
  `camera.world` → coords hex correctes.
- `destroy()` : retirer `camera.world` du container AVANT destruction pour éviter
  la double-destruction :
  `this.container.removeChild(this.camera.world); this.camera.destroy();
  this.container.destroy({ children: true });`

`main.ts` `ensureScenes` : `camera.setEnabled(false)` à l'entrée en combat,
`camera.setEnabled(true)` à la sortie (à côté des bascules `camera.world.visible`).

## 5. Journal
- **2026-07-05** — Création. Approche figée (réutilisation Camera + plancher
  44 px + gating). Fan-out S-A/S-B à lancer.
- **2026-07-05** — **U1 livré.** Fan-out Sonnet parallèle : S-A (caméra
  généralisée `{minZoom,maxZoom}` + `setEnabled` ; plateau de combat dans
  `camera.world` avec plancher `MIN_COMBAT_SCALE ≈ 0,706` ; `main.ts` désactive
  la caméra d'aventure en combat) et S-B (retrait de l'overlay `LandscapeHint` +
  CSS + 2 clés locales ; A6 : onglets ville `flex-wrap`). doc 08 §2.4 mise à
  jour (portrait jouable, plus de nag). **Re-capture ux-audit** (build de prod) :
  **A7 corrigé** (hexes de combat mobile larges ≥ 44 px, plateau pannable, plus
  d'overlay rotation), **A6 corrigé** (onglets sur 2 lignes en mobile × font3,
  aucune troncature), A1 = 0 cible DOM < 44 px. Vérif verte : typecheck 4/4,
  eslint, 233 tests, content:check, build (~223 Ko gzip), **48 smoke**
  (le combat `/#arena` + gardien exerce la nouvelle caméra). Aucun code moteur
  → golden intact. **Reporté (mineur, documenté)** : clamp de pan (parité carte,
  plateau démarre centré) ; re-fit sur resize réinitialise le pan (rare).
  **Prochain : U3 (feedback + journal) / U4 / U6.**
