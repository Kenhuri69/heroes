# Lot R3 — Le HUD d'aventure se range (H3, H6, H7, U7)

> Plan vivant (guidelines §5). Source : `.claude/plans/game-review-remediation-plan.md`
> §6 « Lot R3 » + constats H3 / H6 / H7 / U7 (§2 et §3 du même document).
> Périmètre : **client + données (locales) + docs uniquement** — zéro diff
> `packages/engine`, pas de bump `CURRENT_SAVE_VERSION`, golden inchangé.

## 0. Base de branche — écart constaté

La consigne demandait de partir de `origin/claude/r0-plus-jamais-en-silence`.
Vérification faite au démarrage : **R0 est déjà mergé dans `main`**
(`git merge-base --is-ancestor origin/claude/r0-plus-jamais-en-silence origin/main`
⇒ vrai, PR #519 = commit `f9c960cd`). `origin/main` est donc un **sur-ensemble**
de R0 (il contient aussi R7, PR #518). Décision : brancher sur `origin/main`
pour ne rien défaire de R0 **ni** de R7. Contrôle de non-régression R0 exigé en
fin de lot (toasts `ReorderArmy` / `SplitStack`, `AiFailureNotice`,
`end-turn.test.ts`, `dispatch.test.ts`).

## 1. État AVANT (mesures à relever)

Cibles de code :

| Constat | Fichier:ligne |
|---|---|
| H3 | `packages/client/src/ui/shell.tsx:1358-1434` (`.actions`) · `styles.css:167-175` (`.actions`, pas de `background`, `flex-wrap: wrap`) · `:148-154` (`.turn-row`) · `:138-146` (`.bottom-hud`, `pointer-events:none`) |
| H6 | `styles.css:985-993` (`.resource-bar` ≤ 640 px : `nowrap` + `overflow-x:auto`, **sans affordance de bord**) |
| H7 | `shell.tsx:1411-1413` (`towns.map(...)` — un bouton par ville, sans plafond) |
| U7 | `shell.tsx:1359` (MuteToggle) · `:1360-1367` (options) · `:1368-1377` (kingdom) · `:1380-1392` (next-hero) · `:1393-1407` (journal) — `<UiIcon>` seul |

Mesures avant (Playwright, build de prod, à remplir) :

- [x] `.actions` : `backgroundColor`, hauteur, nombre de rangées (360×640, crans 1/2/3)
- [x] `.resource-bar` : `scrollWidth - clientWidth`, `maskImage`, position de la 7ᵉ ressource
- [x] Capture desktop 1280×800 : les 5 boutons icône-seule ont `textContent === ''`

## 2. Étapes & critères de vérification (chiffrés = assertions)

### Étape A — H3 : un vrai panneau de barre d'actions

- Fond **opaque** sur le conteneur `.actions` (token `--veil-95`), pas sur chaque
  bouton ; `pointer-events: auto` sur le panneau (le parent `.bottom-hud` est en
  `pointer-events: none`).
- **Rangée unique** en portrait : `flex-wrap: nowrap`. `.turn-row` passe en
  colonne ≤ 640 px pour que le panneau prenne toute la largeur (aujourd'hui la
  `.status-bar` lui vole la moitié gauche).
- **Séparation** des trois niveaux : statut (`.status-bar`, hors panneau, au
  dessus) │ navigation (`.action-nav`) │ action principale (`.end-turn`), les
  deux derniers séparés par un filet `.action-sep`.
- Le groupe navigation défile horizontalement s'il déborde (patron déjà livré
  file d'initiative / barre de ressources) ; « Fin de tour » n'est **jamais**
  poussé hors écran.

**Vérif chiffrée** (smoke `@mobile`, `setViewportSize({width:360,height:640})`, crans 1/2/3) :
- (a) `getComputedStyle('.actions').backgroundColor` a **alpha ≥ 0.85** ;
- (b) chaque `button` de `.actions` a son rect **inclus** dans le rect de
  `.actions` (± 1 px sur les 4 côtés) ⇒ 0 bouton sur du terrain nu ;
- (c) `.actions` tient sur **une** rangée : `height ≤ 64` px ;
- (d) non-régression A1 : chaque bouton `min-height ≥ 44 && min-width ≥ 44`.

### Étape B — H6 : affordance de bord de la barre de ressources

Le défilement **existe déjà** (`styles.css:985-993`) ; il manque l'affordance.
**Option retenue : A (fondu de bord)**, pas B (retour à la ligne).
Justification chiffrée : 7 ressources × 44 px (min-width A1) + 6 × 8 px de gap +
2 × 52 px de padding = **460 px > 360 px** ⇒ le `wrap` coûterait une 2ᵉ rangée
(+44 px) au cran 1 et une 3ᵉ au cran 3, c'est-à-dire l'exact inverse du lot
M5/C10 qui a mis cette barre sur une rangée. La « leçon R4 » (un fondu rogne
toujours une entrée) est neutralisée ici par le **padding droit de 52 px déjà
présent** dans le scroller : au défilement maximal la dernière ressource s'arrête
52 px avant le bord, très au-delà des 22 px de fondu.

**Vérif chiffrée** (smoke `@mobile` 360×640, crans 1/2/3) :
- si `bar.scrollWidth > bar.clientWidth` alors `maskImage !== 'none'` ;
- après `bar.scrollLeft = bar.scrollWidth`, la **dernière** `.resource` a
  `right ≤ bar.right + 1` ⇒ aucune ressource coupée ;
- `min-height`/`min-width` des `.resource` restent ≥ 44.

### Étape C — H7 : plafonner les boutons de ville

Au-delà de **2** villes possédées : un bouton unique « Villes (N) » ouvrant
l'écran Royaume (`openModal({ kind: 'kingdom' })`). Le `data-testid`
`town-open-<id>` est **conservé** tant qu'il y a ≤ 2 villes (le smoke de ville
existant et celui de R2 s'appuient dessus).

**Vérif chiffrée** : test **unitaire client** (vitest) sur le helper pur de
répartition — 1 ville ⇒ 1 bouton `town-open-*` ; 2 ⇒ 2 ; 5 ⇒ 0 + 1 agrégé
portant « 5 ». Complément smoke `@mobile` : `.actions` height ≤ 64.

### Étape D — U7 : libellés desktop

Un `<span class="action-label">` à côté de l'icône des 5 boutons icône-seule ;
masqué sous **900 px** (seuil déjà utilisé par `styles.css:960`). Pas de nouveau
`matchMedia` (R1 a créé le seul du client). `aria-label` conservés, badges
`next-hero-badge` / `journal-badge` restent positionnés.

**Vérif chiffrée** :
- smoke desktop 1280×800 : les 5 boutons ont `textContent.trim().length > 0`
  **et** conservent leur `aria-label` ;
- smoke `@mobile` 360×640, 3 crans : les 5 boutons ont `textContent.trim() === ''`
  et `.actions` height ≤ 64 (le gain desktop ne coûte rien en portrait).

### Étape E — docs & pipeline

- `docs/08-ui-ux.md` : HUD carte d'aventure (panneau d'actions, 3 niveaux),
  barre de ressources (fondu de bord), navigation (plafond des villes, libellés
  ≥ 900 px) — **même commit**.
- Locales FR/EN : parité stricte.
- Pipeline 9 étapes vert.

## 3. Journal d'exécution

- [x] Plan écrit, commit + push initial.
- [x] Mesures AVANT relevées.
- [x] Étape A implémentée + vérifiée.
- [x] Étape B implémentée + vérifiée.
- [x] Étape C implémentée + vérifiée.
- [x] Étape D implémentée + vérifiée.
- [x] Docs mises à jour.
- [x] Captures avant/après inspectées.
- [x] Pipeline 9/9.
- [x] Non-régression R0 contrôlée.
