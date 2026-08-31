# Revue des fonctionnalités manquantes (2026-08-31) & plan d'implémentation

> **Demande utilisateur (2026-08-31)** : « relance une revue des fonctionnalités
> manquantes à implémenter et lance un plan d'implémentation pour les
> fonctionnalités ».
>
> Cette revue **re-vérifie dans le code** chaque manque encore listé comme ouvert
> par les deux backlogs existants — `.claude/plans/game-feature-gaps.md`
> (inventaire du 2026-07-10) et `docs/18-audit-fonctionnalites-vs-heroes-online.md`
> — au lieu de les recopier. Beaucoup étaient **périmés** (livrés depuis, §1).
> Le reste, réellement ouvert, est spécifié en §2 et ordonné en lots en §4.

## 0. Méthode & état de référence

- **Croisement** : docs 01→19 (source de vérité) × code réel, avec preuve
  `fichier:ligne` ou mesure reproductible pour chaque constat.
- **Vérifications outillées** : inventaire des capacités du catalogue vs données
  de faction, inventaire des commandes moteur vs commandes réellement émises par
  l'IA, inventaire des toiles de combat vs terrains **franchissables**, endpoints
  du Worker vs contrôles d'accès.
- **Baseline du dépôt (main, 2026-08-31)** : `pnpm typecheck` **vert (5/5)**,
  `pnpm test` **vert** (voir §7). Aucun correctif de régression n'entre dans ce
  périmètre.

## 1. Ce que la revue **ferme** (le backlog était périmé)

| Item du backlog | État affiché | Vérification 2026-08-31 | Preuve |
|---|---|---|---|
| **CAP-CAST / CAP-LIFE « reste »** (capacités au catalogue non portées) | ⬜ | **fermé** — les **35** capacités de `data/core/abilities.json` sont **toutes** portées par ≥ 1 unité de faction | comptage sur `data/factions/**` (min. 2 occurrences par capacité) |
| **`resurrectAlly` inerte** (doc 02 §5.4) | 🧩 | **fermé** — la capacité n'existe plus au catalogue : l'effet est réalisé par le `spellcaster` générique (Ange) | `packages/engine/test/combat-spellcaster.test.ts:102`, `packages/content/test/faction-recruit.test.ts:149` |
| **AS-SYLVAN** (« le trou le plus visible ») | ⬜ | **fermé** — 14 sprites d'unités, avatars, fond et vignettes de ville livrés | `assets/units/sylvan-court/` (14), `assets/heroes/sylvan-court-*`, `assets/backgrounds/town-sylvan-court.jpg` |
| **AS-COMBATBG** (« 9 toiles manquantes/11 ») | ⬜ | **fermé** — 9 toiles présentes ; les 2 absentes (`mountain`, `rocks`) sont des terrains **infranchissables** (`moveCost: null`) : aucun combat n'y a lieu | `assets/backgrounds/combat-*.jpg`, `data/core/config.json` §`adventure.terrains` |
| **AS-BUILDINGS** (vignettes core) | ⬜ | **fermé** — les 7 bâtiments de `data/core/buildings.json` ont leur vignette | `assets/buildings/core/` |
| **NET-RANKED** (classement/saisons) | ⬜ | **livré** — table `ratings`, Elo appliqué à la fin de partie, `GET /leaderboard` saisonnier | `server/src/worker.ts:493`, `applyMatchElo` |
| **NET-EMAIL** (magic-link réels) | ⬜ | **livré** — Resend opt-in (`RESEND_API_KEY`) | `server/src/worker.ts`, doc 15 §10 |
| **M-NAV (b) — bateaux** | différé | **livré** — `BuildBoat`/`BoardBoat`/`DisembarkBoat`, chantier naval, mapgen naval | `packages/engine/src/town/shipyard.ts`, `core/commands.ts:127-129` |
| **UX-ENDSTATS — pertes cumulées** | différé | **livré** | plan archivé `ux-endstats-losses.md` |
| **Backlog doc 18** (écarts vs Heroes Online) | 🚧 | **épuisé** — plus aucun écart P1/P2 ouvert, étapes 1→5 closes | `docs/18-…md` §4 |

