# Plan — Boucle de jeu MVP « complète et agréable » (roadmap priorisée)

> **Statut** : plan livré (analyse + roadmap). Aucun code modifié dans ce lot ;
> chaque sprint ci-dessous ouvrira son propre plan vivant (guidelines §5) et sa
> PR atomique. Source des écarts : `docs/18-audit-fonctionnalites-vs-heroes-online.md`
> (audit 2026-07, source de vérité du comblement).

## 0. Constat d'état — le brief est en retard sur le repo

La demande initiale (« finaliser le rendu carte d'aventure et combat hex »)
décrit un état du projet **antérieur au jalon MVP**, atteint depuis (doc 01 §5,
mémoire projet). Vérification code à l'appui :

| Demande du brief | État réel (fichiers pivots) |
|---|---|
| Grille iso fluide PixiJS | ✅ `render/projection.ts` (losange 2:1), `render/tilemap.ts` (chunks 16² + culling viewport) |
| Path preview + pathfinding visuel | ✅ `render/pathPreview.ts` (A* moteur, jours affichés, tap-tap) |
| Fog of War + vision | ✅ `render/fog.ts` (2 états), vision moteur (`engine/adventure`) |
| Objets de carte (villes, mines, héros, props) | ✅ `render/mapObjects.ts`, `townsLayer.ts`, `heroSprite.ts`, `terrainProps.ts` (~14 types d'objets) |
| Caméra pan/zoom/follow | ✅ `render/camera.ts` (touch-first, pinch), `app/camera-control.ts` (pan animé easeInOutQuad), recentrage sur héros actif |
| Perf cartes moyennes/grandes | ✅ chunking + culling, tailles 64→256², smoke anti-gel ×4 |
| Grille hex combat + placement | ✅ `render/hexgrid.ts`, `scenes/combat/CombatScene.ts` (1183 lignes) |
| Animations attaque/mouvement | ✅ tweens ruée/flash/secousse/fondu de mort, popups dégâts/kills, vitesse réglable, reduce-motion |
| Combat log + feedback | ✅ `app/combat-log.ts` (~20 types d'événements, i18n) |
| UI combat (actions, spellbook, fin de tour) | ✅ livre de sorts, file d'initiative, pré-combat Auto-Battle/Abandon, bilan de fin |
| Boucle New Game → … → Résultat | ✅ `NewGameScreen` (2-4 joueurs, factions, héros de départ), `CombatResultScreen`, transitions scènes (remédiation R2) |
| Sauvegarde IndexedDB + versioning + export/import + autosave | ✅ save v32, `CURRENT_SAVE_VERSION` gardé, autosave fin de tour, `.heroes` export, `SaveFailed` surfacé |

**Conclusion** : ne pas rouvrir ces chantiers (couverts par smoke + golden).
Le vrai travail « boucle complète et agréable » = les écarts P1 de la doc 18
qui touchent la **lisibilité** et le **plaisir de jeu** de la boucle existante.

## 1. Priorités retenues (P1 doc 18, rapport impact/coût décroissant)

1. **B6 — « Juice » de combat** : aucun projectile (le SFX `combat-shoot` tire
   dans le vide), aucun FX d'impact de sort. Client + assets, zéro moteur.
2. **A1 — Gradation visuelle des gardiens** : un gardien de 2 unités et une
   légion de 300 = même sprite. Proposition détaillée doc 18 §3 (paliers 0+1).
   Client + 1 asset, zéro moteur.
3. **E1 — Vue de royaume** : dès 2+ villes, la gestion ville-par-ville devient
   pénible. Client pur (l'état expose déjà `dailyIncome`, `TownState`, `HeroState`).
4. **B1 — Pénalité de portée de tir** : les tireurs sont structurellement
   surpuissants (portée illimitée sans falloff). Moteur générique **opt-in**
   (`combat.rangePenalty` en data) + préviz déjà branchée sur `estimateDamage`.
5. **A2 — Croissance hebdo des gardiens** : pression temporelle du core loop
   HoMM. Moteur générique **opt-in** (`adventure.guardianGrowth`).

Différé hors de ce cycle (tracé ailleurs) : D1 vue de ville peinte (= jalon
Beta, dépend des assets), étapes 3-5 de la doc 18 (équilibrage, en ligne,
décisions de cadrage).

## 2. Plan d'attaque par sprint (~1 semaine chacun)

### Sprint 1 — Le combat se lit sans le log (B6 + B1)
- [ ] 1.a **Projectiles de tir** : sprite interpolé tireur→cible sur
      `StackAttacked` à distance (flèche/carreau/boulet par famille d'unité,
      **repli procédural** : trait lumineux dessiné). Intégration dans la file
      d'animations existante de `CombatScene.animateEvent` (respect `animatingIds`,
      B38). → vérif : smoke arène « projectile visible », reduce-motion le coupe.
- [ ] 1.b **FX d'impact de sort** par `SpellKind` (dégâts : onde/flash coloré
      par école ; soin : particules montantes ; buff/debuff : halo bref) sur
      `SpellCast`/`UnitSpellCast`. Nouveau module `render/combatFx.ts` (pur
      présentation, consomme l'eventBus). → vérif : smoke + revue visuelle.
- [ ] 1.c **Pénalité de portée** (`combat.rangePenalty { hexes, factor }` dans
      `data/core/config.json`, absente ⇒ comportement inchangé ⇒ golden intact) ;
      préviz de dégâts et fiche d'unité reflètent la pénalité. → vérif :
      unitaires `combat/damage`, golden inchangé, doc 02 §5.3 mise à jour.
- **Milestone S1** : « une bataille se comprend écran seul : chaque tir et
  chaque sort a un visuel ; les tireurs ont un contre-jeu ».

### Sprint 2 — La carte se lit au premier coup d'œil (A1 + A2)
- [ ] 2.a **Gradation visuelle des gardiens** — paliers 0+1 de la doc 18 §3 :
      composition à la volée dans `render/mapObjects.ts → buildGuardian`
      (1 / 2-3 / 3-4 instances du sprite selon la bande, offsets **hashés sur
      (x, y, unitId)** — jamais `Math.random`), bannière générique du cran
      « Horde » (asset procédural + repli dessin). Instances culées avec leur
      chunk. → vérif : smoke « jeton horde > 1 instance », budget bundle intact.
- [ ] 2.b **Croissance hebdo des gardiens** : bloc opt-in
      `adventure.guardianGrowth { weeklyFactor, cap }` appliqué au `WeekStarted`
      (le `count` vit déjà dans l'état ⇒ **pas de bump save**). → vérif :
      unitaires `WeekStarted`, config absente ⇒ golden inchangé, doc 02 §2.2.
- [ ] 2.c Correctif une ligne `assets/README.md` (F4, glissé dans le lot assets).
- **Milestone S2** : « le danger se lit sans survol ; la carte met la pression
  dans le temps ».

### Sprint 3 — Gérer son royaume sans friction (E1)
- [ ] 3.a **Vue de royaume** : nouvel écran/onglet (villes + chantier du jour +
      garnison résumée + revenus/jour agrégés + héros/armées), navigation
      directe vers une ville ou un héros (tap ⇒ `TownScreen` / centrage caméra).
      Client pur, données déjà exposées par l'état. Touch-first (cibles ≥ 44 px,
      3 crans de police). → vérif : smoke « ouvrir la vue, naviguer vers une
      ville », audit ux (skill `ux-audit`) sur le nouvel écran.
- [ ] 3.b Filet perf : passage du smoke anti-gel throttling ×4 sur carte 128²
      avec gardiens gradués (régression éventuelle du sprint 2).
- **Milestone S3** : « fin de tour → un écran répond à “où en suis-je ?” —
  boucle MVP confortable à 2+ villes ».

## 3. Fichiers critiques par sprint

| Sprint | À modifier | À créer |
|---|---|---|
| 1 | `scenes/combat/CombatScene.ts` (file d'animations), `engine/combat/damage.ts` + `data/core/config.json` (1.c), `scenes/combat/preview.ts` | `render/combatFx.ts` (+ éventuels PNG projectiles, repli procédural) |
| 2 | `render/mapObjects.ts` (`buildGuardian`), `engine/adventure` (WeekStarted, 2.b), `data/core/config.json` | `assets/map/guardian-banner.png` (pipeline `tools/assets/`) |
| 3 | `ui/shell.tsx` (point d'entrée), `app/store.ts` (état d'ouverture) | `ui/KingdomOverview.tsx` + CSS |

## 4. Risques & mitigations

| Risque | Mitigation |
|---|---|
| Budget bundle < 800 Ko gzip (nouveaux FX/assets) | assets hors bundle (`import.meta.glob ?url`, `assetsInlineLimit: 0`), repli procédural systématique ; gate CI existant |
| Perf mobile (N instances de gardiens, particules de sorts) | instances culées avec leur chunk ; FX = objets courts recyclés, pas de système de particules générique ; smoke anti-gel ×4 étendu (3.b) |
| Déterminisme / golden | tout ce qui touche le moteur est **opt-in par data** (config absente ⇒ comportement bit-identique) ; offsets visuels hashés, jamais `Math.random` |
| Forme de sauvegarde | aucun bump prévu (`count` gardien déjà sérialisé ; FX et vue de royaume = présentation pure) ; si un champ s'avère nécessaire ⇒ bump `CURRENT_SAVE_VERSION` + changelog `engine/core/state.ts` |
| Dérive du temps de CI | suivre le skill `test-authoring` : unitaires moteur pour 1.c/2.b, 1 seul cas smoke par surface visuelle nouvelle |
| File d'animations combat (B38 : morts/jetons gardés) | insérer les projectiles/FX **dans** `animateEvent` (séquencement existant), pas en parallèle sauvage |

## 5. Suivi

- [x] Analyse de l'état réel du code (client + doc 18) — 2026-07-17
- [x] Roadmap priorisée rédigée et poussée (ce fichier)
- [x] Plans détaillés des 3 sprints rédigés — 2026-07-17 :
      `combat-juice-range-penalty.md` (S1), `guardian-visual-gradation.md`
      (S2), `kingdom-overview.md` (S3) — étapes, points d'ancrage code
      vérifiés, tests par niveau, risques, hors-périmètre
- [x] Sprint 1 : **livré** (B6 juice + B1 pénalité de portée) — `combatFx.ts`
      (projectiles + FX de sorts, procédural), `rangePenalty` opt-in moteur,
      tests moteur + 2 smokes. Golden inchangé, pas de bump save. Détail dans
      `combat-juice-range-penalty.md`.
- [x] Sprint 2 : **livré** (A1 gradation visuelle des gardiens + A2 croissance
      hebdo opt-in + F4 README) — helper `strengthBand`, cluster 1/3/4 instances +
      étendard de horde (procédural), `guardianGrowth` moteur (golden inchangé,
      pas de bump save). Détail dans `guardian-visual-gradation.md`.
- [ ] Sprint 3 : implémentation lancée
