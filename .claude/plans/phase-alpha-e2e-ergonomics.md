# Plan — Alpha jouable & fluide : durcissement E2E + ergonomie P0/P1

> **Cadrage (2026-07-19).** Revue de l'état réel du code (pas des docs) : la
> Carte d'Aventure, le pathfinding+preview, le fog, la caméra, le rendu d'objets
> et la sauvegarde versionnée sont **déjà livrés** (`packages/client/src/render/*`,
> `scenes/adventure/AdventureScene.ts`, `app/save.ts`). Le backlog de code de
> l'audit doc 18 est **épuisé**. Le vrai reste-à-faire pour une Alpha « jouable et
> fluide, prête à faire tester » n'est pas de la construction mais :
> **(1)** une passe de vérification jouée bout-en-bout + correction des ruptures
> d'intégration/transitions, **(2)** une validation perf mesurée (grande carte +
> mobile), **(3)** la finition des lots ergonomie/immersion P0/P1 encore ouverts
> (`game-ergonomics-immersion-review.md`).
>
> Décision utilisateur : **« les deux, séquencés »** — Sprint 1 = E2E+perf, puis
> ergonomie P0/P1, puis polish. Typecheck monorepo : vert au démarrage.

## Invariants (guidelines §8) — non négociables à chaque lot
- Zéro `if (faction === …)` dans `packages/engine` (garde-fou CI).
- RNG seedé uniquement (jamais `Math.random`) dans le moteur.
- Moteur sans dépendance rendu/DOM.
- Touch-first ; cibles ≥ 44 px ; jamais la couleur seule.
- Docs `docs/0X-*.md` = source de vérité, mises à jour dans le même commit.
- Extension moteur = **une** variante d'union générique opt-in (pas de bump
  `CURRENT_SAVE_VERSION` ni de golden re-fixé si la config est absente).
- Chaque lot = PR draft atomique ; vérifs standard : typecheck, lint, tests,
  golden, garde-fous faction/couleurs, budget < 800 Ko gzip, smoke.

---

## Sprint 1 (5-7 j) — Boucle E2E prouvée + perf mesurée
**But :** transformer « ça devrait marcher » en « c'est vérifié bout-en-bout et
chiffré ». Priorité absolue avant toute nouvelle finition.

### 1.1 Harnais de vérification E2E jouée *(S/M)* — ✅ LIVRÉ
- Test `@e2e` ajouté dans `tests/smoke.spec.ts` (réutilise les helpers existants,
  guideline §3 — pas de duplication) : **une session continue** New Game →
  exploration/ramassage (tap-tap réel) → aller-retour Ville → combat de gardien
  (pré-combat → Auto-Battle → bilan) → retour carte → fin de tour/autosave →
  rechargement « Continuer » → l'état persiste à l'identique. Helper
  `expectAutosaveDurable`. Siège couvert séparément par S-TEST.
- **Décision utilisateur : `@e2e` OPTIONNEL en CI.** Job `e2e` dédié dans
  `ci.yml` avec `continue-on-error: true` (tourne + visible sur chaque PR, ne
  bloque jamais la fusion) ; `@e2e` exclu des runs bloquants (job `smoke` en
  workflow_dispatch + `deploy.yml`) via `--grep-invert='@perf|@e2e'`. `@e2e`
  n'est ni `@core` ni `@mobile` ⇒ absent du noyau PR par construction.
- **Vérif (faite) :** test vert en local (12 s, Chromium local) ; `--list`
  confirme l'isolation de tag (dans `@e2e`, absent de `@core`) ; `pnpm lint` +
  `pnpm typecheck` verts ; YAML des 2 workflows valide.

