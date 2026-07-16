# 14 — Nouvelle Maison : Sylvan Court (La Cour Sylvestre)

> **Cadrage de la 4ᵉ faction (Phase 3 Beta, lot 5.1)** — proposée pour le
> **créneau « vote de la communauté »** (doc 09, doc 06 §6). Sylvan Court est
> retenue comme **défaut** car sa mécanique signature (`symbiosis`) ne coûte
> **qu'un seul module de combat générique**, sans nouveau point d'extension de
> framework : c'est le **4ᵉ test de modularité** au moindre risque moteur. Ce
> document est la **source de vérité** (doc = vérité, guideline §8.6) ; les lots
> data suivants (5.2 lineup, 5.3 `symbiosis`, 5.4 finitions) l'implémentent en
> **données pures + un point d'extension**, zéro modification des 3 autres maisons.

## 1. Identité

| | |
|---|---|
| **Thème** | Nature primordiale, elfes sylvains, forêt-monde ancienne |
| **Fantasme joueur** | *« Je ne me presse pas : plus je tiens le terrain, plus mes rangs deviennent inarrêtables. »* |
| **Style de jeu** | Attrition / tempo lent — punit l'adversaire qui n'ouvre pas ; s'effondre si on la force à courir |
| **Faiblesse assumée** | **Agression / tempo** : ses piles-clés sont fragiles au départ et doivent *rester* pour monter en puissance ; un rush qui l'oblige à bouger (ou la tue vite) annule la Symbiose |
| **Terrain natif** | `water` — la Forêt-Monde s'abreuve au **fleuve primordial** ; dryades, naïades et licornes sont liées aux **sources sacrées**. (Choix aussi *structurel* : `grass` est déjà la signature de Haven pour l'identification par propriété des tests ; `water` garde chaque maison distinguable sans nom en dur.) |
| **Ressources clés** | **Cristal + Mercure** (rares partagées — aucune ressource de faction propre, contrairement à Arcane Hunters/Necropolis : Sylvan reste économiquement « classique ») |
| **École de magie** | **existante** (`earth` / `water`) — pas d'école propre au 1ᵉʳ lot (minimise les points d'extension) |
| **Couleurs / DA** | Verts profonds & ambre, écorce et lucioles ; bannières à motif de fronde/feuille |

**Lore (5–10 lignes)** : Avant les royaumes des hommes, la Cour Sylvestre veillait
sur la Forêt-Monde, un unique organisme dont chaque arbre est une pensée. Les
elfes sylvains n'y règnent pas : ils *écoutent*. Quand la Première Éclipse a
fissuré le ciel, la Forêt a refermé ses frontières et laissé les jeunes maisons
se déchirer. Aujourd'hui, un fléau ranime les morts (Necropolis) et des chasseurs
traquent l'arcane jusque sous ses racines : la Cour se réveille, lente et
implacable, car la forêt ne charge pas — elle *encercle*.

## 2. Mécanique signature (UNE seule) — **Symbiose**

- **Description** : certaines unités (Dryade T3, Tréant T6, Aïeul T7) portent la
  capacité `symbiosis`. À chaque **round où la pile n'attaque pas et ne se déplace
  pas** (elle **Défend** ou reste en place), elle **enracine** un lien qui lui
  octroie un bonus **cumulatif** d'Attaque et de Défense (`+attackPerRound`,
  `+defensePerRound`), **plafonné** à `maxStacks` paliers. **Attaquer ou se
  déplacer réinitialise** la Symbiose à zéro.
- **Contre-jeu adverse** : forcer l'engagement (tireurs, volants, sorts) pour que
  la pile doive bouger/riposter ; ou la tuer avant qu'elle n'accumule ; les unités
  rapides (Arcane Hunters, cavalerie Necropolis) dictent le tempo.
