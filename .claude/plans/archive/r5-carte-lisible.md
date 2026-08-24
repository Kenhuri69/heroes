# Lot R5 — La carte redevient lisible (U2, U3, U4)

> Plan vivant (guidelines §5). Source : `.claude/plans/game-review-remediation-plan.md`
> §6 « Lot R5 » + constats **U2**, **U3**, **U4** (§3).
>
> **Périmètre** : client (rendu Pixi + CSS) + docs. **Zéro diff `packages/engine`**,
> pas de bump `CURRENT_SAVE_VERSION`, golden inchangé, aucun id de faction dans
> `packages/`.
>
> **Base de branche** : `origin/main` = `8492b59` (R3 mergé, PR #523). **Dernier
> lot** du plan de remédiation (R0, R1, R2, R3, R4, R6, R7 livrés).

## 0. État de référence mesuré (AVANT)

Build de prod servi par `vite preview`, partie `?seed=42`, mesures via le hook
`tileToScreen` et lecture du code de rendu.

| Id | Mesure |
|---|---|
| **U3** | Un losange de tuile mesure **64 × 32** (`ISO_TILE_W/H`), mais les sprites sont mis à l'échelle sur `max(w, h)` d'une boîte **carrée** : objets/gardiens **64 px** = **2 rangées** de tuiles, héros **80 px** = **2,5 rangées** (`AdventureScene`, ×1,25), ville **86 px** = **2,7 rangées** (`townsLayer`, ×1,35). |
| **U3 (zoom)** | `INITIAL_ADVENTURE_ZOOM = 1,6` ⇒ tuile projetée **102 × 51 px**. En portrait 360×640 : **7 demi-largeurs** de tuile visibles seulement — la carte se réduit à une poignée de cases largement recouvertes par les jetons. |
| **U2** | Tiroir héros : `background: var(--veil-95)` = `rgba(16,18,24,.95)` — **translucide**, la carte et le HUD restent lisibles au travers ; `width: min(80vw, 280px)` ⇒ il ne couvre **pas toute la largeur** en portrait, le HUD déborde à droite. |
| **U4** | Le marqueur de ville n'est peint que si `assets/map/town-<factionId>` existe (6 factions l'ont). Sinon — faction sans art, ou pendant le chargement async — c'est un **repli procédural** (créneaux pleins + liseré doré si la ville est assiégeable) au milieu d'objets peints. |

## 1. Décisions de rendu (⇒ `docs/08-ui-ux.md` §2.1)

1. **L'échelle des jetons se calcule sur le losange, pas sur un carré.** Un helper
   partagé `isoTokenScale(texture, rows, cols)` (dans `render/projection.ts`, à
   côté des constantes du losange) borne **la hauteur** à `rows × ISO_TILE_H` ET
   **la largeur** à `cols × ISO_TILE_W`, en préservant le ratio. Allocations :
   **1,5 rangée** pour les objets, gardiens et le héros ; **2 rangées** pour la
   ville, seul point de repère majeur de la carte. Ancrage au pied inchangé.
2. **Zoom initial adapté au viewport.** `1,6` reste bon en desktop ; en portrait
   étroit il ne laisse plus rien voir. Le zoom initial garantit désormais un
   **champ minimal** en tuiles : on prend le plus petit zoom entre 1,6 et celui
   qui fait tenir la largeur visée. Le joueur reste libre de zoomer/dézoomer.
3. **Tiroir héros opaque et pleine largeur en portrait.** Fond `--ink-800` opaque
   (plus de `--veil-95`), largeur **100 %** sous 640 px : rien du dessous ne
   transparaît, le HUD ne déborde plus sur le côté.
4. **Marqueur de ville : chaîne de replis peinte.** `map/town-<faction>` (art
   dédié) → **vignette de bâtiment** `buildings/<faction|core>/townHall` (existe
   pour toutes les factions) → repli procédural. Le liseré doré « assiégeable »
   est **conservé** (2ᵉ canal a11y) mais épouse le losange au lieu d'un carré.

## 2. Étapes & critères de vérification

- [x] **R5.1** — échelle des jetons calée sur le losange (U3).
      → *vérif* : mesure — la hauteur écran de chaque jeton (objet, héros, ville)
      est ≤ `rows × ISO_TILE_H × zoom` ; capture — la ville sous le héros reste
      identifiable.
- [x] **R5.2** — zoom initial utile en portrait (U3).
      → *vérif* : mesure avant/après du nombre de tuiles visibles en portrait.
- [x] **R5.3** — tiroir héros opaque et pleine largeur (U2).
      → *vérif* : mesure — `background-color` **opaque** (alpha 1) et largeur =
      largeur du viewport en portrait ; capture cran 3.
- [x] **R5.4** — marqueur de ville peint avec repli de vignette (U4).
      → *vérif* : test — la chaîne de replis rend une image pour une faction sans
      art de carte ; capture d'une carte de scénario.
