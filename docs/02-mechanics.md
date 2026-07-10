# 02 — Mécaniques détaillées

Toutes les valeurs numériques de ce document sont des **valeurs de départ pour l'équilibrage**, stockées en données (`data/core/*.json`), jamais codées en dur.

---

## 1. Les héros

Le héros est le pion central : il transporte l'armée, lance les sorts, porte les artefacts. Un héros **ne combat pas physiquement** (modèle HoMM classique) : il buffe son armée et agit une fois par round de combat (sort ou attaque à distance de faible dégât).

### 1.1 Attributs primaires

| Attribut | Effet |
|----------|-------|
| **Attaque** | +5 % dégâts infligés par l'armée par point d'écart avec la Défense adverse (plafonné ±60 %) |
| **Défense** | −2,5 % dégâts subis par point d'écart (plafonné −70 %) |
| **Pouvoir** | Puissance des sorts (dégâts, durée des effets = Pouvoir en rounds min. 1) |
| **Savoir** | Mana max = Savoir × 10 |

Les **probabilités de gain** par niveau sont data-driven. *État livré : un **profil global unique** `30/30/20/20` (A/D/P/S, `config.json`) s'applique à tous les héros ; les **classes** distinctes (ex. Nécromancien 15/15/30/40) sont différées.*

### 1.2 Progression