- **Plafond anti-snowball** : `maxStacks` (proposé **4** paliers) borne le bonus ;
  la riposte **ne** réinitialise **pas** (sinon la pile serait triviale à annuler),
  mais une attaque *volontaire* le fait — la Cour choisit entre frapper et croître.
- **Point d'extension** : **UN** module de combat générique `symbiosis`
  (params `attackPerRound`, `defensePerRound`, `maxStacks`), interprété par le
  moteur via l'état de pile existant (comme `mark`, `demonform`) — **aucun nom de
  faction dans le moteur**. Réutilise le compteur « la pile a-t-elle agi/bougé ce
  round » déjà présent (`acted`, `defending`, position). Aucun nouveau point
  d'extension de framework (à la différence de *Tide Covenant*, doc 06 §6).

## 3. Lineup (7 tiers)

> Stats **équilibrées** au lot 5.4 via `faction:sim` (doc 09 ligne 48). Profil :
> **maison-escarmouche mobile** — bas de gamme fragile & bon marché, milieu de
> gamme rapide qui frappe, **grands anciens mobiles** (Tréant/Aïeul lestes, pas
> des statues) qui *choisissent* de s'enraciner pour tanker via Symbiose. Ce profil
> agile est ce qui rend la maison viable face aux factions de burst (voir §9,
> État 5.4) : des anciens lents s'effondraient contre le tir/l'exécution adverses.

| Tier | Unité | PV | Att | Déf | Dégâts | Vit. | Croiss./sem | Coût | Capacités |
|------|-------|----|-----|-----|--------|------|-------------|------|-----------|
| 1 | **Lucine** (fée) | 3 | 2 | 1 | 1–2 | 6 | 16 | 28 or | `flying` |
| 2 | **Archer Sylvestre** | 9 | 5 | 3 | 2–4 | 5 | 9 | 76 or | `shooter(12)` |
| 3 | **Dryade** | 13 | 6 | 3 | 3–5 | 6 | 7 | 150 or | `symbiosis(atk +1, déf +1, max 4)` ¹ |
| 4 | **Loup d'Argent** | 28 | 8 | 6 | 5–8 | 8 | 5 | 300 or | `doubleAttack` |
| 5 | **Licorne** | 29 | 11 | 7 | 7–11 | 8 | 4 | 520 or + 1 cristal | *(aucune ; rapide)* |
| 6 | **Tréant** | 59 | 15 | 11 | 12–18 | 6 | 2 | 1150 or + 1 mercure | `symbiosis(atk +2, déf +2, max 4)` ¹ |
| 7 | **Aïeul de la Forêt** | 125 | 22 | 14 | 28–48 | 10 | 1 | 3000 or + 2 cristal + 2 mercure | `symbiosis(atk +2, déf +3, max 4)` ¹ |

> ¹ **Symbiose livrée (5.3)** : le module moteur générique `symbiosis` est ouvert et
> les unités T3/T6/T7 portent la capacité **en données** (paliers Att/Déf ci-dessus,
> plafond 4). Elles étaient livrées au lot **données (5.2)** avec `abilities: []`
> (lineup complet & recrutable) le temps que le point d'extension existe. Chaque tier
> a **7 variantes améliorées** (`-elite`, dwelling niveau 2, Alpha 4.11), stats
> renforcées, mêmes capacités.
>
> Le lineup n'utilise que des **capacités existantes** (`flying`, `shooter`,
> `doubleAttack`) hors Symbiose — la promesse « **1 module moteur total** » (§9)
> est ainsi tenue (pas de `magicResistance`/`taunt`/`unlimitedRetaliation`
> nouveaux, contrairement à une première ébauche).

## 4. Bâtiments spéciaux (2–3) + chaîne d'habitations

- **Chaîne d'habitations** : 7 dwellings (T1→T7), prérequis en escalier
  **identique au patron des 3 maisons** : **T1 requiert le Fort** (`fort@1`),
  **T5 requiert la Guilde des mages** (`mageGuild@1`), les autres tiers
  requièrent le tier précédent (données pures, `buildings.json`).
