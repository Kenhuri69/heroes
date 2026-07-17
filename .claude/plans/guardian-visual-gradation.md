# Plan — Sprint 2 : « la carte se lit au premier coup d'œil » (A1 + A2 + F4)

> **Statut** : plan détaillé rédigé, implémentation non lancée.
> Parent : `.claude/plans/mvp-game-loop-roadmap.md` (Sprint 2).
> Écarts couverts : **A1** (gradation visuelle des gardiens — proposition
> détaillée doc 18 §3, paliers 0+1), **A2** (croissance hebdo des gardiens),
> **F4** (README assets obsolète).

## 0. Objectif & critère de sortie

Le danger se lit **sans survol** : un gardien solitaire, un groupe et une horde
sont visuellement distincts ; et la carte vit dans le temps : les piles neutres
croissent chaque semaine (pression temporelle du core loop HoMM).

**Critère de sortie mesurable** : sur une carte générée, 3 crans visuels
distincts à l'œil nu ; après N semaines, un gardien non nettoyé a grossi (et
son cran visuel a suivi si un seuil de bande est franchi).

## 1. Invariants (guidelines §8)

- **A1 = zéro diff moteur** : le client possède déjà `count` (état) et la bande
  (`display.strengthBands`, helper `guardianBand` de `shell.tsx` à factoriser).
- **A2 = moteur générique opt-in** : bloc `adventure.guardianGrowth` absent ⇒
  comportement bit-identique (fixtures/golden épargnés).
- Pas de bump `CURRENT_SAVE_VERSION` : `count` du gardien est déjà sérialisé.
- Déterminisme : offsets/échelles des instances **hashés sur `(x, y, unitId)`**
  — jamais `Math.random` ; croissance = arithmétique pure (pas de RNG).
- L'effectif exact n'est **jamais** révélé (choix de design conservé) : la
  gradation mappe les 7 bandes sur 3 crans, le libellé localisé reste la
  source au survol/appui long.
- Accessibilité : le cran « Horde » porte un **marqueur de forme** (étendard),
  jamais la couleur seule (doc 08).

## 2. État des lieux (points d'ancrage vérifiés)

- `render/mapObjects.ts → buildGuardian(unitId, catalog)` (`:477`) : 1 sprite
  unique (repli silhouette procédurale, remplacement async gardé `destroyed`).
  Le `count` n'y entre pas encore — `buildObject` (`:126`) reçoit l'objet
  complet, il suffit de le propager.
- Signatures de reconstruction (`:99-121`) : gardien = signature `obj.type`
  seule ; les errants resynchronisent leur **position** sans rebuild. La
  gradation impose d'inclure le **cran visuel** dans la signature (croissance
  ⇒ franchissement de seuil ⇒ rebuild).
- Bandes : `data/core/config.json → display.strengthBands` (7 bandes,
  seuils 4/9/19/49/99/249/∞) ; libellés déjà affichés (`shell.tsx →
  guardianBand`, `MapObjectCard.tsx`).
- Moteur : `WeekStarted` émis dans `core/engine.ts` (~`:900`, bascule de
  semaine dans EndTurn) **avant** la croissance des villes ; les gardiens
  vivent dans les objets de carte de l'état (`count` mutable — les errants
  bougent déjà).
- Culling : chaque objet est un nœud de la couche d'entités, culé avec son
  chunk — les instances supplémentaires vivent DANS le nœud du gardien ⇒
  culées d'office.

## 3. Étapes

### 3.1 Client — gradation visuelle (A1, palier 0 : zéro asset)

- [ ] a. Factoriser le calcul de bande : helper partagé
      `strengthBandOf(count): BandKey` (module client commun, consommé par
      `shell.tsx`, `MapObjectCard.tsx` et `mapObjects.ts`) + mapping
      `bandTier(band): 'lone' | 'group' | 'horde'`
      (`few/several` → lone ; `pack/lots` → group ; `horde/throng/legion` → horde).
- [ ] b. `buildObject` propage `obj.count` (type gardien) à `buildGuardian` ;
      `buildGuardian(unitId, catalog, count)` compose :
      - **lone** : rendu actuel (1 instance) ;
      - **group** : 2–3 instances du même visuel (sprite OU silhouette de
        repli), décalées en profondeur iso (offsets ± hashés sur
        `(x, y, unitId)`, échelle arrière ~0,9), ombre commune ;
      - **horde** : 3–4 instances resserrées + **étendard** planté derrière
        (voir 3.2). Ordre d'ajout = tri de profondeur interne (arrière → avant).
      Le remplacement async silhouette→sprite s'applique à CHAQUE instance
      (une seule `Assets.load`, N sprites de la même texture).
- [ ] c. Signature de reconstruction : `guardian:<tier>` (au lieu de
      `obj.type`) dans `MapObjectsLayer` — un changement de cran (croissance
      A2, ou pertes après un combat abandonné) force le rebuild ; un simple
      déplacement d'errant reste une resynchro de position.
- [ ] d. Le losange de visée (`groundDiamond`) et la fiche d'appui long
      restent inchangés (une seule case, un seul objet).

### 3.2 Assets — étendard de horde (A1, palier 1 : 1 asset générique)

