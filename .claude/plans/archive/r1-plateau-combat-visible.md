# Lot R1 — Rendre le plateau de combat visible (B2, H5, U5)

> Plan vivant (guidelines §5). Lot issu du chapitre 6 de
> `.claude/plans/game-review-remediation-plan.md` (constats **B2** §1, **H5** §2,
> **U5** §3). **Client uniquement** : zéro diff `packages/engine`, pas de bump
> `CURRENT_SAVE_VERSION`, golden inchangé.

## 0. Constat repris (preuves du plan de remédiation)

`packages/client/src/scenes/combat/CombatScene.ts:115-120` + `:288-292` réservent
l'aire de jeu de la caméra avec **deux constantes figées** :

```ts
const MARGIN_TOP = 96;     // bandeau armées + round
const MARGIN_BOTTOM = 120; // barre d'actions
```

Or les surcouches DOM sont **fluides** (cran de police, avertissement de riposte
mortelle, tiroir « ⋯ », retour à la ligne des libellés). `layout()` centre donc le
plateau dans une aire qu'il croit plus haute qu'elle ne l'est ⇒ le DOM recouvre le
bas du plateau, jusqu'à **l'unique pile ennemie**.

## 1. Mesure de référence (AVANT) — reproduite

Protocole (identique au plan de remédiation) : `vite preview` du build de prod,
arène `/#arena?seed=42`, viewport **360×640**, `getBoundingClientRect()` de
`.combat-armies` (en-tête) et de `.combat-bottom` (bloc bas complet : préviz +
avertissement + barre d'actions), aux 3 crans de police, **état de repos** (aucune
cible sélectionnée ⇒ consigne placeholder).
Script : `scratchpad/measure.mjs` (hors dépôt).

### 1a. Locale par défaut du navigateur (= celle du plan de remédiation)

| Cran | En-tête réel | `MARGIN_TOP` | Bas réel | `MARGIN_BOTTOM` | Bas / viewport | Plateau masqué |
|---|---|---|---|---|---|---|
| 1 | **86** px | 96 | **157** px | 120 | **24,5 %** | 37 px |
| 2 | 89 px | 96 | 168 px | 120 | 26,3 % | 48 px |
| 3 | **91** px | 96 | **217** px | 120 | **33,9 %** | 97 px |

✅ **Baseline confirmée** : les chiffres 86/157 (cran 1) et 91/217 (cran 3) du plan
de remédiation sont reproduits **à l'identique** (l'audit a donc été fait dans la
locale par défaut du navigateur, l'anglais).

### 1b. Locale **fr-FR** — le VRAI pire cas (celui que joue la CI)

`playwright.config.ts` fixe `locale: 'fr-FR'` : les libellés français, plus longs,
sont ce que mesure la CI. Mesure sur `origin/main` (`git stash` + build) :

| Cran | En-tête | Bas réel | Barre seule | Bas / viewport | Consigne tronquée ? |
|---|---|---|---|---|---|
| 1 | 86 px | **206** px | 170 px (3 rangées) | **32,2 %** | **oui** (ellipse) |
| 2 | 90 px | **213** px | 175 px (3 rangées) | **33,3 %** | **oui** |
| 3 | 95 px | **226** px | 186 px (3 rangées) | **35,3 %** | **oui** |

