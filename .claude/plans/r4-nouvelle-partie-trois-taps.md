# Lot R4 — « Nouvelle partie » : jouer en trois taps

Plan vivant (guidelines §5). Source : `.claude/plans/game-review-remediation-plan.md`
§6 lot R4, constats **H4** (~28 réglages, aucun préréglage — `NewGameScreen.tsx:64-140`,
« Lancer » à ~8 écrans de défilement à 4 sièges) et **U1** (pastilles de couleur sans
nom, sans motif, sans libellé — violation directe du pilier A5 du doc 08 ; 7ᵉ pastille
coupée).

**Périmètre** : client + données de locales + doc 08. **Zéro diff `packages/engine`**,
pas de bump `CURRENT_SAVE_VERSION`, aucune fixture golden touchée.

---

## 1. Décisions d'interaction (à reporter dans `docs/08-ui-ux.md`)

1. **« Démarrage rapide »** en tête de la modale : 2 joueurs (siège 1 humain,
   siège 2 IA), **factions aléatoires** (`RANDOM` ⇒ tirage seedé moteur), carte
   **moyenne**, ressources **standard**, 4 densités **standard**, difficulté
   **normale**, couleurs par défaut de la palette, équipes 0 (FFA), héros
   `RANDOM`, **graine fraîche** (`rollSeed`, horloge client — hors moteur).
   Lance directement (même événement `heroes:start-newgame` que « Lancer »).
   *Déterminisme* : la graine est tirée côté client (autorisé, `rollSeed` existe
   déjà pour le bouton 🎲) ; tout le reste est résolu par `resolveNewGameConfig`
   sur le RNG **seedé** ⇒ à graine égale, partie identique.
2. **Progressive disclosure** : deux sections repliables **fermées par défaut**,
   via le composant déjà livré `CollapsibleSection` (`useCollapsed`/`SectionToggle`) :
   - **« Adversaires »** — les sièges **au-delà du siège 1** (contrôleur, faction,
     héros, couleur, équipe de chaque siège 2..N) ;
   - **« Carte & contenu »** — taille de carte, ressources, les 4 curseurs de
     densité **et la graine** (paramètre de génération de carte).
   Restent **toujours visibles** : Démarrage rapide, nombre de joueurs, siège 1
   (« Vous » : faction / héros / couleur / équipe), difficulté IA, « Lancer ».
   **Aucun réglage ne disparaît** — tout reste atteignable en dépliant ; l'état
   plié/déplié persiste (`localStorage`, patron `heroes.section.<id>`).
3. **Couleurs nommées (U1)** : chaque pastille porte son **nom localisé visible**
   (2ᵉ canal permanent, plus fort qu'une infobulle ⇒ aucun besoin d'appui long)
   **et un motif** non chromatique, réutilisant `PatternMark`/`PATTERNS` de
   `FactionBadge` (patron déjà livré, aucun motif inventé), **cyclique sur l'index
   de palette** (`PATTERNS[i % 4]`) ⇒ deux pastilles voisines diffèrent toujours.
   La rangée défile horizontalement avec **fondu de bord** (patron
   `mask-image: linear-gradient(...)` déjà livré pour la file d'initiative,
   `combat.css:67`).

## 2. Étapes & critères de vérification chiffrés

- [x] **E0** — Captures + mesures **AVANT** sur le build de `origin/main`
      (`newgame` desktop 1280×800 & mobile 360×640, crans 1/2/3) + mesures DOM :
      `scrollHeight/clientHeight` de `[data-testid=newgame-screen]` à la config
      par défaut (2 sièges) **et** à 4 sièges ; débordement de la rangée de
      couleurs (`scrollWidth` vs `clientWidth`, rect de la dernière pastille).
- [x] **E1** — Bouton « Démarrage rapide » + helper **pur** `quickStartConfig(seed)`
      dans `app/game.ts` (testable hors DOM).
      *Vérif chiffrée* : test unitaire client (vitest) — 2 slots, factions
      `RANDOM`, `mapSize: 'medium'`, tous les niveaux `standard`, difficulté
      `normal`, seed passée telle quelle ; et **smoke `@core` qui COMPTE les
      interactions** : `menu-new-game` → `newgame-quickstart` = **2 taps** depuis
      le menu (≤ 3 exigés), partie démarrée (`end-turn` visible, `started`).