- [ ] a. Repli **d'abord** : étendard dessiné en Graphics (hampe + flamme
      effilée sombre à liseré), intégré à `buildGuardian` — le sprint est
      livrable sans aucun PNG.
- [ ] b. Génération procédurale : `assets/map/guardian-banner.png` via
      `tools/assets/` (même famille que `gen_faction_badge.py`, skill
      `asset-procedural`), auto-découvert par `render/assets.ts`
      (`import.meta.glob ?url`, hors bundle JS).
- [ ] c. Budget bundle < 800 Ko gzip : intact par construction (asset hors
      bundle) — vérifier le gate CI quand même.

### 3.3 Moteur — croissance hebdo (A2, opt-in)

- [ ] a. Config : bloc **optionnel** `adventure.guardianGrowth
      { "weeklyFactor": number, "cap": number }` (cap = multiple du count
      initial, ex. 4) — type dans `engine/adventure/config.ts` + schéma Zod.
- [ ] b. Application : au point d'émission de `WeekStarted`
      (`core/engine.ts` ~`:900`), si le bloc existe : pour chaque objet
      gardien, `count = min(floor(count × weeklyFactor), initial × cap)` avec
      un plancher `+1` si `floor` n'augmente pas (petites piles). **Question
      d'implémentation** : le `count` initial n'est pas conservé — stocker le
      plafond en absolu à la pose n'est pas possible sans bump save ⇒ le cap
      s'exprime en **valeur absolue de bande** (`cap` = count max, ex. 300) OU
      on accepte `capCount` calculé `initial×N` uniquement pour les nouveaux
      états. **Décision retenue (simplicité, zéro bump)** : cap absolu
      `maxCount` dans la config. Amender ce plan si le playtest exige mieux.
- [ ] c. Données : activer dans `data/core/config.json` :
      `"guardianGrowth": { "weeklyFactor": 1.1, "maxCount": 300 }` (~HoMM
      +10 %/sem).
- [ ] d. Doc : `docs/02-mechanics.md` §2.2 (gardiens) — croissance hebdo,
      opt-in, interaction avec les bandes d'affichage.
- [ ] e. Respawn (`respawnDays`, A2b/P2) : **hors périmètre** de ce sprint,
      noté pour l'étape 3 de la doc 18.

### 3.4 Docs/hygiène — F4

- [ ] a. `assets/README.md` : corriger « aucune intégration client » (une
      ligne — `render/assets.ts` et `app/audio.ts` consomment `assets/`).

### 3.5 Tests (skill `test-authoring`)

- [ ] a. **Unitaires moteur** : croissance sur `WeekStarted` (factor, cap,
      plancher +1) ; config absente ⇒ état bit-identique ; les gardiens
      errants croissent ET bougent sans conflit.
- [ ] b. **Golden** : inchangé attendu (fixtures sans `guardianGrowth`).
- [ ] c. **Smoke carte** (1 cas, `@core`) : un gardien de cran « horde » sur
      la carte de test expose > 1 instance (hook à la `tileToScreen` :
      compteur d'enfants du nœud gardien exposé en mode test) ; le libellé de
      bande au survol reste exact.
- [ ] d. **Perf** (`@perf`) : le smoke anti-gel ×4 existant passe sur carte
      avec gardiens gradués (pré-câblage du filet 3.b du Sprint 3).

### 3.6 Vérifications standard avant PR

- [ ] typecheck + lint + tests moteur + golden + garde-fou « zéro faction »
      (les crans visuels sont dérivés des bandes de config, aucun id de
      faction nulle part) + budget + smoke desktop/mobile.
- [ ] Skill `verify` : nouvelle partie → repérer à l'œil un solitaire, un
      groupe, une horde ; passer 2 semaines → un gardien a grossi.

## 4. Hors périmètre (assumé)

- Palier 2 assets (overlays crânes/trophées par bande) : uniquement si le
  playtest juge les paliers 0+1 insuffisants (doc 18 §3.2).
- Respawn de gardiens (`respawnDays`) : étape 3 doc 18.
- Cartouche de bande sous le jeton au cran de police max : option a11y à
  évaluer au playtest, pas dans ce lot.

## 5. Risques

| Risque | Mitigation |
|---|---|
| Perf : ×3-4 sprites par gardien sur grande carte | même texture partagée (1 `Assets.load`), instances dans le nœud culé existant ; test `@perf` 3.5.d |
| Golden cassé par la croissance | opt-in strict ; si le golden bouge, l'opt-in fuit — corriger, ne pas re-fixer |
| Écrasement visuel des tuiles voisines (sprites debout qui débordent) | offsets bornés au losange ± marge déjà tolérée par les props de relief ; zIndex du nœud inchangé (`isoDepth`) |
| Cap de croissance mal calibré (piles absurdes) | `maxCount` absolu aligné sur le seuil `legion` (249+) ; re-calibrable en data sans code |

## 6. Suivi

- [x] Plan rédigé (2026-07-17)
- [ ] 3.1 gradation client
- [ ] 3.2 étendard (repli + asset)
- [ ] 3.3 croissance moteur
- [ ] 3.4 F4 README
- [ ] 3.5 tests
- [ ] 3.6 vérifs + PR