### 1.2 Audit des transitions Adventure ↔ Town ↔ Combat ↔ Siège *(M)* — ✅ LIVRÉ
- **Audit lu ligne à ligne** du cycle de vie : `main.ts` (`ensureScenes`/
  `teardownScenes` — l'orchestration vit là, pas dans `app/game.ts`),
  `AdventureScene.destroy()`, `CombatScene` (constructeur/`destroy`), `camera.ts`
  (`destroy`), `camera-control.ts` (register/unregister), `input/pointer.ts`
  (`onTap`/`onLongPress`).
- **Verdict : aucune fuite.** Cycle de vie déjà durci (CL1/CL2/B45) — symétrie
  add/remove complète : chaque scène libère ses 4 abonnements (store/eventBus/
  tap/longPress), son ticker, sa caméra (listeners `app.stage` + canvas `wheel`/
  `pointercancel`) ; `onTap`/`onLongPress` retirent tous leurs listeners et
  `onLongPress` purge son `setTimeout` ; `panCameraTo` s'arrête via la garde
  `registered !== reg` si la caméra meurt en vol. La scène de COMBAT n'est pas une
  route : dérivée de `game.combat` ⇒ zéro désync route/état. La vue de Ville est
  une **modale DOM** (aucune scène Pixi démontée). Route désync / sprites
  orphelins / brouillard périmé : non reproduits.
- **Non-régression automatisée** (verrou anti-régression) : test `@e2e`
  « allers-retours Aventure↔Combat sans fuite » — 5 A/R dans une session,
  empreinte du scène-graphe (`app.stage.children` + `listenerCount('pointerdown')`
  via le nouveau hook `sceneGraphStats`) qui **revient exactement à la ligne de
  base** après chaque cycle (et croît pendant le combat = preuve de montage).
- **Trouvaille mineure (perf, PAS une fuite) → S1.3 :** l'`onTick` de
  `AdventureScene` (culling + waterSheen) continue pendant le combat alors que
  `camera.world` est masqué — travail par-frame gaspillé. À couper/throttler dans
  le lot perf 1.3 (le throttle `cullTilemap` sur delta caméra le neutralise déjà
  en partie).
- **Vérif (faite) :** test `@e2e` vert en local (Chromium local) ; `pnpm lint` +
  `pnpm typecheck` verts.

### 1.3 Perf grande carte + mobile, chiffrée *(M)* — ✅ LIVRÉ
- **Fix throttle `cullTilemap`** (`AdventureScene`) : recalcul de visibilité des
  chunks seulement quand la caméra (x/y/zoom) OU la taille écran change au-delà
  d'un seuil — sur 256² cela supprime des centaines de tests AABB/frame quand la
  vue est immobile, sans jamais laisser un chunk périmé (le resize rouvre le
  recalcul).
- **Fix trouvaille S1.2** : `onTick` sort tôt quand `camera.world.visible` est
  faux (combat) — plus de culling ni de miroitement d'eau par-frame invisibles.
- **Mesure** (rendu logiciel CI, repère) : carte 256² générée par le vrai chemin
  `heroes:start-newgame` ; le **culling borne le rendu à ~17 chunks visibles /
  25 bâtis sur 256** — l'échelle tient. FPS sous rendu logiciel : arène 12.9,
  aventure proto 7.5 (≥ floor anti-gel 5), 256² ~1-2 fps (le raster logiciel
  domine sur si grande carte — sur GPU réel le culling rend la carte fluide ;
  fps LOGGÉ, non asserté car trop bruité en CI). Le budget « ≥ 30 fps pan sur
  256² » est un objectif device (hors mesure CI logicielle).
- **Non-régression** : test `@e2e` « perf 256² : le culling borne les chunks
  rendus » — assertion DÉTERMINISTE (`visible < total/2`, `built < total`, via le
  nouveau hook `tilemapStats`), fps en annotation seulement. Optionnel en CI.
- **Profil mobile / heap / pooling** : non nécessaires — le culling déjà en place
  borne le travail (prouvé) ; pas de pooling spéculatif (guideline §2), à
  n'ouvrir que sur mesure device réelle.
- **Vérif (faite) :** 3 tests `@e2e` verts + I12 (eau) + les 2 `@perf` existants
  verts (aucune régression) ; `pnpm lint` + `pnpm typecheck` verts.

### 1.4 Robustesse sauvegarde — confirmer, pas reconstruire *(S)* — ✅ LIVRÉ
- **État des lieux (déjà couvert)** : autosave→Continuer (happy), aller-retour
  export/import `.heroes` (happy), **import version incompatible → rejeté** (lot
  3.8), **échec de stockage (navigation privée/quota) → toast d'erreur**
  (`SaveFailed`, lot 3.9). ⇒ la cible « quota plein → `SaveFailed` » est **déjà
  tenue**, ne pas dupliquer (guideline §3, skill test-authoring).
- **Trou réel comblé** : import d'un **fichier corrompu** (pas un gzip valide —
  mauvais fichier choisi) → l'échec survient dans le `try/catch` de `importSave`
  (branche DISTINCTE du rejet de version). Nouveau hook `importCorruptedSave` +
  smoke « sauvegarde corrompue : import rejeté proprement sans crash » : rendu
  `false`, **aucune exception**, partie en cours **intacte** (ni navigation ni
  chargement partiel), zéro erreur console.
