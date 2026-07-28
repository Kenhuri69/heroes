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