⇒ **Les chantiers « assets » ne sont plus le trou visible** : la DA est en place
pour les 6 maisons. Le déficit s'est déplacé vers **l'adversaire** (IA) et vers
les **garde-fous du mode en ligne**.

## 2. Manques réellement ouverts

Priorité : **P1** = écart jouable fort · **P2** = profondeur appréciable ·
**P3** = finition. Effort : S ≈ ½ j · M ≈ 1–3 j · L ≈ 1 sem+.

### G1 — Profondeur de l'IA 🧩 **P1 / L** — *le plus gros écart jouable*

Le jeu est **majoritairement solo** (scénarios, campagnes, escarmouche) : la
qualité de l'adversaire est la qualité du jeu. Or l'IA est restée l'heuristique
gloutonne du MVP (phase 3.5) alors que **40 commandes** de gameplay ont été
ouvertes depuis.

| # | Constat | Preuve |
|---|---|---|
| **G1.a** | L'IA de ville construit **le premier bâtiment abordable par ordre alphabétique d'`id`** — aucune priorité Fort / Hôtel de ville / habitations | `packages/engine/src/ai/town-ai.ts:38-46` (`Object.keys(draft.buildingCatalog).sort()`) |
| **G1.b** | L'IA n'**améliore jamais** ses unités : `UpgradeUnits` n'est jamais émis | `grep 'type: ' packages/engine/src/ai/*.ts` ⇒ 4 commandes seulement |
| **G1.c** | Sur ~17 leviers d'action pertinents, l'IA n'en utilise que **4** (`BuildStructure`, `RecruitUnits`, `RecruitHero`, `CaptureTown`). Jamais : `TradeResources` (marché — elle reste bloquée par une pénurie alors qu'elle croule sur une autre ressource), `EquipArtifact` (les artefacts ramassés dorment dans le sac), `UpgradeUnits`, `BuyWarMachine`, `SendCaravan`, `CastAdventureSpell`, `Dig` (Graal), `GarrisonTransfer`, `BoardBoat`/`BuildBoat`, `BuyArtifact` | `packages/engine/src/core/commands.ts:61-355` vs `packages/engine/src/ai/` |
| **G1.d** | La **difficulté** n'est qu'un **handicap de départ** (armée ×0,6/1/1,6, ressources ×1/1,5, Fort prébâti) : elle s'évapore après quelques semaines et ne change **jamais** le comportement | `packages/client/src/app/game.ts:697-706` |
| **G1.e** | Aucune **défense** : l'IA ne rapatrie pas un héros vers une ville menacée, ne laisse pas de garnison, ne fuit pas un combat perdu d'avance | `ai/adventure.ts:18-38` (contrat : 5 priorités, aucune défensive) |