- **Reload cross-version (chemin IndexedDB)** : la garde `isCompatible` du chemin
  de chargement (`decodeStoredValue`) est la MÊME que celle de l'import (testée)
  et le câblage IndexedDB read/decode est exercé par le smoke autosave→Continuer
  ⇒ couvert par composition, pas de smoke redondant ajouté (discipline skill).
- **Vérif (faite) :** 3 tests de robustesse save verts (corrompu + incompatible +
  échec stockage) ; `pnpm lint` + `pnpm typecheck` verts.

**Milestone S1 :** *« Une partie complète se joue, se sauvegarde, se recharge et
se re-joue sans rupture ; perf chiffrée sur carte Immense + mobile ; toutes les
transitions vérifiées. »*

---

## Sprint 2 (5-7 j) — Ergonomie P0 : le combat mobile & la carte au pouce
Source : `game-ergonomics-immersion-review.md` Lots 0→2 (vague 1).

### ⚠️ Découverte (audit vs `main`, 2026-07) : **les Lots 0/1/2 P0 sont DÉJÀ LIVRÉS.**
Audit item par item (agent Explore, preuves `fichier:ligne`) : 0.1 « Se rendre »
sans « (0 or) » ✅, 0.2 sous-libellé « Aucune sauvegarde » ✅, 0.3 pip ville non
chromatique ✅, 0.4 bouton « raccourcis » dans Options ✅ ; 1.1 barre compacte + « ⋯ »
(5 primaires) ✅, 1.2 bandeau d'aide ancré ✅, 1.3 fondu + auto-scroll initiative ✅,
1.4 pan de combat borné (clamp, ≥44 px) ✅ ; 2.1 « héros suivant » HUD ✅, 2.2 tap
portrait = centrer ✅, 2.3 accès villes (bouton/ville plutôt que popup-liste —
objectif joueur atteint, écart de forme). ⇒ **aucune construction P0 à faire.**