**Écart constaté vs le plan de remédiation** : en français le défaut est plus
sévère que documenté — **3 rangées de barre dès le cran 1** et consigne tronquée
aux **trois** crans (le plan n'en signalait que « les deux crans mesurés »).
C'est ce jeu de chiffres qui pilote le dimensionnement du lot.

Captures avant : `scratchpad/captures/r1-avant/` (EN) et `r1-avant-fr/` (FR).
Inspection visuelle FR cran 3 : la consigne « Sélectionnez une cible pour
prévisualis**…** » est **posée sur le jeton de la pile ennemie**, dont seul un
sliver du badge « 12 » dépasse sous la barre ⇒ B2 + U5 confirmés visuellement.

## 2. Étapes

### R1.1 — Marges de caméra MESURÉES (B2)

- [x] Nouveau mini-store client `scenes/combat/insets.ts` (même patron que
      `preview.ts`) : `combatInsets.set/reset/get/subscribe`, constantes de repli
      `FALLBACK_INSET_TOP = 96` / `FALLBACK_INSET_BOTTOM = 120`.
      **Robustesse** : une hauteur absente, nulle, négative ou non finie retombe
      sur la constante — **jamais 0**.
- [x] `ui/combat.tsx` : `ResizeObserver` sur `.combat-armies` et `.combat-bottom`,
      publication des hauteurs réelles ; `reset()` au démontage.
- [x] `CombatScene.viewRect()` lit `combatInsets.get()` ; abonnement
      `combatInsets.subscribe(() => this.layout())` (re-layout à chaque
      changement de hauteur : cran de police, avertissement, tiroir « ⋯ »).
- [x] Surface de test : `CombatScene.stackScreenPoints()` +
      `__HEROES_TEST__.combatStackScreenPoints()` (coordonnées écran des piles
      vivantes, même patron que `tileToScreen`).

- [x] Surface de test : `__HEROES_TEST__.combatReservedInsets()` (marges
      réellement réservées par la scène) — l'assertion « bas réel ≤ marge
      réservée » est ainsi mesurée **littéralement**, pas déduite.

→ *vérif chiffrée* : test unitaire client `insets.test.ts` (repli sur les
constantes quand l'élément est absent / hauteur 0 / négative / NaN) **+** smoke
`@mobile` qui **mesure** : `bas réel ≤ marge réservée` et chaque pile vivante
dans l'aire non recouverte, aux crans 1 et 3.

### R1.2 — Bandeau d'aide hors du plateau, plus tronqué (U5)

- [x] `.combat-bottom` reçoit le fond opaque du bloc bas (`var(--veil-85)`) : la
      préviz cesse d'être une pastille **flottante au-dessus des jetons** et
      devient une ligne du panneau bas (structurellement elle y était déjà).
- [x] Suppression de `white-space: nowrap` / `text-overflow: ellipsis` de
      `.damage-preview` en portrait : le texte **revient à la ligne** (la marge
      étant désormais mesurée, il ne mange plus le plateau).

→ *vérif* : capture cran 3 — aucune ellipse, aucun jeton recouvert.

### R1.3 — Compaction au cran 3 (H5)

- [x] `settings.ts` publie `document.documentElement.dataset.fontScale` (crochet
      CSS des 3 crans, aucun autre usage).
- [x] En portrait, au-delà du cran 1, les **sous-libellés de raison** (E2)
      disparaissent visuellement ; l'explication reste dans `title` **et** dans
      `aria-label` du bouton (canal AT préservé).
- [x] En portrait, au-delà du cran 1, les deux **actions de héros** débordent dans
      le tiroir « ⋯ » (`compactBar`) ⇒ barre à **2 rangées maximum** mesurées.
- [x] Paddings/gaps du bloc bas et des boutons resserrés en portrait (cible
      tactile ≥ 44 px intacte).

→ *vérif chiffrée* : bloc bas **≤ 25 % du viewport aux trois crans** (mesure
smoke `@mobile`).

## 3. Mesure APRÈS

### 3a. Mobile 360×640, **fr-FR** (le pire cas mesuré au §1b)

| Cran | En-tête | Marge haute réservée | Bas réel | Marge basse réservée | Bas / viewport | Barre | Consigne tronquée | Piles recouvertes |
|---|---|---|---|---|---|---|---|---|
| 1 | 86 px | **86** | **132** px | **132** | **20,6 %** | 2 rangées | non | **0 / 4** |
| 2 | 90 px | **90** | **101** px | **101** | **15,8 %** | 1 rangée | non | **0 / 4** |
| 3 | 95 px | **95** | **153** px | **153** | **23,9 %** | 2 rangées | non | **0 / 4** |

- **`bas réel ≤ marge réservée` : égalité** aux trois crans (la marge EST la
  mesure) — avant : **120 réservés pour 206 / 213 / 226 réels**.
- **Bloc bas ≤ 25 %** : `20,6 / 15,8 / 23,9 %` — critère tenu aux trois crans
  (avant : `32,2 / 33,3 / 35,3 %`). Marge la plus faible au cran 3 : **7 px**
  (153 vs le plafond 160) — layout déterministe, la CI mesure les mêmes chaînes
  dans le même Chromium ; le budget joue alors son rôle de garde-fou si un
  libellé s'allonge.
- **Consigne tronquée : non** aux trois crans (`scrollWidth == clientWidth`) —
  avant : **oui aux trois**.
- **Piles vivantes sous une surcouche : 0** aux trois crans (mesuré par
  `combatStackScreenPoints`).

### 3b. Desktop 1280×800, fr-FR (non-régression)

| Cran | En-tête / réservé | Bas réel / réservé | Piles recouvertes |
|---|---|---|---|
| 1 | 60 / **60** px | 170 / **170** px | 0 / 4 |
| 3 | 64 / **64** px | 189 / **189** px | 0 / 4 |

Le desktop était **aussi** mal réservé (120 px pour 170–189 réels) : il gagne la
correction sans autre changement — actions de héros toujours primaires,
sous-libellés de raison toujours visibles (compaction limitée au portrait).

Captures après : `scratchpad/captures/r1-apres/combat-mobile-font{1,2,3}.png` +
`combat-desktop-font{1,3}.png`.

## 4. Écarts constatés & décisions

1. **Le bandeau d'aide était déjà structurellement dans `.combat-bottom`** — seul
   son fond transparent le faisait *lire* comme une pastille flottante sur les
   jetons, et la marge figée le laissait *effectivement* au-dessus du plateau.
   Décision : fond opaque sur `.combat-bottom` + marge mesurée, plutôt qu'un
   déplacement de nœud DOM (zéro churn de structure).
2. **Le seul levier « masquer les sous-libellés » ne suffisait pas.** Mesuré, pas
   estimé : avec les sous-libellés masqués et les paddings resserrés, la barre
   française restait à **3 rangées** au-delà du cran 1 (154 px, bloc bas à 32 %) —
   « Attaque du héros » (179 px au cran 3) empêche trois boutons de tenir sur une
   rangée de 344 px. Décision : appliquer **les deux options** que le plan de
   remédiation autorisait, cumulées :
   - sous-libellés de raison en `title` + nom accessible au-delà du cran 1
     (portrait) ;
   - **débordement dans le tiroir « ⋯ »** des deux actions de héros au-delà du
     cran 1 (portrait) ⇒ la barre revient à **1–2 rangées** (budget « 2 rangées
     maximum » tenu) ;
   - + resserrement des paddings/gaps du bloc bas et des boutons en portrait
     (cible tactile ≥ 44 px **intacte** : `min-height`/`min-width` sont hors media
     query, seul l'espacement horizontal bouge).
   *Coût assumé* : au cran 2/3 en portrait, *Attaque du héros* / *Sort du héros*
   demandent un tap de plus (ouvrir « ⋯ »). Contrepartie : le plateau entier
   redevient visible et ciblable — objet même du lot. Couvert par une assertion
   du smoke (caché hors tiroir, visible après ouverture).
   *Effet de bord accepté* : le seul endroit du client où la largeur de viewport
   est lue en **JS** (`useNarrowViewport`, même seuil 640 px que le CSS) ; la
   responsivité reste ailleurs en CSS, on ne peut pas reparenter un nœud en CSS.
3. **Marges de repli conservées telles quelles** (96/120) : elles restent le
   comportement de l'arène sans DOM monté et des tests unitaires. Une chute à 0
   recadrerait le plateau sur toute la hauteur de l'écran (régression inverse) —
   couvert par `insets.test.ts`.
4. **Portée du masquage des sous-libellés** : limitée au portrait
   (`@media (max-width: 640px)`). Sur desktop la place ne manque pas et l'audit
   ne relevait rien ⇒ chirurgie (guidelines §3). Le smoke `@core` existant
   (« E2 : un bouton désactivé affiche sa raison ») tourne au cran 1 ⇒ inchangé.
5. **`aria-label` ajouté sur les boutons portant une raison** : le sous-libellé
   visible était le seul canal tactile de l'information ; le masquer au cran ≥ 2
   sans `aria` aurait dégradé A2/A5. Vérifié : aucun test ne cible ces boutons par
   nom accessible (tous par `data-testid`).
6. **L'assertion « chaque pile vivante dans l'aire non recouverte » est
   VERTICALE.** Mesuré : au plancher tactile (hexes ≥ 44 px) le plateau **déborde
   horizontalement** en portrait par conception (doc 08 §2.4 : pan/pinch), les
   piles des colonnes extrêmes étant à `x = 41` et `x = 657` sur 360 px de large.
   Le critère ne peut donc porter que sur l'occlusion par les **surcouches DOM**,
   qui est exactement le défaut B2. Écrit tel quel dans le test, avec le
   commentaire qui l'explique.
7. **Contre-épreuve du test** (garde anti-test vide) : en forçant
   temporairement `combatInsets.get()` à rendre les constantes (= comportement
   d'avant), le smoke **échoue** aux crans 1 et 3 — `120 < 131,6` puis
   `120 < 153,4`. Le cran 2 passe (son bloc bas tient sur une rangée, 101 px
   < 120) : c'est pourquoi les crans **1 et 3** sont ceux tagués `@core`.
8. **Budget mesuré « à l'état de repos »** (consigne placeholder). Le bloc bas
   grossit transitoirement quand une préviz de dégâts ou l'avertissement de
   riposte mortelle s'affiche — c'est précisément le cas que R1.1 couvre : la
   marge suit (`ResizeObserver`) et **aucune occlusion n'est possible dans aucun
   état**. Le budget des 25 % porte sur l'état persistant.

## 5. Pipeline (résultats consignés)

- [x] `pnpm typecheck` — vert (5 projets)
- [x] `pnpm lint` — vert (0 problème)
- [x] `pnpm test` — **935 moteur + 164 contenu + 39 client** (dont les 6 nouveaux
      `insets.test.ts`), golden replay inclus. *Un run intermédiaire a signalé
      1 échec moteur non reproductible (3 runs verts ensuite) — flake de
      contention CPU, aucun rapport avec le lot (client uniquement).*
- [x] `pnpm content:check` — 7 paquets, 2 cartes, 16 scénarios valides
- [x] `pnpm build` — vert
- [x] Garde-fou zéro id de faction dans `packages/` — **statut grep = 1**
- [x] Garde-fou zéro couleur en dur hors `tokens.css` — **statut grep = 1**
- [x] Budget bundle — **363 176 octets gzip** / 819 200 (44 %), identique à la
      baseline `origin/main`
- [x] Smoke Playwright `--grep=@core` — **47/47** (dont les 2 nouveaux R1 crans
      1 et 3, sur les projets desktop **et** mobile)
- [x] Smoke ciblé combat/arène (`--grep "combat|arène|R1|E2 |E1 "`) — **25/25**,
      y compris les tests de fuite de scène CL1/CL2 (le lot ajoute un abonnement
      à la scène) et `@perf` arène (16,8 fps sous throttle ×4)

### Invariants du diff

- **Aucun fichier de `packages/engine`** touché.
- `CURRENT_SAVE_VERSION` **inchangé** (aucun diff dans `engine/src/core/state.ts`).
- **Aucune fixture golden** touchée ; `golden-replay.test.ts` vert.
- **Aucune clé de locale ajoutée** (les libellés `combat.reason.*.hint` existaient
  déjà) ⇒ parité FR/EN inchangée par construction.

## 6. Docs mises à jour (même commit)

- `docs/08-ui-ux.md` — écran de combat + adaptation mobile : marges de caméra
  mesurées, bandeau d'aide intégré au panneau bas et non tronqué, budget
  « bloc bas ≤ 25 % du viewport aux 3 crans », sous-libellés de raison en
  `title`/`aria` au-delà du cran 1.
- `docs/08-ui-ux.md` §4 (accessibilité) — le cran de police est publié sur
  `<html data-font-scale>` : une surcouche serrée en hauteur peut alléger son
  contenu au-delà du cran 1 **sans perdre l'information**.
- `docs/02-mechanics.md` — **non modifié**, dit explicitement : aucune règle de
  combat n'est arbitrée par ce lot (ni règle de jeu, ni règle d'affichage de
  combat au sens du doc 02 — la prévisualisation obligatoire, le contenu des
  popups de frappe et la file d'initiative sont inchangés). Seuls le **cadrage de
  la caméra** et la **mise en page** des surcouches changent : cela relève du
  doc 08.
- `.claude/plans/game-review-remediation-plan.md` — case de suivi R1 cochée.
