# LE8 — Finitions (reliquats sans décision de design)

> Suite du plan `game-experience-enrichment.md` après la livraison de tous ses
> lots (LE1→LE7, LE-UX, E3). Choix utilisateur du 2026-10-07 : « lot
> finitions ». Trois petits reliquats, une PR.

## 1. Constat

| # | Reliquat | Source | Aujourd'hui |
|---|---|---|---|
| 1 | L'IA ne choisit pas l'option d'un niveau à `alternatives` | E3 (`e3-pilot-level-alternatives`) | `tryBuild` construit sans `choice` ⇒ toujours l'option 0 |
| 2 | `map:gen` ≠ client à graine égale | `post-review-followups` (§1.4) | la CLI n'envoie ni `artifactRarity`, ni `townFactionIds`, ni le filtre « gardiens peints » ; aucune option de taille/joueurs |
| 3 | Icône PWA *maskable* absente | idem | le manifeste ne déclare que `purpose: any` |

## 2. Décisions

- **1** : à un niveau dont les options sont des habitations, l'IA prend celle qui
  donne le plus de **force brute par pièce d'or** — PV + Att + Déf (la mesure de
  `armyStrength`) × croissance hebdo ÷ coût en or. Égalité ⇒ option 0. Options
  d'un autre type : option 0. Générique, déterministe, sans RNG.
- **2** : les options de génération du client deviennent un helper de
  `@heroes/content` (`standardMapOptions`), paramétré par deux prédicats d'art
  (unité peinte, château de carte peint). Le client les lit dans son registre
  d'assets, la CLI sur le disque (`assets/`, même convention de nommage). La CLI
  accepte les options de « Nouvelle partie » en `--clé=valeur`.
- **3** : icône 512 px dédiée `icon-maskable-512.png` (motif réduit dans la zone
  sûre de 80 %, fond plein) déclarée `purpose: maskable` dans une entrée à part.
  Garde de contenu : chaque icône du manifeste existe, une icône maskable est déclarée.

## 3. Étapes

1. [x] IA : choix d'option + test moteur
2. [x] `standardMapOptions` (contenu) ; client et CLI branchés ; test de parité
3. [x] Icône maskable + manifeste + test de contenu
4. [x] Docs (02, 07/09 selon le cas), plan d'enrichissement, CLAUDE.md
5. [ ] Vérifications

## 4. Vérifications

- [ ] typecheck (sans `-s`), lint, build, tests, garde-fous, golden inchangé
- [ ] Playwright complet

## 5. Journal

- 2026-10-07 : plan ouvert ; les trois points livrés. Écarts et décisions :
  - IA : Haven T3 ⇒ Templier (41 × 7 ÷ 295 contre 38 × 7 ÷ 295 au Vindicateur) ;
    test « même unité retenue quel que soit son rang » ;
  - `map:gen` : miroir disque de `unitSpriteUrl`/`townMapUrl` (même convention
    `assets/units/<faction>/<unité>`, repli élite → base, `assets/map/town-<faction>`) ;
    l'id de carte reste propre à chaque appelant (`random` côté client) ; la CLI
    pose désormais des villes neutres, comme le client ;
  - icône : encodeur PNG maison (aucune toolchain image), motif ×0,8 autour du
    centre ⇒ point le plus éloigné du motif à ~30 % de la taille depuis le centre, dans le cercle sûr (40 %).