- [x] **E2** — Sections repliables (fermées par défaut).
      *Vérif chiffrée* : smoke mobile 360×640 — à la config par défaut,
      `scrollHeight ≤ 2 × clientHeight` du panneau (seuil du lot ; mesuré AVANT
      pour comparaison, et à 4 sièges dépliés pour prouver que rien n'a disparu).
      Les tests smoke existants qui pilotent les sièges 2+/densités sont adaptés
      (dépliage explicite de la section concernée).
- [x] **E3** — Pastilles nommées + motif + rangée à fondu de bord.
      *Vérif chiffrée* : smoke — chaque pastille porte un `aria-label` non vide et
      un libellé texte visible ; après défilement de la rangée en fin de course,
      la **dernière pastille est entièrement dans le rect du conteneur**
      (`right ≤ container.right + 1`).
- [x] **E4** — Locales FR/EN (8 noms de couleur + 3 titres de section + libellé/
      indice du démarrage rapide) — **parité stricte** vérifiée.
- [x] **E5** — `docs/08-ui-ux.md` : encart d'état « Nouvelle partie » mis à jour
      (démarrage rapide, disclosure, couleurs nommées) + §4 A5 (pastilles de
      couleur = nom + motif).
- [x] **E6** — Captures + mesures **APRÈS**, consignées ci-dessous.
- [x] **E7** — Pipeline 9 étapes vert.

## 3. Mesures avant / après

Script focalisé (dérivé de `capture.mjs`, flux `newgame` seul + mesures DOM) :
`/tmp/.../scratchpad/newgame-measure.mjs`. Panneau mesuré :
`[data-testid="newgame-screen"]` (`.modal.options-panel`, `max-height: 86vh`,
`overflow-y: auto` ⇒ c'est bien le conteneur de défilement).

| Mesure (mobile 360×640, cran 1) | AVANT (`origin/main`) | APRÈS | Critère |
|---|---|---|---|
| `scrollHeight / clientHeight` — 2 sièges (défaut) | **2.49** (1449/582) | **1.41** (822/582) | ≤ ~2 |
| idem, cran 2 / cran 3 | 2.57 / **2.63** (1529/582) | 1.43 / **1.45** (845/582) | ≤ ~2 aux 3 crans |
| `scrollHeight / clientHeight` — 4 sièges | **3.26** (1897/582) | **1.41** (822/582, sections fermées) | ≤ ~2 |
| idem, sections **dépliées** à 4 sièges | 3.26 | **3.63** (2112/582) | rien ne disparaît |
| Pastilles avec `aria-label` nommé | 0/8 (`#c0392b`…) | **8/8** (Rouge…Ardoise) | A5 |
| Pastilles avec libellé texte visible | 0/8 | **8/8** | A5 |
| Pastilles avec motif non chromatique (`data-pattern`) | 0/8 | **8/8** | A5 |
| Fondu de bord de la rangée (`mask-image`) | `none` | `linear-gradient(…)` | affordance |
| Dernière pastille hors du conteneur au 1ᵉʳ rendu | **oui** : right **419** > 335 ⇒ **84 px coupés**, sans affordance | **non coupée** : chaque pastille entièrement dans le rect après défilement (`scrollIntoView`), fondu présent | 0 coupée |
| Cibles DOM < 44 px (A1) | 0 | 0 | 0 |

Desktop 1280×800 cran 1 : AVANT **2.01** (1449/720) → APRÈS **1.12** (805/720) ;
4 sièges : 2.63 → **1.12** (fermées) / 2.91 (dépliées).

Viewport du smoke `mobile` (412×877, `clientHeight` 754) : `scrollHeight` **1.10×**,
`newgame-start.offsetTop` = **768 px** — soit *juste* au pli, atteignable d'un
flick ; c'est pourquoi l'assertion retenue est « ≤ 1 écran de défilement »
(`scrollHeight ≤ 2 × clientHeight` **et** `startOffsetTop ≤ 2 × clientHeight`)
plutôt que « strictement au-dessus du pli », qui dépendrait du viewport exact.

## 4. Écarts constatés & décisions en cours de route

- La **graine** n'était pas nommée dans le périmètre du lot (« Carte & contenu
  (taille, ressources, 4 curseurs) »). Décision : la ranger **dans** « Carte &
  contenu » — c'est un paramètre de génération de carte, et la laisser visible
  aurait coûté ~120 px (titre + rangée + indice) sur l'objectif « Lancer dans le
  premier écran ». Rien ne disparaît (section dépliable, testid inchangés).
- **Motif des pastilles — 1ʳᵉ tentative rejetée sur capture** : `patternFor()`
  (hash FNV-1a du nom de couleur) donnait `dots` sur **3 pastilles voisines**
  (Violet / Orange / Sarcelle) — renfort inutile. Corrigé en **cyclique sur
  l'index** (`PATTERNS[i % 4]`) : voisines toujours distinctes, paires identiques
  espacées de 4 crans (couleurs et noms très différents). `PATTERNS` est donc
  exporté de `FactionBadge` (au lieu de `patternFor`) ; aucune nouvelle famille de
  motifs inventée (guidelines §2-3). Le **libellé nommé** reste le 2ᵉ canal
  principal, le motif est le 3ᵉ.
- **Écart mesuré à l'étape E0** : le constat H4 annonçait « ~8 écrans de
  défilement à 4 sièges » ; la mesure instrumentée donne **3,26×** la hauteur
  visible en portrait (2 sièges : 2,49×). L'ordre de grandeur du constat était
  pessimiste, le problème reste réel et le lot le divise par ~2,3.
- **Titre de section « Vous » supprimé** : au viewport du smoke mobile, « Lancer »
  tombait 14 px sous le pli. La ligne de siège affiche déjà le libellé « Vous » ⇒
  le `<h3>` était redondant ; le retirer gagne ~30 px sans rien cacher.
- **Piège d'environnement rencontré (à savoir pour les lots suivants)** : le port
  4173 est partagé entre agents ET `playwright.config.ts:45` a
  `reuseExistingServer: !CI`. Une première série de mesures/smokes a donc porté sur
  le **build d'un autre agent** (résultats identiques à l'AVANT, testids absents).
  Correctifs : `CI=1` pour le smoke, et un wrapper qui **vérifie que le hash du JS
  servi = celui de mon `dist/`** avant de mesurer. Un `pnpm preview` lancé dans le
  `flock` fuite aussi son fd de verrou (interblocage des autres agents) ⇒ nettoyage
  `pkill -f 'vite.*preview --port 4173'` en sortie.
