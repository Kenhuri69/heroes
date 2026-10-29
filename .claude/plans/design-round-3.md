# Tour de design n° 3 — après LE1→LE8, R1→R4

> **Demande utilisateur (2026-10-28)** : « nouveau tour de design ». Tous les lots
> de `game-experience-enrichment.md` sont livrés ; son registre §1 ne garde que
> des chantiers bloqués ou écartés (souterrain > 2 niveaux, snapshot D1, TS 7,
> F-BUILDEFF Traque/Sceau…), **non re-proposés ici**.
>
> Plan **vivant** (guidelines §5). Rédigé par l'agent `game-designer` sur `main` à
> `4ef2732`. **Aucun code** : ce document propose ; chaque lot validé ouvrira son
> plan `.claude/plans/<lot>.md` et une PR atomique. Le verdict de
> `tactical-rpg-expert` (§5) et les décisions 🗳️ (§4) restent à rendre.

## 0. Mesures faites pour ce tour

- **`pnpm faction:sim`** (main, 2026-10-28, ≈ 2,5 min) : **0 béance** au duel de
  base, mais **13 paires sur 15 hors 45–55 %** (bornes à 79,2/20,8 : Haven-AH,
  AH-Dungeon, Haven-Sylvan). Attrition et gauntlet resserrés (2,0 → 2,8 vagues).
  Le **duel des élites** (budget 4 000 or/tier, lecture) montre 11 paires hors
  20–80 % (AH-Sylvan 98,3 %), et Haven élites ne gagne que 13,3 % **contre sa propre
  base**, alors que le facteur d'égalité mesuré à 40 000 or/tier vaut ×1,024. Ces
  écarts ressemblent à un effet de seuil du petit budget (peu d'unités T6-T7),
  pas à un déséquilibre : on les note au §3, sans lot.
- **Bench IA jetable** (script hors dépôt dans le scratchpad, **non commité**,
  même harnais que les lots LE) : `newGameStartCommand` réel, 2 IA, carte générée
  64², difficulté normale, factions tournantes, graines 1001–1030, boucle
  `AiTurn`.

  | Variante | Parties finies | dont finies par la perte du **héros de départ du joueur 1**, une ville encore tenue | Joueur 2 encore en jeu sans son héros de départ |
  |---|---|---|---|
  | Règles actuelles, 60 j | 17/30 | **16/17** (7 fois avec d'autres héros vivants, 2 fois le héros était seulement **en réserve** après une fuite) | 10/30 |
  | Défaite par **élimination seule** (HoMM), 90 j | **8/30** | 0 | 16/30 |

  Autres lectures de la variante « élimination », jours 28 et 56 : **12 parties
  sur 30 sans aucun combat hors gardien en 90 jours**. Ce compte inclut pourtant
  les sièges de villes neutres. Le premier combat de ce type arrive en médiane
  vers le **j54**. Quand une IA a plusieurs héros, le plus fort ne porte en
  médiane que **65 %** de la force de ses armées, et **un tiers** de ses héros
  n'ont **aucune troupe**.

## 1. Diagnostic : une partie type aujourd'hui

- **Ouverture (j1-7)** : elle tient. Elle offre un vrai choix de ville (Semaine
  offerte, LE6), des coffres or/XP, des cabanes Apprendre/Refuser (R3), des gardiens
  aux goulots (LE3) et des neutres qui fuient ou se rallient (LE5).
- **Mi-partie (sem. 2-6)** : la carte résiste et la magie compte. Deux creux restent :
  - **la progression du héros est une loterie**. Chaque montée de niveau tire 2
    compétences au hasard, uniformément, parmi ≈ 23 éligibles
    (`hero/level-up.ts:13-45`). Un héros de force se voit proposer Magie de l'eau
    aussi souvent que Tactique. L'IA prend **la 1ʳᵉ proposition**, sans aucune
    préférence (`adventure/experience.ts:143`) ;
  - **un second héros ne sert à rien en début de partie**. Un héros recruté à la
    Taverne arrive **sans aucune troupe** (`hero/recruit.ts:119`). Or un camp sans
    pile perd le combat sur-le-champ (doc 02 §5.5) : c'est donc un éclaireur à
    2 500 or que n'importe quel ennemi tue gratuitement. Chez l'IA, il vide aussi la
    garnison à la place du héros principal (`ai/town-ai.ts:290-293` donne la
    garnison au héros d'id le plus petit).
- **Fin de partie** : c'est là que le jeu casse.
  - **Une règle fausse** : en Nouvelle partie et en escarmouche, la défaite est
    `defeatHero(hero-<siège>)` (`client/src/app/game.ts:874`, `:1250`). Perdre son
    **héros de départ** fait perdre la partie, même avec des villes et d'autres
    héros. Depuis LE6, **fuir** le fait aussi : le héros part en réserve
    (`combat/leave.ts:177`) et `defeatHero` est rempli (`scenario/outcome.ts:45-46`).
    Le joueur qui sauve son héros par la fuite HoMM perd donc la partie. La règle
    est de plus **asymétrique** : seuls les objectifs du joueur « local » sont
    évalués (`outcome.ts:88`), si bien qu'une IA qui perd son héros de départ continue.
    Doc 02 §6 dit pourtant « Défaite : perte de tous héros **et** villes ».
  - **Une IA qui ne conclut pas** : une fois cette règle neutralisée, 22 parties
    sur 30 ne se terminent pas en 90 jours sur une **petite** carte à 2 joueurs.
    Les objectifs de l'IA ne portent qu'à 3 jours (`ai/adventure.ts:580`).
    Elle explore **avant** de marcher sur une ville adverse lointaine (`:958` puis
    `:966` : la marche n'est qu'un dernier repli). Elle ne regroupe jamais ses
    armées (aucun `TransferBetweenHeroes` dans `engine/src/ai/`).
  - **Peu de mobilité de fin de partie** : il n'existe que 4 sorts d'aventure
    (`hero/types.ts:41-55` : Ville-portail, Vision, Marche forcée, Cartographie),
    et l'IA ne lance jamais Ville-portail (`ai/adventure.ts:864`, `:941`). Les
    cartes vont pourtant jusqu'à 512².

**Diagnostic** : la mi-partie est désormais riche, mais **la partie ne sait pas
finir**. Elle se termine sur une règle de défaite fausse ou ne se termine pas du
tout. Les lots LD1 et LD2 sont la priorité. LD3 et LD4 rendent les héros
secondaires et la progression lisibles. LD5 et LD6 approfondissent l'asymétrie et
la fin de partie.

## 2. Lots proposés (ordre valeur / effort)

Format condensé en 8 points (`.claude/agents/game-designer.md`) ; le point 8
(verdict) est au §5.

### LD1 — Une défaite HoMM (S)

1. **Intention joueur** : « je perds quand je n'ai plus ni ville ni héros, pas parce
   que mon premier héros a fui pour sauver sa peau ».
2. **Constat** : voir §1 (`game.ts:874/1250`, `outcome.ts:45-46/88`,
   `leave.ts:177`). Bench : 16 des 17 parties finies en 60 jours l'ont été par
   cette règle. Doc 02 §6 contredit le code. Il y a aussi une limite connue en
   hot-seat (`outcome.ts:84-87`, B27) : l'élimination du 1ᵉʳ humain termine la
   partie, même si un autre humain joue encore.
3. **Mécanique** :
   - `ScenarioObjectives.defeat` devient **optionnel**. S'il est absent, seule
     compte l'élimination HoMM déjà codée (plus de ville ni de héros, ou plus de
     7 jours sans ville). `newGameStartCommand` et `skirmishStartCommand` ne posent
     plus de `defeat`. Les scénarios et campagnes gardent leurs objectifs
     explicites.
   - Un héros **en réserve** (après une fuite) ne remplit **pas** `defeatHero`
     quand c'est la condition de **défaite** de son propre joueur. Il la remplit
     quand c'est la condition de **victoire** d'un adversaire : l'ennemi a été
     battu. Voir 🗳️ D-LD1b.
   - **Hot-seat** (🗳️ D-LD1c) : la partie continue tant qu'un humain non éliminé
     reste en jeu. `outcome = lost` seulement quand tous les humains sont
     éliminés, `won` quand un humain remplit sa victoire. L'overlay affiche déjà
     le siège gagnant (`outcome.winner`).
4. **Pilier** : core loop HoMM (fidélité), armée & héros.
5. **Point d'extension** : un **champ optionnel** (`defeat?`) au schéma de
   scénario et au moteur. Aucun état nouveau.
6. **Coût** : S · moteur oui (`scenario/outcome.ts`, schéma) + client (2
   builders) · **pas de bump** (forme existante toujours valide) · golden **non**
   (replay sans scénario).
7. **Critère** : tests moteur (« héros de départ tué, ville tenue ⇒ partie
   continue » ; « fuite du protagoniste de campagne ⇒ pas de défaite » ; « fuite
   du héros cible ⇒ victoire adverse » ; hot-seat à 2 humains + 1 IA) ; bench :
   0 partie finie par la perte du héros de départ ; smoke `@core` de fin de partie
   inchangé ; doc 02 §5.5 et §6 amendés.
   **Risque** : seul, LD1 **allonge** les parties (8/30 finies en 90 jours).
   Il faut l'enchaîner avec LD2, sans attendre.

### LD2 — Une IA qui conclut (M)

1. **Intention joueur** : « en fin de partie, l'IA rassemble une armée et vient
   me chercher ; elle ne se disperse plus sur la carte ».
2. **Constat** : voir §1. En variante « élimination », 12 parties sur 30 n'ont
   **aucun** combat hors gardien en 90 jours. Le héros le plus fort ne porte que
   65 % de la force des armées, et un tiers des héros IA n'ont aucune troupe.
   Horizon de 3 jours (`ai/adventure.ts:580`), exploration avant la marche
   (`:958`/`:966`), aucune consolidation entre héros, garnison donnée au premier
   id venu (`town-ai.ts:292`).
3. **Mécanique** (IA seule, aucune règle neuve) :
   - **Héros principal** : recalculé à chaque tour, c'est le héros de plus forte
     `armyStrength` (à égalité, l'id le plus petit). La garnison d'une ville va au
     principal s'il est à ≤ 2 jours ; sinon au héros présent. C'est le patron du
     rappel LE1.
   - **Relais** : un héros secondaire qui porte au moins 25 % de la force du
     principal et se trouve à ≤ 2 jours de lui le rejoint et lui donne tout par
     `TransferBetweenHeroes`, pile par pile, dans la limite de `heroArmyCap`. Il
     repart ensuite ramasser et explorer.
   - **Offensive** : si le principal pèse au moins **1,5 ×** la défense estimée
     (`townDefenseStrength`) d'une ville adverse **déjà explorée**, il y marche
     **sans horizon** de jours. Cet objectif passe **avant** l'exploration (il est
     déplacé avant `:958`). La priorité 0 « ma ville va tomber » reste en tête.
   - **Recrutement de héros** : l'IA n'achète un héros que si elle a plus de
     villes que de héros, ou si LD3 est livré (le héros arrive avec une escorte).
4. **Pilier** : armée & héros (adversaire), rythme de fin de partie.
5. **Point d'extension** : aucun. L'IA se sert de commandes existantes
   (`TransferBetweenHeroes`, `GarrisonTransfer`, marche de siège LE1).
6. **Coût** : M · IA seule · save non · golden non.
7. **Critère** : bench jetable (2 IA, 64², 30 graines, 90 jours, défaite
   d'élimination) : parties conclues **8/30 → ≥ 15/30** ; parties sans combat
   hors gardien **12/30 → ≤ 5/30** ; part du héros principal **0,65 → ≥ 0,85** ;
   durée d'un tour IA sans recul de plus de 20 %. Property « IA contre IA se
   termine » et déterminisme verts. Tests : relais vers le principal, offensive
   au-delà de 3 jours. Doc 02 (IA d'aventure) amendé.
   **Risques** : une IA trop agressive envers le joueur en *facile*
   (🗳️ D-LD2) ; un relais qui affame un héros secondaire en danger (le relais ne
   s'applique jamais à un héros menacé par la priorité 0).

### LD3 — Escorte de Taverne (S)

1. **Intention joueur** : « un héros recruté arrive avec une petite escorte. Il
   peut ramasser, tenir une mine ou servir de relais dès le jour même ».
2. **Constat** : `hero/recruit.ts:119` donne `army: []`, et doc 02 §1.5 le confirme
   (« armée vide »). Dans HoMM III, un héros de taverne arrive avec 1 à 3 piles de
   bas tier. Ici, un héros sans pile perd dès l'ouverture d'un combat (doc 02 §5.5).
   Le bench montre qu'un tiers des héros IA ne portent aucune troupe.
3. **Mécanique** : bloc de config **opt-in** `hero.tavernEscort: [{ tier, min,
   max }]`. Proposition : T1 10–20, T2 4–7, T3 1–3. *L'ordre de grandeur suit le
   canon III, mais les chiffres exacts restent incertains et sont à confirmer par
   l'expert.* Pour chaque palier, on prend l'unité **de base** de l'habitation de
   ce palier dans la chaîne de la faction du héros. Le helper de dwellings de
   ville, déjà partagé avec le client, sert pour cela, sans aucun id de faction.
   L'effectif est tiré au **RNG seedé**. Un palier introuvable est sauté. La valeur
   de l'escorte est plafonnée à environ **40 % du prix du héros**, pour qu'on ne
   recrute pas un héros juste pour ses troupes (abus classique du III). Un héros
   qui revient de la **réserve** arrive sans escorte : la fuite doit coûter
   (🗳️ D-LD3).
4. **Pilier** : armée & héros.
5. **Point d'extension** : un bloc de config optionnel (absent = pas d'escorte),
   lu par `handleRecruitHero`.
6. **Coût** : S · moteur oui · save non · golden non (rien n'est recruté dans le
   replay, à vérifier).
7. **Critère** : tests (« escorte posée, bornes tenues, déterministe » ; « palier
   absent ⇒ sauté » ; « réserve ⇒ sans escorte ») ; bench : part des héros IA sans
   troupe passe de 1/3 à moins de 10 % ; doc 02 §1.5 amendé ; smoke Taverne :
   le héros recruté affiche une armée.

### LD4 — La montée de niveau HoMM III (S-M)

1. **Intention joueur** : « à chaque niveau, je choisis entre approfondir mon
   build et ouvrir une nouvelle voie, et ces propositions ressemblent à mon
   héros ».
2. **Constat** : tirage uniforme de 2 compétences parmi les éligibles
   (`hero/level-up.ts:40`). Rien ne garantit une montée de rang, ni une proposition
   qui colle à l'archétype. L'IA applique la 1ʳᵉ proposition au hasard
   (`adventure/experience.ts:143`), donc un héros IA de Nécropole tient rarement
   Nécromancie à un rang utile. Le patron existe déjà pour les attributs
   (`attributeWeightsByArchetype`, `experience.ts:15-23`).
3. **Mécanique** (canon III) :
   - Une proposition est une **montée** de rang d'une compétence connue de rang
     < 3, si elle existe ; l'autre est une **nouvelle** compétence, si un
     emplacement est libre. À défaut, deux montées ou deux nouvelles.
   - Tirage **pondéré** : `config.hero.skillWeightsByArchetype?: Record<archetype,
     Record<skillId, weight>>` (clés opaques ; poids 1 par défaut). Un héros
     générique, sans archétype, garde le tirage uniforme.
   - **Option canon III** (🗳️ D-LD4) : la Sagesse est garantie si elle n'a pas été
     proposée en 6 niveaux, et une école de magie tous les 4 niveaux, pour un héros
     qui peut les apprendre. *Rythme canon cité de mémoire, à confirmer.*
   - **IA** : elle choisit la proposition de meilleur score (compétence de faction >
     montée de rang > poids d'archétype), sans tirage supplémentaire.
4. **Pilier** : armée & héros (progression), asymétrie.
5. **Point d'extension** : un bloc de config optionnel (patron
   `attributeWeightsByArchetype`). La règle « montée + nouvelle » change le tirage.
6. **Coût** : S-M · moteur oui · save non · golden **à vérifier** (la séquence RNG
   des propositions change si le replay fait monter un héros de niveau).
7. **Critère** : tests (« une montée + une nouvelle quand c'est possible » ;
   « poids respectés sur 10 000 tirages » ; « IA de Nécropole ⇒ Nécromancie choisie
   dès qu'elle est proposée ») ; bench : rang moyen de la compétence de faction des
   héros IA au j56 ; doc 02 §1.2/§1.3 amendé.

### LD5 — Un dilemme de construction par maison (M, données)

1. **Intention joueur** : « chaque maison me pose au moins un choix d'habitation
   définitif, qui change mon armée ».
2. **Constat** : les `alternatives` de niveau (E3) ne sont utilisées que par
   Haven T3 (`data/factions/haven/buildings.json`), et les `exclusiveGroup` que par
   AH et Vox. **Nécropole, Sylvan et Donjon n'ont aucun dilemme de
   construction.** Le moteur est prêt, l'IA choisit déjà (LE8) et le sim lit les
   élites (E3).
3. **Mécanique** : une alternative au niveau 2 d'une habitation par maison,
   avec des capacités **déjà au catalogue**. Les variantes s'inspirent des
   améliorations alternatives de HoMM V *Tribes of the East* :
   - **Nécropole T1** : Squelette archer (élite actuelle) **ou Squelette
     guerrier** (`shieldWall`, mêlée robuste), le pendant canon V ;
   - **Sylvan T5** : Licorne (`magicResistance`) **ou Licorne de guerre**
     (`curseOnHit`, qui reprend l'esprit de l'aveuglement) ;
   - **Donjon T3** : Minotaure élite **ou Minotaure gardien** (`taunt` : il
     protège les tireurs, ce qui donne du jeu au Donjon, faction de mêlée).

   Chaque variante est **au même prix** que l'élite, au juste prix mesuré par le
   facteur d'égalité ×1,00 ± 5 %, comme le Vindicateur.
4. **Pilier** : rejouabilité, asymétrie des factions.
5. **Point d'extension** : aucun (données + locales).
6. **Coût** : M · moteur non · save non (l'id choisi est déjà dans
   `levelChoices`) · golden non. **Assets** : 3 sprites, avec repli procédural en
   attendant (prompts doc 12).
7. **Critère** : `faction:sim`, facteur d'égalité de chaque variante dans ±5 % ;
   duel de base toujours à 0 béance ; `content:check` (parité des capacités
   élite/variante) ; docs 04/14/17 amendés.

### LD6 — Porte dimensionnelle, et l'IA qui se sert de Ville-portail (M)

1. **Intention joueur** : « en fin de partie, mon mage expert se joue des
   distances, et l'IA rentre défendre sa ville au lieu de la perdre à 10 jours
   de marche ».
2. **Constat** : `AdventureEffect` compte 4 effets (`hero/types.ts:41-55`). Il n'y
   a aucun saut ciblé, alors que les cartes vont jusqu'à 512². Le cercle 5 ne
   contient que 3 sorts, dont 2 communs : Armageddon et Résurrection de masse
   (`data/core/spells.json`). L'IA ne lance jamais `townPortal`
   (`ai/adventure.ts:864/941`, seules Marche forcée, Vision et Cartographie).
3. **Mécanique** :
   - Effet `blink { range, perDay }` : le héros se téléporte sur une tuile
     **explorée, franchissable et libre**, sur sa couche, à ≤ `range` tuiles
     (Tchebychev), au plus `perDay` fois par jour. Il ne peut pas atterrir dans une
     zone de contrôle de gardien. Le saut coûte 300 PM ; sans ces PM, le sort est
     refusé.
   - Le compteur par jour est un champ **optionnel** paresseux
     (`HeroState.blinksToday?`), remis à zéro à l'aube.
   - Sort **Porte dimensionnelle** (Air, cercle 5, canon III) : `range` 7 ;
     `perDay` 1/2/3 selon la maîtrise d'école de LE4 (`mastery`).
   - **Interaction** : modale de visée sur la carte (tap sur la tuile, puis tap
     pour confirmer) ; tuiles valides surlignées. C'est le patron du ciblage de
     sort de combat, adapté au doigt.
   - **IA** : `townPortal` quand une de ses villes est menacée et hors de portée à
     pied (priorité 0 de LD2) ; `blink` seulement s'il raccourcit d'au moins un
     jour la marche vers l'objectif choisi.
4. **Pilier** : exploration, armée & héros (fin de partie).
5. **Point d'extension** : **un** nouvel effet d'aventure, `blink` ; un sort
   en données.
6. **Coût** : M · moteur oui · save non (champ optionnel) · golden non.
7. **Critère** : tests (cibles valides ou refusées : brouillard, zone de contrôle,
   occupée, autre couche ; quota par jour ; PM) ; test IA « ville menacée hors de
   portée ⇒ Ville-portail » ; smoke `@core` de visée au doigt ; doc 02 §1.4 et
   doc 08 amendés.
   **Risque** : un saut qui contourne les goulots de LE3. Les parades sont la zone
   de contrôle interdite, la portée de 7 et le cercle 5, qui exige la Sagesse
   experte.

### Ordre et dépendances

**LD1 → LD2** (en paire : LD1 corrige la règle, LD2 évite que les parties
s'enlisent), puis **LD3** (il nourrit les relais de LD2), **LD4**, **LD5**,
**LD6** (sa visée IA s'appuie sur la priorité 0 de LD2, et `perDay` sur
`mastery`). LD3, LD4 et LD5 sont indépendants entre eux.

| Lot | Valeur | Effort | Moteur | Save | Golden |
|---|---|---|---|---|---|
| LD1 Défaite HoMM | ★★★ | S | oui (champ optionnel) | non | non |
| LD2 IA qui conclut | ★★★ | M | IA seule | non | non |
| LD3 Escorte de Taverne | ★★ | S | 1 bloc de config | non | non (à vérifier) |
| LD4 Montée de niveau III | ★★ | S-M | 1 bloc de config | non | à vérifier |
| LD5 Dilemme par maison | ★★ | M | non (données) | non | non |
| LD6 Porte dimensionnelle | ★ | M | 1 effet | non | non |

## 3. Considérés et non retenus

- **Conditions de victoire au choix à « Nouvelle partie »** (Graal, Capitale) :
  le générateur aléatoire de HoMM III n'en propose pas, et les scénarios ont déjà
  leurs objectifs déclaratifs. Un ajout de rejouabilité secondaire ; on le
  rouvrira quand les parties sauront finir (LD1/LD2).
- **Guilde des voleurs** : déjà livrée (doc 02 §1.5, lot doc 18 E3).
- **Vol / Marche sur l'eau** : un second point d'extension (le pathfinding ignore
  le terrain), pour une valeur proche de `blink`. Écarté, sauf choix contraire en
  🗳️ D-LD6.
- **Combat tactique** : c'est le système le plus travaillé depuis le dernier tour
  (LE2, F1, F2, R1, statuts sans cumul), et aucun manque n'a été prouvé. Reste
  connu et mineur : l'IA de combat n'utilise ni `dispel` ni `summon` (doc 02
  §1.4). On le laisse à l'appréciation de l'expert.
- **Duel des élites au sim** : les écarts (11 paires hors 20–80 %) contredisent
  le facteur d'égalité mesuré à 40 000 or/tier. On soupçonne un effet de seuil du
  budget de 4 000 or/tier. C'est une question d'outillage, pas de design : on
  remesurerait à 40 000 or/tier avant toute passe 5.

## 4. Décisions 🗳️ à trancher par l'utilisateur

- 🗳️ **D-LD1a — Défaite en partie générée** : (a) **élimination HoMM seule, plus
  ni ville ni héros (recommandé)** ; (b) garder « perte du héros de départ », mais
  un héros en réserve compte comme vivant ; (c) option « Héros de départ = vie » à
  « Nouvelle partie », désactivée par défaut.
- 🗳️ **D-LD1b — `defeatHero` et la fuite** : (a) **la fuite ne compte pas comme
  défaite de son propre joueur, mais compte comme victoire adverse (recommandé : le
  héros est sauf, l'ennemi a été battu)** ; (b) statu quo (la fuite remplit
  toujours `defeatHero`) ; (c) la fuite ne compte jamais (il faut tuer le héros
  cible).
- 🗳️ **D-LD1c — Hot-seat** : (a) **la partie continue tant qu'un humain vit
  (recommandé)** ; (b) statu quo B27.
- 🗳️ **D-LD2 — Seuil d'offensive de l'IA** : (a) **1,5 × la défense estimée,
  à toutes les difficultés (recommandé, aligné sur LE1)** ; (b) 2 × (plus prudente) ;
  (c) seuil par cran de difficulté via un champ opaque de siège (nouveau champ
  optionnel de `PlayerSetup`, comme `economyBonus`).
- 🗳️ **D-LD3 — Portée de l'escorte** : (a) **héros neufs de Taverne seulement ; un
  retour de réserve arrive sans troupe (recommandé)** ; (b) escorte aussi au retour
  de réserve ; (c) pas d'escorte, l'IA cesse seulement d'acheter des héros
  inutiles (LD2).
- 🗳️ **D-LD4 — Ampleur de la montée de niveau** : (a) **« une montée + une
  nouvelle » et poids par archétype (recommandé)** ; (b) (a) plus les garanties
  canon III (Sagesse en 6 niveaux, école de magie en 4) ; (c) IA seulement (elle
  choisit mieux, le tirage humain ne change pas).
- 🗳️ **D-LD5 — Périmètre des dilemmes** : (a) **Nécropole, Sylvan et Donjon, les
  trois maisons sans dilemme (recommandé)** ; (b) les six maisons ; (c) pilote
  Nécropole T1 seul.
- 🗳️ **D-LD6 — Mobilité de fin de partie** : (a) **Porte dimensionnelle + IA
  Ville-portail (recommandé)** ; (b) IA Ville-portail seule (sans nouvel effet) ;
  (c) (a) plus Vol et Marche sur l'eau (second point d'extension).

### Décisions prises (utilisateur, 2026-10-28)

- **D-LD1a → (a)** élimination HoMM seule (+ compte à rebours « N jours pour
  prendre une ville » et avis d'élimination, amendements de l'expert).
- **D-LD1b → (a)**, **D-LD1c → (a)** (portés par le choix « Élimination HoMM »).
- **D-LD2 → (a)** 1,5× à toutes les difficultés.
- **D-LD4 → (b)** montée + nouvelle, poids d'archétype **et** garanties
  Sagesse (6 niveaux) / école (4 niveaux).
- **D-LD6 → (b)** IA Ville-portail seule, intégrée à LD2 ; Porte dimensionnelle
  différée.
- **D-LD3** et **D-LD5** non soumis : recommandation de l'expert appliquée —
  escorte des héros neufs en budget d'or par emplacement + 1 pile T1 minimale au
  retour de réserve ; dilemmes Nécropole/Sylvan/Donjon en 3 PR, capacités de la
  base gardées.

Ordre de livraison : LD3 → LD1+LD2 → LD4 → LD5 (×3). LD6b différé.

## 5. Verdict de l'expert

> Relecture `tactical-rpg-expert` du 2026-10-28, faite sur `main` en lisant le
> code (`scenario/outcome.ts`, `combat/leave.ts`, `hero/level-up.ts`,
> `hero/recruit.ts`, `adventure/experience.ts`, `client/src/app/game.ts:874/1250`,
> données d'unités et de bâtiments). Les constats du §1 sont **confirmés dans le
> code**. Les chiffres canon non garantis sont marqués *(non certifié)*.

| Lot | Filiation | Verdict | Amendement |
|---|---|---|---|
| LD1 | Canon III (élimination, 7 jours sans ville) | **Amender** (léger) | Compte à rebours « N jours pour prendre une ville » affiché ; avis « siège X éliminé » en hot-seat ; la fuite ne fait perdre que pour un objectif explicite |
| LD2 | Adaptation (IA de III) | **Amender** | Le relais laisse ≥ 1 créature ; hystérésis de cible (garde ≥ 1,2×) ; chemin en cache ; IA Ville-portail en priorité 0 (LD6a) ; bench : 1ᵉʳ combat joueur-joueur ≤ J35 |
| LD3 | Adaptation du canon III | **Amender** | Escorte en **budget d'or par emplacement** (T1 300–500, T2 200–350, T3 150–250) ; retour de réserve avec 1 pile T1 minimale (100–150 or) ; ne prélève pas le stock de la ville |
| LD4 | Canon III | **Retenir avec D-LD4 (b)** | Garanties génériques en config (`hero.skillGuarantees?` : Sagesse /6 niveaux, écoles /4), compteur `HeroState.skillOfferCounters?` optionnel ; score IA = poids d'archétype × (1 + bonus montée) ; UI « Montée (rang N) » / « Nouvelle » ; plafond 6 compétences gardé |
| LD5 | Adaptation de V (*Tribes of the East*) | **Amender + découper** | Chaque alternative garde les capacités de sa base (convention Vindicateur) et en ajoute une ; prix au facteur d'égalité ; 3 PR (Nécropole T1 pilote, Sylvan T5, Donjon T3) ; écart *Grand bouclier* de V documenté doc 04 |
| LD6 | Canon III | **Découper** | LD6a (IA Ville-portail) intégré à LD2 ; LD6b (Porte dimensionnelle) **différé** : contourne les goulots de LE3, à rouvrir après mesure de LD1/LD2 |

### Points saillants

- **LD1** — `game.ts:874/1250` diverge du canon et de doc 02 §6 (« perdre le
  héros X » n'existe qu'en condition de scénario). La règle actuelle punit la
  fuite livrée en LE6. Sans affichage de `townlessDays` (absent du client), la
  seule défaite restante serait invisible. Test à figer : héros seulement en
  réserve + aucune ville ⇒ éliminé à J+8.
- **D-LD1b** — dans III, la retraite déclenche probablement « perdre le héros
  X » *(non certifié)* ; adaptation assumée : LE6 a fait de la fuite un outil
  central, la punir pousse à sacrifier le protagoniste.
- **LD2** — un héros vidé par un relais perd à l'ouverture du combat (kill
  gratuit, snowball) ; `townDefenseStrength` lit la garnison réelle d'une ville
  explorée (légère triche, acceptable, à documenter) ; A\* non borné sur 512² à
  mettre en cache.
- **LD3** — en effectifs fixes (T1 15 / T2 5,5 / T3 2), l'escorte vaut ≈ 1 490
  or Haven, ≈ 2 210 Donjon, ≈ 1 180 Nécropole : inéquitable. Le budget d'or
  donne ≈ 875 or en moyenne (35 % du prix), max ≈ 1 100 (44 %), sans cas
  particulier. Fourchettes canon III T1 10–20 / T2 4–7 / T3 2–3 *(non certifié)*.
- **LD4** — garanties SoD : Sagesse au moins tous les 6 niveaux, école de magie
  tous les 4 ; compteur remis à zéro quand la compétence est *proposée*, actif
  seulement si la classe peut l'apprendre (confiant, détails non certifiés).
  Sans garantie, un héros de magie peut rester bloqué hors des cercles 3+.
  Séquence RNG changée ⇒ golden à vérifier.
- **LD5** — Squelette guerrier = `undead` + `shieldWall` ; Licorne de guerre =
  `magicResistance` + `curseOnHit` ; Minotaure gardien = `moraleImmune` +
  `doubleAttack` + `taunt` (très fort : prix mesuré, pas supposé). Après chaque
  PR : duel de base à 0 béance.
- **LD6b** (si rouvert) — 1 lancer/jour au départ ; destination explorée, libre,
  sans objet ni héros, hors zone de contrôle ; lancement interdit depuis une zone
  de contrôle ; critère : aucun goulot de LE3 contourné avant J28 sur 30 graines.

### Décisions recommandées par l'expert

- **D-LD1a → (a)** élimination seule (canon III, doc 02 §6).
- **D-LD1b → (a)** la fuite ne fait pas perdre son joueur, compte comme victoire
  adverse (scénarios/campagnes seulement).
- **D-LD1c → (a)** la partie continue tant qu'un humain vit, avec avis
  d'élimination (clôt B27).
- **D-LD2 → (a)** 1,5× partout (aligné sur les marges IA existantes) ; (c)
  seulement si le bench en facile montre une défaite avant J28 dans > ⅓ des
  parties.
- **D-LD3 → (a) amendé** : héros neufs avec escorte en budget d'or ; retour de
  réserve avec 1 pile T1 minimale.
- **D-LD4 → (b)** montée + nouvelle, poids d'archétype et garanties
  Sagesse/école.
- **D-LD5 → (a)** les trois maisons, en 3 PR, capacités de la base gardées.
- **D-LD6 → (b)** IA Ville-portail seule maintenant (dans LD2) ; Porte
  dimensionnelle différée.

### Ordre de livraison conseillé

1. **LD3** — escorte de Taverne (S, indépendant, meilleure base de mesure).
2. **LD1 + LD2** en paire, fusionnés rapprochés (déploiement continu : LD1 seul
   en production = parties sans fin) ; LD2 inclut LD6a.
3. **LD4** — montée de niveau III avec garanties.
4. **LD5** — trois PR, `faction:sim` après chacune.
5. **LD6b** — différé, à rouvrir quand LD2 tient ≥ 15/30 parties conclues et un
   1ᵉʳ combat joueur-joueur ≤ J35.

## 6. Journal

- **2026-10-28** — Tour n° 3 rendu par `game-designer` (lecture du code à `4ef2732`,
  `faction:sim`, bench IA jetable sur 30 graines non commité). 6 lots LD1→LD6,
  8 décisions 🗳️. Constat principal : la partie ne sait pas finir (défaite au
  héros de départ, IA qui ne conclut pas). **Aucun code.** Verdict de l'expert en
  attente.
- **2026-10-28** — Verdict `tactical-rpg-expert` reporté au §5 : LD1/LD2/LD3/LD5 amendés, LD4 retenu (b), LD6 découpé (LD6a dans LD2, LD6b différé).
- **2026-10-28/29** — Livrés : LD3 (#570), LD1+LD2 (#571), LD4 (PR suivante). Reste : LD5 (3 PR), LD6b différé.
