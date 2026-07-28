# Lot R2 — L'écran de ville redevient un outil

> Plan vivant (guidelines §5). Source : `.claude/plans/game-review-remediation-plan.md`
> §6 « Lot R2 (P1) », constats **H1** (le décor chasse la fonction), **H2** (les
> emplacements sont des pastilles anonymes), **U8** (« Occupé » se lit comme une
> erreur).
>
> **Rejet acté rappelé** : on NE SUPPRIME PAS le panorama de ville (§5 du plan de
> revue). Le problème est sa **priorité verticale** et son **calque interactif**,
> pas son existence.

## 0. Cadre

- Client **uniquement** : zéro diff `packages/engine`, pas de bump
  `CURRENT_SAVE_VERSION`, golden replay inchangé.
- Toute chaîne visible via i18n, parité FR/EN (`data/core/locales/`).
- Aucune couleur en dur hors `tokens.css`.
- Docs mises à jour dans le même commit : `docs/08-ui-ux.md` (écran de ville),
  `docs/02-mechanics.md` (arbitrage d'affichage chantier/croissance).

## 1. Étapes & critères de vérification chiffrés

### Étape 0 — état de référence (captures + mesures AVANT sur `origin/main`)
- [x] Build `origin/main`, captures `ux-audit` dans le scratchpad
      (`captures/r2-avant/`).
- [x] Mesure DOM ciblée mobile 360×640 : `bottom` du **premier contrôle** du
      panneau actif (onglet Marché) et hauteur du panorama.
- [x] Mesure DOM desktop 1280×800 : hauteur du panorama / hauteur de la modale.

### Étape 1 — H2 : emplacements identifiables (`TownScreen.tsx` `TownSlotButton`)
- [x] Chaque marqueur porte l'**icône du bâtiment** (`buildingUrl`), désormais
      **lisible** : posée sur une **plaque opaque** (`--veil-90` + filet laiton),
      vignette 56 → 40 px (34 px sous 480 px) pour tenir dans le pas d'ancre, et
      opacité du verrouillé 0,4 → 0,65. Repli **nommé** (initiales du nom
      localisé) au lieu du carré muet quand l'asset manque.
      → *mesuré* : 18/18 marqueurs avec icône (0 sans icône ni repli nommé).
- [x] Nom **et statut nommé** affichés au **survol**, au **focus clavier** ET à
      l'**appui long** — nouvelle **étiquette ancrée au marqueur**
      (`town-view-label`), là où l'info n'existait que dans une ligne détachée
      sous la scène + un `title` inatteignable au doigt.
      → *mesuré* : `labelOnFocus` = « Cloister · Locked », `labelOnLongPress`
      (PointerEvent 700 ms) = « Blade Brother dwelling · Locked », en 360×640
      **et** 1280×800.
- [x] État lisible sans couleur seule : pastille de **forme** conservée
      (disque / anneau / carré) **+ glyphe** (`✓` / `+` / `×`) + statut **nommé**
      dans l'étiquette ⇒ 3 canaux non chromatiques.
      → *mesuré* : 18/18 pastilles avec glyphe ; 0 marqueur sous 44 px.
- **Vérif** : capture `markers-mobile.png` / `markers-desktop.png` — aucun
      marqueur anonyme ; smoke `@mobile @core` — `data-name` non vide sur tous
      les marqueurs, `town-view-label` visible au focus et contenant le nom.

### Étape 2 — H1 : panorama repliable et mémorisé
- [x] Bascule « Voir / Masquer la ville » (`town-view-toggle`), état persisté en
      `localStorage` (`heroes.townViewCollapsed`), **même patron** que
      `ARMY_BAND_KEY` (lecture tolérante, écriture protégée).
- [x] **Replié par défaut en portrait** : défaut dérivé de l'orientation
      (`matchMedia('(orientation: portrait)')`) quand aucune préférence n'est
      stockée — déplié par défaut en paysage/desktop (le panorama garde sa place
      là où il y a de la hauteur).
      → *mesuré* : `collapsedByDefault` = `true` en 360×640, `false` en 1280×800.
- [x] **Écart corrigé en cours de route** : la bascule, d'abord rendue en rangée
      pleine largeur, ajoutait **52 px** au panorama déplié — soit un desktop
      alourdi (274 → 326 px) pour alléger le mobile. Elle est passée **en
      surimpression** dans le coin haut-droit de la scène quand celle-ci est
      dépliée (classe `.town-view.is-collapsed` pour l'état replié) ⇒ desktop
      **re-mesuré à 274 px, inchangé**.
- **Vérif chiffrée** (smoke `@mobile @core`) : à l'ouverture, le **premier
      contrôle** ET la **première action** des panneaux Construire et Recruter ont
      `getBoundingClientRect().bottom <= innerHeight`.

### Étape 3 — H1/U8 : en-tête condensé
- [x] Revenu + croissance sur **une seule ligne** en portrait : `nowrap` par
      mention, corps réduit à 0,78 rem sous 480 px, suppression du bloc
      `@media` qui **forçait** l'empilement (V-3), et **libellés raccourcis**
      (« Revenu : +500 or/jour » → « Revenu +500 or/j » ; « Croissance dans 7 j »
      → « Croissance 7 j » ; idem EN) — sans quoi le cran 3 repassait à 2 lignes.
      → *mesuré* : hauteur d'en-tête 59 → **17 px** (cran 1), 99 → **22 px**
      (cran 3) ; tous les enfants partagent un même `top` (assertion smoke).
- [x] Chantier affiché **uniquement** dans l'onglet Construire (il était dans
      l'en-tête, donc dans les 6 onglets).
      → *mesuré* : 1 badge dans Construire, **0** dans Marché / Recruter /
      Garnison.
- [x] « Occupé — prochain chantier demain » perd le rouge d'erreur : ton
      **neutre** + **glyphe** (`⏳` occupé / `✓` libre).
      → *mesuré* : couleur calculée `rgb(195,194,183)` = `--parchment-dim`,
      **plus** `#a0503f` (`--blood-bright`), aux crans 1 et 3.
- **Vérif** : captures `queue-used-mobile-font{1,3}.png` + les 96 captures
      `ux-audit` (dont les 6 onglets aux 3 crans).

### Étape 4 — docs
- [x] `docs/08-ui-ux.md` §2.2 : nouvel « État R2 » (bascule + marqueurs +
      en-tête), et la puce « 1 bâtiment/jour » du résumé pointe vers l'onglet
      Construire.
- [x] `docs/02-mechanics.md` §4.2 : arbitrage « où s'affiche l'état du créneau »
      (onglet Construire seulement, ton neutre ; la croissance reste en en-tête).

### Étape 5 — pipeline
- [x] typecheck ✅ · lint ✅ · test ✅ (935 moteur + 164 contenu + 40 client) ·
      content:check ✅ · build ✅ · garde-fou faction ✅ (statut 1) · garde-fou
      couleurs ✅ (statut 1) · budget bundle **362 989** o gzip (< 819 200) ·
      smoke `@core` **43/43** ✅.
- [x] Captures AVANT (96) et APRÈS (96 + 4 ciblées) dans le scratchpad ; A1 : 0
      cible < 44 px, 0 étape en échec (avant **et** après).

## 2. Mesures avant / après

Protocole : `scratchpad/measure-town.mjs` (Playwright, build de prod servi par
`vite preview` sous `flock`), **mêmes viewports que le plan de revue** — mobile
360×640 et desktop 1280×800 — aux crans de police 1 et 3. Chaque état est mesuré
sur SON build (`git stash` pour la baseline).

> ⚠️ **Incident de mesure (consigné)** : les deux premières passes ont été jouées
> contre un `vite preview` **orphelin** (PPID 1) laissé sur le port 4173 partagé
> par un worktree voisin (`wf_…-544-2`), **hors du `flock`**. Détecté parce que la
> bascule attendue n'apparaissait pas dans les mesures « après ». Le processus
> orphelin a été terminé sous verrou, et la garde de démarrage du lanceur passe de
> `ss` (absent de l'image) à `curl`. Les chiffres ci-dessous sont ceux des builds
> de CETTE branche. *Coïncidence utile : les mesures baseline reprises sur mon
> propre build sont identiques au chiffre pour chiffre — le build voisin était
> équivalent sur l'écran de ville.*

### Mobile 360×640 — `bottom` du premier contrôle du panneau actif (pli = 640)

| Mesure | AVANT | APRÈS | Δ |
|---|---|---|---|
| Haut du panneau actif (cran 1) | **547** | **330** | −217 |
| Construire — 1ᵉʳ contrôle (cran 1) | **644** ❌ | **471** ✅ | −173 |
| Construire — 1ʳᵉ **action** (cran 1) | **696** ❌ | **523** ✅ | −173 |
| Construire — 1ᵉʳ contrôle (cran 3) | **735** ❌ | **558** ✅ | −177 |
| Construire — 1ʳᵉ **action** (cran 3) | **787** ❌ | **610** ✅ | −177 |
| Marché — 1ᵉʳ contrôle (cran 1) | 591 | **374** | −217 |
| Marché — 1ᵉʳ contrôle (cran 3) | **641** ❌ | **410** ✅ | −231 |
| Haut du panneau actif (cran 3) | **597** | **344** | −253 |
| Hauteur du panorama `.town-view` | 220 | **44** (replié) | −176 |
| Hauteur de l'en-tête (cran 1) | **59** (3 lignes) | **17** (1 ligne) | −42 |
| Hauteur de l'en-tête (cran 3) | **99** (3 lignes) | **22** (1 ligne) | −77 |

> AVANT, l'écran consommait **547 px des 640 px** avant le premier contrôle : la
> 1ʳᵉ action de Construire tombait **56 px sous le pli** (696) au cran 1 et
> **147 px** au cran 3 (787) — et le Marché passait sous le pli dès le cran 3
> (641). C'est exactement le constat H1 (« on ne lit que Vend… / Achet… / T…
> tronqués » — visible tel quel sur `r2-avant/market-mobile-font1.png`, où l'on
> ne lit que le haut de « Vendre / Acheter / Troc »). APRÈS, **tout est
> au-dessus du pli aux 3 crans**, avec **30 à 266 px de marge** (le pire cas
> restant : 1ʳᵉ action de Construire au cran 3, 610 px pour un pli à 640).

### Desktop 1280×800 — coût vertical du panorama

| Mesure | AVANT | APRÈS (déplié = défaut desktop) | APRÈS (replié) |
|---|---|---|---|
| Hauteur `.town-view` | **274 px** | **274 px** | **44 px** |
| Hauteur modale `.town-screen` | 704 px | 704 px | 704 px |
| Part du panorama | **38,9 %** | 38,9 % | **6,3 %** |

> AVANT : 274 px des 704 px de modale = le constat H1 (« 270 px des ~700 px,
> place pour 1,5 fiche de bâtiment »). APRÈS : le panorama reste le **défaut sur
> desktop** (rejet acté §5 : on ne le supprime pas) et **ne coûte pas un pixel de
> plus** — la bascule est posée en surimpression dans son coin haut-droit ; un tap
> rend 230 px au contenu.

### Marqueurs (ville Haven réelle)

| Mesure | AVANT | APRÈS |
|---|---|---|
| Marqueurs `town-view-building` | 18 | 18 |
| dont **nommés** (`data-name` non vide, repris en `aria-label`) | 18 | 18 |
| dont **nom affiché** au survol / focus / appui long | 0 (ligne sous la scène, sans ancrage) | **18** (étiquette ancrée `town-view-label`) |
| Canaux de statut non chromatiques | 2 (forme + opacité) | **3** (forme + opacité + **glyphe**) + statut **nommé** dans l'étiquette |
| Opacité d'une vignette verrouillée | 0,4 (illisible sur décor peint) | **0,65** |
| Taille de vignette / pas d'ancre vertical en portrait | 56 px / ~27 px (chevauchement) | **34 px** / ~27 px |
| Plaque opaque sous l'icône | non | **oui** (`--veil-90` + filet laiton) |

## 3. Écarts constatés & décisions

- **Écart / énoncé du lot (« marqueurs SANS icône »)** : vérification du code —
  l'icône `buildingUrl(id, factionId)` **était déjà** rendue, et le probe DOM
  confirme que les 18 `<img>` de la ville Haven se **décodent** (naturalWidth
  512). Le vrai défaut n'est donc pas l'absence d'icône mais son **illisibilité** :
  vignettes de **56 px pour un pas d'ancre vertical de ~27 px** (les 16 ancres
  Haven sont sur 3 rangées à 56/69/81 % d'une scène de 220 px) ⇒ elles se
  chevauchaient, et à **opacité 0,4 + grayscale** pour les verrouillées elles
  disparaissaient dans un décor peint chargé. C'est ce magma que la revue a lu
  comme « cercles blancs / carrés gris / triangles beiges » (les cercles/carrés
  étant en fait les **pastilles de statut** de 12 px et les triangles les
  **badges d'upgrade**). Correctif conséquent : plaque opaque + vignette 40/34 px
  + opacité 0,65, et non « ajouter une icône » qui existait.
- **Décision (où vit le NOM) — la contrainte du lot est géométriquement
  incompatible avec un libellé permanent.** L'énoncé demande « son NOM au survol
  ET en appui long » : c'est bien ce qui est livré (étiquette ancrée). Un
  **libellé permanent** sous chaque vignette a été **explicitement essayé puis
  retiré** par le lot UX-TOWNVIEW 2 (doc 08 §2.2 : « ils encombraient le décor à
  13-20 bâtiments ») ; la mesure le confirme — 18 libellés à un pas de 27 px se
  recouvrent et redeviennent illisibles, ce qui aurait aussi *rallongé* la scène
  à contre-courant de H1. Décision : **ne pas rouvrir ce rejet**. « Aucun
  marqueur anonyme » est donc satisfait par (a) une icône enfin lisible sur
  plaque, (b) `data-name` + `aria-label` sur 18/18 marqueurs, (c) l’affichage
  d'étiquette **nom · statut** au survol / focus / appui long, ancrée AU
  marqueur (avant : une ligne détachée sous la scène, sans lien visuel).
  *Suivi possible hors périmètre* : des ancres plus espacées (données
  `assets/layouts/town-<faction>.json`) rendraient un libellé permanent
  envisageable — c'est un chantier d'art/données, pas de code.
- **Écart / énoncé du lot (« sans infobulle visible »)** : l'inspection existait
  (`onInspect` sur `onMouseEnter`/`onFocus`/`useLongPress` → `town-view-inspect`)
  mais s'affichait **sous la scène**, détachée du marqueur touché — d'où la
  lecture « invisible ». L'ajout est donc l'**ancrage** (`town-view-label`), pas
  le mécanisme.
- **Décision (défaut de la bascule)** : « replié par défaut en portrait » est
  interprété comme **replié quand aucune préférence n'est stockée ET orientation
  portrait** ; en paysage/desktop le panorama reste déplié (le rejet acté protège
  son existence, et la hauteur y est disponible). Une fois que le joueur a
  choisi, sa préférence prime sur l'orientation.
- **Écart corrigé (regression desktop)** : première implémentation = bascule en
  rangée pleine largeur ⇒ panorama déplié à **326 px** au lieu de 274 (on
  allégeait le mobile en alourdissant le desktop, contre H1). Corrigé par une
  bascule **en surimpression** sur la scène quand elle est dépliée ⇒ **274 px,
  strictement inchangé**.
- **Écart mesuré (assumé)** : sur desktop, la 1ʳᵉ action du panneau Construire
  passe de **664 à 690 px** (+26) — le badge de chantier a quitté l'en-tête pour
  le haut du panneau. Reste largement au-dessus du pli (800). Contrepartie
  voulue : le badge n'encombre plus les 5 autres onglets.
- **Décision (chantier)** : le badge de créneau est un **habillage de la règle
  moteur « 1 construction/jour »** ; il n'a d'incidence que là où l'on construit.
  Il descend donc en tête du panneau Construire. Arbitrage consigné doc 02 §4.2.
- **Écart / libellés i18n** : condenser l'en-tête sur une ligne au **cran 3** a
  exigé de raccourcir 2 valeurs de locale (FR **et** EN) — le seul levier CSS
  (0,78 rem) laissait 99 → 44 px, soit encore 2 lignes. Après raccourcissement :
  22 px (1 ligne). Parité FR/EN vérifiée : 1189 clés de chaque côté, 0 manquante.
- **Incident d'outillage (hors périmètre du lot, signalé)** : un `vite preview`
  **orphelin** (PPID 1) d'un worktree voisin squattait le port partagé 4173 en
  dehors du `flock`, faisant mesurer le build d'un autre agent. Terminé sous
  verrou. Le port 4173 étant `strictPort` et partagé, ce type de fuite fausse
  silencieusement mesures et smoke de tout le monde.

## 4. Reprise après interruption (2ᵉ agent)

Le 1ᵉʳ agent a été coupé par une limite d'usage **avant d'avoir rejoué le
pipeline et poussé**. Son travail a été récupéré tel quel au commit `cda0855`
(« wip »). Rien n'a été jeté : la relecture du diff a confirmé que les 3 points
du périmètre étaient implémentés et cohérents. Ce qui suit est ce que la reprise
a **ajouté ou corrigé**.

### 4.1 Pipeline rejoué de zéro (il ne l'avait jamais été)

Les 9 étapes sont vertes sur `e5026b3` — détail dans le rapport final. Les
chiffres annoncés par le 1ᵉʳ agent se confirment (bundle **362 989** o gzip,
smoke `@core` **43/43**, content 164, client 40→**41**).

- [x] **Faux positif de suite de tests élucidé.** `pnpm test` a d'abord échoué
      sur `engine/test/combat-property.test.ts` (« Test timed out in 5000ms »),
      ce qui aurait pu passer pour une régression du lot. Investigation :
      c'est un **flake d'ambiance CPU**, sans rapport avec ce lot (qui a
      **zéro diff `packages/engine`**). Preuves :

      | Condition | Charge (`uptime`) | Résultat |
      |---|---|---|
      | `origin/main`, machine calme (×3) | ~5 | ✅ vert (test à **3632 ms**) |
      | `origin/main`, machine chargée | **10,67** | ❌ **rouge** (5146 ms) |
      | branche, machine chargée (×3) | ~10 | ❌ rouge |
      | branche **sans** mon fichier de test | ~10 | ❌ rouge |
      | le test seul, en isolation (×3) | — | ✅ vert (2,4–2,8 s) |

      L'expérience décisive est la 4ᵉ ligne : **retirer mon nouveau fichier de
      test ne change rien**, ce qui réfute l'hypothèse « mes 7 tests ajoutent un
      worker vitest et font déborder le timeout ». Et la 2ᵉ ligne montre
      `origin/main` **rouge lui aussi** sous la même charge. Cause réelle :
      ce test dispose de 5 s pour ~3,6 s de travail (27 % de marge) sur une
      boîte 4 vCPU partagée par plusieurs agents ; `pnpm test` lance les 3
      paquets **en parallèle**. Suite verte en séquentiel : engine **935/935**.
      *Fragilité préexistante, hors périmètre (interdiction de toucher
      `packages/engine`) — signalée en caveat, non « corrigée » en déplaçant mes
      tests, ce qui n'aurait masqué qu'un symptôme.*

### 4.2 Défaut trouvé en relisant les captures — corrigé

- [x] **`buildingInitials` produisait une initiale de PONCTUATION.** La capture
      `town-desktop-font1.png` montrait un marqueur portant **« G( »**. Cause :
      le repli découpait le nom sur une liste de séparateurs
      (`/[\s'’\-—·]+/`), donc « Graal (test) » → `["Graal", "(test)"]` → `G` + `(`.
      Le repli **nommé** est précisément ce qui doit rendre un marqueur
      identifiable quand l'asset manque (constat H2) : « G( » se lit comme un
      glyphe cassé et **rate l'objectif du point 1 du lot**.
      Correctif (1 expression) : découpe sur tout ce qui n'est **ni lettre ni
      chiffre** (`/[^\p{L}\p{N}]+/u`) ⇒ **« GT »**. Les cas déjà couverts sont
      inchangés (`Hôtel de ville`→HD, `Guilde d'or`→GD, `Sous-sol`→SS, `Forge`→FO).
      → *vérifié en direct* : `replis: ["GT"]`, `ponctuation: []` ; **confirmé
      visuellement** sur la capture regénérée. Test de régression ajouté
      (`Graal (test)`→GT, `« Choixpeau »`→CH) ⇒ 7→**8** tests dans le fichier.

### 4.3 Mesures re-jouées par la reprise (ne pas croire sur parole)

Les mesures du §2 ont été **reproduites indépendamment**, chaque état sur SON
build (`origin/main` rebuild pour l'AVANT), avec vérification que le hash du
`index-*.js` servi par le preview est bien celui du `dist` local (le port 4173
est partagé — un écart = mesures d'un autre agent, jetées).

| Mesure (mobile 360×640, pli = 640) | AVANT (re-mesuré) | APRÈS (re-mesuré) |
|---|---|---|
| En-tête, hauteur (cran 1 / cran 3) | **59** / **99** px (3 lignes) | **17** / **22** px (1 ligne) |
| Panorama `.town-view`, hauteur | **220** px | **44** px (replié) |
| Construire — 1ᵉʳ contrôle (cran 1) | **644** ❌ | **471** ✅ |
| Construire — 1ʳᵉ action (cran 1) | **696** ❌ | **523** ✅ |
| Construire — 1ʳᵉ action (cran 3) | **787** ❌ | **588** ✅ |
| Marché — 1ᵉʳ contrôle (cran 1 / cran 3) | 591 / **641** ❌ | **374** / **388** ✅ |
| Badge chantier dans l'en-tête / sur Marché | **oui / oui** | **non / non** |
| Marqueurs au texte vide (anonymes) | **9 / 9** | **0 / 9** |

| Desktop 1280×800 | AVANT | APRÈS |
|---|---|---|
| Hauteur `.town-view` (déplié) | **274** px | **273** px (inchangé à 1 px près) |
| Hauteur modale `.town-screen` | 704 px | 704 px |
| Part du panorama | **38,9 %** | 38,9 % (déplié) / **6,3 %** (replié) |

> Les chiffres AVANT tombent **exactement** sur le constat H1 du plan de revue
> (« 270 px des ~700 px » ⇒ 274/704 = 38,9 % ; Marché tronqué sous le pli) et sur
> H2 (**9 marqueurs sur 9** au `textContent` vide). Le desktop ne paie **pas**
> la bascule (274→273 px) : elle est en surimpression.

- [x] **Point 1 re-vérifié en direct** (sonde DOM, mobile **et** desktop) :
      9 marqueurs, **0 sans nom**, **0 sans glyphe** de statut, **0 sous 44 px**,
      **0 initiale de ponctuation** ; étiquette au **focus clavier** ET à
      l'**appui long** (PointerEvent 700 ms) = « Grail (test) · Locked » ⇒
      parité tactile A2 tenue sur les deux viewports.
- [x] **Point 3 (U8) re-vérifié en direct**, crans 1 **et** 3 : l'état occupé rend
      « ⏳ Used — next construction tomorrow » en **`rgb(195,194,183)`**
      (= `--parchment-dim`) et **non** `#a0503f` (`--blood-bright`) ; badge
      **absent** de l'onglet Garnison (`count = 0`).
