# Plan — Phase 3.8 : Durcissement — garde de version de sauvegarde

Suite du durcissement post-MVP (choix utilisateur « Durcissement du MVP »).
Angle mort concret repéré au lot 3.7 : `GameState.saveVersion` est un champ
**décoratif** (littéral `1`, jamais incrémenté alors que la forme d'état a
changé en 3.4/3.5) et **jamais vérifié au chargement**. `deserializeState`
caste aveuglément le JSON en `GameState` : une sauvegarde d'une ancienne forme
se charge en état malformé (champs `factionCatalog`/`scenario`/`outcome`
absents) → plantage à la première résolution d'effet de faction, plutôt qu'un
rejet propre.

## Objectif

Établir un **vrai mécanisme de version de sauvegarde** : source unique de
vérité, incrémentée pour refléter les changements de forme depuis 3.4/3.5, et
**contrôlée au chargement** (IndexedDB « Continuer » + import `.heroes`). Une
sauvegarde incompatible est **rejetée proprement** (traitée comme absente /
import invalide) au lieu de corrompre la partie.

## Étapes

- [x] Étape 1 — moteur : `CURRENT_SAVE_VERSION=2`, `readSaveVersion`, exports, tests (+3), golden re-fixé `48073225`→`3568ea04`.
- [x] Étape 2 — client : `encodeHeroesFile` partagé, garde dans `readSlot`/`decodeStoredValue` + `importSave`, hook + smoke de rejet (+2, 38 verts).
- [x] Étape 3 — doc 07 §4 (garde de version), vérif complète, PR.

1. **Moteur — source de vérité + lecture de version**
   - `state.ts` : `export const CURRENT_SAVE_VERSION = 2` ; `saveVersion` typé
     `number` ; `createEmptyState` pose `CURRENT_SAVE_VERSION`.
     (Bump 1→2 : reflète honnêtement les changements de forme 3.4/3.5.)
   - `serialize.ts` : `readSaveVersion(snapshot): number | null` (parse tolérant,
     null si absent/non-numérique/JSON invalide). `deserializeState` inchangé.
   - `index.ts` : exporter `CURRENT_SAVE_VERSION` et `readSaveVersion`.
   - **Vérif** : test moteur — un état sérialisé porte `CURRENT_SAVE_VERSION` ;
     `readSaveVersion` rend le nombre / null sur ordures. Golden **re-fixé**
     (le champ est dans l'état haché — changement intentionnel).
2. **Client — garde au chargement**
   - `save.ts` : refactor DRY `encodeHeroesFile(snapshot, packs)` (partagé par
     `exportSave`). `decodeStoredValue`/`readSlot` : version incompatible ⇒
     `null` (⇒ « Continuer » grisé, pas de chargement d'un état malformé).
     `importSave` : version incompatible ⇒ `false` (toast « import invalide »).
   - **Vérif** : le happy-path (`saveRoundtrip`, version courante) reste vert ;
     nouveau smoke du chemin de rejet via un hook de test dédié qui importe une
     sauvegarde à version incompatible.
3. **Docs + intégration** : note doc 07 §4 (garde de version) ; vérif complète ;
   PR.

## Vérification globale

typecheck, lint, garde-fou de modularité, tests moteur (+ golden re-fixé) +
contenu, `content:check`, smoke desktop+mobile (happy-path + rejet), budget
bundle. 

## Écarts

- Pas de **migration** d'anciennes sauvegardes (rejet propre seulement) — la
  migration ascendante est hors périmètre MVP (doc 07 §4, incrémental différé).
