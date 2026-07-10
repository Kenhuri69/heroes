# Audit UX — Accueil (menu) & Écran de ville (2026-07-09)

> Passe `ux-audit` outillée (skill) sur le **build de prod** (`vite preview`),
> **menu** + **ville**, aux 2 viewports (desktop 1280×800, mobile 360×640) et
> aux **3 crans de police**. 12 captures de référence dans
> `scratchpad/ux-captures/` (`{menu,town}-{desktop,mobile}-font{1,2,3}.png`).
> Source de vérité : `docs/08-ui-ux.md`. **Passe d'audit = constats, pas de
> correctifs** (guideline skill).

## Résultat A1 (cibles < 44 px, mesures DOM)

- **Menu : 0 cible < 44 px** aux 6 combinaisons. ✅
- **Ville** : seul échec réel = boutons de **ressources rares** ; le reste des
  « warnings » sont des **faux positifs** de l'outil (voir V-2).

## Constats priorisés

### V-1 — A1, **MEDIUM** — boutons ressources rares < 44 px de large
- **Écran/vp/cran** : ville (et hero/adventure — surface partagée) ; desktop
  **37–39 px**, mobile **36–38 px** de large ; hauteur 44 OK. Tous crans.
- **Cibles** : `resource-open-{crystal,gems,sulfur,mercury}` (valeur « 0 » à un
  chiffre ⇒ bouton étroit ; les 4 communes à gros nombres passent).
- **Cause** : `.resource` a `min-height: 44px` mais **pas de `min-width`**
  (`packages/client/src/ui/styles.css:24`).
- **Fix candidat** (hors passe) : `min-width: 44px` sur `.resource` (ou `44px`
  de zone tactile), à revérifier au cran 3 mobile (débordement de la barre).

### V-2 — Outillage, **INFO** — faux positifs A1 sur la ville
- Le sélecteur d'audit `[data-testid^="town-build-"]` (`capture.mjs:72`) capte
  des **éléments d'affichage non-interactifs** : `town-build-queue` (div bandeau),
  `town-build-queue-state` (span), `town-build-time-*` (spans « Chantier : 1 j »).
  → gonfle le compte de warnings ville (11–13) alors que les vrais boutons
  `town-build-<id>` sont ≥ 44 px.
- **Fix candidat** : restreindre aux vrais boutons (`button[data-testid^="town-build-"]`,
  hors `-time`/`-queue`).

### M-1 — A5, **LOW** — état désactivé de « Continuer »
- Menu (desktop + mobile) : « Continuer » désactivé est distingué par
  **opacité/gris** et **absence de panneau** (les actifs ont un panneau) ⇒ il lit
  comme un **intitulé de section** plutôt qu'un bouton indisponible. Second canal
  faible. `packages/client/src/ui/MenuScreen.tsx:71-75`.
- Piste : libellé/état explicite (« Aucune partie » / cadenas) ou garder le
  panneau grisé pour signer « bouton, mais inactif ».

### V-3 — A6, **LOW** — séparateur orphelin (ville mobile cran 3)
- Le « · » du sous-en-tête revenu/croissance se retrouve **seul en fin de ligne**
  au retour à la ligne (cosmétique ; déjà `aria-hidden`).
  `packages/client/src/ui/TownScreen.tsx:123` (`town-subheader-sep`).
- Piste : `white-space: nowrap` sur chaque segment, ou masquer le séparateur
  quand ça passe à la ligne.

### V-4 — A5, **LOW** — pastille « disponible » ≈ spinner
- Bande de plan de ville : la pastille **anneau pointillé** (statut « disponible »,
  UXD-5) ressemble à un **spinner de chargement**. Lisible (doublée du libellé
  « Disponible » dans les cartes) mais ambiguë au premier coup d'œil.

### C-1 — Outillage, **INFO** (hors périmètre demandé) — combat mobile non shooté
- `capture.mjs` échoue (`FAIL combat-mobile-font*`, timeout du `waitFor` du
  testid combat) : l'écran combat mobile n'entre pas dans la référence. Sans
  impact sur menu/ville ; à corriger si on étend l'audit au combat.

## Points positifs (à préserver)
- **Menu** : DA aboutie (fond peint + logo + voile), scaling 3 crans propre,
  0 cible < 44 px, i18n OK.
- **Ville** : plan de construction à **2ᵉ canal** (forme de pastille + libellé
  Disponible/Construit, A5) ; **tabs icônisés** ; **poupée d'équipement typée**
  (UXD-5b) visible dans le rail droit ; scaling propre (en-tête qui wrappe,
  bande à défilement horizontal) ; temps de chantier en **jours** (B1).

## Suites possibles (au choix utilisateur)
1. **V-1** (fix A1, ~1 ligne CSS + revérif cran 3 mobile) — le seul vrai bug.
2. **V-2** (affiner `capture.mjs`) — fiabilise les prochaines passes.
3. M-1/V-3/V-4 = polish optionnel.
