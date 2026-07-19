# Plan — U2 : Routeur d'écrans (chantier UX §5.3, étape 2)

> Lot U2 du chantier UX (plan de remédiation §5). Cause racine de CL1/CL2 :
> aujourd'hui menu ⇄ carte ⇄ combat sont des bascules ad hoc réparties entre
> `store.ts` (`screen: 'menu'|'game'`), des dérivations (`game.started`,
> `game.combat !== null`), `townScreenOpen` et un `useState(optionsOpen)` local
> à `shell.tsx`. Le cycle de vie Pixi est recollé à la main dans
> `main.ts` (`ensureScenes` sur `appStore.subscribe`). Prérequis à tout écran
> futur (ville peinte, fiche héros plein écran, journal, multi-héros).

## 1. Objectif & critères de succès

- **Source unique de vérité de navigation** : un routeur typé remplace les
  drapeaux dispersés. `shell.tsx` (DOM) ET `main.ts` (scènes Pixi) lisent la
  même route.
- **Pile de modales explicite** (doc 08 §3) : ≤ 2 niveaux, bouton retour
  Android / geste ferme la modale du dessus (aujourd'hui : 2 handlers Échap
  concurrents, pas de pile réelle — cf. R7c).
- **Zéro régression** : parcours menu → partie → combat → menu, ville, options,
  montée de niveau, victoire/défaite — tous couverts par le smoke étendu.
- **Invariants** : moteur pur intact (aucun changement moteur attendu ; la
  route est un état CLIENT), budget bundle < 800 Ko, cibles ≥ 44 px, golden
  stable (`be72de4b`).

Vérif de succès : `pnpm typecheck` (4/4) + lint + test + content:check + build
+ smoke (desktop + mobile) verts ; audit `ux-audit` A4 (pile ≤ 2) revérifié.

## 2. Décision d'architecture (cadrage utilisateur AVANT code)

Fork réel qui contraint U3/U4/U6 → posé via AskUserQuestion :

1. **Modèle du routeur** : (A) enum minimal `route: menu|adventure|combat` +
   modales restant des drapeaux ; (B) **route de base + pile de modales typée**
   (`ModalRoute[]` : town/hero/options/journal…) avec push/pop + bouton retour
   Android (doc 08 §3) ; (C) routeur à historique + sync hash d'URL.
   → **Recommandation B** : implémente directement la pile de modales du doc 08
   §3 et prépare les écrans U3/U4/U6 (journal, fiche héros, marché/guilde) sans
   re-refactor.
2. **Scène de combat** : (a) rester **dérivée de l'état moteur**
   (`game.combat !== null` ⇒ route combat automatique) ; (b) navigation
   explicite. → **Recommandation a** : le combat naît d'une commande moteur
   (interception de gardien, `StartCombat`) ; le dériver garantit la cohérence
   avec l'auto-combat et le déterminisme (pas de désync route/état).

**Décision (2026-07-05)** : cadrage AskUserQuestion interrompu (canal fermé) ;
l'utilisateur a demandé de continuer → on retient les **recommandations** :
**1-B** (route de base + pile de modales typée, plafond 2, bouton retour) et
**2-a** (combat dérivé de `game.combat`). Justifs ci-dessus.

**Contrat figé (S1, `app/router.ts`)** :
- `type Screen = 'menu' | 'adventure'` (combat = dérivé de `game.combat`, non
  stocké) ; `type Modal = { kind: 'town'; townId } | { kind: 'options' }`
  (seules les 2 modales existantes ; les overlays FORCÉS non annulables —
  `SkillChoice`, `OutcomeOverlay` — restent dérivés de l'état moteur, HORS pile).
- Réducteurs purs `pushModal`/`popModal` (plafond `MAX_MODAL_DEPTH = 2`, un même
  `kind` ne s'empile pas). API `navigate`/`openModal`/`closeModal`/
  `closeModalKind`/`back`. Sélecteurs `useScreen`/`useModals`/`useTopModal`.
- Store : `screen: 'menu'|'adventure'` + `modals: Modal[]` (retire
  `townScreenOpen`). `back()` ⇒ Échap (shell) + `popstate` (retour Android).
- Pas de test unitaire client (pas de runner client en CI, cf. R6 différé) →
  **couverture par le smoke** (S4) : menu↔partie, pile ≤ 2, Échap ferme le
  dessus.

## 3. Découpage en sous-tâches (fan-out Sonnet)

Interfaces figées par le pilote AVANT fan-out (le module `router` est le
contrat partagé). Sous-tâches indépendantes une fois le contrat figé :

- **S1 — Module routeur (client, app/router.ts)** : type `Route` + `ModalRoute`,
  état dans le store (remplace `screen`/`townScreenOpen`), API
  `navigate`/`openModal`/`closeModal`/`back`, dérivation de la route de combat.
  Hook `useRoute`. + tests unitaires purs du réducteur de navigation.
- **S2 — Intégration scènes Pixi (main.ts)** : `ensureScenes` piloté par la
  route au lieu des drapeaux ; `teardownScenes` au retour menu. Conserve le
  cycle de vie CL1/CL2.
- **S3 — Câblage UI (shell.tsx + modales)** : `shell.tsx` consomme `useRoute` ;
  `OptionsPanel`/`TownScreen`/tiroirs passent par `openModal`/`closeModal` ;
  bouton retour matériel (`popstate`/Échap) → `back()` sur la pile.
- **S4 — Smoke + doc 08** : étend `smoke.spec.ts` (retour menu, pile de modales
  ≤ 2, back ferme le dessus) ; met à jour `docs/08-ui-ux.md` §3 (routeur + pile)
  dans le même commit.

S1 est le contrat : figé et livré par le pilote (ou 1 sous-agent) d'abord ;
S2/S3 en parallèle ensuite (fichiers disjoints main.ts vs ui/) ; S4 après
intégration.

## 4. Journal
- **2026-07-05** — Création du plan. Décision d'archi en attente de cadrage
  utilisateur (§2). Rien codé.
- **2026-07-05** — **U2 livré.** Contrat `app/router.ts` + migration
  `store.ts`/`save.ts`/`main.ts` (pilote), câblage DOM `ui/*` délégué à un
  sous-agent Sonnet (S3 : shell/TownScreen/OptionsPanel/MenuScreen/
  OutcomeOverlay, suppression de `useEscapeKey`). `screen: 'menu'|'game'` +
  `townScreenOpen` + `optionsOpen` locaux → route de base + pile de modales
  typée ; combat dérivé de `game.combat`. Handler global de retour (Échap +
  `popstate` Android) remplace les 2 `useEscapeKey` concurrents (mineur R7c
  résorbé). doc 08 §3 mis à jour (routeur + pile). Smoke +2 tests (×2 projets)
  : Échap ferme la modale en partie ; options du menu passent par la pile.
  Vérif verte : typecheck 4/4, lint (`eslint .`), 233 tests moteur + content,
  content:check, build (JS ~223 Ko gzip < 800), **48 smoke** (desktop+mobile,
  `PW_CHROMIUM_PATH` sur le Chromium préinstallé 1194). Golden non touché
  (aucun code moteur). **Prochain : U1 (combat mobile, CL7/A7) + correctif A6.**