- **Bâtiment propre livré (5.4)** :
  - **Bosquet du Cœur** (`heart-grove`) — croissance : **+25 % de croissance hebdo**
    (effet de bâtiment **générique** `growthBonus` déjà existant, **aucun code neuf** :
    `applyWeeklyGrowth` somme le `growthBonus` de tous les bâtiments construits).
    Coût 2000 or + 5 cristaux, prérequis Fort niveau 1. Le « Cercle des Anciens »
    de l'ébauche est abandonné (redondant avec la `mageGuild` commune).
  - **Graal** (`sylvan-court-grail`, gaté par le méta-puzzle obélisques →
    fouille) : sentiers de la sylve — `heroAura` mouvement +700 (town-scoped).
    Cf. doc 02 §2.2 (table par-faction).
- **Aucune ressource de faction propre** (choix de cadrage : Sylvan valide que la
  modularité tient *sans* rouvrir le point d'extension « ressource de faction »
  déjà prouvé par Essence — variété de preuve).

## 5. Classes de héros (2) + 2 héros nommés

- **Classes** : **Gardien** (Might — Commandement/Armure) et **Druide** (Magic —
  Sagesse/école earth-water). Dotation par défaut du contenu au 1ᵉʳ lot (comme les
  autres maisons ; héros nommés = chantier narratif doc 13).
- **Héros nommés (état livré, H-COND)** : *Faelar l'Écoutant* (Druide) et *Sylwen
  Gardefronde* (Gardien) sont **jouables** (roster sylvan-court). Le point
  d'extension moteur **générique** `conditional` (spécialité scopée par unité et/ou
  par niveau, interprété en combat par `conditionalUnitBonus` — aucune faction en
  dur, pas de bump save) porte leurs spécialités. **Sylwen** = **+1 vitesse aux
  Archers sylvestres (`t2-archer-sylvestre`)** (fidèle : « +vitesse aux tireurs »).
  **Faelar** portait au lot H-COND une variante **+1 déf aux Tréants par 2 niveaux**.
- **État livré (H-COND-EXACT)** : *Faelar* porte désormais sa signature EXACTE
  (doc §5) — **sa Symbiose démarre à 1 palier** — via un point d'extension moteur
  **générique** dédié : le champ d'effet `startingSymbiosisStacks` initialise, à
  l'ouverture du combat (`openPlacementOrBattle`), les piles du camp du héros
  DOTÉES de la capacité `symbiosis` à `min(valeur, maxStacks)` paliers (au lieu de
  0). Zéro faction en dur (`symbiosis` est un module de capacité), pas de bump
  save, golden inchangé.

## 6. Compétence de faction (si applicable)

Aucune au 1ᵉʳ lot (comme Haven/Necropolis en MVP). La Symbiose porte l'identité ;
une compétence de faction (ex. *Sylve* : +1 palier max de Symbiose) reste un
raffinement data ultérieur, sans diff moteur.

## 7. Matchups attendus (pourquoi viser ~50 %)

- **vs Haven** (attrition/défense) : miroir de tempo lent ; la Symbiose donne
  l'avantage d'attrition **si** Sylvan tient, mais les tireurs Haven (Archer,
  Prêtresse) forcent des ripostes et grignotent les fragiles bas-tiers → ~50 %.
- **vs Necropolis** (masse + Nécromancie) : la masse de squelettes force Sylvan à
  frapper (donc à casser sa Symbiose) ; en échange, les Tréants encaissés
  neutralisent la Nécromancie (peu de vivants tués côté Sylvan si les gros tiennent)
  → ~50 %.