- **XP** : combats **gagnés uniquement** (XP = somme des PV des unités ennemies tuées × coefficient — valeur de départ **1**, dans `data/core/config.json` ; seul le héros du camp vainqueur en reçoit), coffres, lieux de savoir.
- Courbe : `xp(niveau) = 1000 × niveau^1.9` (héros max niveau 30 au MVP).
- À chaque niveau : +1 attribut primaire (tirage pondéré par un **profil global unique** `attack:30 / defense:30 / power:20 / knowledge:20`, `config.json` — les **classes de héros** distinctes sont différées) + **choix entre 2 propositions de compétence** (nouvelle compétence ou montée d'une existante). Un **seul** choix est visible à la fois : plusieurs niveaux gagnés d'un coup n'empilent pas les choix (le dernier écrase le précédent, `experience.ts`).

### 1.3 Compétences secondaires

3 rangs (Novice/Expert/Maître), 6 slots max par héros. Pool MVP (~12) :

| Compétence | Novice → Maître |
|------------|-----------------|
| Logistique | +10/20/30 % points de mouvement |
| Recherche | Portée de vision +2/4/6 |
| Chance | +1/2/3 Chance |
| Commandement | +1/2/3 Moral |
| Attaque au corps | +10/20/30 % dégâts mêlée |
| Tir | +10/20/30 % dégâts distance |
| Armure | −5/10/15 % dégâts subis |
| Magie (par école ×4) | −5/10/20 % coût mana |
| Économie | +250/500/1000 or/jour |

Les factions peuvent **ajouter des compétences** au pool via leur manifeste (ex. Nécromancie, cf. doc 04 ; Chasse rituelle, cf. doc 05).

> 🚧 **État 3.2** : pool livré = **13** compétences en données (`data/core/skills.json`) — « Magie (par école ×4) » compte pour 4 entrées (`magic-fire/water/earth/air`). Effets branchés au moteur : Logistique (PM), Recherche (vision), Économie (or/jour), Chance, Attaque au corps / Tir / Armure et réduction de coût de mana (combat). **Commandement (moral) reste à brancher** au moral de pile (raffinement 3.3+). Choix à la montée de niveau (`ChooseSkill`) opérationnel ; cap 3 rangs.
>
> 🔧 **État R5 (remédiation)** : pool réduit à **12** — **Commandement enfin branché** au moral de pile (`moraleOf`, `combat/state-helpers.ts`) ; **Sagesse retirée du pool MVP** (son effet `learnCircle`/apprentissage de sorts et les cercles 4–5 sont différés — plus de choix mort à la montée de niveau) ; les 4 compétences **Magie** donnent désormais un effet réel **dès le rang 1** (−5/10/20 % coût mana ; le déblocage de cercle `spellCircleUnlock`, no-op tant que tous les sorts ≤ cercle 3 sont connus, est retiré des données). Champs de schéma `learnCircle`/`spellCircleUnlock` conservés (réservés post-MVP).

### 1.4 Magie

- **4 écoles neutres** : Feu (dégâts), Eau (contrôle/soin), Terre (protection/invocation), Air (mobilité/vitesse). Les factions peuvent définir une école propre.
- **5 cercles** de sorts. Le héros apprend les sorts dans la **Guilde des mages** de la ville (cercles disponibles = étages construits) ou via parchemins/lieux.
- Coût en mana, 1 sort/round de combat + sorts d'aventure (Ville-portail, Vision, etc. — post-MVP sauf `Rappel`).
- ~20 sorts au MVP (liste dans `data/core/spells/`).

> 🚧 **État 3.2** : 10 sorts livrés (`data/core/spells.json`, cercles 1–3) — Feu/Eau/Terre/Air/neutre, types `damage`/`heal`/`buff`/`debuff`. Mana = `Savoir × 10 + artefacts`, remplie à l'ouverture du combat. **1 sort/round** en combat (commande `CastSpell`, prévisualisation obligatoire sans RNG). Dégâts = `round((base + perPower × Pouvoir) × (1 − résistance) × (lucky ? 2 : 1))`. Gating MVP : le héros connaît d'emblée ses `startingSpells`. **G2 livré** : la Guilde des mages enseigne désormais des sorts à la visite (pool seedé par cercle, §4.1), et la compétence **Sagesse** (H2) débloque l'apprentissage des cercles 4–5 (base 3). Les sorts de cercle 4–5 eux-mêmes (contenu) et les autres sorts d'aventure restent des raffinements ultérieurs (H1). L'IA ne lance pas de sort d'aventure en 3.2.

> 🚧 **État (sorts d'aventure, Alpha 4.16)** : ouverture du sous-système **hors
> combat**. Nouveau **kind `adventure`** portant un effet déclaratif
> `adventure: { type: 'townPortal' }` (union extensible — Vision, etc. = pure
> donnée + un cas). Commande générique **`CastAdventureSpell`** (hors combat,
> joueur actif, sort connu de kind `adventure`, mana suffisante). Sort livré :
> **Ville-portail** (cercle 3) — téléporte le héros vers la ville possédée cible
> (`townId`) ou la **plus proche** par défaut, révèle le brouillard, décompte la
> mana. La **mana se restaure chaque jour** (comme les points de mouvement) — le
> combat garde son remplissage propre à l'ouverture, équilibre inchangé. Le coût
> en mouvement de la téléportation = raffinement ultérieur. **Zéro nom de faction**
> ; golden inchangé. UI : livre de sorts d'aventure dans le tiroir héros.

### 1.5 Mouvement sur carte d'aventure

- Points de mouvement quotidiens : `base 1500 + 50 × vitesse de la créature la plus lente de l'armée` (encourage les armées homogènes), modifiés par la compétence **Logistique** (`movementBonusPct`), les routes (coût tuile ×0,75) et les terrains (marais ×1,5). *Pas de bonus de terrain natif sur la carte (les terrains ne portent qu'un `moveCost`) ; les artefacts ne donnent **pas** de points de mouvement — différés.*
- Coût d'entrée d'une tuile : **100 points** en terrain de base (herbe), pas en **diagonale ×1,41** (≈ √2), multiplicateurs cumulés puis arrondis à l'entier — ex. route en diagonale : `round(100 × 0,75 × 1,41) = 106`. Valeurs de départ pour l'équilibrage, stockées dans `data/core/config.json`.
- **Catalogue de terrains** (data-driven, `adventure.terrains` ; le moteur ne connaît que le `moveCost`, `null` = infranchissable) :

  | Terrain | `moveCost` | Nature |
  |---|---|---|
  | `grass` (herbe) | 100 | base franchissable |
  | `dirt` (terre) | 100 | plaine sèche |
  | `rough` (broussaille) | 125 | hauteurs érodées |
  | `sand` (sable) | 150 | plages / zones arides |
  | `forest` (forêt) | 150 | sous-bois (relief) |
  | `snow` (neige) | 150 | froid |
  | `swamp` (marais) | 150 | creux humides |
  | `river` (rivière) | 200 | eau vive **franchissable** (gué) |
  | `water` (eau) | `null` | mer/lac infranchissable |
  | `mountain` (montagne) | `null` | relief infranchissable |
  | `rocks` (éboulis) | `null` | obstacle plat infranchissable |

  Ajouter un terrain = données (`config.json` + recette de tuile `gen_tiles.py`), **zéro diff moteur** (schéma terrain = chaîne opaque validée au load contre la config).
- Portée de vision de base du héros : **5 tuiles** (distance de Tchebychev), avant bonus (Recherche +2/4/6).
- Pathfinding A* avec préviualisation du chemin et des jours nécessaires (points verts/jaunes comme HoMM).
- *État livré : **un seul héros par joueur** (créé au démarrage, pas de recrutement de héros). Le multi-héros (jusqu'à 8), les échanges d'armée/artefacts entre héros et le combat héros-vs-héros (le champ `defenderHeroId` existe mais reste toujours `null`) sont **différés**.*

---

## 2. Carte d'aventure

### 2.1 Structure

- Grille **carrée** (le hex est réservé au combat — choix Heroes Online) avec déplacement 8 directions, tuiles de 64 px logiques.
- **Tailles de carte** : Petite **64²**, Moyenne **96²**, Grande **128²**, Immense **256²** (plafond du schéma `mapFileSchema`). Chaque paramètre de « Nouvelle partie » peut rester sur « Aléatoire » (tiré de la graine).
- **Rendu isométrique** (Lot A1) : le moteur reste sur la grille **carrée** (coordonnées entières `GridPos`, A*, vision, coûts, sauvegarde inchangés) ; seule la **projection de rendu** est isométrique (losange 2:1 façon HoMM Online, `packages/client/src/render/projection.ts`). Picking (tap → tuile) et hook de test `tileToScreen` passent par la **même** projection. Sol = **tuiles-losanges texturées** (`assets/tiles/iso/`, dérivées des tuiles carrées par `gen_tiles.py`, cf. doc 12) posées sur un **repli gouache** (losange teinté, aussi anti-couture). **Chunking + culling** : la tilemap est découpée en chunks de 16² tuiles ; une petite carte est aplatie en une texture (1 draw call), une grande garde les chunks en sprites batchés et n'affiche que ceux qui intersectent le viewport (mémoire bornée, pas de dessin hors écran → 64²→256² jouables). Les tuiles **forêt/montagne** portent en plus un **prop de relief** « billboard » (`assets/tiles/props/`) qui dépasse la tuile pour donner de la hauteur, culé avec son chunk. Objets de carte, villes et héros vivent dans **une couche d'entités unique triée par profondeur** (`zIndex = x+y`) : un objet de premier plan passe devant un héros situé plus haut (tri inter-couches). La **mini-carte** reste **top-down** (convention, fidèle à HO).
- **Génération de carte aléatoire par biomes** (`packages/content/src/mapgen.ts`, pure & déterministe, RNG seedé) : trois champs de bruit fractal (élévation, humidité, température) classent chaque tuile en biome cohérent (mers/lacs en creux, plages de sable au rivage, forêts en zones humides d'altitude moyenne, marais en creux humides, rough en hauteurs sèches, neige au froid, montagnes/rochers en altitude, plaine dominante) ; des **rivières** descendent en pente jusqu'à l'eau. Carte valide par construction (`loadMap`).
- Couches : terrain / routes-rivières / décor bloquant / objets interactifs / brouillard.
- **Brouillard de guerre** à 2 états : inexploré (noir) et exploré-hors-vision (grisé, montre le terrain figé).
- Format de carte : JSON (`data/maps/*.map.json`), incluant scripts d'événements simples (triggers déclaratifs : `onVisit`, `onDay`, `onFlagCaptured`).

### 2.2 Objets de carte (MVP ~25 types)

| Catégorie | Exemples | Comportement |
|-----------|----------|--------------|
| Ressources au sol | tas d'or, bois, minerai… | ramassage instantané |
| Mines | scierie, mine de minerai, d'or, de gemmes… | production/jour au propriétaire ; gardées par neutres |
| Habitations | recrutement de créatures hors ville | stock hebdomadaire |
| Lieux de bonus | fontaine (+chance), écurie (+mouvement), arbre du savoir (+1 niveau) | usage 1×/héros ou 1×/semaine |
| Coffres | choix or **ou** XP | dilemme classique conservé |
| Artefacts | gardés selon rareté | équipement héros (10 slots) |
| Gardiens neutres | pile de créatures | combat ; force affichée en fourchette (« quelques », « horde »…) |
| Villes | capturables | cf. §4 |
| Obélisques/Graal | méta-puzzle | post-MVP |

> **État (comblement post-MVP)** : ressources au sol (7 types), **mines**
> capturables (fouler la tuile ⇒ drapeau à la couleur du joueur, revenu/jour
> aux montants du §3, recapturables — les gardes se posent en plaçant un
> gardien devant), **coffres** (choix or **ou** XP via une modale forcée ;
> l'IA prend l'or), **artefacts au sol** (ramassés vers le 1er slot libre,
> laissés au sol si l'inventaire est plein), **lieux de bonus** (effet
> déclaratif : fontaine `luck` — consommée à la fin du prochain combat,
> écurie `movement`, arbre du savoir `levelXp` — l'XP du niveau suivant,
> moulin `resource` fixe ; re-visite `oncePerHero` ou `oncePerHeroPerWeek`),
> **habitations hors ville** (stock hebdomadaire aux données d'unité, la
> visite recrute le maximum abordable) et gardiens neutres — y compris
> **errants** (`roamRadius` : 1 pas/jour vers le héros le plus proche à
> portée, arrêt au contact) — sont livrés (`data/maps/*.map.json` :
> `resource`/`mine`/`treasure`/`artifact`/`visitable`/`dwelling`/`guardian`/
> `town`). Obélisques/Graal restent post-MVP.

> **Sémantique de parcours** : ressources, artefacts au sol et mines sont
> ramassés/capturés **en passant** — le héros ne s'arrête pas et poursuit son
> chemin (fidélité HoMM, D6). Seul un **coffre** interrompt (choix or/XP en
> attente). Un **gardien** intercepte : le héros paie le pas d'engagement mais
> **n'entre pas** sur la tuile du gardien ; le combat s'ouvre, et le gardien
> doit être le dernier pas atteint (le parcours s'arrête à l'interception).

> **Gradation des gardiens (cartes générées)** : sur une carte procédurale
> (`generateMap`, doc 09 Live), la force d'un gardien suit la **profondeur** de
> sa tuile = distance au départ le plus proche, normalisée par le rayon de
> l'anneau des départs (0 collé à un départ → 1 au centre / zones profondes).
> Le **tier** de l'unité (palette triée par tier) et la **taille de pile**
> (~4 → ~40) croissent avec cette profondeur : faibles autour des départs,
> forts vers le centre. Générique et faction-agnostique (aucun cas particulier
> de faction).

> **Panel & progression d'objets (cartes générées)** : `generateMap` peuple la
> carte de toutes les catégories du §2.2, pas seulement des tas de ressources et
> des gardiens. Chaque partie propose un **panel varié** — ressources, mines,
> **coffres** (montants gradués par la profondeur, jusqu'à ×2 au centre), **lieux
> de bonus** tirés en rotation dans les cinq sortes (fontaine `luck`, **écurie
> `movement`**, tour de guet `vision`, sanctuaire `levelXp`, moulin `resource`),
> **habitations** (`dwelling`, tier de l'unité gradué par la profondeur) et
> **artefacts** au sol. La **progression** suit la même profondeur que les
> gardiens : les récompenses premium (habitations de haut tier, artefacts) sont
> posées loin des départs et **gardées** par une sentinelle (`guardian` adjacent,
> force graduée). Densité mise à l'échelle par l'aire et le réglage bas/riche.
> Zéro diff moteur : tout passe par des objets déjà interprétés (`data/maps/`),
> `generateMap` ne fait que les instancier.

### 2.3 Temps

- **Jour** = 1 tour de chaque joueur. **Semaine** = 7 jours → croissance des créatures dans villes/habitations. **Mois** = 4 semaines (événements type « semaine de la peste » : post-MVP).

---

## 3. Ressources

| Ressource | Rôle | Revenu de base |
|-----------|------|----------------|
| **Or** | universelle (bâtiments, recrutement) | ville : 500–4000/j selon hôtel de ville ; mine d'or : 1000/j |
| **Bois** | constructions basses | scierie : 2/j |
| **Minerai** | constructions/fortifications | mine : 2/j |
| **Cristal** | rare — orienté « might » | mine : 1/j |
| **Gemmes** | rare — orienté « magic » | mine : 1/j |
| **Soufre** | rare — factions démoniaques/mortes-vivantes | mine : 1/j |
| **Mercure** | rare — factions magiques | mine : 1/j |

Chaque faction consomme surtout **une paire de ressources rares** (Haven : cristal+gemmes ; Necropolis : soufre+gemmes ; Arcane Hunters : mercure+gemmes), ce qui crée la compétition territoriale.

> **État livré (marché)** : `TradeResources` échange **ressource ↔ or** à **taux plats** (`config.market` : vente 25, achat 50) ; exactement un côté doit être de l'or (le troc **ressource ↔ ressource** est rejeté). Le taux **dégressif** selon le nombre de marchés possédés est **différé**.

---

## 4. Villes & town building

### 4.1 Règles générales

- **1 construction par ville et par jour** (règle sacrée du rythme HoMM).
- Arbre technologique par faction : chaque bâtiment a des **prérequis** (autres bâtiments), un **coût**, et des **effets** déclaratifs.
- Bâtiments communs à toutes les factions (mêmes IDs, skins différents) :

| Bâtiment | Niveaux | Effet |
|----------|---------|-------|
| Hôtel de ville → Capitole | 4 | 500/1000/2000/4000 or/j (1 seul Capitole par joueur) |
| Fort → Château | 3 | murs (défense de siège), +50 %/+100 % croissance créatures |
| Taverne | 1 | **effet `none` — aucune mécanique livrée** (ni recrutement de héros, ni rumeurs, ni +1 moral) ; sert uniquement de **prérequis** (arbre, ex. Tableau des Contrats AH). Recrutement de héros différé |
| Marché | 1 | échange **ressource ↔ or** à taux plat (`market`, doc §3) ; troc ressource↔ressource différé |
| Forge | 1 | vend des machines de guerre au héros présent (effet générique `warMachineVendor`, Alpha 4.12) |
| Guilde des mages | 3 | **G2 livré** : à la construction d'un niveau L, `spellCount` sorts du cercle L sont tirés au **RNG seedé** dans `town.spellPool` (4/3/2 par niveau) ; un héros du propriétaire qui **visite la ville** (foule sa tuile) apprend automatiquement les sorts du pool de cercle ≤ son cercle apprenable. Cercle apprenable = **3** de base, relevé à **4/5** par la compétence **Sagesse** (H2). Onglet Guilde informatif côté client |
| Habitations T1–T7 | 2 (base + améliorée) | niveau 1 débloque le tier de base ; niveau 2 (amélioré) débloque l'unité upgradée |
| Bâtiments spéciaux ×2–3 | 1 | uniques à la faction (définis dans son manifeste) |

- **Recrutement** : chaque habitation a une croissance hebdo (ex. T1 : 14/sem, T7 : 1/sem) ; le stock s'accumule s'il n'est pas recruté (plafond : 2 semaines). Valeurs de départ : coûts des bâtiments communs dans `data/core/buildings.json` — hôtel de ville **gratuit / 2500 or / 5000 or + 5 gemmes / 10000 or + 10 gemmes + 10 cristal** (le niveau 4 = Capitole, `uniquePerPlayer`) ; fort 5000 or + 20 minerai, ×2 par niveau ; guilde des mages 2000 or + 5 bois (×2 par niveau). Croissance/coût de recrutement dans les données d'unité ; le stock d'une habitation ne se remplit qu'au **passage de semaine** (état de départ vide).
- **Croissance partagée** (générique, doc 05 §3.1/§8) : un manifeste de faction peut déclarer un **groupe de croissance partagée** (`sharedGrowthGroups`, ex. « double sommet » T7/T8). Les membres d'un même groupe **se partagent une seule croissance hebdomadaire** dans une ville où au moins deux d'entre eux sont bâtis ; le joueur désigne le destinataire via la commande `ChooseSharedGrowth` (préférence permanente, défaut = 1er membre déclaré). Le moteur ne connaît que des ids opaques (`GameState.growthGroups`, `TownState.sharedGrowthChoice`) — aucun nom de faction.
- **File de garnison** : une ville stocke une armée de défense ; attaquer une ville **défendue** ouvre un **combat de siège** contre sa garnison (Alpha 4.13) — combat normal sur le terrain de la ville, le Fort accordant un bonus de défense « murs » aux piles défenseure. Tour de garde + catapulte différés (v2).
- **Capture** : ville **sans** garnison = capture immédiate ; ville **défendue** = capture à l'issue d'un siège **gagné** (garnison anéantie ⇒ la ville change de main, garnison vidée ; siège repoussé ⇒ héros retiré, garnison survivante conservée). Le joueur qui perd sa dernière ville a **7 jours** (`RETAKE_GRACE_DAYS`, constante moteur) pour en reprendre une, sinon défaite. *L'élimination et cette grâce ne sont actives **qu'en mode scénario** (`GameState.scenario`) — no-op en partie libre/proto.*

> 🚧 **État (upgrades d'unités, Alpha 4.11)** : chaque habitation est un
> **bâtiment gradué `maxLevel:2`** — niveau 1 = unité de base, niveau 2
> (amélioré) débloque la variante upgradée. **Zéro règle moteur nouvelle** :
> recrutement/croissance de l'unité améliorée passent par le moteur existant
> (données pures). SEUL point d'extension : la commande générique `UpgradeUnits`
> convertit une pile de garnison **déjà recrutée** base→améliorée contre le
> différentiel de coût (mapping base→amélioré **dérivé** du dwelling gradué —
> jamais un nom de faction). Chaque faction fournit ses 7–8 variantes améliorées
> en données (`<baseId>-elite`). Améliorer les unités de l'armée du héros (hors
> garnison) restent différés.

> 🚧 **État (machines de guerre, Alpha 4.12)** : la **Baliste** (doc §5) est
> livrée comme machine de base — catalogue **core générique** (`data/core/
> war-machines.json`, fusionné dans le catalogue d'unités), achetée à la **Forge**
> (effet de bâtiment générique `warMachineVendor` listant les machines vendues)
> par le héros présent (`BuyWarMachine`, `HeroState.warMachines`). En combat, les
> machines rejoignent le camp du héros comme piles supplémentaires (hors cap 7) et
> ne sont jamais absorbées dans l'armée. First Aid Tent / Ammo Cart = différés.
> `CURRENT_SAVE_VERSION` → 6.

> 🚧 **État (sièges v1 — fondation, Alpha 4.13)** : attaquer une ville **défendue**
> (`CaptureTown`) n'est plus rejeté — elle ouvre un **combat de siège** générique
> (`beginTownCombat`, jumeau de l'interception de gardien) : attaquant = armée du
> héros **+ machines de guerre**, défenseur = **garnison**, terrain de la ville.
> Le Fort accorde un **bonus de défense « murs »** plat aux piles défenseure
> (`CombatState.wallDefenseBonus`, +3/niveau, appliqué dans le calcul de dégâts).
> Victoire ⇒ capture (transfert de propriété, garnison vidée) ; défaite ⇒ héros
> retiré, garnison survivante réécrite (`applyConsequences`). Côté carte, une
> ville **neutre** posée en données (objet `town` avec `factionId`/`garrison`) est
> assiégeable en marchant dessus. **Zéro nom de faction dans le moteur** ; forme
> de sauvegarde inchangée (état de combat transitoire). Tour de garde, catapulte
> et destruction de murs = tranche tactique v2.

### 4.2 Écran de ville

Vue peinte de la ville où les bâtiments construits apparaissent (grande satisfaction visuelle HoMM). Chaque bâtiment est un sprite cliquable ; l'arbre complet est aussi accessible en liste (indispensable mobile), cf. doc 08.

> **File de chantier (Lot B1)** : la règle sacrée « 1 construction/ville/jour »
> (§4.1) est **présentée** façon HoMM Online — un bandeau « Chantier du jour »
> (libre / occupé) et un temps de chantier affiché **en jours** (« Chantier : 1 j »)
> par bâtiment. **Habillage de présentation uniquement** : le « temps » se compte
> en jours (= tours), **jamais** en secondes (interdit anti-timers, doc 01 §4) ;
> aucun changement moteur ni de forme de sauvegarde (le déterministe reste intact).

---

## 5. Système de combat

### 5.1 Plateau

- **Grille hexagonale pointy-top de 15 colonnes × 10 rangées** (largeur HoMM III : no-man's land central ample, marge de manœuvre tactique et séparation nette des camps ; hauteur 10 rangées pour rester lisible sur mobile).
- Attaquant à gauche, défenseur à droite ; jusqu'à **7 piles** par armée, placement initial automatique + phase de placement tactique si compétence Tactique.
- Placement automatique (valeur de départ, Phase 2) : attaquant colonne 0, défenseur colonne 14 ; pour n piles, rangée du slot i = `floor((i + 0,5) × 10 / n)`.
- Obstacles générés selon le terrain d'aventure (2–5 hexes bloqués, tirés au RNG du combat dans les colonnes centrales 3–11, soit 3 tuiles de marge depuis chaque bord de spawn) ; le terrain natif donne +1 vitesse/+1 moral aux unités natives.
- La **vitesse** d'une unité est sa portée de déplacement en hexes par round.

### 5.2 Tour par tour

- **Rounds par vagues** : à chaque round, toutes les piles agissent par ordre de **vitesse décroissante** (égalité : attaquant d'abord, puis ordre de slot). Choix « vagues » plutôt que barre ATB : plus prévisible et lisible sur petit écran.
- Actions d'une pile : **déplacer**, **attaquer** (mêlée : déplacement+attaque ; distance : tir si pas d'ennemi adjacent, sinon mêlée à ½ dégâts), **attendre** (rejoue en fin de round, par vitesse **croissante** ; une attente par round), **défendre** (+30 % défense, soit Défense ×1,3 arrondie à l'entier inférieur, jusqu'au prochain tour de la pile).
- **Riposte** : 1 riposte/round par pile, après application des pertes de la frappe — une pile détruite ne riposte pas, le tir ne déclenche jamais de riposte (des capacités la modifient : `noRetaliation`, `unlimitedRetaliation`).
- **Le héros** : 1 action/round (sort OU attaque héroïque mineure), ne peut pas être ciblé.

### 5.3 Dégâts

```
dégâts = Σ(dmg aléatoire min–max par créature de la pile)
       × (1 ± 0.05 × (AttaqueTotale − DéfenseTotale))   // borné [−0.70, +0.60]
       × modificateurs (capacités, sorts, chance ×2, moral n'affecte pas les dégâts)
```

- Les pertes retirent des créatures entières + PV entamés sur la première.
- **Moral** (−3..+3) : proba d'un **tour bonus** (moral positif : 4 %/point) ou d'un **tour sauté** (négatif : 4 %/point, symétrique). Armée multi-factions : −1 moral par faction supplémentaire (les morts-vivants ne subissent/ne donnent pas de moral).
- **Chance** (0..+3) : proba de dégâts doublés (4 %/point).
- Note (Phase 2.4) : en combat, la formule symétrique ±0,05/point s'applique
  telle quelle aux stats des unités ; la pente défensive −2,5 %/point de §1.1
  concerne l'attribut **Défense du héros**, qui s'ajoutera au MVP (les bornes
  −70 %/+60 % sont communes). Toutes ces constantes vivent dans
  `data/core/config.json` (`adventure.combat`).

### 5.4 Capacités d'unités (bibliothèque moteur)

Le moteur expose un **catalogue de capacités génériques paramétrables** ; les unités les référencent par ID dans leurs données.

> **État livré** : le catalogue réellement interprété par le moteur — `data/core/abilities.json` — compte **9 capacités** : `flying`, `shooter`, `noRetaliation`, `doubleAttack`, `undead`, `mark`, `consumeMarks`, `demonform`, `symbiosis` (+ `magicResistance`, porté par `demonform`). Les capacités plus riches nommées dans les lineups de faction (`taunt`, `shieldWall`, `charge`, `firstStrike`, `lifeDrain`, `curseOnHit`, `spellcaster`, `areaAttack`, `aura`, `incorporeal`, `strikeAndReturn`, `breathAttack`, `poisonSting`, `swarm`, `resurrectAlly`, `unlimitedRetaliation`…) sont **déclarées en données mais pas encore interprétées** par le moteur (inertes en combat) — cible de design, à activer par sous-lots ultérieurs.

Une faction qui a besoin d'une capacité **réellement nouvelle** l'obtient en ouvrant **un** point d'extension **générique** du moteur, interprété depuis les données (cf. doc 06 §4) — jamais un module propre à une faction. C'est ainsi que `consumeMarks`/`demonform`/`symbiosis` ont été livrées.

Sémantique des **9 capacités** du catalogue (valeurs de départ) :

| Capacité | Effet implémenté |
|---|---|
| `flying` | le déplacement ignore obstacles et unités (survol), portée = vitesse, atterrissage sur hex libre |
| `shooter(ammo, noMeleePenalty?)` | tir sans riposte, portée illimitée, 1 munition/tir ; à 0 munition ou ennemi adjacent : mêlée à ½ dégâts sauf `noMeleePenalty` |
| `noRetaliation` | la cible ne riposte jamais aux attaques de cette unité |
| `doubleAttack` | deux frappes ; la riposte éventuelle s'intercale après la 1ʳᵉ |
| `undead` | moral figé à 0 (ne subit ni ne donne), ne compte pas dans le malus multi-factions |
| `mark` | chaque frappe applique 1 charge à la cible (max 3, persistantes) ; +8 %/charge de dégâts subis |
| `consumeMarks(...)` | sur une frappe **volontaire** (jamais en riposte), consomme les charges de Marque pour un effet paramétré : bonus de dégâts, suppression de riposte (`suppressRetaliation`, « expose ») ou immobilisation (`immobilizeRounds`, « pinningShot ») |
| `demonform` | T8 : commence en forme humaine (`magicResistance` 50 %), bascule 1×/combat en forme démon (+dégâts, attaque de zone) mais perd la résistance |
| `symbiosis` | une pile qui **ne bouge pas** accumule un buff croissant round après round (signature Sylvan Court) |

### 5.5 Fin de combat & auto-résolution

- Victoire = plus aucune pile adverse. Fuite (perd l'armée, garde héros+artefacts, re-recrutable en taverne) et reddition (idem + coût en or, garde l'armée restante — post-MVP).
- **Combat auto** : la même IA de combat joue les deux camps en accéléré ; résultat déterministe re-simulable (même seed) — indispensable pour le PvP asynchrone futur.
- **Écran pré-combat** (Lot 1, fidélité HoMM Online) : au démarrage de tout combat, un écran d'intro compare la **puissance de combat** des deux camps (`armyStrength`, même métrique que le graphe de fin de partie — pur affichage, sans effet sur la simulation) et propose **Combattre** (conduite manuelle) ou **Auto-Battle** (auto-résolution immédiate). Pur habillage client (`preBattlePending`), aucun changement moteur.
- **Retours de frappe** (UXD-4, fidélité HoMM Online) : après chaque frappe, un popup flottant montre les **dégâts** (`-N`) et, si des créatures meurent, une 2ᵉ ligne **kills** mise en avant (plus grosse, colorée) ; `★` sur coup de chance. La **file d'ordre de passage** du round (bandeau d'initiative, lot M1) et la **fiche de pile** au tap complètent la lisibilité tactique. Purs rendus canvas.

### 5.6 IA de combat (MVP)

Heuristique par pile : score = dégâts espérés × valeur de la cible − risque de riposte − exposition ; les tireurs kitent, les lents défendent. Pas de recherche arborescente au MVP.

---

## 6. Conditions de victoire/défaite (par scénario)

`eliminateAllEnemies` (défaut), `captureTown(id)`, `defeatHero(id)`, `surviveDays(n)`, `collectArtifact(id)`, `accumulateResource(type, n)`. Défaite : perte de tous héros **et** villes (ou objectif du scénario).

> 🚧 **État 3.5** : 4 conditions déclaratives implémentées (`eliminateAllEnemies`,
> `captureTown`, `defeatHero`, `surviveDays` — `collectArtifact`/
> `accumulateResource` différées). Le moteur (`engine/scenario`) évalue
> `GameState.scenario.objectives` (par joueur) après chaque transition (fin de
> tour, combat, capture) et pose `GameState.outcome` + émet `GameEnded` ; un
> joueur sans ville NI héros est **éliminé immédiatement**, et un joueur qui a
> **perdu** sa dernière ville en gardant un héros est éliminé au-delà de
> `RETAKE_GRACE_DAYS` (=7) jours (grâce de reprise, doc §4.1 — armée seulement
> une fois une ville possédée, `PlayerState.townlessDays`) ; hors scénario
> (partie libre) = **aucune** évaluation.
>
> 🚧 **État (comblement MVP)** : la **grâce de reprise de ville** (7 jours) et
> les **triggers de carte** `onVisit`/`onDay` (doc §2.1) sont désormais
> implémentés. Triggers = point d'extension **générique** (`AdventureMapDef.
> triggers`, effets déclaratifs `grantResource`/`message`, one-shot, événement
> `TriggerFired`) — jamais un nom de faction/scénario dans le moteur.
> `collectArtifact`/`accumulateResource` et `onFlagCaptured` restent différés.
>
> 🤝 **Alliances / équipes** (save v13) : `PlayerState.team` (entier opaque —
> `0` = **sans alliance**, comportement chacun-pour-soi historique ; même n°
> **non nul** = alliés, `areAllies`). Deux alliés **ne s'assiègent pas**
> (`validateCaptureTown` + IA) et **partagent la victoire** : `eliminateAllEnemies`
> compte un allié comme non-ennemi, donc dès que tous les non-alliés sont
> éliminés chaque allié remplit sa condition. Choisi par siège à « Nouvelle
> partie » ; générique (aucune faction). Un joueur éliminé reste hors-jeu même
> si son allié continue (MVP).
> **IA d'aventure** déterministe (`engine/ai`, commande `AiTurn`) : chaque
> joueur `controller:'ai'` explore / ramasse / attaque un gardien battable /
> capture / construit / recrute puis passe son tour ; heuristique gloutonne de
> tutoriel (pas de magie ni de planif multi-tours — écart assumé). 3 scénarios
> solo en données (`data/scenarios/`).