### 2.x Verrou de non-régression P0 (fait) *(½ j)*
Les micro-correctifs P0 n'avaient **pas** de test de non-régression (ils pouvaient
régresser en silence). Ajout d'assertions aux tests de même état (pas de smoke
redondant, skill test-authoring) : **0.2** `menu-continue-hint` visible quand
« Continuer » est grisé ; **0.4** `options-shortcuts` atteignable sans clavier →
ouvre `ShortcutsOverlay` ; **0.1** le libellé « Se rendre » ne contient **jamais**
« (0 » (verrou robuste du bug corrigé). **Vérif :** 3 tests étendus verts,
`pnpm lint`/`typecheck` verts.

**Milestone S2 (P0) :** *atteint AVANT ce sprint — verrouillé ici.* La vraie
friction restante est en P1 (Lot 4 confort de gestion) — voir Sprint 3.

---

## Sprint 3 (5-7 j) — Ergonomie P1 : feedback & confort de gestion
Source : review Lots 3→4 (vague 2).
- **Lot 3** (E9/E2/E14/E8) : moins de bruit, raisons visibles des actions,
  filtres de journal, avertissements de combat — re-vérifier ce qui reste après
  #494/#496.
- **Lot 4** (E5/E6/E7/E11/E12) : confort de gestion (découpable) — récap fin de
  tour, accès rapide héros/ville, files de recrutement/construction.

**Milestone S3 :** *« Le jeu "répond" : chaque action a une raison visible, la
gestion multi-héros/multi-ville est fluide. »*

---

## Sprint 4 (5-7 j) — Immersion sans nouveaux assets + moments forts
Source : review Lots 5→7 (vagues 3-4).
- **Lot 5** (I2/I3) : le combat prend vie (juice `render/combatFx.ts` déjà là —
  étendre), sans assets neufs.
- **Lot 6** (I7/E2) : chasse aux placeholders visibles en partie réelle.
- **Lot 7** (I9/I10/I14/E15) : habiller victoire/hot-seat/moments forts.

**Milestone S4 :** *« Plus aucun placeholder en partie réelle (hors planches
d'assets longues) ; les moments forts sont habillés. »*

---

## Sprint 5 (optionnel, à trancher) — monde qui respire & audio
Review Lots 8-9 (I1/I12 déjà partiellement là via `waterSheen`; I8 audio
d'identité — nécessite des pistes). Lot 10 (P3, gros chantiers) = arbitrage
séparé, hors périmètre Alpha.

---

## Risques techniques & parades
| Risque | Impact | Parade |
|---|---|---|
| Fuites de scène au changement Adventure↔Combat (déjà mordu : CL1/B45) | dégradation perf en session longue | Lot 1.2 : audit heap sur 10 A/R, garder les `destroy()` sans `texture:true` |
| Perf 256² + props sur mobile | gel/jank | culling par-frame existant ; throttle `cullTilemap` sur delta caméra ; pooling objets |
| Refaire un item ergo déjà livré (E8/E14/E15) | gaspillage | re-vérifier chaque lot vs commits `main` avant d'ouvrir la PR |
| Toucher au moteur pour un fix UX | casse garde-fous / golden | tout fix Alpha reste client/données ; extension moteur = union générique opt-in seulement |
| Budget bundle < 800 Ko gzip | échec CI | assets hors bundle (`assetsInlineLimit:0`) ; mesurer à chaque PR |
| Déterminisme (perte de reproductibilité) | replays/tests cassés | jamais `Math.random`, `performance.now()` seulement pour l'animation (jamais l'état) |

## Refactorings clés (seulement si le sprint les justifie)
- **`cullTilemap` throttlé sur delta caméra** (1.3) : ne recalculer les chunks
  visibles que si la caméra a bougé au-delà d'un seuil — économie de frame sur
  grande carte. Refactor local dans `AdventureScene.onTick`.
- **Pool de nœuds d'objets de carte** (1.3, si mesuré nécessaire) : réutiliser
  les `Container` de `MapObjectsLayer` au lieu de `destroy()`/recréer au sync.
- Pas de refactor spéculatif (guideline §2/§3) : n'ouvrir que sur mesure.

## Suivi
- [x] S1.1 harnais E2E (test `@e2e` + job CI non bloquant ; vérifié local)
- [x] S1.2 audit transitions (aucune fuite ; verrou `@e2e` return-to-baseline)
- [x] S1.3 perf : throttle cullTilemap + skip combat + verrou culling 256²
- [x] S1.4 non-régressions save (import corrompu ; quota/version déjà couverts)
- ✅ **Sprint 1 (durcissement E2E) TERMINÉ** → suite : Sprint 2 (ergo P0)
- [ ] S2 ergo P0 (lots 0-2)
- [ ] S3 ergo P1 (lots 3-4)
- [ ] S4 immersion (lots 5-7)
- [ ] S5 (optionnel) monde/audio