- Le smoke existant « configuration 3 joueurs + taille + ressources » **dépliait
  nécessairement** les deux sections : adapté par deux clics de dépliage
  (`newgame-section-opponents` / `newgame-section-map`), assertions inchangées.
- **E4/E7** : deux clés de locale (`newgame.quickstart`, `newgame.quickstartHint`)
  + 8 noms de couleur + 3 titres de section ; parité FR/EN vérifiée par diff des
  jeux de clés (0 écart).
- **Persistance** : les sections utilisent `useCollapsed('newgame.opponents' | 'newgame.map', true)`
  ⇒ défaut **fermé**, choix du joueur mémorisé. Contexte de test Playwright neuf
  à chaque test ⇒ le défaut fermé est bien celui mesuré.
- **Tests ajoutés** (niveaux choisis selon `test-authoring`) :
  - unitaire **client vitest** `packages/client/src/app/newgame-quickstart.test.ts`
    (2 cas) — forme du préréglage + reproductibilité via `resolveNewGameConfig`
    (aucun id de faction réel : catalogue synthétique `alpha/beta/gamma`) ;
  - **un seul** smoke ajouté (`@mobile @core`) regroupant les 3 critères chiffrés
    sur le même état de départ (compte de taps, mesures de défilement, contrôle
    A5), plutôt qu'un smoke par critère (coût ~100× un unitaire) ;
  - smoke existant « configuration 3 joueurs… » adapté (2 clics de dépliage).

## 5. Pipeline (exécuté depuis la racine du worktree)

