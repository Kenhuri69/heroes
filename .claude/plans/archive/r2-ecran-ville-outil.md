# Lot R2 — L'écran de ville redevient un outil (H1, H2, U8)

> Plan vivant (guidelines §5). Source : `.claude/plans/game-review-remediation-plan.md`
> §6 « Lot R2 » + constats **H1** / **H2** (§2) et **U8** (§3).
>
> **Périmètre** : client + locales + **ancres de layout** (`assets/layouts/`,
> données) + docs. **Zéro diff `packages/engine`**, pas de bump
> `CURRENT_SAVE_VERSION`, golden inchangé, aucun id de faction dans `packages/`.
>
> **Base de branche** : `origin/main` = `a5955a3` (R0, R1, R4, R6, R7 mergés).
> Ordre de la vague 2 du plan de remédiation : R2 puis R3.

## 0. État de référence mesuré (AVANT)

Build de prod (`pnpm build` → 187,85 Ko gzip index + 164,94 pixi + 12,18 css)
servi par `vite preview`, captures via le skill `ux-audit`.

**Correctif d'outillage préalable** : `capture.mjs` échouait depuis le lot R4
(`FAIL adventure-real-*`, `FAIL handoff-*` ⇒ `SKIP town-real-*`) — les sections
« Carte & contenu » / « Adversaires » de `NewGameScreen` sont désormais
**repliées par défaut** et leur état **persiste en `localStorage`**, donc un clic
aveugle rouvrait *ou refermait* la section selon le flux déjà joué. Ajout d'un
helper **idempotent** `expandSection()` (lit `aria-expanded`). Après correctif :
**0 étape en échec, 0 warning A1** sur les 96 captures. Sans lui, l'écran de
ville **Haven réel** — le sujet même du lot — n'était pas capturable.

Constats confirmés sur `town-real-desktop-font1.png` / `town-real-mobile-font1.png` :

| Id | Mesure / observation |
|---|---|
| H1 | Desktop 1280×800 : le panorama occupe **270 px** de la modale ; sous la rangée d'onglets il ne reste qu'**1,5 fiche** de bâtiment. Mobile 360×640 : l'en-tête prend **3 lignes**, la 1ʳᵉ fiche de bâtiment (« Forge ») est **coupée par le bas du viewport**. |
| H2 | Les 18 emplacements sont des **anneaux blancs / carrés sombres / triangles beiges** de 12 px ; la vignette du bâtiment est soit noyée dans le décor, soit — pour les verrouillés (`opacity .4` + `grayscale(1)`) — réduite à une **tache sombre illisible**. Aucun nom n'est visible sans survol/appui long. |
| U8 | L'état du chantier s'affiche dans **tous** les onglets ; « Occupé » est rendu en `--blood-bright` (rouge d'erreur) alors que c'est un état **normal** du jeu. |

## 1. Décisions d'interaction (⇒ `docs/08-ui-ux.md` §2.2)

1. **Le panorama est un décor, la liste est l'outil.** Le panorama devient une
   **section repliable** (`SectionToggle`, même composant que le tiroir héros et
   « Nouvelle partie »), état persisté en `localStorage`
   (`heroes.section.town.view`), **replié par défaut en portrait étroit**
   (≤ 640 px) et déplié ailleurs. Aucun contenu n'est perdu : replié, la rangée
   d'onglets — donc le premier contrôle utile — remonte au-dessus du pli.
2. **Aucun marqueur anonyme.** Chaque emplacement porte (a) la **vignette** du
   bâtiment sur une plaque sombre (lisible sur un décor chargé), (b) son **nom
   localisé** en libellé permanent sous la vignette, (c) un **glyphe de statut**
   (`✓` construit / `＋` disponible / `✕` verrouillé) *en plus* de la forme de
   pastille déjà livrée. Le verrouillé reste estompé mais **reste identifiable**
   (`opacity .4 → .72`, `grayscale(1) → .8`). En **portrait étroit** le libellé
   permanent est masqué (il ne tient pas) : le nom y reste au tap/appui long et
   dans la liste de l'onglet Construire, que le point 1 remonte au-dessus du pli.
3. **En-tête condensé.** Revenu et croissance passent en **forme courte** en
   portrait (`town.incomeGoldShort` / `town.growthInShort`) pour tenir sur une
   ligne ; l'état du **chantier du jour quitte l'en-tête** et n'apparaît plus que
   dans l'onglet **Construire**, où il conditionne l'action.
4. **« Occupé » n'est pas une erreur.** Le badge perd le rouge (`--blood-bright`)
   au profit d'un ton neutre (`--parchment-dim`) et gagne un **glyphe** (`✓`
   fait / `✦` libre) — 2ᵉ canal non chromatique (doc 08 §4).

## 2. Étapes & critères de vérification

- [x] **R2.0** — réparer `capture.mjs` (helper idempotent `expandSection`).
      → *vérif* : run complet `ux-audit` = **0 échec**, `town-real-*` capturé.
- [x] **R2.1** — emplacements identifiables (H2) : plaque + nom + glyphe de statut.
      → *vérif* : capture — aucun marqueur anonyme ; smoke — chaque emplacement
      expose son nom en texte DOM (`town-view-name`) et son statut en
      `data-status` (A5 : 2ᵉ canal).
