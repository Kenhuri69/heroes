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

### 1.2 Audit des transitions Adventure ↔ Town ↔ Combat ↔ Siège *(M)*
- Piloter à la main (skill `run`) chaque transition et son retour, chercher :
  cycles de vie de scène (fuite `AdventureScene`/`CombatScene`, cf. CL1/B45),
  caméra mal recentrée, brouillard périmé, sprites orphelins, route désynchro de
  `game.combat`.
- Fichiers sous surveillance : `app/router.ts`, `scenes/adventure/AdventureScene.ts`
  (`destroy()`), `scenes/combat/CombatScene.ts`, `app/game.ts` (`ensureScenes`).
- **Vérif :** aucune fuite mémoire sur 10 allers-retours (heap stable via DevTools),
  aucun warning console, caméra centrée sur le bon héros à chaque main.

### 1.3 Perf grande carte + mobile, chiffrée *(M)*
- Générer une carte **256²** (Immense) riche en objets/props, mesurer FPS
  pan/zoom desktop + profil mobile (throttle ×4/×6), heap, temps de génération.
- Vérifier le culling (`cullTilemap`), le batching des chunks, l'anti-gel ×4
  (déjà garde-fou côté combat/carte — étendre le smoke `@perf` si trou).
- Si régression : pooling de sprites d'objets, throttle du `cullTilemap` (ne
  recalculer que si la caméra a bougé > seuil), réduire la densité de props au
  zoom éloigné.
- **Vérif :** ≥ 30 FPS pan sur 256² desktop ; démarrage < N s ; budget bundle
  intact ; smoke `@perf` vert.

### 1.4 Robustesse sauvegarde — confirmer, pas reconstruire *(S)*
- La versioning/export/import/autosave/`SaveFailed` **existent**. Ajouter les
  cas de non-régression manquants : reload cross-version rejeté proprement,
  import `.heroes` corrompu → toast (pas de crash), autosave en quota plein →
  `SaveFailed`.
- **Vérif :** unitaires `app/save.*` + un cas smoke reload.

**Milestone S1 :** *« Une partie complète se joue, se sauvegarde, se recharge et
se re-joue sans rupture ; perf chiffrée sur carte Immense + mobile ; toutes les
transitions vérifiées. »*

---

## Sprint 2 (5-7 j) — Ergonomie P0 : le combat mobile & la carte au pouce
Source : `game-ergonomics-immersion-review.md` Lots 0→2 (vague 1). Certains items
(E13/E14/E15/E8) sont déjà tombés en commits récents — **re-vérifier l'état exact
avant d'attaquer**, ne pas refaire.

### 2.1 Lot 0 — micro-correctifs sans risque *(reliquat E2/E13 — ½ j)*
### 2.2 Lot 1 — combat mobile : rendre le plateau au joueur *(E1/E3/E10 — 2-3 j)*
- Hexes de combat sous 44 px en mobile (cf. skill `ux-audit` CL7), zoom/pan du
  plateau, lisibilité de la file d'initiative. Fichiers : `scenes/combat/*`,
  `ui/combat.tsx`, `render/hexgrid.ts`.
### 2.3 Lot 2 — navigation au pouce sur la carte *(E4 — 1-2 j)*
- Confort du tap-tap, taille des cibles d'objets, gestes. Fichiers :
  `input/pointer.ts`, `AdventureScene.handleTap/handleLongPress`.

**Milestone S2 :** *« Le combat et la carte se pilotent confortablement au pouce
sur mobile (audit ux-audit vert sur les écrans concernés). »*

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
- [ ] S1.2 audit transitions
- [ ] S1.3 perf chiffrée
- [ ] S1.4 non-régressions save
- [ ] S2 ergo P0 (lots 0-2)
- [ ] S3 ergo P1 (lots 3-4)
- [ ] S4 immersion (lots 5-7)
- [ ] S5 (optionnel) monde/audio