| # | Étape | Résultat |
|---|---|---|
| 1 | `pnpm typecheck` | ✅ |
| 2 | `pnpm lint` | ✅ |
| 3 | `pnpm test` | ✅ 935 moteur + 164 contenu + **35 client** (+2) |
| 4 | `pnpm content:check` | ✅ 7 paquets, 2 cartes, 16 scénarios |
| 5 | `pnpm build` | ✅ |
| 6 | garde-fou zéro id de faction dans `packages/` | ✅ `statut=1` |
| 7 | garde-fou zéro couleur en dur hors `tokens.css` | ✅ `statut=1` |
| 8 | budget bundle | ✅ **362 935 o** gzip / 819 200 (44 %) |
| 9 | smoke `--grep=@core --workers=1` | ✅ **45/45** (4,7 min) |

Invariants du diff : **aucun fichier de `packages/engine`**,
`CURRENT_SAVE_VERSION` inchangé (35), aucune fixture golden touchée, parité FR/EN
des locales vérifiée (1199 = 1199 clés).

## 6. Re-vérification indépendante (2ᵉ passe, même commit)

Pipeline rejoué intégralement sur un worktree neuf, à partir du même arbre.

| # | Étape | Résultat de la re-passe |
|---|---|---|
| 1 | `pnpm typecheck` | ✅ |
| 2 | `pnpm lint` | ✅ |
| 3 | `pnpm test` | ⚠️ puis ✅ — voir note de flakiness ci-dessous (935 moteur / 164 contenu / 35 client) |
| 4 | `pnpm content:check` | ✅ 7 paquets, 2 cartes, 16 scénarios |
| 5 | `pnpm build` | ✅ |
| 6 | garde-fou zéro id de faction dans `packages/` | ✅ aucune correspondance |
| 7 | garde-fou zéro couleur en dur hors `tokens.css` | ✅ seules les définitions de `tokens.css` |
| 8 | budget bundle | ✅ **362 935 o** gzip / 819 200 (44 %) |
| 9 | smoke `--grep=@core --workers=1` (flock, `CI=1`) | ✅ **45/45** (7,1 min) |

**Note de flakiness (étape 3)** — en lançant les trois paquets *en parallèle*
(`pnpm test` à la racine), `test/combat-property.test.ts` (property-based, 500
rounds) dépasse le `testTimeout` de 5 s **deux fois de suite** sur ce conteneur.
Cause : contention CPU (load average **8** sur **4 vCPU**, plusieurs agents
concurrents), pas le diff — ce lot ne touche **aucun** fichier de
`packages/engine`. Preuves : le fichier seul passe en **2,0 s** (marge ×2,5), et
la suite moteur complète lancée seule passe **935/935**, golden replay inclus.

**Mesures re-mesurées sur le build de cette passe** (hash JS du serveur vérifié
avant lecture, port 4173 partagé) — identiques au §3 :

| Mesure | desktop 1280×800 | mobile 360×640 |
|---|---|---|
| `scrollHeight / clientHeight`, défaut (2 sièges) | **1.12** (805/720) | **1.41** (822/582) |
| idem cran 2 / cran 3 | 1.16 / 1.17 | 1.43 / **1.45** |
| idem, 4 sièges (sections fermées) | **1.12** | **1.41** |
| idem, 4 sièges **dépliés** (rien ne disparaît) | 2.91 | 3.63 |
| pastilles nommées / à motif / à libellé texte | 8/8 · 8/8 · 8/8 | 8/8 · 8/8 · 8/8 |
| pastille coupée après défilement | **aucune** (`toutesAtteignables=true`) | **aucune** |
| fondu de bord de la rangée | `linear-gradient(...)` | `linear-gradient(...)` |
| cibles interactives < 44 px | **0** | **0** |

Captures de contrôle : `<scratchpad>/captures/r4-apres-verif/` (inspectées à
l'œil : bouton « Démarrage rapide » en tête, sections « Adversaires (N) » et
« Carte & contenu » repliées, pastilles nommées + motifs distincts).

---

## 7. Écarts de la vérification adversariale (3ᵉ passe) & leur fermeture

