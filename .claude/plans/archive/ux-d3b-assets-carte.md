# Plan — UXD-3B : assets peints de la carte (héros, villes, objets)

> Tranche **génération d'images** du lot 3 (suite de UXD-3A bord de monde,
> mergé #94). Remplace les placeholders procéduraux de la carte d'aventure par
> des sprites peints (règles A/C doc 12). Pilotée par prompts Gemini fournis à
> l'utilisateur ; le câblage client suit à la réception des images.

## Placeholders visés (constat §1.4 du plan maître)

| Placeholder actuel | Code | Asset cible | Règle |
|---|---|---|---|
| Écusson épinglé du héros | `render/heroSprite.ts` | `assets/map/hero-<faction>.png` (héros monté) | A |
| Donjon `Graphics` de ville | `render/townsLayer.ts` | `assets/map/town-<faction>.png` (château) | C |
| Coffre / camp / panneau / autel | `render/mapObjects.ts` | `assets/map/{chest,camp,signpost,shrine}.png` | C |

## Étapes

- [x] Étendre `gen_prompts.py` : familles `map-heroes` (règle A, héros monté par
      faction) et `map-props` (règle C, châteaux par faction + objets communs).
      → `assets/prompts/map-heroes.md`, `assets/prompts/map-props.md`.
- [x] **Utilisateur** : 2 planches générées dans Gemini (fond gris clair
      `#c8c8c8`) et fournies.
- [x] Extraction QC (`sheet_extract.py`, commandes dans les .md) → PNG validés
      vers `assets/map/`. **Ne jamais committer un FAIL de QC** (doc 12 §8).
- [x] Câblage client (à la réception) : résolveurs `heroMapUrl`/`townMapUrl`/
      `mapPropUrl` dans `render/assets.ts` (faction-agnostiques, convention
      `assets/map/...`), consommés par `heroSprite.ts`/`townsLayer.ts`/
      `mapObjects.ts` avec **repli procédural gracieux** conservé (doc 12 §10.3).
- [x] Vérif : smoke « assets servis sans 404 » étendu, ux-audit, anti-gel carte,
      budget (PNG hors bundle).

## Notes

- Dérive préexistante repérée : les `assets/prompts/*.md` committés sont
  désynchronisés du `gen_prompts.py` courant (l'ajout de sylvan-court + un
  changement de gabarit ne sont pas régénérés). **Non corrigé ici** (hors
  périmètre, guidelines §3) — à régénérer dans une passe assets dédiée.
- Le drapeau de propriétaire de ville reste ajouté par le code (2ᵉ canal A5) ;
  l'asset de château reste neutre en couleur d'équipe.

## Livraison (2026-07-07)

- Planches reçues : héros rendus **4×2** (2 variantes/faction, retenu la rangée 1) ;
  villes+objets avec **libellés texte incrustés** (prompt « no text » non
  respecté par Gemini) → contourné en découpant la planche en 2 moitiés
  (châteaux / objets) hors bandes de texte, extraites en 4×1. **QC verte** sur
  les 16 sujets (8 héros, 4 châteaux, 4 objets).
- 12 assets copiés dans `assets/map/` (< 260 Ko chacun, hors bundle) :
  hero-{haven,arcane-hunters,necropolis,sylvan-court}, town-{idem},
  chest, camp, signpost, shrine.
- Câblage : résolveurs `heroMapUrl`/`townMapUrl`/`mapPropUrl` ;
  `heroSprite` (jeton monté, remplace l'avatar-portrait sur la carte),
  `townsLayer` (château, liseré de siège A5 conservé), `mapObjects`
  (coffre/camp/panneau-autel) — **repli procédural gracieux partout**.
- Preuves : tutoriel = **chevalier haven monté** peint dans l'anneau ;
  escarmouche haven = **château haven** peint ; coffre/camp/panneau peints.
  Le sandbox proto-01 (faction `test-faction`, sans asset) garde le repli —
  attendu ; les scénarios/escarmouches à faction réelle sont peints.
- Vérif : smokes **92 verts + 2 skipped**, « assets sans 404 » OK, anti-gel
  carte 7,4 / arène 13,4 fps, typecheck/lint/build verts.