- [x] **R2.2** — panorama repliable et mémorisé (H1).
      → *vérif* : smoke `@mobile` — à l'ouverture de la ville, le haut de la
      rangée d'onglets est **au-dessus du pli** (`top < innerHeight`) ; la
      préférence persiste après réouverture.
- [x] **R2.3** — en-tête condensé + chantier dans Construire + « Occupé » neutre
      (H1, U8).
      → *vérif* : capture mobile — en-tête sur **une ligne** au cran 1 ; smoke —
      le badge de chantier est absent hors onglet Construire.
- [x] **R2.4** — doc 08 §2.2 alignée (docs = source de vérité).
- [x] **R2.5** — pipeline complet : `typecheck`, `lint`, `test`, `build` (budget),
      garde-fous CI, smoke.

## 3. Journal / écarts constatés

- **R2.0** : cause racine plus subtile que « sélecteur périmé » — l'état replié
  **persiste**, donc le flux `handoff` (joué après `real`) retrouvait la section
  déjà ouverte et la refermait. Un clic conditionnel sur `aria-expanded` est la
  seule forme correcte.
- **R2.1 — revirement assumé.** Le libellé permanent avait été **retiré** au lot
  UX-TOWNVIEW 2 (doc 08 : « ils encombraient le décor à 13-20 bâtiments »). Il
  est réintroduit parce que le critère du plan de remédiation se vérifie *sur
  capture* (« aucun marqueur anonyme ») et que la parité tactile (doc 08 §1.1)
  interdit une info exclusive au survol. **La cause réelle de l'encombrement
  n'était pas le libellé mais l'espacement des ancres** : 3 rangées à ~13 %
  d'écart (≈ 35 px pour un marqueur de 60 px) et, sur Haven, deux ancres à
  **2,2 %** l'une de l'autre (x = 63 et 65,2 ⇒ 12 px : deux bâtiments
  littéralement superposés). Corrigé en **données** : les 6 fichiers
  `assets/layouts/town-<faction>.json` sont ré-étalés (rangées 30/56/82, pas
  horizontal constant par rangée), la vignette passe de 56 à **44 px** (cible
  tactile inchangée : `min-height` du bouton), le débordement au-delà des ancres
  reçoit sa **rangée haute** propre (`spillSlot`) et `bandSlot` garantit un écart
  vertical minimal. **Mesure DOM après : 0 chevauchement** (Haven 18, Vox Arcana
  22, Necropolis 16) — contre 1 à 2 avant ces correctifs.
- **R2.2** : réutilisation de `useCollapsed`/`SectionToggle` (aucun nouveau
  mécanisme de persistance). Le seuil « portrait étroit » est le **même** que
  celui du combat (lot R1) : le hook local de `combat.tsx` est **extrait** en
  `ui/useNarrowViewport.ts` et partagé, plutôt que dupliqué (dette R7).
- **R2.3** : les formes courtes sont de **nouvelles clés** (FR + EN) plutôt qu'un
  raccourcissement des existantes — le desktop garde ses libellés complets.
- **Faux positif de test** : sur mobile, changer d'onglet **après** avoir déplié
  le panorama fait parfois échouer le clic Playwright (défilement + rangée
  d'onglets `sticky` ⇒ point de clic périmé, la modale se ferme). Reproduit **à
  la main** (tap réel aux coordonnées du bouton) : le produit se comporte
  correctement, la modale reste ouverte et l'onglet change. Le smoke vérifie donc
  le changement d'onglet **avant** le dépliage, quand la modale est compacte.
- **Hors périmètre R2** (constats voisins non traités, notés pour R3/R5) : la
  barre de ressources tronquée (H6), les jetons de carte à deux tuiles (U3), le
  tiroir héros translucide (U2).

## 4. Bilan

Livré. Vérifications finales au §5 du journal de commit :

| Vérification | Résultat |
|---|---|
| `pnpm typecheck` | ✅ |
| `pnpm lint` | ✅ |
| `pnpm test` (moteur + contenu) | ✅ 935 tests |
| Garde-fou « zéro faction dans `packages/` » | ✅ |
| `pnpm content:check` | ✅ 7 paquets, 2 cartes, 16 scénarios |
| Garde-fou « couleurs en dur hors tokens.css » | ✅ |
| `pnpm build` + budget bundle | ✅ **355 Ko gzip** / 800 (187 index + 164 pixi + 12 css) |
| Smoke Playwright (desktop + mobile) | ✅ **138 tests** |
| Audit `ux-audit` (96 captures) | ✅ 0 warning A1, 0 échec |
| Chevauchement de libellés (mesure DOM, desktop) | ✅ **0** sur Haven (18), Vox Arcana (22), Necropolis (16) |

### Avant / après mesurés (mobile 360×640, ville Haven réelle)

| | Avant | Après |
|---|---|---|
| En-tête | 3 lignes | **1 ligne** (cran 1 **et** cran 3) |
| Premier contrôle utile | sous le pli (défilement obligatoire) | rangée d'onglets **au-dessus du pli** |
| 1ʳᵉ fiche de bâtiment | coupée par le bas du viewport | **entière**, bouton « Construire » compris |
| Emplacements nommés | 0 / 18 | 18 / 18 (desktop ; tap/appui long + liste en portrait) |