Une re-vérification adversariale indépendante a relevé **4 écarts**. Les deux
premiers sont bloquants (le critère 3 « aucune pastille coupée » était à la fois
**régressé** et **non prouvé**). Périmètre de la correction : client + locales +
doc 08 — toujours **zéro diff `packages/engine`**, pas de bump
`CURRENT_SAVE_VERSION`, aucune fixture golden touchée.

### Diagnostic accepté

- **É1 (bloquant)** — `newgame.css:62-63` posait le fondu de bord
  **inconditionnellement**. Preuve du vérificateur (desktop 1280×800) : la rangée
  `.newgame-seat-colors` **ne défile pas** (`scrollWidth` 406 = `clientWidth` 406)
  et porte pourtant `mask-image: linear-gradient(...)` ⇒ la zone de fondu démarre
  à x=821 alors que la dernière pastille (« Ardoise ») s'étend jusqu'à x=840 :
  **19 px effacés en dégradé sur une pastille de 44 px**, sans aucun défilement
  possible. Double défaut : (a) pastille coupée — ce que le critère interdit —
  et (b) **fausse affordance** de défilement. Même défaut en mobile **une fois
  la rangée défilée en fin de course** (plus rien à droite, fondu maintenu).
  → Le prédicat correct n'est pas « la rangée déborde » mais **« il reste du
  contenu à droite »** : `scrollWidth − clientWidth − scrollLeft > 1`. Il couvre
  les deux cas d'un coup (rangée non défilante ⇒ 0 > 1 faux).
- **É2 (bloquant)** — `smoke.spec.ts:1568` `expect(colors.allInside).toBe(true)`
  était **tautologique** : précédé d'un `scrollIntoView` par pastille, il ne
  mesurait que l'atteignabilité par défilement (vérifié : l'assertion passe aussi
  sur `origin/main`, sans le correctif). Le seul garde-fou restant
  (`if (scrollable) expect(faded).toBe(true)`) ne se déclenchait jamais sur le cas
  défaillant (rangée non défilante).
- **É3 (mineur)** — clé `newgame.seats` orpheline depuis la suppression du `<h3>`
  de la section « Vous » par **ce lot** (`origin/main:NewGameScreen.tsx:186`
  la consommait).
- **É4 (mineur)** — `PLAYER_COLOR_NAMES` couplé **par index** à `PLAYER_COLORS`
  sans test de parité : une 9ᵉ couleur produirait l'`aria-label` brut
  `newgame.colorName.8` — la régression U1 que ce lot corrige.

Aucun des 4 écarts n'est jugé faux.

### Étapes & critères de vérification chiffrés

- [x] **F1 (É1)** — fondu **piloté par l'état de défilement** : nouveau
      sous-composant `ColorRow` (`NewGameScreen.tsx`) qui pose la classe
      `is-scrollable` **ssi** `scrollWidth − clientWidth − scrollLeft > 1`
      (re-synchronisée au `scroll`, au `resize` et à chaque rendu) ; le
      `mask-image` de `newgame.css` passe sous `.newgame-seat-colors.is-scrollable`.
      *Vérif chiffrée* : desktop (rangée non défilante) `maskImage === 'none'` **et**
      **8/8** pastilles entièrement dans le rect du conteneur **au premier rendu,
      sans défilement** ; mobile (rangée défilante) fondu présent au repos puis
      `maskImage === 'none'` **en fin de course**, dernière pastille entièrement
      dans le rect.
- [x] **F2 (É2)** — smoke réécrit : les mesures sont prises **au premier rendu**
      (plus de `scrollIntoView` préalable) puis **après défilement en fin de
      course**. Assertions **discriminantes** (elles échouent sur le code d'avant
      F1) : `if (!scrollable) expect(faded).toBe(false)` +
      `if (!scrollable) expect(insideAtRest).toBe(count)` + en fin de course
      `expect(fadedAtEnd).toBe(false)` et `expect(lastInsideAtEnd).toBe(true)`.
      *Preuve de discrimination* : rejouées contre le CSS d'avant F1 (§ « Preuve »).
