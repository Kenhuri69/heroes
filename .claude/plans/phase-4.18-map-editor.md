# Plan — Alpha 4.18 : éditeur de carte interne minimal

> Dernier item roadmap doc 09 ligne 49 (« Éditeur de carte interne minimal —
> accélère la prod de contenu »). Outil visuel **in-client** pour peindre une
> carte et exporter un `data/maps/<id>.map.json` valide.

## Conception (client, minimal, réutilise le schéma existant)
- **Route** : nouvel écran `editor` (routeur) + bouton menu « Éditeur de carte » +
  entrée directe `#editor` (comme `#arena`) pour le smoke.
- **`MapEditor`** (DOM, pas Pixi — minimal) : grille de cellules cliquables
  colorées par terrain ; palette d'outils = 4 terrains (grass/swamp/water/
  mountain) + position de départ + ressource (or) + ville + gomme ; champs
  id/largeur/hauteur.
- **Export** : construit un `MapFile` (légende fixe g/s/w/m, `tiles` par rangées,
  `roads` tout à 0, `objects` = ressources+villes, `startPositions`) → **valide
  via `mapFileSchema`** (@heroes/content) → télécharge `<id>.map.json` ; erreurs
  affichées, jamais d'export invalide.
- **Import** : `<input type=file>` → parse → valide → recharge la grille.
- Objets minimaux : ressource `gold` (montant), ville (id auto). Gardiens +
  triggers + routes = raffinement ultérieur (documenté).

## Lots
- [x] `app/router.ts` : `Screen += 'editor'`.
- [x] `ui/MapEditor.tsx` (+ `MapEditor.css`) : grille, outils, export/import.
- [x] `ui/shell.tsx` : rend `MapEditor` quand `screen === 'editor'`.
- [x] `ui/MenuScreen.tsx` : bouton « Éditeur de carte ».
- [x] `main.ts` : entrée `#editor` (navigate editor sans démarrer de partie).
- [x] Locales FR/EN : bloc `editor.*` + `menu.editor`.
- [x] Smoke : menu → éditeur, peindre, export sans départ (refus) puis avec départ
  (valide `mapFileSchema`), retour menu. Desktop + mobile.
- [x] Docs 08 §2.5/§3 + roadmap 09. Plan à jour.

## Écarts / décisions constatés
- **`#ui-root` en `pointer-events: none`** : l'éditeur devait réactiver
  `pointer-events: auto` (sinon les clics filaient vers la toile PixiJS dessous).
- **`schemaVersion: 1`** requis par `mapFileSchema` — ajouté à l'export (sinon
  toute carte produite était rejetée).
- **Validation = `mapFileSchema`** (structurelle) : les règles croisées de
  `loadMap` (passabilité des départs, ids uniques, dimensions) ne sont pas
  rejouées en direct — l'éditeur produit des cartes structurellement valides ;
  les gardiens/triggers/routes et le rendu Pixi sont différés.

## Invariants
Client seul (moteur/golden intacts), **zéro nom de faction**, i18n FR/EN,
cibles tactiles ≥ 44px (cellules/outils), budget < 800 Ko, garde-fou faction
local, smoke desktop + mobile.

## Journal
- **2026-07-06** — Après merge #74 (faction:sim 4.17). Base = `origin/main`
  (d5c30b5). Cadrage : éditeur DOM minimal, export validé par `mapFileSchema`.
- **2026-07-06** — Implémentation complète. Tout vert : typecheck 4/4, lint,
  `content:check`, build (~236 Ko gzip < 800), smoke desktop + mobile (nouveau cas
  éditeur), garde-fou faction propre. Client seul, moteur/golden intacts.
