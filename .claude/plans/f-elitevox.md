# Lot F-ELITEVOX — variantes élites de Vox Arcana (pur contenu)

Backlog §2.3 (F-ELITEVOX 🕳️ M, « différé assumé doc 16 §4 » — désormais traité).
Vox Arcana est la seule des 5+ maisons **sans variantes élites** : ses 8
habitations sont `maxLevel:1`. Ce lot ajoute la ligne élite en **pur contenu**,
réutilisant le mécanisme d'upgrade **générique** (Alpha 4.11 — l'unité améliorée
est **dérivée** du dwelling gradué niveau 2, zéro diff moteur).

## Portée F-ELITEVOX

- **8 unités élites** (`data/factions/vox-arcana/units/t*-*-elite.json`) : stats
  ~1.25-1.3× la base (patron Haven), coût majoré, croissance identique, capacités
  conservées/renforcées. Stats **placeholder d'équilibrage** (doc 16 §4 — `faction:sim`
  ultérieur).
- **8 dwellings** (`buildings.json`) : `maxLevel:1` → `maxLevel:2`, niveau 2 =
  `dwelling` vers l'unité élite (l'upgrade base→élite en découle génériquement).
- **manifest** : `units[]` += les 8 ids élites (validation croisée dwelling↔units).
- **locales** : `unit.<id>.name` FR/EN pour les 8 élites.

## Invariants

- **Zéro diff moteur** (upgrade générique déjà livré ; élite = donnée pure) —
  garde-fou faction vert.
- **Aucun bump de sauvegarde** ; **golden inchangé** (unités hors replay inline).
- `sharedGrowthGroups` (apex T7/T8, ids de base) inchangé — les élites n'y entrent
  pas (détail d'équilibrage noté, hors périmètre correctness).

## Vérifs

typecheck · lint · engine+content · content:check (8 dwellings gradués + 8 élites
+ clés de nom) · garde-fou · build · budget · smoke.

## Journal

- branche `claude/f-elitevox` depuis `main` @ merge #248 (F-RESON.1).
