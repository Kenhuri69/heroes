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

Les **probabilités de gain** par niveau sont data-driven. *État livré (H-NAMED.3) : un **profil global** `30/30/20/20` (A/D/P/S, `config.json`) s'applique par défaut, mais un **profil déclaratif par archétype** (`config.hero.attributeWeightsByArchetype`) le prime pour un héros dont le roster porte un archétype — **might** `35/30/15/20` (favorise Attaque/Défense) et **magic** `15/15/35/35` (favorise Pouvoir/Savoir). Sélection via `heroRoster[rosterId].archetype` à la montée de niveau (`experience.ts`), repli global pour un héros sans archétype. Générique, zéro faction moteur ; champs OPTIONNELS ⇒ **pas de bump save, golden inchangé** (vieux save = repli global). Profils par CLASSE plus fins (ex. Nécromancien 15/15/30/40) réalisables en données ultérieurement.*

> **Héros nommés (H-NAMED.1, doc §1.2)** : les fiches d'identité `heroes/<id>.json` (doc 16 État 16.9 — avatar/bio/archetype/origine) portent des **champs gameplay optionnels** (`attributes`, `specialtyEffect`, `startingSkills`, `startingSpells`). Une fiche **avec `attributes`** devient **jouée** : `buildHeroRoster` la résout, et le moteur applique nom/attributs/spécialité/compétences/sorts à la création si `PlayerSetup.startingHeroId` la désigne (catalogue `StartGame.heroRoster`, comme `houseCatalog`) ; les champs explicites du scénario (report de campagne) la priment. Une fiche **sans** gameplay reste identity-only (staging avatars). **H-NAMED.2 livré** : à « Nouvelle partie » et « Escarmouche », **chaque siège humain choisit son héros nommé** dans le roster de sa faction (`<select>` par siège) ; défaut = **aléatoire seedé** (RNG moteur, jamais `Math.random`), unicité de pool au sein d'un `StartGame`. La sélection pose `PlayerSetup.startingHeroId` (identité résolue par le moteur, **zéro diff moteur** ⇒ pas de bump save) et omet les attributs génériques ; le loadout de sorts MVP est conservé. Sièges IA = héros génériques. **État livré (H-COND)** : point d'extension moteur **générique** `conditional` sur le vocabulaire d'effets déclaratifs — une spécialité peut être scopée **par unité** (`unitId`) et/ou **par niveau** (`perLevels` ⇒ ×`ceil(niveau/perLevels)`), interprétée au niveau unité en combat (`conditionalUnitBonus` : attaque/défense/vitesse ; jamais agrégée à plat). Aucune faction en dur, **pas de bump save, golden inchangé**. 6 héros nommés différés désormais jouables (Vhalen, Mère Corbeau, Sylwen, Faelar, Evadne, Alwin — cf. docs 04/05/14 §5/§7). **État livré (H-COND-EXACT)** : les 3 variantes différées portent leurs signatures EXACTES via 3 points d'extension génériques dédiés — Mère Corbeau `raiseUndeadPctPerLevel` (Nécromancie +%/niveau), Faelar `startingSymbiosisStacks` (Symbiose de départ), Alwin `startingArmyBonus` (familier T2 gratuit). **État livré (H-NAMED.3)** : profil de gain d'attribut **par archétype** (`attributeWeightsByArchetype`, cf. §1.2). Tous : zéro faction moteur, pas de bump save, golden inchangé.

### 1.2 Progression

- **XP** : combats **gagnés uniquement** (XP = somme des PV des unités ennemies tuées × coefficient — valeur de départ **1**, dans `data/core/config.json` ; seul le héros du camp vainqueur en reçoit), coffres, lieux de savoir.
- Courbe : `xp(niveau) = base × niveau^1.9` avec `base = 268` (`config.json`) ⇒ **premier palier au niveau 2 ≈ 1000 XP** ; héros max niveau 30 au MVP.
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
> 🔧 **État R5 (remédiation)** : **Commandement enfin branché** au moral de pile (`moraleOf`, `combat/state-helpers.ts`) ; les 4 compétences **Magie** donnent un effet réel **dès le rang 1** (−5/10/20 % coût mana). **Sagesse ré-introduite depuis (G2/H2)** : son effet `learnCircle` débloque l'apprentissage des cercles 4–5 à la Guilde des mages — le pool livré est donc bien de **13** compétences (`data/core/skills.json`), Sagesse incluse. Le champ de schéma `spellCircleUnlock` reste conservé (réservé post-MVP).
>
> 🚧 **État F-SKILLS** : les factions **injectent des compétences dans le pool via leur manifeste** (`manifest.heroSkills` = ids de compétences). Le loader **estampille** ces compétences de l'id de leur faction (`HeroSkillDef.factionId`) ⇒ elles ne sont proposées au tirage de niveau (`eligibleSkills`) **qu'aux héros de cette faction**. Une compétence dont le payoff est **externe** (ex. **Nécromancie** = % gradué de `raiseUndeadOnVictory`, doc 04 §2) est marquée `external` en données (rangs sans `SkillRankEffect` direct autorisés). 1ʳᵉ compétence de faction livrée : **Nécromancie** (Necropolis, 10/15/20 % par rang). Effet UI des compétences marqueurs (description de rang) = raffinement ultérieur.

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