- [x] **F3 (É3)** — `newgame.seats` supprimée de `data/core/locales/{fr,en}.json`
      (parité conservée). Guidelines §3 : c'est **ce lot** qui a créé l'orphelin
      (« Remove … that YOUR changes made unused »), la demande de fermeture d'écart
      vaut autorisation ; aucune autre clé morte pré-existante n'est touchée.
- [x] **F4 (É4)** — `expect(PLAYER_COLOR_NAMES).toHaveLength(PLAYER_COLORS.length)`
      (+ chaque nom non vide) dans `packages/client/src/app/newgame-quickstart.test.ts`
      — unitaire client, niveau le moins cher (`test-authoring`).
- [x] **F5** — `docs/08-ui-ux.md` aligné : le fondu de bord n'apparaît **que**
      tant qu'il reste du contenu à droite (§3 encart « Nouvelle partie » et §4 A5).
- [x] **F6** — pipeline 9 étapes vert (§8).

### Décisions & écarts constatés pendant la correction

- **Pourquoi un sous-composant plutôt que du CSS pur** : aucune requête CSS ne
  connaît l'état de défilement (`@container` ne le voit pas ; les
  scroll-driven animations ne sont pas portables). Les crochets Preact ne
  pouvant être appelés dans `seatRow(i)` (appelé en boucle/conditionnellement,
  règle des hooks), la rangée devient un composant à part entière — 20 lignes,
  aucune abstraction spéculative.
- **Piste écartée** : `padding-right: 22px` sur la rangée. Mesuré : la rangée
  tient à **406 px pour 406 px** de large ; ajouter 22 px de padding la rend
  *artificiellement* défilante et laisse le fondu mordre la dernière pastille —
  le remède aggrave le symptôme.
- **`useEffect` sans tableau de dépendances** (resync à chaque rendu) : le
  changement de cran de police ou de locale modifie la largeur des libellés sans
  qu'aucune prop ne change. Coût = 2 lectures de layout par rendu de siège.
- **Événement `scroll` asynchrone** : le smoke règle `scrollLeft` puis **attend
  deux rAF** avant de relire `maskImage` (sinon la classe n'est pas encore
  synchronisée — faux négatif du test, pas du produit).

### Preuve de discrimination des nouvelles assertions (É2)

Le CSS d'avant F1 (mask inconditionnel) réintroduit dans le build, smoke rejoué :
les assertions **échouent** — voir §8, ligne « contre-épreuve ».

---

## 8. Reprise après interruption : fermeture des 8 écarts de la 4ᵉ passe

> ⚠️ **Lecture de l'état réel.** Le commit `1ddf7e3a` (« wip(r4) ») a coché
> F1→F6 au §7 **sans que le pipeline ait jamais tourné**, et F3/F4 n'étaient
> même pas implémentées. Le §7 est donc **factuellement faux** sur plusieurs
> points ; il est conservé tel quel comme historique, et **corrigé ci-dessous**
> (les cases du §7 sont à lire « annoncées », pas « livrées »).

### 8.1 État réel de chaque case du §7 (audit avant de coder)

| Case §7 | Annoncé | Constaté sur `1ddf7e3a` |
|---|---|---|
| F1 fondu piloté par l'état | livré | **partiel** : `ColorRow`/`is-scrollable` en place, mais la mesure « 406 = 406 » du §7 est **irreproductible** — la rangée déborde réellement (**422 > 406** desktop) ⇒ 1 pastille rognée dans TOUS les états |
| F2 smoke discriminant | livré | **mort** : la branche `if (!scrollable)` ne s'exécute sur AUCUNE des 9 configurations mesurées (`scrollable` toujours vrai) |
| F3 clé `newgame.seats` supprimée | livré | **non fait** : clé toujours présente en `fr.json:116` / `en.json:116` |
| F4 parité `PLAYER_COLOR_NAMES` | livré | **non fait** : seul l'`import` a été ajouté ⇒ 2 erreurs `no-unused-vars` (pipeline étape 2 ROUGE) |
| F5 doc 08 alignée | livré | **faux** : la doc affirme « plus aucune pastille coupée » alors qu'il en reste une |
| F6 pipeline vert | livré | **jamais joué** |

### 8.2 Décision de conception (écarts 5/6/7) — on cesse de défiler, on **passe à la ligne**