- **vs Arcane Hunters** (tempo/Marque) : **mauvais matchup thématique** de Sylvan
  (l'agression Arcane exploite la faiblesse assumée) — l'équilibrage data devra
  *compenser* par un léger avantage de stats/coût, cible ~48–52 %.

> Ces cibles seront **mesurées et ajustées** avec `faction:sim` au lot data, comme
> la 1ʳᵉ passe d'équilibrage 4.17 (Havre). Objectif : 0 déséquilibre béant d'abord,
> convergence 45–55 % ensuite.

## 8. Lore & storytelling (chantier narratif — doc 13 §8)

- **Identité narrative** : la Cour parle **peu et lentement**, en métaphores
  végétales ; elle croit que toute hâte est une maladie ; elle se cache sa propre
  peur de *bouger* (l'immobilisme comme force **et** comme faille).
- **Lecture de l'arc global** : elle voit dans le fléau mort-vivant une *pourriture*
  à endiguer, et dans les Chasseurs Arcanes des *bûcherons* de l'invisible.
- **Relations** : Haven = « les jeunes chênes bien intentionnés » ; Necropolis =
  « la pourriture qu'on encercle » ; Arcane Hunters = « ceux qui coupent ce qu'ils
  ne comprennent pas ».
- **Arcs des héros nommés** (3 étapes, différés) : Faelar apprend à *agir* sans
  trahir l'écoute ; Sylwen accepte de *défendre la lisière* plutôt que la forêt
  entière.
- **Textes d'ambiance** : engagement à un `loreKey` FR/EN par unité/bâtiment.
- **Campagne** : optionnelle (3 chapitres « La forêt se referme / La lisière brûle
  / L'Aïeul s'éveille ») — hors 1ᵉʳ lot.

## 9. Résumé des points d'extension utilisés (test de modularité)

| Besoin | Résolution | Nouveau point d'extension moteur ? |
|--------|-----------|-------------------------------------|
| Symbiose (signature) | ability générique `symbiosis` (params, état de pile existant) | **1** (générique, sans faction) |
| Croissance ciblée (Bosquet du Cœur) | effet de bâtiment `growthBonus` **existant** | non |
| Guilde thématisée (Cercle des Anciens) | effet `mageGuild` **existant** | non |
| Lineup, dwellings, locales, bonus | **données pures** (manifeste + JSON) | non |

**Coût moteur total : 1 module de combat générique** (`symbiosis`). Objectif du
4ᵉ test de modularité : prouver qu'une maison entière = **données + un** point
d'extension, **zéro** diff sur Haven/Necropolis/Arcane Hunters (garde-fou CI
« zéro faction dans le moteur » maintenu).

## État 5.1

Cadrage livré (ce document).

## État 5.2

**Données de la faction livrées** (`data/factions/sylvan-court/`) : manifeste
(natif `water`, 7 tiers, sans ressource de faction), **14 unités** (7 base + 7
améliorées), **7 dwellings** (`maxLevel:2`, prérequis en escalier), locales FR/EN,
ajout à `data/factions/index.json`, **test de recrutement** (faction identifiée par
propriété : native de l'eau + 7 tiers, aucun nom en dur). `content:check` vert (5
paquets), garde-fou faction vert, **zéro diff moteur**. Symbiose (T3/T6/T7) à
`abilities: []` en attendant le module moteur. Prochains lots : **5.3** point
d'extension `symbiosis` (moteur générique + données qui l'exercent + tests) ;
**5.4** équilibrage `faction:sim` + Bosquet du Cœur + finitions (assets procéduraux
en repli).

## État 5.3