> Contrainte d'invariant (guidelines §8) : tout ajout reste **sans faction en dur**
> et **déterministe** (RNG de l'état). L'IA lit le catalogue par ses **effets**
> (`dwelling`, `growthBonus`…), jamais par un id de bâtiment connu.

### G2 — En ligne : contrôle d'accès & abus 🐞 **P1 / S-M**

| # | Constat | Preuve |
|---|---|---|
| **G2.a** | `GET /matches/:id/moves` ne vérifie **pas la participation** : tout compte authentifié peut lire le journal complet de **n'importe quelle** partie et donc re-simuler l'état d'autrui | `server/src/worker.ts:443-452` (le `POST` voisin, lui, vérifie le siège l.457-459) |
| **G2.b** | **Aucun rate limit** : `/auth/request` accepte un nombre illimité de demandes de magic-link par e-mail/IP (bombardement d'e-mails, énumération de comptes) | `grep -n 'rateLimit' server/src/worker.ts` ⇒ vide |
| **G2.c** | **NET-FOG** — information ouverte par construction (le journal rejoué révèle tout) ; limite assumée en async, **bloquante pour une beta compétitive** | doc 07 §5, doc 15 |
| **G2.d** | **NET-SRVGUARD.2** (copie de sécurité N-1 des cloud saves) et **NET-MATCHMAKING** (appariement) restent absents | `server/schema.sql`, `worker.ts:336-431` |

### G3 — Souterrain / cartes multi-niveaux 🕳️ **P2 / L**

Dernier grand manque **structurel** de la carte d'aventure (doc 02 §2.1 ;
M-NAV (c)). Aucune trace en code (`grep -i underground|souterrain` ⇒ 0).
Chantier transversal : `MapFile` (niveaux), pathfinding, brouillard, rendu,
mini-carte, escaliers, **bump `CURRENT_SAVE_VERSION`**. Les monolithes (téléport
intra-niveau) sont livrés et donnent déjà une partie du service.

### G4 — Contenu narratif : campagnes manquantes 🕳️ **P2 / M (données pures)**

| Maison | Campagne | Chapitres |
|---|---|---|
| Haven | ✅ | prologue + ch2 + ch3 |
| Necropolis | ✅ | ch1 + ch2 |
| Arcane Hunters | ✅ | ch1 + ch2 |
| Dungeon | ✅ | ch1 + ch2 + ch3 |
| Vox Arcana | 🧩 | **ch1 seul** |
| **Sylvan Court** | 🕳️ | **aucune** (`data/factions/sylvan-court/story/` absent) |

Le pipeline narratif (N3a) est prouvé 4× ⇒ **zéro diff moteur** attendu.

### G5 — Gardiens ↔ trésors sur cartes **générées** 🧩 **P3 / S**

Le champ `guardedBy` existe et est validé, mais `generateMap` ne le pose jamais :
sur une carte procédurale (le mode « Nouvelle partie » par défaut) **tous** les
trésors sont libres, alors que les cartes éditées à la main les gardent.
Preuve : `packages/content/src/mapgen.ts` (aucun `guardedBy`), `data/maps/proto-01.map.json` (`gold-2`).

### G6 — Contenu de faction résiduel 🧩 **P3 / S**

- **Salle des Reliques** (Arcane Hunters, doc 05 §353) : spécifiée, **jamais livrée**.
- **« Mois des créatures »** façon HoMM3 (apparition de piles neutres sur la carte,
  doc 02 §481) : la table d'événements de calendrier existe (croissance, ruée de
  ressources), l'effet « peuplement » manque.
- **Portail (coût en Essence)** : le bâtiment est livré, son coût de faction est différé.

### G7 — Hygiène doc & locales 📄 **P3 / S**

- `data/core/locales/{fr,en}.json:379-380` décrivent `ability.resurrectAlly` comme
  « à venir » alors que la capacité **n'existe plus** (réalisée via `spellcaster`).
- doc 02 §5.4 annonce **32** capacités et `resurrectAlly` « pas encore interprétée » :
  le catalogue en compte **35**, toutes interprétées.
- doc 02 §1.2 dit les « classes de héros différées » alors que H-NAMED.3
  (`attributeWeightsByArchetype`) est livré.
- `.claude/plans/game-feature-gaps.md` : inventaire périmé sur ≥ 10 lignes (§1 ci-dessus).

## 3. Hors périmètre (inchangé, confirmé par les docs)

MMO temps réel & PvP à timer (doc 01 §3 « Post-Beta ») · monétisation (doc 01 §4)
· cinématiques vidéo (doc 13 §2) · replays/spectateur/achievements (jamais promis)
· éditeur de carte au-delà du minimal (doc 09 Alpha) · créatures 2-hex et arbre
d'aptitudes MMHO (divergences **tranchées** doc 18 §4 étape 5).

## 4. Plan d'implémentation ordonné