> 🚧 **État (Vision, H-SPELLS.3)** : 2ᵉ effet d'aventure — `adventure: { type:
> 'vision', radius }`. Sort livré **Clairvoyance** (Air, cercle 2) : **révèle le
> brouillard** dans `radius` tuiles autour du héros **sans le déplacer**
> (`revealAround`). Le schéma `adventure` devient une **union discriminée**
> (`townPortal | vision`) ; le client `AdventureSpellbook` le lance sans changement
> (aucune cible requise). **Additif** (l'effet vit dans le catalogue) ⇒ **pas de
> bump save, golden inchangé**. « Rappel » = déjà couvert par Ville-portail ;
> invocation / résurrection de pile entière restent à venir.

> 🚧 **État (sorts de masse, H-SPELLS.1)** : le champ de zone `SpellDef.area`
> gagne la valeur **`all`** (à côté de `splash`) — le sort touche **toutes** les
> piles vivantes du camp de la pile ciblée (le camp visé = celui de la cible :
> taper un allié ⇒ buff de tout son camp ; taper un ennemi ⇒ debuff/dégâts de
> tout le camp adverse). Réutilise le cœur de résolution partagé
> (`applySpellToTargets`/`estimateSpell`) — la prévisualisation agrège l'effet.
> Sorts livrés (cercle 3, plafond apprenable de la Guilde) : **Bénédiction de
> masse**, **Hâte de masse**, **Affaiblissement de masse**. **Zéro nom de
> faction, aucun champ d'état nouveau ⇒ pas de bump save, golden inchangé.**
> Restent (H-SPELLS suite) : autres sorts d'aventure (Vision, Rappel),
> invocation, chaîne, résurrection de pile entière.

> 🚧 **État (cercles 4-5 & Guilde à 5 niveaux, H-SPELLS.2)** : la **Guilde des
> mages** monte désormais à **5 niveaux** (cercles 1→5 ; `data/core/buildings.json`)
> et le catalogue gagne des sorts de **cercle 4-5** — **Résurrection** & **Pluie
> de météores** (c4), **Armageddon** (dégâts de masse) & **Résurrection de masse**
> (c5). La compétence **Sagesse** (`learnCircle` 4/5), jusque-là inerte faute de
> sorts à apprendre, devient enfin utile. **Données pures** : le moteur enseignait
> déjà un cercle arbitraire (`rollGuildSpells` filtre `circle === level`, testé) —
> **zéro diff moteur, pas de bump save, golden inchangé**. Un test de contenu
> garde l'invariant « chaque niveau de guilde a assez de sorts de son cercle ».

> 🚧 **État (dissipation réelle, H-SPELLS.4)** : nouveau **`SpellKind 'dispel'`**
> générique — un sort **offensif** (vise l'adverse) qui **retire tous les statuts
> temporaires de sort** (buffs/poison/malédiction/silence) de la pile ennemie
> ciblée (« on souffle sur les enchantements d'autrui »). Réutilise le tableau
> `stack.statuses` et le cœur partagé `applySpellToTargets`/`estimateSpell` — la
> zone (`splash`/`all`) est gratuite pour une future « dissipation de masse ». Le
> sort **Dissipation** (neutre, cercle 3), jusqu'ici un simple debuff −2/−2
> déguisé, devient une vraie dissipation en **données pures** (`kind: 'dispel'`).
> **Zéro nom de faction, aucun champ d'état nouveau ⇒ pas de bump save, golden
> inchangé** ; l'IA ignore `dispel` (jamais lancé, jamais de crash). Restent
> (H-SPELLS suite) : invocation, chaîne, résurrection de pile entière.

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
- *État livré (M-TAVERN.1 + .2) : **multi-héros par recrutement à la Taverne** — la commande `RecruitHero` (moteur) crée un **héros nommé** du roster de la faction de la ville (`GameState.heroRoster`, H-NAMED.1) contre or (`config.hero.recruitCost` = 2500), plafonné à `config.hero.maxPerPlayer` (**8**, doc §1.5) ; le héros apparaît sur la ville, armée vide. **M-TAVERN.2 (client)** : onglet **Taverne** de l'écran de ville (visible seulement si le bâtiment est construit, comme Marché/Guilde) — liste du roster de la faction de la ville (avatar, nom, bio, spécialité, attributs, coût), bouton Recruter, états « Recruté »/cap/or insuffisant ; le héros recruté devient le héros **sélectionné**. Le roster est embarqué à `StartGame` par **tous** les chemins client (partie rapide, Nouvelle partie, escarmouche, scénario). **État livré (UX-HEROSWAP)** : deux héros du **même joueur** sur des **tuiles adjacentes** (8 directions) échangent piles d'armée et artefacts via la commande GÉNÉRIQUE `TransferBetweenHeroes` (`kind: 'army' | 'artifact'`, une entité par commande — fusion des piles de même unité, cap 7 respecté ; artefact vers le 1er slot libre) ; UI de rencontre double-colonne tap-tap (`HeroSwap`) avec « Tout donner ». Purement déterministe (aucun RNG), aucun champ d'état nouveau ⇒ **pas de bump save, golden inchangé**. **État livré (H-VS-H)** : marcher sur un héros **ennemi** (autre joueur, non allié) déclenche un **combat héros-vs-héros** — `beginHeroCombat` (jumeau de l'interception de gardien), **les deux camps portent un héros** (`defenderHeroId` enfin non-null) ; le héros mouvant reste adjacent (n'entre pas). Le **perdant meurt** (retiré de la partie) ; **dépouille** : les artefacts du vaincu passent au vainqueur (slots libres ; surplus **déposé au sol** sur la tuile du vaincu), l'XP du vainqueur venant des PV ennemis tués. Aucun champ d'état nouveau ⇒ **pas de bump save, golden inchangé**. **État livré (M-TAVERN.4)** : **pool de Taverne exclusif inter-joueurs** — un héros du roster ne peut être **vivant que chez UN joueur à la fois** (`HeroState.rosterId` marque l'origine roster ; `validateRecruitHero` refuse un héros déjà en jeu) ; un héros **mort** (retiré de `heroes`) redevient recrutable par tous. Bump `CURRENT_SAVE_VERSION` **25→26** (nouveau champ `rosterId`, golden re-fixé — forme). **IA recruteuse** : l'IA d'aventure recrute un héros à une ville dotée d'une Taverne quand elle est **riche** (or ≥ coût × 2) et **sous le cap** (`engine/ai/town-ai.ts`). Client : l'onglet Taverne affiche « Indisponible » pour un héros vivant chez un adversaire. **État livré (H-NAMED.2)** : à « Nouvelle partie »/« Escarmouche », chaque siège humain **choisit son héros de départ** (`startingHeroId`, défaut aléatoire seedé). **Différés** : split de pile « Équilibrer » (UX-SPLIT), ciblage des héros ennemis par l'IA d'aventure.*

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
> l'IA prend l'or) — **ratio 1 or : 0,8 XP** : « random parfait », l'or est la
> seule magnitude aléatoire du coffre et l'XP en dérive (`xp = round(gold ×
> 0,8)`), afin que le dilemme reste équilibré (`generateMap` le garantit ; les
> cartes livrées le respectent) —, **artefacts au sol** (ramassés vers le 1er slot libre,
> laissés au sol si l'inventaire est plein), **lieux de bonus** (effet
> déclaratif : fontaine `luck` — consommée à la fin du prochain combat,
> écurie `movement`, arbre du savoir `levelXp` — l'XP du niveau suivant,
> moulin `resource` fixe, **arène/statue `permanentStat`** (M-VISIT : +attribut
> primaire **définitif** au héros visiteur), **sanctuaire de sort `learnSpell`**
> (M-VISIT : enseigne un sort précis au héros — ajout idempotent à `hero.spells`,
> classique « Sanctuaire de Magie » HoMM) ; re-visite `oncePerHero` ou
> `oncePerHeroPerWeek`),
> **habitations hors ville** (M-DWELLOWN : **capturables** — la fouler pose le
> drapeau du joueur et lui réserve le réassort hebdomadaire, façon HoMM ; la
> visite recrute le maximum abordable ; stock hebdomadaire aux données d'unité)
> et gardiens neutres — y compris
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
> **M-GUARDLINK (« gardés selon rareté »)** : un objet ramassable
> (`resource`/`treasure`/`artifact`) peut porter un champ optionnel `guardedBy`
> = id d'un **gardien** de la carte. Tant que cette sentinelle existe, l'objet
> **reste inerte** (impossible de la contourner pour rafler le butin) ; une fois
> la sentinelle vaincue (retirée de la carte), l'objet se ramasse normalement.
> Le contenu valide que `guardedBy` désigne bien un gardien présent.

> **Gradation des gardiens (cartes générées)** : sur une carte procédurale
> (`generateMap`, doc 09 Live), la force d'un gardien suit la **profondeur** de
> sa tuile = distance au départ le plus proche, normalisée par le rayon de
> l'anneau des départs (0 collé à un départ → 1 au centre / zones profondes).
> Le **tier** de l'unité (palette triée par tier) et la **taille de pile**
> (~4 → ~40) croissent avec cette profondeur : faibles autour des départs,
> forts vers le centre. Générique et faction-agnostique (aucun cas particulier
> de faction).

> **Butin de gardien** : vaincre un gardien neutre **crédite un butin** gradué
> par sa **force** (PV totaux = `hp × count`), tiré au **RNG seedé** — piloté par
> le bloc de config optionnel `adventure.guardianReward` (`goldPerHp`,
> `variancePercent`, `resources`, `resourceThresholdHp`, `resourceAmount`,
> `artifactThresholdHp`, `artifactChancePercent`). **Or toujours** (base × PV ±
> variance) ; **ressource** non-or au-delà d'un seuil ; **artefact** (tirage du
> catalogue) avec une chance au-delà d'un seuil plus haut ⇒ « artefact au niveau
> élevé » (gardiens forts, en profondeur). GÉNÉRIQUE : le moteur ne lit que des
> ids de ressource/artefact **opaques**, jamais un nom de faction ; config absente
> ⇒ aucun butin (aucun tirage RNG — fixtures/golden épargnés). L'artefact rejoint
> le 1er slot équipé libre, sinon le SAC (comme un ramassage au sol).

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

- **Jour** = 1 tour de chaque joueur. **Semaine** = 7 jours → croissance des créatures dans villes/habitations. **Mois** = 4 semaines (28 jours).
- **Événements de calendrier** (M-CALENDAR, livré) : à chaque début de semaine, un
  événement est tiré au **RNG seedé** parmi une table pondérée déclarative
  (`config.calendar.events` — données pures, aucun cas en dur). Chaque événement
  porte un `growthFactor` qui module la croissance hebdomadaire des créatures
  (villes + habitations de carte) : `1` = semaine normale, `0.5` = « semaine de la
  peste » (croissance ÷2), `2` = « semaine d'abondance » (×2). Le moteur émet
  `CalendarEventStarted { eventId, week, month }` ; le client toaste les semaines
  spéciales (pas les normales). `monthOf(jour)` = `⌊(jour−1)/28⌋+1`. **Calendrier
  persistant à l'écran (M-CALWIDGET, livré)** : la barre de statut affiche
  « Mois M · Semaine W · Jour J » et un **badge persistant** de semaine spéciale
  (croissance ≠ normale) tant qu'elle dure — là où il n'y avait qu'un toast
  transitoire. *Différés :* événements de **mois** persistants, événements
  ciblant une créature précise (« semaine du Griffon »).

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

> **État livré (marché, T-MARKETRATE)** : `TradeResources` échange **ressource ↔ or** ET **ressource ↔ ressource** (troc, via équivalence or). Le taux est **dégressif** selon le nombre de marchés possédés par le joueur : `factor = min(maxMarketFactor, 1 + perMarketBonus × (nbMarchés − 1))`, `sellRate × factor` / `buyRate ÷ factor` (`config.market`, valeurs de départ vente 25 / achat 50, `perMarketBonus 0.1` / `maxMarketFactor 2`). Un seul marché ⇒ facteur 1 (taux plat). Déterministe (aucun RNG), aucun nouvel état (pas de bump save). *Différés : courbe HoMM3 exacte non linéaire, taux de troc pénalisé distinct de l'équivalence or.*

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
| Taverne | 1 | **effet `tavern` (M-TAVERN.1 + .2)** : active le **recrutement de héros nommés** du propriétaire (`RecruitHero`, contre or, cap 8, doc §1.5) — onglet **Taverne** de l'écran de ville côté client. Sert aussi de prérequis d'arbre. Rumeurs / +1 moral non livrés |
| Marché | 1 | échange **ressource ↔ or** et **troc** ressource↔ressource ; taux **dégressif** selon le nombre de marchés possédés (`market`, doc §3, T-MARKETRATE) |
| Forge | 1 | vend des machines de guerre au héros présent (effet générique `warMachineVendor`, Alpha 4.12) |
| Guilde des mages | 5 | **G2 + H-SPELLS.2 livrés** : à la construction d'un niveau L (1→5), `spellCount` sorts du cercle L sont tirés au **RNG seedé** dans `town.spellPool` (4/3/2/2/1 par niveau) ; un héros du propriétaire qui **visite la ville** (foule sa tuile) apprend automatiquement les sorts du pool de cercle ≤ son cercle apprenable. Cercle apprenable = **3** de base, relevé à **4/5** par la compétence **Sagesse** (H2). Onglet Guilde informatif côté client |
| Habitations T1–T7 | 2 (base + améliorée) | niveau 1 débloque le tier de base ; niveau 2 (amélioré) débloque l'unité upgradée |
| Bâtiments spéciaux ×2–3 | 1 | uniques à la faction (définis dans son manifeste) |
| Aura de héros (ex. Écuries / Statue du Jugement Haven, Cercle Vigile AH) | 1 | effet générique `heroAura` (F-BUILDEFF) : bonus lié à la ville, sans nom de faction. Champs câblés : `movementBonusFlat` (.1) = +PM/jour au héros du **propriétaire présent sur la ville** (option B) ; `combatMoraleBonus` (.2) = +moral en **combat de siège** au camp **défenseur** (garnison) ; `garrisonDefense` (.4) = +défense « murs » plate au **siège** (même champ que la Maison Blaireau, porté par un bâtiment). Autres champs = sous-lots F-BUILDEFF.x |
| Bâtiment enseignant (ex. Cloître Haven) | 1 | effet générique `grantSpell` (F-BUILDEFF.3) : à la construction, ajoute un `spellId` au pool de sorts de la ville ; le héros du propriétaire présent l'apprend via la mécanique d'apprentissage à la visite (comme la Guilde des mages). `spellId` cross-validé au chargement |

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

> 🚧 **État (sièges v2 — C-SIEGE2.1, murs de grille)** : une ville à **Fort**
> (`buildings.fort ≥ 1`) assiégée dresse un **rempart** — des segments d'obstacle
> sur une colonne devant le défenseur (`combat.siegeWalls`, champ **OPTIONNEL** ⇒
> pas de bump de sauvegarde, golden inchangé), laissant une **porte** centrale
> ouverte. Le mur **bloque déplacement + ligne de vue** exactement comme un
> obstacle (helper partagé `staticBlockedKeys`) : la mêlée s'engouffre par la
> porte, les **volants** le survolent, les **tireurs** tirent par l'ouverture. Une
> ville **sans Fort** ⇒ aucun mur (siège v1 inchangé). **Non destructibles** pour
> l'instant : PV de segment / destruction par les unités = **C-SIEGE2.2+** ;
> tour de tir = .3 ; douves = .4. Zéro faction moteur.

> 🚧 **État (sièges v2 — C-SIEGE2.2, catapulte)** : une **catapulte** (machine de
> guerre `data/core/war-machines.json`, marqueur `siegeBreaker`, vendue par la
> **Forge** comme la Baliste) portée par l'assaillant **brèche le rempart** au
> montage du siège — les segments qui **flanquent la porte** sont retirés,
> **doublant l'ouverture** (`buildSiegeWalls(fortLevel, breached)`, `breached`
> détecté via `hero.warMachines` + `hasAbility('siegeBreaker')`). La catapulte
> rejoint aussi le camp attaquant comme pile (engin lent/tanky). Bombardement
> **tour-par-tour** (ciblage de segment, PV) = raffinement ultérieur. Champ
> `siegeWalls` inchangé (la brèche = moins de segments) ⇒ pas de bump save, golden
> inchangé. Zéro faction moteur.

> 🚧 **État (sièges v2 — C-SIEGE2.3, douves)** : une ville **bien fortifiée**
> (Fort ≥ 2) creuse une **douve** — une colonne d'hexes (`CombatState.moat`, champ
> **optionnel** ⇒ pas de bump save, golden inchangé) juste devant le rempart. Un
> hex de douve est **atteignable** mais **non traversable en un déplacement** : le
> BFS de `reachableHexes` l'ajoute à l'atteignable sans le ré-explorer, si bien
> que **franchir la douve coûte un tour**. La douve ne bloque **pas** la ligne de
> vue (ce n'est pas un mur) et les **volants l'ignorent**. Rendu client : teinte
> de fossé distincte (`FILL_MOAT`). Dégâts de douve = **C-SIEGE2.4**. Zéro faction
> moteur.

> 🚧 **État (sièges v2 — C-SIEGE2.4, dégâts de douve)** : une pile **assaillante**
> qui **s'arrête dans la douve** (la douve étant infranchissable en un tour,
> terminer un déplacement dessus = y être entré) subit des **dégâts** échelonnés
> sur le Fort (`CombatState.moatDamage`, champ **optionnel** = `fortLevel × 20` ⇒
> pas de bump save, golden inchangé ; `applyMove` inflige les dégâts via
> `damageOneStack` puis émet `MoatDamaged`). **Seul l'assaillant** la subit — le
> **défenseur** vit derrière son rempart et ne franchit jamais sa propre douve
> (garde `stack.side === 'attacker'`, générique, zéro faction). Rendu client : le
> nombre de dégâts flotte sur la pile mordue (`MoatDamaged` ⇒ `spawnDamageNumber`).
> Zéro faction moteur.

> 🚧 **État (sièges v2 — C-SIEGE2.5, tour de tir)** : une ville **très fortifiée**
> (Fort ≥ 3, Château) ajoute une **tour de tir** au camp défenseur — une pile
> tireuse **immobile** (unité générique `arrow-tower` de `war-machines.json`,
> marqueurs `warMachine` + `shooter` + **`immobile`**). La capacité générique
> `immobile` fait renvoyer `reachableHexes` **vide** : la tour ne se déplace
> jamais, elle **tire ou attend** (le schéma d'unité impose vitesse ≥ 1, d'où le
> marqueur plutôt qu'une vitesse 0). Elle est plantée **derrière la porte**
> (`SIEGE_WALL_COL + 1`), donc **atteignable** par l'assaillant qui franchit la
> porte ⇒ **destructible, pas de stalemate** ; hors zone d'obstacles et de la
> colonne de douve ⇒ aucune collision de montage. Elle **compte comme pile
> défenseur** (le combat ne finit qu'une fois la tour tombée aussi) ; comme toute
> `warMachine` elle est hors moral/pertes et **ne se relève pas** en squelettes
> (Nécromancie exclut `warMachine`). Jamais vendue (absente de tout
> `warMachineVendor`) : elle n'existe que posée par le siège. Une garnison **vide**
> ⇒ capture immédiate inchangée (défense tour-seule = ultérieur). Tour = pile dans
> `stacks` (aucun champ neuf) ⇒ pas de bump save, golden inchangé. Zéro faction
> moteur ; rendu client automatique (jeton d'unité).

> 🚧 **État (sièges v2 — C-SIEGE2.6, bombardement de catapulte)** : au-delà de la
> **brèche initiale** au montage (C-SIEGE2.2), une **catapulte** (`siegeBreaker`)
> encore vivante côté assaillant **érode le rempart round après round**. Les
> segments gagnent des **PV** (`CombatState.siegeWallHp`, `"col,row" → PV`, présent
> **uniquement** avec une catapulte ⇒ sinon murs indestructibles comme en .1/.2).
> **Au début de chaque round** (`advanceTurn`), la catapulte **bombarde** le segment
> intact le plus proche du centre de la porte (élargissement contigu, déterministe) :
> dégâts = tirage RNG **seedé** des dégâts de la catapulte ; PV ≤ 0 ⇒ le segment
> est **retiré** de `siegeWalls` (l'hex s'ouvre) et de `siegeWallHp`, événement
> `WallBombarded { col, row, destroyed }`. Un seul tir/round ; catapulte détruite ⇒
> plus d'érosion. La catapulte **agit toujours** comme pile (le bombardement est un
> effet de round, pas son tour). Rendu client : le mur détruit s'ouvre (redraw du
> plateau sur `WallBombarded`). `siegeWallHp` **optionnel** ⇒ pas de bump save,
> golden inchangé (aucun siège dans le golden). Zéro faction moteur.

> 🚧 **État (sièges v2 — C-SIEGE2.7a, défense tour-seule)** : une ville à garnison
> **vide** n'est plus toujours prise sans combat — un **Château** (Fort ≥ 3, qui
> pose une tour de tir) **se défend par sa seule tour**. `handleCaptureTown` ouvre
> un siège si `garnison > 0` **OU** si une tour apparaîtrait
> (`wouldSpawnSiegeTower(fortLevel, catalog)` = Fort ≥ 3 ET unité `arrow-tower`
> chargée) ; `validateCaptureTown` refuse alors aussi l'**armée vide** (un héros
> sans troupe ne prend pas une ville tour-défendue). La tour seule est atteignable
> (derrière la porte) ⇒ destructible, **pas de stalemate** ; sa chute vide le camp
> défenseur ⇒ capture (flux `applyConsequences` inchangé). Changement **de
> comportement** (aucun champ neuf) ⇒ pas de bump save, golden inchangé. Zéro
> faction moteur.

> 🚧 **État (caravanes inter-villes — T-CARAVAN, livré)** : commande générique
> **`SendCaravan { fromTownId, toTownId, slot }`** — envoie une pile de garnison
> d'une ville possédée vers une autre ville du **joueur actif**. La durée de
> trajet (en **jours**) est dérivée de l'A* existant (`ceil(coûtChemin /
> movement.base)`, min 1 ; vitesse de base, aucun PM de héros consommé). La
> caravane vit dans `GameState.caravans` (`CURRENT_SAVE_VERSION` → 21) et avance
> d'un jour à chaque `DayStarted` ; à l'arrivée elle se **dépose en garnison**
> (fusion par unité, sinon nouvelle pile ≤ 7 ; garnison pleine ⇒ attente). Si la
> ville de destination **change de main** avant l'arrivée, la caravane se
> **disperse** (`CaravanLost`). **Non interceptable** (convention HoMM3). UI :
> bouton « Caravane » + sélecteur de destination dans l'onglet Garnison, bandeau
> des caravanes en route. *Différés : interception, caravanes de héros (multi-héros
> non livré), annulation en route.*

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

> **Phase de placement (C-TACTICS, livré)** : un héros doté de la compétence
> **Tactique** ouvre le combat en `phase: 'placement'` — le camp joueur
> repositionne ses piles dans une **bande** de `tacticsColumns` colonnes depuis
> sa colonne de spawn (rang 1/2/3 → 2/3/4 colonnes) via la commande `PlaceStack`
> (bornée : bande, case libre, hors obstacle), puis `FinishPlacement` démarre la
> bataille. Sans Tactique, le combat démarre directement en `phase: 'battle'`.
> L'auto-combat et l'IA **sautent** un placement pendant (aucune IA ne place ;
> la property « un combat se termine toujours » est préservée). Save v24.
- Obstacles générés selon le terrain d'aventure (2–5 hexes bloqués, tirés au RNG du combat dans les colonnes centrales 3–11, soit 3 tuiles de marge depuis chaque bord de spawn) ; le terrain natif donne +1 vitesse/+1 moral aux unités natives.
- La **vitesse** d'une unité est sa portée de déplacement en hexes par round.

### 5.2 Tour par tour

- **Rounds par vagues** : à chaque round, toutes les piles agissent par ordre de **vitesse décroissante** (égalité : attaquant d'abord, puis ordre de slot). Choix « vagues » plutôt que barre ATB : plus prévisible et lisible sur petit écran.
- Actions d'une pile : **déplacer**, **attaquer** (mêlée : déplacement+attaque ; distance : tir si pas d'ennemi adjacent **et ligne de vue dégagée**, sinon mêlée à ½ dégâts), **attendre** (rejoue en fin de round, par vitesse **croissante** ; une attente par round), **défendre** (+30 % défense, soit Défense ×1,3 arrondie à l'entier inférieur, jusqu'au prochain tour de la pile).
- **Ligne de vue** (C-LOS) : un tir exige une ligne de vue dégagée entre le tireur et sa cible. Seuls les **obstacles** de la grille bloquent la vue — les **piles** (alliées ou ennemies) ne la bloquent pas. Une cible masquée par un obstacle **ne peut pas être tirée** (pas de malus : tir simplement interdit) ⇒ le tireur doit la frapper en mêlée. La portée reste illimitée (§5.4). La ligne est tracée en géométrie hexagonale déterministe (linedraw cubique) pour un replay stable.
- **Riposte** : 1 riposte/round par pile, après application des pertes de la frappe — une pile détruite ne riposte pas, le tir ne déclenche jamais de riposte (des capacités la modifient : `noRetaliation`, `unlimitedRetaliation`).
- **Le héros** : 1 action/round (sort OU attaque héroïque mineure), ne peut pas être ciblé.

### 5.3 Dégâts

```
dégâts = Σ(dmg aléatoire min–max par créature de la pile)
       × (1 ± 0.05 × (AttaqueTotale − DéfenseTotale))   // borné [−0.70, +0.60]
       × modificateurs (capacités, sorts, chance ×2 / malchance ×0,5, moral n'affecte pas les dégâts)
```

- Les pertes retirent des créatures entières + PV entamés sur la première.
- **Moral** (−3..+3) : proba d'un **tour bonus** (moral positif : 4 %/point) ou d'un **tour sauté** (négatif : 4 %/point, symétrique). Armée multi-factions : −1 moral par faction supplémentaire (les morts-vivants ne subissent/ne donnent pas de moral).
- **Chance** (−3..+3, C-BADLUCK) : un seul jet par frappe, |chance| × 4 %/point de déclencher — selon le signe — soit un **coup de chance** (dégâts ×2), soit un **coup de malchance** (demi-dégâts, ×0,5). Symétrique du moral. Chance nulle ⇒ jamais de déclenchement.
- Note (Phase 2.4) : en combat, la formule symétrique ±0,05/point s'applique
  telle quelle aux stats des unités ; la pente défensive −2,5 %/point de §1.1
  concerne l'attribut **Défense du héros**, qui s'ajoutera au MVP (les bornes
  −70 %/+60 % sont communes). Toutes ces constantes vivent dans
  `data/core/config.json` (`adventure.combat`).

### 5.4 Capacités d'unités (bibliothèque moteur)

Le moteur expose un **catalogue de capacités génériques paramétrables** ; les unités les référencent par ID dans leurs données.

> **État livré** : le catalogue réellement interprété par le moteur — `data/core/abilities.json` — compte **27 capacités** : `flying`, `shooter`, `noRetaliation`, `doubleAttack`, `undead`, `mark`, `consumeMarks`, `demonform`, `symbiosis`, `shieldWall`, `unlimitedRetaliation`, `charge`, `magicResistance` (autonome, plus seulement porté par `demonform`), `lifeDrain` (lot A2a), `incorporeal`, `strikeAndReturn` (lot A2b), `curseOnHit` (lot A2c), `aura`, `moraleImmune` (lot A3a), `swarm` (lot A3b), `areaAttack` (lot A3c), `devourMarks` (lot A2d), `breathAttack` (lot A3d), `taunt` (lot A2e), `poisonSting` (lot A2f), `firstStrike` (lot A2g), et `spellcaster` (lot A2h). La dernière capacité encore nommée dans les lineups mais **pas encore interprétée** (inerte en combat) : `resurrectAlly` — cible de design, activée par un sous-lot ultérieur.

Une faction qui a besoin d'une capacité **réellement nouvelle** l'obtient en ouvrant **un** point d'extension **générique** du moteur, interprété depuis les données (cf. doc 06 §4) — jamais un module propre à une faction. C'est ainsi que `consumeMarks`/`demonform`/`symbiosis` ont été livrées.

Sémantique des **27 capacités** du catalogue (valeurs de départ) :

| Capacité | Effet implémenté |
|---|---|
| `flying` | le déplacement ignore obstacles et unités (survol), portée = vitesse, atterrissage sur hex libre |
| `shooter(ammo, noMeleePenalty?)` | tir sans riposte, portée illimitée **avec ligne de vue** (obstacles bloquants, C-LOS §5.2), 1 munition/tir ; à 0 munition, ennemi adjacent **ou vue bloquée** : mêlée à ½ dégâts sauf `noMeleePenalty` |
| `noRetaliation` | la cible ne riposte jamais aux attaques de cette unité |
| `doubleAttack` | deux frappes ; la riposte éventuelle s'intercale après la 1ʳᵉ |
| `undead` | moral figé à 0 (ne subit ni ne donne), ne compte pas dans le malus multi-factions |
| `mark` | chaque frappe applique 1 charge à la cible (max 3, persistantes) ; +8 %/charge de dégâts subis |
| `consumeMarks(...)` | sur une frappe **volontaire** (jamais en riposte), consomme les charges de Marque pour un effet paramétré : bonus de dégâts, suppression de riposte (`suppressRetaliation`, « expose ») ou immobilisation (`immobilizeRounds`, « pinningShot ») |
| `demonform` | T8 : commence en forme humaine (`magicResistance` 50 %), bascule 1×/combat en forme démon (+dégâts, attaque de zone) mais perd la résistance |
| `symbiosis` | une pile qui **ne bouge pas** accumule un buff croissant round après round (signature Sylvan Court) |
| `shieldWall(defendMultiplier)` | A2a : Défendre donne un multiplicateur de Défense propre (ex. ×1,5) au lieu du ×1,3 commun |
| `unlimitedRetaliation` | A2a : la pile riposte sans limite de 1/round |
| `charge(perHex)` | A2a : bonus de dégâts de la frappe de mêlée **volontaire** = `perHex × hexes parcourus` avant la frappe (0 sur place, jamais en riposte) |
| `magicResistance(value)` | A2a : réduit les dégâts de sort subis de `value` (autonome ; `demonform` en porte aussi une variante conditionnelle) |
| `lifeDrain(pct)` | A2a : la pile qui frappe en mêlée se soigne/relève de `pct × dégâts` infligés, plafonné à son effectif de départ |
| `incorporeal(dodge)` | A2b : la pile subissant une frappe a `dodge` chances de l'esquiver (dégâts 0), tirage seedé par frappe |
| `strikeAndReturn` | A2b : frappe de mêlée volontaire puis **retour à la case d'origine** ; la cible **ne riposte pas** (repli « harpie ») |
| `curseOnHit(chance, …mods, rounds)` | A2c : une frappe qui touche (non esquivée) a `chance` d'appliquer/rafraîchir un statut temporaire à la cible — `attackMod`/`defenseMod`/`speedMod` (« Affaiblissement ») ou `damageDealtMod` (« Faux funeste », −% dégâts infligés) sur `rounds` |
| `aura(moraleMod)` | A3a : une pile portant l'aura module le moral des piles **adverses** vivantes (ex. Dragon d'os −1) — portée totale du champ |
| `moraleImmune` | A3a : immunité au moral **négatif** (plancher 0) — le moral positif reste possible (ex. Ange) |
| `swarm(bonus, minAllies)` | A3b : +`bonus` de dégâts **par créature** quand au moins `minAllies` autres piles alliées de l'attaquant sont adjacentes à la cible (tactique de meute — Élève, Chœur) |
| `areaAttack(pct, sparesUndead?)` | A3c : une frappe volontaire éclabousse les piles **ennemies adjacentes à la cible** de `pct` des dégâts (sans riposte ; épargne les morts-vivants si `sparesUndead`) — nuage de la Liche |
| `devourMarks(perMark, healPerMark)` | A2d : sur une frappe volontaire, dévore **toutes** les charges de Marque du champ (+`perMark`/charge de dégâts cette attaque) puis soigne le striker de `healPerMark`/charge — Pénitent |
| `breathAttack(pct)` | A3d : une frappe de mêlée touche **aussi** la pile ennemie située **derrière** la cible (prolongement du souffle) de `pct` des dégâts — Dragon d'os |
| `taunt` | A2e : une attaque de **mêlée** partant d'une case adjacente à ce provocateur **doit le viser** (protège les tiers ; le **tir** n'est pas concerné) — Conscrit |
| `poisonSting(damagePerRound, rounds)` | A2f : une frappe de **mêlée** qui touche applique/rafraîchit un **poison** ; la cible subit `damagePerRound` (plats, cumulés) au **début de chaque round** pendant `rounds`, avant décroissance des statuts — Manticore |
| `firstStrike` | A2g : à **vitesse d'initiative égale**, la pile agit **avant** les piles sans `firstStrike` (priorité dans la vague, indépendante du camp/slot) — Chevalier du Griffon |
| `spellcaster(spellId, charges, power)` | A2h : la pile lance le sort embarqué `spellId` (catalogue partagé) jusqu'à `charges` fois/combat, Pouvoir effectif `power` (dégâts/soin/durée) ; cibles comme un sort de héros (ennemi damage/debuff, allié heal/buff), sans riposte. **Engine-first** : piloté par l'IA/auto-combat ; UI joueur différée — Prêtresse (soin ×2) |

### 5.5 Fin de combat & auto-résolution

- Victoire = plus aucune pile adverse. Fuite (perd l'armée, garde héros+artefacts, re-recrutable en taverne) et reddition (idem + coût en or, garde l'armée restante — post-MVP).
- **Abandon pré-combat** (retour de jeu 2026-07, commande `AbandonCombat`) : la puissance ennemie n'étant visible qu'en lançant le combat (écran pré-combat), on peut y **renoncer avant d'échanger le moindre coup** en conservant l'armée survivante, **sans coût** (l'ennemi l'emporte, le gardien/la ville reste). Réservé au premier round ; l'UI n'expose le bouton **que** sur l'écran pré-combat, jamais en bataille (où seules fuite/reddition existent). Distinct de la fuite (qui, elle, abandonne l'armée).
- **Bilan de fin de combat** (retour de jeu 2026-07) : à l'issue d'un combat *fouillé* (annihilation), un écran récapitule **morts/survivants par armée** et les **gains** (XP + niveaux, or, ressources, artefact, mort-vivants relevés). L'événement `CombatEnded` porte désormais `survivors` (en plus de `casualties`) ; un départ délibéré (fuite/reddition/abandon) n'ouvre pas de bilan.
- **Combat auto** : la même IA de combat joue les deux camps en accéléré ; résultat déterministe re-simulable (même seed) — indispensable pour le PvP asynchrone futur.
- **Écran pré-combat** (Lot 1, fidélité HoMM Online) : au démarrage de tout combat, un écran d'intro compare la **puissance de combat** des deux camps (`armyStrength`, même métrique que le graphe de fin de partie — pur affichage, sans effet sur la simulation) et propose **Combattre** (conduite manuelle) ou **Auto-Battle** (auto-résolution immédiate). Pur habillage client (`preBattlePending`), aucun changement moteur.
- **Retours de frappe** (UXD-4, fidélité HoMM Online) : après chaque frappe, un popup flottant montre les **dégâts** (`-N`) et, si des créatures meurent, une 2ᵉ ligne **kills** mise en avant (plus grosse, colorée) ; `★` sur coup de chance. La **file d'ordre de passage** du round (bandeau d'initiative, lot M1) et la **fiche de pile** au tap complètent la lisibilité tactique. Purs rendus canvas.

### 5.6 IA de combat (MVP)

Heuristique par pile : score = dégâts espérés × valeur de la cible − risque de riposte − exposition ; les tireurs kitent, les lents défendent. Pas de recherche arborescente au MVP.

**Parité héros (C-AIPARITY)** : l'IA joue aussi les actions du héros de son
camp — un sort par round (priorité dégâts > soin si un allié est blessé >
debuff/marques > buff, à mana suffisante) et l'attaque héroïque 1×/combat
(cible maximisant pertes × valeur), avant l'action de la pile active. En
auto-combat, les héros des DEUX camps sont joués. Le verrou « 1 sort/round »
est par camp (`heroCastThisRound`, save v23).

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
> 🚧 **État (M-NAV a — monolithes appariés, doc §2.1)** : nouvel objet de carte
> `monolith` portant un `pairId`. **Exactement 2** monolithes partagent un `pairId`
> (validé au load) ; fouler l'un **téléporte** le héros sur la tuile de l'autre et
> **interrompt** le déplacement (le reste du chemin part de l'entrée). Le héros
> arrive sur la sortie sans re-téléporter (pas de boucle) ; le brouillard est
> révélé à l'arrivée ; événement `HeroTeleported`. **Zéro sens imposé** (deux
> sens), zéro faction. Bateaux/chantier naval (b) et souterrain (c) restent
> différés (cf. backlog M-NAV).
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
