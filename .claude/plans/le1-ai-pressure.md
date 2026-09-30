# LE1 — Un adversaire qui presse

> Lot LE1 du plan `game-experience-enrichment.md` (§4), propositions **B2**, **B1**
> et décision **D-SIEGEAI**, adoptées par l'utilisateur le 2026-09-29 (§5).
> Périmètre : `packages/engine/src/ai/` + un helper pur d'estimation dans
> `town/capture.ts`. **Aucune règle nouvelle** : l'IA se sert de ce que le moteur
> offre déjà. Zéro faction, pas de bump save, golden inchangé (replay sans IA).

## 1. Baseline mesurée (avant le lot)

Bench jetable (non commité) : 2 IA, carte générée 64², 10 graines, 60 jours,
difficulté normale, factions tournantes.

| Mesure | Baseline |
|---|---|
| 1ʳᵉ **pression** (héros IA sur/adjacent à une ville d'un joueur adverse) | **jamais** (0/10) |
| 1ʳᵉ capture d'une ville de joueur | **jamais** (0/10) |
| Villes neutres prises (médiane) | **0** |
| Puissance max au j28 (médiane, `playerPower`) | 1893 |
| Parties terminées en 60 j | 3/10 |

Cause (lue dans le code) : la marche multi-jours `pickTownMarchTarget` n'est
qu'un repli **après** exploration complète (`ai/adventure.ts:734`), une ville à
garnison n'est jamais attaquée au contact (`:452`), une seule pile recrutée par
jour (`ai/town-ai.ts:110`), et les villes jouent **après** les héros (`:58-73`).

## 2. Étapes

1. [x] **B2 — recrutement complet** (`town-ai.ts`) : la pile du plus haut tier est
   recrutée comme avant, puis les tiers suivants tant que l'or dépasse la
   **réserve** du bâtiment prioritaire bloqué par le seul coût (`tryBuild` la
   renvoie). → tests « chaque tier recruté » + « réserve respectée ».
2. [x] **B2 — villes d'abord pour un héros qui dort en ville** (`runAiTurn`).
   → test « le héros part avec les recrues du jour » (échoue sans le correctif).
3. [x] **D-SIEGEAI** : helper pur `townDefenseStrength` (`town/capture.ts`) +
   `siegeTowerArmy` (`combat/setup.ts`) ; siège au contact et marche l'utilisent.
   → tests garnison faible ⇒ siège / forte ⇒ rien.
4. [x] **B1 — objectifs multi-jours avant l'exploration** (`pickMultiDayObjective`) :
   ville prenable (10), garnison à rapatrier (6), mine (4), ≤ 3 jours, score =
   valeur / (jours + 1). → test « marche vers une ville à 2 jours ».
5. [x] **Mesure après** — voir §4.
6. [x] **Vérifs** — voir §5. Doc 02 (IA d'aventure) alignée.

## 3. Écarts au plan (trouvés en mesurant)

La première version (étapes 1-4 seules) ne bougeait presque pas la baseline
(1/10 pression). Le bench instrumenté a montré trois causes que le plan n'avait
pas vues, toutes dans le périmètre B2 « économie IA fidèle » :

- **Ressources rares** : l'IA finissait à 30 000–70 000 or, bloquée à vie par
  3 mercure / 5 bois (habitations T3+ et recrues T5+) — elle vendait au marché,
  n'achetait jamais. ⇒ `marketPlan` : achat or → ressource pour le bâtiment
  prioritaire (tout ou rien, `tryBuyShortfall`) et pour les recrues (effectif max
  payable, `maxCountWithMarket`). Une ressource de faction ne s'achète pas.
- **Joueur sans héros** : après la mort de son héros, un joueur restait à vie
  sans Taverne (priorité 20 derrière tout le reste) ⇒ Taverne à 200 si aucun héros.
- **Garnison qui dort** : le rapatriement n'était tenté qu'à portée du jour, et le
  ramassage passait devant ⇒ garnison dans les objectifs multi-jours + **rappel**
  prioritaire quand elle vaut ≥ l'armée (`GARRISON_RECALL_RATIO = 1`).

**Hors périmètre, relevé pour la suite** :
- les **villes neutres** générées ont des garnisons démesurées (ex. 37 T8 + 27 T8
  élites, défense estimée ≈ 17 700 contre ≈ 1 800 pour une armée IA au j40) :
  aucune n'est jamais prise — à traiter au lot **LE3** (la carte qui résiste,
  `generateMap`) ;
- l'IA recrute des héros qui errent **sans armée** (riche + sous le cap) : elle
  disperse son or ; à regarder avec **LE6** (fuite / réserve de héros) ;
- la mesure « puissance au j28 » baisse (2042 → 1519) **uniquement** parce que
  davantage de parties se terminent avant le j28 (elles comptent 0) : le nombre de
  recrues au j28 est inchangé (167 → 165).

## 4. Mesure (bench jetable, 2 IA, 64², 20 graines, 60 jours, normal)

| Mesure | Avant | Après |
|---|---|---|
| Parties avec un combat entre joueurs (héros-vs-héros ou siège) | 9/20, médiane j55 | **17/20, médiane j38** |
| Villes de joueur capturées | 0/20 | **4/20** (médiane j46) |
| Parties conclues en 60 jours | 5/20 (j55) | **12/20** (j42) |
| Recrues au j28 (médiane) | 167 | 165 |

## 5. Vérifications (rejouées sur la branche)

- [x] `pnpm typecheck` vert (5 projets + smoke-tsc)
- [x] `pnpm lint` vert
- [x] `pnpm test` — moteur **1034/1034** (+12 `ai-pressure.test.ts`, dont 9 échouent
      sans le correctif ; property « IA vs IA se termine » + déterminisme verts),
      contenu 186, client 109, serveur 10 ; **golden inchangé**
- [x] `pnpm content:check` — 7 paquets, 3 cartes, 21 scénarios valides
- [x] garde-fou « zéro faction » (dérivé de `data/factions/index.json`) : aucun ID
- [x] garde-fou couleurs : non concerné (aucun fichier client touché)
- [x] `pnpm build` + budget : **377 184 o gzip** (cap 819 200)
- [x] smoke `@core` desktop + mobile : **56/56** verts
- Pas de bump `CURRENT_SAVE_VERSION` (aucun champ d'état nouveau).

## 6. Journal

- 2026-09-29 : plan ouvert, baseline mesurée (§1).
- 2026-09-29 : étapes 1-4 livrées ; écarts §3 trouvés au bench et corrigés ;
  mesures §4 ; vérifications §5.
- 2026-09-29 : relecture adverse du diff — un achat au marché pouvait précéder un
  recrutement refusé pour une autre raison (garnison pleine) ⇒ or gaspillé.
  Garde ajoutée (on n'achète que si `cannotAfford` est le seul obstacle) + test.