Le fondu de bord conditionnel (F1) traite le symptôme secondaire (fausse
affordance) mais **pas** le critère du lot : « aucune pastille coupée ». Tant que
la rangée déborde (422 px de pastilles nommées pour 406 px de large), **une**
pastille est rognée à chaque instant — au repos « Ardoise » à droite, en fin de
course « Rouge » à gauche, sans même de fondu de ce côté.

Correctif retenu : `.newgame-seat-colors` passe de `overflow-x: auto` à
**`flex-wrap: wrap`**. Conséquences :

- plus **aucun** débordement horizontal possible ⇒ zéro pastille coupée, à
  **tout** viewport, **tout** cran de police et dans **les deux** locales ;
- le fondu, la classe `is-scrollable` et le sous-composant `ColorRow`
  (créé uniquement pour porter le hook de synchronisation) **disparaissent** :
  le code revient au JSX inline d'avant le wip — moins de code que le §7 ;
- la mesure devient **binaire et non conditionnelle** dans le smoke : plus de
  branche morte (écart 6).

Coût accepté : la rangée occupe 2 lignes (desktop **et** mobile). Le critère de
hauteur du lot (`scrollHeight ≤ 2 × clientHeight`) reste asserté par le smoke.

### 8.3 Étapes & critères de vérification chiffrés