- [x] **R5.5** — doc 08 §2.1 alignée (docs = source de vérité).
- [x] **R5.6** — pipeline complet : `typecheck`, `lint`, `test`, `content:check`,
      garde-fous CI, `build` (budget), smoke, audit `ux-audit`.

## 3. Journal / écarts constatés

- **U2 : le vrai coupable était le fondu, pas seulement le fond.** Une fois le
  panneau rendu opaque et pleine largeur, « Fin de tour » restait lisible dans le
  bas du tiroir. Diagnostic : le **fondu bas du lot X6** est un `mask-image`,
  c'est-à-dire un **masque alpha** — il rend la zone fondue littéralement
  transparente, HUD compris. Remplacé par un **dégradé peint dans l'encre du
  tiroir** (`::after` en `position: fixed`, dont le bloc conteneur est le tiroir
  lui-même puisqu'il porte un `transform`) : même signal « le contenu continue »,
  zéro transparence. Le smoke assère donc **aussi** l'absence de masque.
- **`width: 100%` ne suffisait pas** : sans `box-sizing: border-box`, le padding
  latéral portait le tiroir à **388 px** pour un viewport de 360.
- **Zoom : une règle, pas un point de rupture.** Plutôt qu'un « 1,0 en mobile,
  1,6 en desktop », le zoom initial est **plafonné par ce que le viewport peut
  afficher** (`MIN_VISIBLE_TILES_ACROSS = 11`, pas horizontal `ISO_TILE_W / 2`).
  Desktop 1280 px : plafond 3,6 ⇒ **1,6 inchangé**. Portrait 360 px : **1,02**.
  La règle vaut pour toutes les tailles d'écran, y compris celles non testées.
- **U4 était double.** Le repli procédural (créneaux) n'était que la moitié du
  « glyphe gris encadré jaune » : l'autre moitié est le **liseré carré de 48 px**
  d'« assiégeable », posé de travers sur une grille iso. Corrigé aussi (il épouse
  désormais le losange). Le repli passe par la **vignette d'hôtel de ville**, que
  toutes les factions possèdent via le paquet core — aucun id de faction en dur,
  les deux URLs sortent du registre d'assets.
- **Repli procédural du HÉROS laissé tel quel** (hors périmètre) : à défaut d'art
  `map/hero-<faction>`, le jeton reste le blason dessiné. Les 6 factions livrées
  ont leur art ; seule la faction de test (chemin dev `?seed=42`) montre le repli.
- **Niveau de test choisi** (skill `test-authoring`) : `isoTokenScale` est une
  **fonction pure** ⇒ 5 cas unitaires client (`render/projection.test.ts`), y
  compris la contre-épreuve « plus petit que l'ancienne boîte carrée ». Le champ
  de vision et le tiroir sont observables en **DOM/hook** ⇒ un seul test smoke
  (`@core @mobile`). La **hauteur des jetons à l'écran** n'est pas assérée : elle
  vit dans le canvas Pixi et exigerait un nouveau hook de test — la règle qui la
  produit est couverte unitairement, son effet est vérifié en capture.

## 4. Bilan

Livré. **Dernier lot du plan de remédiation** — R0, R1, R2, R3, R4, R5, R6, R7 sont
tous livrés.

| Vérification | Résultat |
|---|---|
| `pnpm typecheck` / `pnpm lint` | ✅ |
| `pnpm test` (moteur + contenu) | ✅ 935 tests |
| Tests unitaires client | ✅ 74 tests (+5 pour R5) |
| `pnpm content:check` | ✅ 7 paquets, 2 cartes, 16 scénarios |
| Garde-fous CI (faction, couleurs) | ✅ |
| `pnpm build` + budget bundle | ✅ **355 Ko gzip** / 800 |
| Smoke Playwright | ✅ (desktop + mobile) |
| Audit `ux-audit` (96 captures) | ✅ 0 warning A1, 0 échec |

### Avant / après mesurés

| | Avant | Après |
|---|---|---|
| Hauteur d'un jeton d'objet/gardien | 64 px = **2 rangées** de tuiles | 48 px = **1,5** |
| Hauteur du jeton de héros | 80 px = **2,5 rangées** | 48 px = **1,5** |
| Hauteur du donjon de ville | 86 px = **2,7 rangées** | 64 px = **2** |
| Zoom initial en portrait 360 px | 1,6 ⇒ **7 tuiles** de large | 1,02 ⇒ **11 tuiles** |
| Zoom initial en desktop 1280 px | 1,6 ⇒ 25 tuiles | **inchangé** |
| Tiroir héros | `rgba(…,.95)` + fondu par masque alpha | **opaque**, fondu peint |
| Largeur du tiroir en portrait | `min(80vw, 280px)` = 280 px | **360 px** (plein écran) |
| Marqueur de ville sans art dédié | créneaux dessinés + carré jaune | **vignette peinte** + losange doré |