Principes : (1) d'abord ce qui **protège** (contrôle d'accès) et ce qui se voit
**à chaque partie** (l'adversaire) ; (2) un lot = **un** plan vivant + **une** PR
atomique + les vérifs guidelines §4/§7 ; (3) toute extension moteur reste **une**
variante générique **opt-in** (champ optionnel ⇒ pas de bump save ni de golden
re-fixé) ; (4) zéro faction dans `packages/`.

| # | Lot | Couvre | Effort | Diff moteur | Save |
|---|-----|--------|--------|-------------|------|
| **L1** ✅ | **Verrous du mode en ligne** — participation obligatoire sur `GET …/moves` ; rate limit `/auth/request` (par e-mail + par IP, fenêtre fixe en D1) | G2.a, G2.b | S | non (serveur seul) | non |
| **L2** ✅ | **IA de ville qui bâtit juste** — ordre de construction **priorisé par effet**, **amélioration** des unités (`UpgradeUnits`), et **ramassage de la garnison** par le héros (trouvé en cours de lot : sans lui, l'armée de l'IA ne grossissait jamais) | G1.a, G1.b, G1.c | S | oui (IA seule) | non |
| **L3** ✅ | **IA qui gère son économie** — marché (vente du surplus contre de l'or), équipement automatique des artefacts ramassés, achat de machines de guerre | G1.c | M | oui (IA seule) | non |
| **L4** ✅ | **IA qui défend & voyage** — rapatriement d'un héros vers une ville menacée, garnison minimale, refus d'un combat perdu d'avance, sorts d'aventure (Vision/Marche forcée), fouille du Graal quand la position est connue | G1.c, G1.e | M | oui (IA seule) | non |
| **L5** ✅ | **Une difficulté qui pèse dans la durée** — remplacer le one-shot par des **leviers de données persistants** (bonus de revenu/croissance de l'IA, marges d'engagement, cadence de recrutement) pilotés par `config`, jamais par un enum dans le moteur | G1.d | S-M | non (données + client) | non |
| **L6** ✅ | **Campagne Sylvan Court** (3 chapitres, patron N3a) puis **Vox ch2** | G4 | M×2 | non (données) | non |
| **L7** ✅ | **Gardiens ↔ trésors dans `generateMap`** — les trésors de valeur naissent gardés (densité déjà réglable à « Nouvelle partie ») | G5 | S | non (content) | non |
| **L8** ✅ | **Finitions de contenu** — Salle des Reliques (AH), « mois des créatures » (peuplement neutre déclaratif) | G6 | S+M | 1 point générique pour le peuplement | non |
| **L9** ✅ | **Hygiène doc & locales** — §G7, + remise à niveau de `game-feature-gaps.md` sur cette revue | G7 | S | non | non |
| **L10** 📋 | **Souterrain** — **cadrage livré** (`l10-underground.md`, 5 sous-lots) ; implémentation laissée à l'arbitrage | G3 | L | oui (transversal) | **bump** |
| **L11** ✅ | **En ligne compétitif** — NET-FOG (après décision), matchmaking, sauvegarde N-1 | G2.c, G2.d | L | non | non |

**Ordre recommandé** : L1 → L2 → L3 → L4 → L5 → L7 → L9 → L6 → L8 → (L10/L11
après arbitrage). L1-L5 tiennent la promesse « une partie solo qui résiste »,
qui est ce que le joueur touche à chaque session.

## 5. Décisions à trancher avant leur lot

1. **L10 (souterrain)** : chantier transversal + bump de sauvegarde pour un gain
   d'exploration. À confirmer avant tout code (recommandation : après L1-L5).
2. **L11 (NET-FOG)** : accepter l'information ouverte en async (statu quo, gratuit)
   **ou** implémenter une vue filtrée serveur (coûteux). Recommandation : statu quo
   documenté + L1 (qui ferme déjà l'espionnage **hors** partie), et ne rouvrir que
   pour une beta compétitive.
3. **L5** : jusqu'où la difficulté doit-elle « tricher » (bonus de revenu) plutôt
   que « mieux jouer » ? Recommandation : bonus **de données** modestes + meilleures
   heuristiques partagées par tous les crans.

## 6. Critères de vérification transverses (rappel guidelines §4/§7/§8)

Chaque PR : `pnpm typecheck` (5/5) · `pnpm lint` · `pnpm test` (+ le cas du lot
dans le même commit, skill `test-authoring`) · `pnpm content:check` · garde-fous
« zéro faction » et « couleurs » · `pnpm build` + budget bundle · smoke `@core`
desktop + mobile · golden replay re-fixé **une seule fois** et **seulement** si la
forme change · bump `CURRENT_SAVE_VERSION` seulement si la sauvegarde change.

## 7. Journal

- **2026-08-31** — Revue rejouée sur `main` (baseline `typecheck` vert 5/5,
  `pnpm test` vert). 10 items du backlog **fermés** comme périmés (§1) ; 7 familles
  de manques réellement ouvertes (§2) ; plan en 11 lots (§4). Aucun code de
  gameplay écrit dans ce commit.

- **2026-08-31 — Lot L1 livré** (G2.a + G2.b, serveur seul) :
  - **ACL du journal de partie** — `GET /matches/:id/moves` exige désormais un
    **siège** dans la partie (403 sinon), comme le `POST` voisin le faisait déjà.
    Fermait un trou réel : tout compte authentifié pouvait lire le journal de
    n'importe quelle partie et **re-simuler** l'état complet d'autrui. Aucun
    chemin client n'est affecté (`openOnlineMatch` n'est appelé qu'après création
    ou `join`) ; le SDK documente le 403.
  - **Limitation de débit** (NET-SEC.3, le dernier « reste » de la famille
    NET-SEC) — `POST /auth/request` plafonné à **5/h par adresse** et **20/h par
    IP** (`CF-Connecting-IP`), 429 au-delà, message **identique** dans les deux
    cas (aucune fuite sur l'existence d'un compte). Compteurs à **fenêtre fixe**
    dans une nouvelle table D1 `rate_limits` (une écriture par appel, purge
    opportuniste des fenêtres périmées) : le motif « exige un state KV » qui
    justifiait le report ne tenait pas — D1 suffit, aucun coût nouveau.
  - Docs alignées dans le même commit (guidelines §8.6) : doc 15 §4 (9 tables),
    §5.1 pt 6 (quotas), §5.3 pt 5 (ACL du journal).
  - *Limite assumée, héritée des lots NET-SEC.1/.2* : il n'existe **pas de
    harness de test du Worker** (pas de runner `server/` en CI) ⇒ la vérification
    est le typecheck `server` + client et la relecture ; aucun test automatisé ne
    couvre ces deux règles. Ouvrir un harness Worker (miniflare) serait un lot à
    part — noté comme candidat en §4 si le mode en ligne prend de l'importance.

- **2026-08-31 — Lot L2 livré** (G1.a + G1.b + un pan de G1.c, `engine/ai` seul) :
  - **Découverte en cours de lot, plus grave que le constat initial** : l'IA
    recrutait **dans le vide**. `RecruitUnits` dépose les recrues en
    **garnison** (doc 02 §4.1) et l'IA n'émettait jamais `GarrisonTransfer` ⇒
    ses héros terminaient la partie avec leur **armée de départ**, quels que
    soient l'or dépensé et les semaines écoulées. C'est l'explication mécanique
    du « l'IA ne menace jamais » ressenti en jeu. Corrigé par un ramassage joué
    aux deux bouts du tour (début de tour du héros posté sur sa ville ; fin de
    tour de ville pour celui qui vient d'arriver) **plus** un nouvel objectif de
    déplacement « rentrer chercher la garnison » (priorité 3, seuil ≥ 25 % de la
    force de l'armée du héros, A\* borné aux PM du jour comme les autres pickers).
  - **Ordre de construction** dérivé du seul **effet déclaratif** du niveau visé
    (`buildPriority`) au lieu de l'ordre **alphabétique d'id** : revenu (100) >
    habitation (80 + palier) > croissance (70) > guilde (40) > marché (35) >
    reste (20). Un effet inédit garde le repli bas : un bâtiment de faction
    nouveau reste constructible, simplement pas prioritaire. **Zéro id de
    bâtiment ou de faction dans le moteur** (garde-fou vert).
  - **`UpgradeUnits`** enfin émise : les piles de garnison montent en gamme dès
    que l'habitation de niveau 2 est bâtie et le différentiel payable, **après**
    le recrutement (le neuf d'abord, l'amélioration avec le reste).
  - Tests : `packages/engine/test/ai-town.test.ts` (**5 unitaires**, fixtures
    volontairement anonymes — `atelier`/`caserne` — pour le garde-fou « zéro
    faction ») : priorité vs ordre alphabétique, amélioration payable / non
    payable, ramassage sur place, retour au bercail. Niveau **unitaire moteur**
    conformément au skill `test-authoring` (aucun smoke ajouté : la règle est
    pure, le smoke `scénario` couvre déjà l'intégration du relais IA).
  - **Pas de bump `CURRENT_SAVE_VERSION`** (aucun champ d'état), **golden
    inchangé** (le replay golden n'a aucun joueur IA), doc 02 §6 alignée.
  - *Limite assumée* : l'IA reste **gloutonne** (un objectif par héros et par
    tour, cible dans les PM du jour). Une ville hors de portée du jour n'est pas
    encore un objectif — c'est le périmètre de L4 (défense & voyage).

### Vérification du lot L1+L2 (rejouée en entier le 2026-08-31)

- [x] `pnpm typecheck` vert (5 projets, `server` inclus)
- [x] `pnpm lint` vert
- [x] tests **moteur 952/952** (+5 `ai-town.test.ts`), **contenu 165**, **client 82**
- [x] `pnpm content:check` vert
- [x] garde-fou faction (motif dérivé de `data/factions/index.json`) : aucun id dans `packages/`
- [x] garde-fou couleurs : aucun littéral hors `ui/tokens.css`
- [x] `pnpm build` + budget bundle **366 323 o gzip** (cap 819 200)
- [x] **golden inchangé** (le replay golden n'a aucun joueur IA ; aucun autre
      module moteur touché)
- [x] smoke `@core` desktop + mobile : **54/55**, l'unique échec étant le test
      `ville` **mobile** qui dépasse le timeout **local** de 30 s sous contention
      CPU du conteneur (rendu logiciel) — **il échoue déjà de la même façon sur
      `main` avant ce lot**, et **rejoué seul il est vert (19,2 s)**. La CI porte
      ce timeout à 45 s précisément pour ce motif (`playwright.config.ts`).
- [x] *non couvert* : les deux règles serveur de L1 (aucun harness Worker) —
      limite énoncée au journal, pas de non-régression automatisée revendiquée.

- **2026-08-31 — Lot L3 livré** (le reste de G1.c, `engine/ai` seul) : trois
  commandes que l'IA n'émettait **jamais** alors qu'elles existaient.
  - **Marché** (`TradeResources`) : en tête du tour de ville, elle vend son plus
    gros surplus de ressource non-or **au-delà d'une réserve de 30** contre de
    l'or — une ressource par ville et par tour. Elle s'asseyait sur un tas de
    gemmes ou de cristal inutile pendant que l'or, la ressource qui recrute,
    manquait. Réserve calibrée sur les paliers de coût les plus lourds du contenu
    livré (ordre de 20-40) : vendre ne bloque pas la construction du lendemain.
  - **Machines de guerre** (`BuyWarMachine`) : une par ville et par tour, au
    héros présent, parmi celles que **déclare** l'effet `warMachineVendor`
    (jamais un id en dur). Baliste et tente de soins pèsent dans chaque combat.
  - **Artefacts** (`EquipArtifact`) : le butin est routé vers le **sac**
    (H-ARTEQUIP) et l'IA ne l'en sortait pas — elle collectionnait sans jamais
    porter un bonus. Équipement au début du tour de chaque héros, **y compris
    sans point de mouvement** (un héros immobile peut être attaqué) ; un
    artefact refusé (emplacement typé pris, 10 slots pleins) n'empêche pas les
    autres.
  - Tests : 5 unitaires de plus dans `ai-town.test.ts` (**10 au total**) —
    vente du plus gros surplus / réserve conservée / ni sous la réserve ni sans
    marché, achat au héros présent / rien sans héros, sac vidé dans les slots.
  - **Pas de bump `CURRENT_SAVE_VERSION`**, **golden inchangé**, doc 02 §6 alignée.
  - *Limites assumées* : l'IA ne fait pas encore l'inverse du marché (**acheter**
    la ressource qui manque pour une construction précise — demande de regarder
    les candidats de construction, à faire avec L4) ; elle équipe dans l'ordre du
    sac sans comparer les bonus.

### Vérification du lot L3 (rejouée en entier le 2026-08-31)

- [x] `pnpm typecheck` vert (5 projets) · `pnpm lint` vert
- [x] tests **moteur 957/957** (+5), **contenu 165**, **client 82**
- [x] `pnpm content:check` vert · garde-fous faction & couleurs verts
- [x] `pnpm build` + budget bundle **366 799 o gzip** (cap 819 200)
- [x] **golden inchangé** (aucun joueur IA dans le replay golden)
- [x] smoke `@core` desktop + mobile **55/55** (aucun flake cette fois) et
      **`@e2e` 3/3** — la boucle longue joue contre l'IA, c'est elle qui
      encaisse le changement de comportement

- **2026-08-31 — Lots L4, L5, L7, L9 livrés** (une PR par lot, chacune avec son
  plan vivant `.claude/plans/l<N>-*.md`, CI verte puis fusionnée) :
  - **L4** (PR #533) — l'IA défend ses villes (priorité 0 + hystérésis de garde),
    lance ses sorts d'aventure (Marche forcée, puis Vision faute d'objectif, avec
    réserve de mana de combat) et poursuit le Graal (obélisques collectables,
    `Dig` à l'arrivée). Helper partagé `adventure/grail` extrait pour ne pas
    dupliquer la règle de fouille entre la commande du joueur et l'IA.
  - **L5** (PR #534) — `PlayerState.economyBonus` : profil économique **opaque**
    par joueur (revenu quotidien + croissance hebdo, projections d'UI comprises),
    sur lequel le client projette le cran de difficulté des sièges IA. Le cran
    ne s'évapore plus après les premières semaines.
  - **L7** (PR #535) — le butin des cartes **générées** naît gardé
    (`guardedBy` posé par `generateMap` sur artefacts et coffres).
  - **L9** (cette PR) — hygiène : entrée de locale morte `ability.resurrectAlly`
    retirée, comptes de capacités (27/32 → **35**) corrigés docs 02/03, deux
    « UI joueur différée » démenties par le code (spellcaster, Prière de
    bataille), profil d'attribut par archétype acté, et l'inventaire vivant
    `game-feature-gaps.md` re-coché item par item.

- **2026-08-31 — Lots L6, L8, L11 livrés ; L10 cadré** (suite de la passe
  autonome, une PR par lot) :
  - **L6** (PR #537) — campagne **Sylvan Court** (3 chapitres) et **Vox ch2** :
    les 6 maisons jouables ont désormais leur histoire. 100 % données.
  - **L8** (PR #538) — **Salle des Reliques** (aura générique
    `heroAura.learnCircleBonus`) et **mois des créatures**
    (`spawnCreatures` : peuplement neutre seedé et borné).
  - **L11** (PR #539) — **appariement automatique** (`POST /matchmaking`, sans
    file), **copie de sauvegarde N-1** (`save_backups` + `/restore`), et
    **NET-FOG tranché** : statu quo assumé et documenté (docs 07 §5, 15), à
    rouvrir seulement si le classement devient un enjeu.
  - **L10** (PR de cadrage) — le souterrain reste **non implémenté**, à dessein :
    c'est le seul lot qui touche à la fois la forme de sauvegarde, le pipeline
    de contenu, le rendu et l'IA. Son cadrage (`l10-underground.md`) livre le
    modèle de données (`GridPos.level`, escaliers = monolithes inter-couches —
    la brique existe déjà), l'impact mesuré par surface et un découpage en
    **5 sous-lots** prêts à exécuter. Décision d'implémentation au porteur.

### État final du plan (2026-08-31)

| Lot | État |
|---|---|
| L1 verrous en ligne · L2 IA de ville · L3 économie de l'IA | ✅ livrés (PR #532) |
| L4 défense & voyage de l'IA | ✅ livré (PR #533) |
| L5 difficulté durable | ✅ livré (PR #534) |
| L7 butin gardé sur cartes générées | ✅ livré (PR #535) |
| L9 hygiène doc & locales | ✅ livré (PR #536) |
| L6 campagnes Sylvan & Vox ch2 | ✅ livré (PR #537) |
| L8 Salle des Reliques & mois des créatures | ✅ livré (PR #538) |
| L11 appariement, copie N-1, NET-FOG | ✅ livré (PR #539) |
| **L10 souterrain** | 📋 **cadré, non implémenté** (arbitrage) |