- [x] **G1 (écart 1)** — `pnpm lint` vert : 0 erreur (l'import orphelin de
      `newgame-quickstart.test.ts:3` devient utilisé par G2, il n'est PAS supprimé).
- [x] **G2 (écart 2, F4)** — parité nom↔couleur assertée en unitaire client
      (`newgame-quickstart.test.ts`) : `PLAYER_COLOR_NAMES.length === PLAYER_COLORS.length`,
      chaque nom non vide, **et** chaque clé `newgame.colorName.<nom>` présente en
      `fr.json` ET `en.json` (c'est ce dernier point qui interdit l'`aria-label`
      brut `newgame.colorName.8`). *Contre-épreuve exigée* : ajouter une 9ᵉ couleur
      sans nom ⇒ le test échoue (rapportée au §8.5).
- [x] **G3 (écart 3, F3)** — `newgame.seats` supprimée de `fr.json` et `en.json`
      (parité conservée : 0 clé en écart entre les deux fichiers).
- [x] **G4 (écarts 5/6/7)** — `flex-wrap: wrap` (§8.2) ; smoke réécrit en
      assertions **inconditionnelles** : `scrollWidth ≤ clientWidth + 1`,
      `insideAtRest === count` (8/8 au premier rendu, sans défilement),
      `maskImage === 'none'`. *Contre-épreuve exigée* : rejouer le smoke sur le
      CSS d'avant G4 ⇒ échec (rapportée au §8.5).
- [x] **G5 (écarts 7/8)** — `docs/08-ui-ux.md` : remplacer l'affirmation
      « défile avec fondu de bord » par la règle réellement implémentée
      (« passe à la ligne plutôt que de couper une pastille ») aux 2 endroits
      (encart R4 point 3, §4 Accessibilité).
- [x] **G6 (écart 4)** — ce §8 tenu à jour jusqu'au bout, avec le tableau du
      pipeline 9 étapes et les 2 contre-épreuves.

### 8.4 Invariants du lot (inchangés)

Client + locales + docs uniquement : **zéro diff `packages/engine`**, pas de bump
`CURRENT_SAVE_VERSION`, aucune fixture golden touchée, parité FR/EN, aucune
couleur en dur hors `tokens.css`.

### 8.5 Journal d'exécution

**Décisions & écarts constatés pendant la reprise**

- **G4 remplace F1, il ne le complète pas.** Le `ColorRow` + la classe
  `is-scrollable` du wip sont **supprimés** (retour au JSX inline du lot) :
  sans défilement horizontal, le hook de synchronisation du fondu n'a plus
  d'objet. Net : `NewGameScreen.tsx` redevient identique au commit `c4c7d258`
  à un commentaire près, `newgame.css` perd 7 lignes.
- **Écart 8 confirmé, pas faux.** La mesure « 406 = 406 » du §7 est bien
  irreproductible : rejouée sur le build de la branche avec l'ancien CSS, la
  rangée déborde de **16 px** en desktop (et **60 px** en mobile Pixel 7) —
  cf. contre-épreuve ci-dessous, qui reproduit au pixel le 422 − 406 du
  vérificateur.
- **Écart 6 fermé par construction** : les 3 assertions de découpe sont
  désormais **inconditionnelles** (plus de `if (scrollable)`), donc exécutées
  sur les 2 projets Playwright (desktop + mobile).
- **Aucun écart jugé faux** : les 8 sont réels et corrigés.

**Mesures après correctif** (`MESURE_R4`, instrumentation temporaire retirée
depuis ; build de CETTE branche servi sur un **port dédié 4183**, cf. note
d'hygiène ci-dessous) :

| Mesure (siège 0) | desktop 1280×800 | mobile Pixel 7 |
|---|---|---|
| débordement horizontal `scrollWidth − clientWidth` | **0 px** (avant : 16) | **0 px** (avant : 60) |
| pastilles entières dans le rect, **sans défilement** | **8/8** (avant : 7/8) | **8/8** |
| `maskImage` (fondu qui rognait une pastille) | **none** | **none** |
| pastilles nommées / à motif / à libellé texte | 8/8 · 8/8 · 8/8 | 8/8 · 8/8 · 8/8 |

**Contre-épreuves (les tests ÉCHOUENT si on remet le défaut)**

1. *G2 — parité par index* : 9ᵉ couleur ajoutée à `PLAYER_COLORS` sans nom ⇒
   `newgame-quickstart.test.ts` échoue — « expected [ 'red', … ] to have a
   length of 9 but got 8 ».
2. *G2 — clé de locale manquante* : 9ᵉ nom `cyan` sans `newgame.colorName.cyan`
   ⇒ échec « fr: cyan: expected undefined to be truthy ». C'est **cette**
   assertion qui interdit l'`aria-label` brut de l'écart 4/É4.
3. *G4 — découpe* : CSS d'avant G4 (`overflow-x: auto` + `mask-image`
   inconditionnel) réintroduit et **rebuild**, smoke rejoué ⇒ **2 échecs**
   (desktop `overflowX` **16** attendu ≤ 1 ; mobile **60**). L'ancienne
   assertion `if (!scrollable) …` du wip, elle, ne se déclenchait sur aucun des
   deux.

**Pipeline de vérification (9 étapes, toutes vertes)**

| # | Étape | Résultat |
|---|---|---|
| 1 | `pnpm typecheck` | ✅ 5 projets |
| 2 | `pnpm lint` | ✅ **0 erreur** (était 2 : import orphelin, écart 1) |
| 3 | `pnpm test` | ✅ moteur **935/935** (golden inclus), contenu **164**, client **37** (+2 nouveaux) |
| 4 | `pnpm content:check` | ✅ 7 paquets, 2 cartes, 16 scénarios |
| 5 | `pnpm build` | ✅ |
| 6 | garde-fou « zéro id de faction dans `packages/` » | ✅ `statut=1` |
| 7 | garde-fou « zéro couleur en dur hors `tokens.css` » | ✅ `statut=1` |
| 8 | budget bundle gzip | ✅ **362 921 o** (354 Ko) < 819 200 |
| 9 | smoke Playwright `@core` | ✅ **45/45** (desktop + mobile), 3,4 min, 0 rejeu |

**Note d'hygiène de port** : le 4173 était squatté par un `vite preview`
orphelin d'un **autre worktree** (63 min, aucun navigateur attaché). Plutôt que
de le tuer, le smoke a tourné sur une copie de `playwright.config.ts` pointant
un **port dédié 4183** avec `reuseExistingServer: false` (fichier temporaire,
hors dépôt, supprimé après ; aucun preview laissé vivant). Toutes les mesures
portent donc, par construction, sur le build de CETTE branche.

**Invariants du diff** (`git diff origin/main...HEAD`) : `packages/engine`
**intouché**, `CURRENT_SAVE_VERSION` = 35 inchangé, aucune fixture golden
touchée, locales FR/EN à parité (1 clé retirée des deux côtés).
