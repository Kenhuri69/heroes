# Plan — Lot 6.1 : générateur de cartes aléatoires (cœur) — doc 09 Phase 4

Item **autonome** de la Phase 4 Live (doc 09 §4) : « générateur de cartes
aléatoires ». Les autres items Live (PvP temps réel, backend) attendent une
direction d'infra ; le générateur est **in-paradigme** (déterministe, data-driven,
zéro backend). Livré en increments comme N2 :

- **6.1 (ce lot)** — le **cœur** : une fonction pure `generateMap(id, seed, opts)`
  qui produit un `MapFile` **toujours valide** (schéma + règles croisées de
  `loadMap`) et **déterministe** (PRNG seedé auto-contenu, pas de `Math.random`).
  Property test : N graines ⇒ toutes les cartes passent `loadMap`. Aucun diff
  moteur (le générateur vit dans `@heroes/content`, à côté de `loadMap`).
- **6.2 (suivant)** — intégration client : une escarmouche « carte aléatoire »
  (le client génère + `loadMap` en mémoire) + smoke. CLI `map:gen` en option.

## Portée 6.1

- `packages/content/src/mapgen.ts` :
  - PRNG `mulberry32(seed)` auto-contenu (déterministe, aucune dépendance).
  - `generateMap(id, seed, opts)` : terrain de base franchissable + amas
    d'obstacles infranchissables (lacs/montagnes), 2 positions de départ opposées
    **forcées franchissables**, objets (ressources/mines/trésors/lieu visitable ;
    gardiens si palette d'unités fournie) placés sur des tuiles franchissables,
    uniques, hors départs. Routes = `'0'` (optionnelles). `triggers` omis.
  - Garanties de validité par construction (tuiles d'objet/départ forcées base,
    ids uniques, bornes, trésor gain > 0).
- Export depuis `@heroes/content` (`generateMap`, `MapGenOptions`).
- Property test `packages/content/test/mapgen.test.ts` : pour K graines, la carte
  générée passe `loadMap` (avec config à 4 terrains + palette d'unités) ;
  déterminisme (même graine ⇒ carte identique) ; départs franchissables & distincts.

## Vérification par lot

typecheck 4/4 · moteur (golden **inchangé**) · content (+ property test mapgen) ·
`content:check` · garde-fou faction + garde-fou couleurs · build < 800 Ko ·
smoke desktop + mobile (non-régression — 6.1 n'ajoute pas d'UI).

## Vérification par lot

- [x] typecheck 4/4
- [x] moteur 321 (golden **inchangé** — le générateur vit dans content, zéro diff moteur)
- [x] content **82** (77 + 5 tests mapgen : validité sur 40 graines, déterminisme, palette gardiens)
- [x] `content:check` (5 paquets, 2 cartes, 12 scénarios)
- [x] garde-fou faction + garde-fou couleurs (grep local : propres)
- [x] lint · build client (< 800 Ko gzip)
- [x] smoke desktop + mobile (non-régression — 6.1 sans UI)

## Décisions / écarts

- **PRNG auto-contenu (mulberry32)** dans `@heroes/content` plutôt que le PCG32 du
  moteur : le générateur de carte n'est **pas** de la simulation (pas de replay),
  seul le **déterminisme** compte ; garde `content` sans dépendance sur `engine`.
  L'invariant « pas de `Math.random` » est respecté (PRNG seedé).
- **Validité par construction** : tuiles de départ/objet forcées au terrain de
  base franchissable ; ids d'objet uniques ; trésor à gain > 0. Le property test
  la **prouve** en passant chaque carte générée dans `loadMap` (schéma + règles
  croisées réelles), pas seulement le schéma.
- **Objets sans catalogue externe par défaut** (ressources/mines/trésors/lieu
  visitable) → toujours valides sans connaître le contenu. Les **gardiens** ne
  sont ajoutés que si une **palette d'unités connues** est fournie (le client la
  passera depuis le contenu chargé) — évite tout `unitId` inconnu.
- **Routes `'0'`** (aucune) et `triggers` omis en 6.1 : valides et suffisants ;
  raffinements (routes reliant les départs, gardiens gradués) = itération.
- Intégration client (escarmouche « carte aléatoire ») + CLI `map:gen` → **6.2**.

## 6.2 — intégration client + CLI (livré ✅)

- **Client** : `resolveGeneratedMap(report, seed)` (`app/content.ts`) génère la
  carte puis la **revalide par le même `loadMap`** via un shim `readJson` en
  mémoire — toute la validation croisée s'applique, aucun détour. `SkirmishConfig`
  gagne `randomMap?`, `SkirmishScreen` un choix « Standard / Aléatoire »,
  `main.startSkirmish` résout la carte générée quand `randomMap`.
- **CLI** : `pnpm map:gen <id> <seed>` (`@heroes/tools`) génère + valide (loadMap
  réel avec unités connues) + écrit `data/maps/<id>.map.json` ; jamais d'export
  invalide.
- **Vérif 6.2** : typecheck 4/4 · golden inchangé · content 82 · content:check ·
  garde-fous verts · build < 800 Ko · smoke desktop + mobile (escarmouche « carte
  aléatoire » démarre sur une carte `id: 'random'`). CLI exercé manuellement
  (carte 24×24 valide écrite puis retirée — non commitée).
