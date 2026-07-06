# Plan — DA Beta : décors bespoke (sprites de gardiens + fix nommage sprites)

> Choix utilisateur (fork post-§5.3) : « DA Beta : décors bespoke ». Constat
> d'inventaire : les **fichiers** de fonds/tuiles/unités sont **déjà produits et
> intégrés** ; les nouveaux pixels peints passent par un outil image externe
> (étape manuelle utilisateur, cf. `asset-creation-strategy.md`). Ce lot livre
> les deux améliorations de DA **autonomes** (aucun nouveau pixel) trouvées à
> l'audit.

## Constat déclencheur (2026-07-06)
1. **Sprites Arcane Hunters mal nommés** : 5/8 fichiers portent un suffixe de
   nom (`t1-eleve-sombreveille.png`) alors que l'id d'unité est `t1-eleve`. Le
   résolveur `unitSpriteUrl(id, faction) → registry.get('units/<faction>/<id>')`
   fait une clé **exacte** → ces 5 sprites bespoke **ne s'affichent jamais**
   (repli polygone en combat). Haven/Necropolis suivent `<id>.png` (OK).
2. **Gardiens de carte = fanion procédural gris** (`mapObjects.ts` : « aucun
   asset produit ») alors que le gardien porte un `unitId` et que les sprites
   d'unités existent → HoMM montre la créature qui garde la case.

## Étapes

- [x] **A. Renommer les 5 sprites Arcane Hunters** vers `<unitId>.png` (git mv) :
      `t1-eleve-sombreveille→t1-eleve`, `t2-familier-lie→t2-familier`,
      `t3-prefet-cercle→t3-prefet`, `t5-lame-serment→t5-lame`,
      `t6-chasseresse-abime→t6-chasseresse`. (t4/t7/t8 déjà bons.)
      → **vérif** : `unitSpriteUrl` résout les 8 unités AH (script de contrôle
      des 22 clés `units/<faction>/<id>`), aucune référence au suffixe (grep vide).
- [x] **B. Gardiens rendus avec le sprite de leur créature** (`mapObjects.ts`) :
      pour un `guardian`, résoudre `unitSpriteUrl(obj.unitId, catalog[obj.unitId]
      ?.groupId)` ; texture préchargée ⇒ sprite, sinon **chargement async**
      (patron `CombatScene` : `Assets.load` + gardes `destroyed`) ; **repli
      fanion** conservé si pas de faction / pas de sprite.
      → **vérif** : préchargement des sprites de gardiens (ajout `units/` ciblé au
      preload OU async), le gardien proto-01 (`t1-eleve` AH, `t1-recruit` test)
      montre un sprite ; anti-gel carte ×4 inchangé (2 gardiens, petits sprites).
- [x] **C. Smoke** : test d'assets étendu — assertion « un sprite de gardien
      (`t1-eleve`/`t1-recruit`) est chargé (200) » ; **54 smoke** verts (série),
      anti-gel carte ×4 **18,7 fps**. (Le gardien est un sprite canvas Pixi, pas
      du DOM → on vérifie le chargement réseau, comme les tuiles/mines.)
- [x] **D. Docs** : `docs/08-ui-ux.md` §5 (État DA Beta : gardiens illustrés +
      nommage sprites + follow-up générateur).

## Invariants
Moteur **non touché** (rendu client + renommage d'assets) → golden `be72de4b`
stable, zéro faction moteur. Budget < 800 Ko (sprites hors bundle JS). Anti-gel
×4 (peu de gardiens, petits sprites, leçon U5-C). Repli gracieux partout. Cibles
tactiles inchangées.

## Journal
- **2026-07-06** — Création. Base `a30133e` (origin/main après #63). Audit :
  fonds/tuiles complets ; bug de nommage AH + gardiens procéduraux = cibles.
- **2026-07-06** — A livré (rename, 13529e4). B/C/D livrés : `mapObjects.ts`
  charge le sprite de la créature (repli fanion), `AdventureScene.sync` passe le
  catalogue ; smoke étendu ; docs. Vérif : typecheck 4/4, lint, **54 smoke**,
  **245 engine + 70 content**, golden `be72de4b` **stable** (moteur non touché),
  anti-gel carte 18,7 fps. Lot prêt pour PR.