**Signature Symbiose livrée** — point d'extension moteur **générique** `symbiosis`
(à la manière de `mark`/`consumeMarks`/`demonform`, **zéro nom de faction dans
`packages/`**). Une pile portant la capacité accumule un palier à chaque **Défense**
(et tant qu'elle ne bouge ni n'attaque volontairement), chaque palier ajoutant
`attackPerRound`/`defensePerRound` à ses stats effectives de frappe, plafonné à
`maxStacks`. Un **déplacement** ou une **attaque volontaire** remet les paliers à 0
(la frappe consomme le bonus accumulé) ; **la riposte ne réinitialise pas**, si bien
qu'un défenseur enraciné cogne dur en représailles. Implémentation :
`symbiosisStacks` sur `CombatStack` (transitoire, purgé en fin de combat → **golden
inchangé**), incrément dans `applyDefend`, remise à 0 dans `applyMove`/`applyAttack`,
bonus lus dans `damage.ts`. Données : `symbiosis` ajouté à `data/core/abilities.json`
et aux 6 unités Sylvestres T3/T6/T7. **6 tests moteur** (accumulation, plafond,
bonus Att/Déf, remises à 0 déplacement/attaque, préservation en riposte),
`content:check` vert, garde-fou faction vert, smoke desktop+mobile vert. Reste :
**5.4** équilibrage `faction:sim` + Bosquet du Cœur + finitions.

## État 5.4 — Sylvan Court complète (Beta)

**Équilibrage `faction:sim`** — la faction passait de **2 déséquilibres béants** à
**0**. Réglage **100 % données** (stats/coûts d'unités, base + elite cohérents) :

| Matchup (winrate Sylvan) | Avant 5.4 | Après 5.4 |
|--------------------------|-----------|-----------|
| vs Haven                 | 73.8 %    | **44.6 %** |
| vs Arcane Hunters        | 17.9 % ✗  | **44.6 %** |
| vs Necropolis            | 100.0 % ✗ | **57.5 %** |

**Découverte de réglage** : la Symbiose (5.3) ne pèse presque rien dans le sim
(l'IA de combat ne Défend qu'en dernier recours) — l'écart était **structurel**
(stats/coûts). Sylvan écrasait les factions « loyales » (Haven/Necro) mais
s'effondrait contre le **burst** d'Arcane (marks/exécuteur/tir). Un levier de
puissance *uniforme* déplaçait les trois matchups dans le même sens sans résorber
les deux blowouts opposés. La solution qui les corrige **ensemble** : basculer
Sylvan de **tanky-tortue** vers **agile-verre** — moins de PV/Déf, plus de
Vitesse/Att, **y compris sur les grands anciens** (Tréant/Aïeul rendus mobiles).
Vérifié empiriquement : re-ralentir T6/T7 ré-effondrait le matchup Arcane
(≈ 5 %) et rouvrait le blowout Necro (≈ 85 %). D'où le profil « escarmouche
mobile » du §3 et la lecture narrative des anciens *striders*. `faction:sim`
reste un **garde-fou d'alerte** (échec seulement sur blowout), pas un gate CI ;
les 3 matchups Sylvan sont désormais dans la bande 20–80 (deux à ~45 %, un à
57.5 %). Aucune autre faction touchée.

**F-SYMBAI (post-5.4)** : l'IA de combat sait désormais s'enraciner — une pile
`symbiosis` sous son plafond qui n'a rien à frapper Défend quand le combat
vient à elle (au lieu d'avancer et de perdre ses paliers), bornée par le
plafond. Une variante plus agressive (« défendre au lieu de bouger-frapper »)
a été testée en sim et **rejetée** : avec le profil agile-verre ci-dessus,
temporiser donne la première frappe à l'adversaire et effondre Sylvan
(1–10 % de winrate). La Symbiose pèse donc en sim par sa règle minimale ;
son poids principal reste le jeu du joueur (enraciner un Tréant sur un point
de passage), pas l'auto-combat.

**Bosquet du Cœur** (`heart-grove`) livré — bâtiment `growthBonus` +25 %,
effet **générique** existant, **zéro code moteur** (§4).

**Modularité prouvée une 4ᵉ fois** : maison complète (lineup, dwellings, bâtiment
propre, signature `symbiosis`) = **données + 1 point d'extension générique**,
garde-fou « zéro nom de faction dans `packages/` » vert. **Sylvan Court complète.**
Héros nommés / classes / bonus de faction restent différés (points d'extension
ouverts au besoin, cf. §5/§7). Assets : repli procédural (intégration hors lot).
