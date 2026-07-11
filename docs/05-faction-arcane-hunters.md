# 05 — Nouvelle Maison : Arcane Hunters (Les Chasseurs Arcanes)

Faction inédite, produite en **Alpha** — elle sert de validation grandeur nature du système de modularité (doc 06). Inspirations assumées : **académie de magie à l'anglaise** (maisons, tours, bibliothèques vivantes, familiers) × **Demon Hunter** (traque, marques, sacrifice, arsenal anti-démon).

> 🚧 **État 4.1 (cadrage Alpha)** : démarrage de la production. Le paquet
> `data/factions/arcane-hunters/` existe en **stub** (1 unité T1, se charge et
> passe `content:check`). Le plan de décomposition vit dans
> `.claude/plans/phase-4.1-arcane-hunters-cadrage.md` : la faction requiert
> **6 nouveaux points d'extension moteur génériques** (Marque déclarative,
> consommation de charges, ressource de faction branchée au gameplay, choix de
> bâtiment exclusif, hook d'aventure hebdomadaire, module de capacité stateful
> `demonform`), livrés en sous-lots 4.2→4.7. Chacun reste **générique** (zéro
> nom de faction dans le moteur, garde-fou CI) — c'est l'objet du test de
> modularité #3. Périmètre Alpha-MVP : **jouabilité de la signature (Marque +
> lineup) d'abord** (4.2), mécaniques lourdes ensuite ; comportement dégradé
> documenté tant qu'un effet n'est pas livré (jamais de crash). Assets peints =
> Beta.
>
> 🚧 **État 4.2 (Marque + lineup, data-only)** : la **signature Marque n'a
> demandé AUCUN diff moteur** — la capacité générique `mark` et le bonus
> `markBonusPerStack` existent au moteur depuis le lot combat 2.4 (cf.
> `combat-damage.test.ts`). La faction est donc du **pur contenu**, comme la
> première faction data-only : lineup **T1–T7** livré (`units/`, `buildings.json`
> dwellings T1–T7, manifeste, locales fr/en), toutes porteuses de `mark` ;
> recrutement complet prouvé par un test faction-agnostique. **T8 Pénitent**
> (coût en Essence, `demonform`, croissance partagée `apex`) reporté en **4.6** ;
> capacité exotique `spellcaster` différée ; **`poisonSting` livrée (A2f)**
> (Manticore de Dressage : dard de mêlée appliquant un poison de 6 PV/round
> sur 3 rounds, tick au début de round) ;
> expose/executioner/pinningShot livrées (`consumeMarks`),
> **`magicResistance` autonome livrée (A2a)** (Bibliothécaire, réduit les dégâts
> de sort hors `demonform`), **`strikeAndReturn` livrée (A2b)** (Lame du
> Serment : frappe puis retour à l'origine, sans riposte), **`swarm` livrée
> (A3b)** (Élève : +1 dégât/créature si ≥ 2 alliés cernent la cible) et
> **`devourMarks` livrée (A2d)** (Pénitent : dévore toutes les Marques du champ,
> +2 %/charge de dégâts, se soigne)
> (les unités combattent sans en attendant, jamais de crash). Écart assumé vs
> §3.1 : le bonus de Marque est **universel** (tout attaquant vs cible marquée),
> pas réservé aux Hunters/sorts de Traque — simplification générique déjà en
> place au moteur.
>
> 🚧 **État 4.3 (consumeMarks générique)** : ouverture du **1ᵉʳ nouveau point
> d'extension moteur** de la faction — la capacité générique **`consumeMarks`**
> (`{ cost, damageBonus }`, au catalogue `abilities.json`) : à l'attaque, si la
> cible porte ≥ `cost` charges de Marque, l'attaquant les **consomme** et la
> frappe gagne `×(1+damageBonus)` (threadé dans la formule unique
> `computeMultiplier` ⇒ la prévisualisation de dégâts le reflète ; seule la
> frappe réelle consomme, event `MarksConsumed`). C'est l'`executioner` de la
> **Lame du Serment** (T5, `consumeMarks(3, +40 %)`) exprimé **génériquement**
> (zéro nom de faction — garde-fou vert ; golden inchangé, la formule reste
> numériquement identique à `markConsumeBonus=0`). Effets de consommation
> non-dégâts (`expose`=riposte, `pinningShot`=immobilisation, `devourMarks`) :
> micro-lots ultérieurs (params additionnels de la même capacité).
>
> 🚧 **État 4.4 (Essence : ressource de faction gagnée)** : 2ᵉ point d'extension
> — **brancher une ressource de faction au gameplay**. `PlayerState.
> factionResources` (carte générique id→montant, le moteur n'en connaît aucun
> nom ; `saveVersion` 2→3, golden re-fixé). Nouvel effet **déclaratif**
> `gainFactionResourceOnVictory { resource, amount }` (variante de `factionBonus`,
> comme la Nécromancie) : chaque combat gagné crédite le joueur (event
> `FactionResourceGained`, toast i18n, affichage barre de ressources). Données :
> le manifeste AH gagne +10 Essence/victoire **en tant qu'attaquant** (remédiation
> D2 : les effets de faction post-victoire sont crédités au héros attaquant
> vainqueur ; l'extension au défenseur vainqueur suivra la boucle « héros en
> défense », inexistante aujourd'hui). Le
> loader vérifie que la ressource est déclarée dans `factionResources`. Zéro nom
> de faction dans le moteur (garde-fou vert). **Dépense** d'Essence (T8/upgrades)
> = 4.6 ; **Contrats de chasse** (hook d'aventure hebdomadaire, autre point) =
> 4.5 ; cap de ressource non imposé au gain pour l'instant.
>
> 🚧 **État 4.5 (consumeMarks → expose)** : extension de la capacité générique
> `consumeMarks` (4.3) avec un 2ᵉ effet déclaratif `suppressRetaliation` —
> `expose` du **Familier lié** (T2, `consumeMarks(1, suppressRetaliation)`) :
> consommer 1 charge de Marque prive la cible de sa **riposte** cette attaque
> (`victim.retaliationsLeft = 0` ; la prévisualisation de dégâts masque la
> riposte). Aucun nouveau système — un param de plus sur une capacité existante
> (garde-fou vert, golden inchangé). `pinningShot` (immobilisation, T6) et
> `devourMarks` (T8) restent différés (statut « ne peut pas agir » / T8 4.6).
>
> 🚧 **État 4.6 (dépense d'Essence + T8 Pénitent)** : ferme la boucle
> économique (gain 4.4 → dépense). Le paiement de recrutement est **faction-aware**
> (`canAffordCost`/`spendCost`, `town/resources.ts`) : un coût d'unité peut mêler
> ressources communes et de faction, chaque clé routée vers le bon stock
> (`player.resources` / `player.factionResources`). Le **contenu** l'autorisait
> déjà (`unit.cost` string-keyed, loader validant les clés) — seul le moteur
> l'ignorait. Le **T8 Pénitent Démonique** (stats doc 05, coût 3800 or + 3
> gemmes + **40 Essence**) est recrutable (dwelling T8), lineup 8 tiers complet.
> `CostList` (client) affiche les coûts de faction. Zéro nom de faction moteur
> (garde-fou vert), golden inchangé (aucune unité du golden n'a de coût de
> faction). **Croissance partagée `apex`** (T7/T8) et **`demonform`** différés
> (T8 : croissance 1/sem indépendante, combat en unité forte à `mark`) ; coûts de
> **bâtiment** en Essence différés (schéma core-only).
>
> 🚧 **État 4.7 (Cercles : choix de bâtiment exclusif)** : point d'extension
> **générique** `exclusiveGroup` sur `BuildingDef` — au plus un bâtiment par
> groupe et par ville (irréversible ; garde `exclusiveChoiceLocked` dans
> `validateBuildStructure`). Utile à toute faction (branches de ville
> alternatives), le moteur ne connaît que l'égalité de chaîne du groupe.
> Données : 4 **Cercles** AH (`arcane-hunters-circle-{vigile,traque,sceau,
> abime}`, groupe `arcane-circle`, prérequis Guilde des mages) à effets
> **existants** distincts (revenu/croissance) — choix économique différencié.
> Client : bâtiment de Cercle verrouillé si un frère est bâti. Golden inchangé
> (aucun bâtiment du golden n'a d'`exclusiveGroup`), garde-fou vert. Les
> **passifs fidèles** des Cercles (vision/vitesse/coût mana/dégâts T7-T8) et le
> **Grand Amphithéâtre** dédié + bâtiments débloqués par Cercle : lots ultérieurs
> (nouveaux effets de bâtiment).
>
> 🚧 **État 4.8 (consumeMarks → pinningShot)** : 3ᵉ effet de la capacité
> générique `consumeMarks` — `immobilizeRounds`. La **Chasseresse de l'Abîme**
> (T6, `consumeMarks(2, immobilizeRounds:1)`) consomme 2 charges de Marque pour
> **immobiliser** la cible (elle saute son prochain tour). Nouveau champ
> `CombatStack.immobilizedRounds` + saut de tour dans `advanceTurn` (même patron
> que le malus de moral, event `StackImmobilized`). Golden inchangé (combat null
> en fin de golden), garde-fou vert. La famille consumeMarks est complète
> (executioner/expose/pinningShot) ; `devourMarks` (T8) suivra avec le
> `demonform`. Grounding explicite des volants simplifié (l'immobilisation
> couvre).
>
> 🚧 **État 4.9 (école de la Traque — amorce)** : ouverture de l'école de sorts
> propre (doc 05 §6) — `SpellSchool` gagne `traque` et un **nouvel effet de sort
> générique** `applyMarks` (pose des charges de Marque, plafonné `marksMax`,
> event `MarkApplied` — réutilise le système de Marque). Threadé dans
> `handleCastSpell` + `estimateSpell`. Deux sorts au catalogue : **Marque du
> Guetteur** (`applyMarks`, 2 charges, cercle 1) et **Entraves Runiques**
> (debuff `speedMod -3`, cercle 2, **data-only**). Manifeste AH `spellSchool:
> traque`. Golden inchangé (les sorts du golden ne changent pas), garde-fou vert.
> Sorts Traque complexes (Bannissement, Silence, Volée de Dagues, Heure de la
> Curée) et **accès des héros AH** aux sorts Traque (avec les héros nommés,
> doc 05 §7) : différés — les sorts vivent au catalogue, apprenables via guilde/
> `startingSpells`.
>
> 🚧 **État 4.10 (demonform — T8)** : dernière grande capacité de signature —
> `demonform` (doc 05 §4), capacité **stateful** générique (état par pile
> sérialisable `CombatStack.transformed`), inline dans le moteur comme
> `mark`/`consumeMarks`. La pile démarre en **forme humaine**
> (`magicResistance` : dégâts de sort subis réduits) et **bascule en forme
> démon à sa 1ʳᵉ attaque** (event `StackTransformed`, perd la résistance, gagne
> `+damageBonus` — threadé dans `computeMultiplier` et la prévisualisation). Le
> `magicResistance` est câblé dans `handleCastSpell`/`estimateSpell`. Données :
> `t8-penitent` gagne `demonform { damageBonus: 0.5, magicResistance: 0.5 }`.
> Golden inchangé (combat null en fin de golden), garde-fou vert. **Écarts
> assumés** : la bascule est **automatique** (choix de timing actif +
> action/UI/IA différés), l'**`areaAttack(cône)`** et `devourMarks` restent
> différés (attaque multi-cibles = nouvelle surface).

## 1. Lore

L'**Académie de Sombreveille** fut fondée sur les ruines d'un portail démoniaque scellé. Ses élèves n'apprennent pas la magie pour la contempler : chaque diplôme est un permis de chasse. Répartis en **quatre Cercles** (Vigile, Traque, Sceau, Abîme), les Chasseurs Arcanes étudient l'ennemi jusqu'à lui ressembler — les plus grands d'entre eux greffent des reliques démoniaques sur leur propre corps. Leur crédo : *« Connaître, marquer, abattre. »*

L'Académie est officiellement neutre… mais considère toute armée trop puissante comme un « spécimen d'étude ».

## 2. Identité de jeu

| | |
|---|---|
| **Fantasme joueur** | L'école de chasseurs de monstres : marquer une cible et voir toute l'armée fondre dessus ; l'élève discret du T1 devient l'hybride démoniaque du T8 |
| **Style de jeu** | Tempo et assassinat de piles clés (« burst la cible marquée »), armée d'élite peu nombreuse, fragile si le combat s'éternise |
| **Terrain natif** | Lande brumeuse — réalisée par le terrain `swamp` (marais) de la config au niveau des données (remédiation R5 CO3) ; un terrain `moor` dédié (légende de carte + rendu) reste à créer si l'on veut le distinguer du marais Necropolis |
| **Ressources clés** | Mercure + Gemmes |
| **École de magie propre** | **Art de la Traque** (marques, entraves, bannissement, métamorphose) |
| **Couleurs / DA** | Violet nuit, argent, vert-de-gris ; tours d'académie gothiques + trophées de chasse, lanternes spectrales, écharpes de maison |

## 3. Mécaniques uniques de faction

### 3.1 Marque du Chasseur (signature)

- Toute attaque d'une unité Arcane Hunters applique 1 **charge de Marque** à sa cible (max 3, visible sous la pile).
- Chaque charge : la cible subit **+8 % de dégâts** des unités Arcane Hunters et des sorts de Traque.
- Plusieurs capacités **consomment** les charges pour des effets forts (cf. lineup) — décision tactique : entretenir la marque ou l'encaisser.
- Implémentation : capacité générique `mark(target)` + nouveau module de capacité `consumeMarks(effect)` enregistré par le paquet de faction (cf. doc 06 §4).

### 3.2 Les Quatre Cercles (choix de spécialisation de ville)

Au moment de construire le **Grand Amphithéâtre** (bâtiment T3 de l'arbre), le joueur choisit le Cercle de la ville — un mini arbre exclusif (1 seul Cercle par ville, irréversible) :

| Cercle | Bonus passif de la ville | Bâtiment exclusif débloqué |
|--------|--------------------------|----------------------------|
| **Vigile** | +2 portée de vision des héros recrutés ici ; garnison : +10 % déf | Tour de Guet Astrale (révèle 1 zone de carte/semaine) |
| **Traque** | Unités recrutées ici : +1 vitesse | Volière de Familiers (+2 croissance T2) |
| **Sceau** | Sorts de Traque −15 % mana pour héros visiteurs | Scriptorium Scellé (1 parchemin de sort aléatoire/semaine) |
| **Abîme** | T7/T8 : +10 % dégâts | Fosse aux Reliques (+1 croissance T8… et −1 moral en garnison pour les non-Hunters) |

> **État livré (Cercles)** : les 4 bâtiments de Cercle exclusifs existent
> (`arcane-hunters-circle-{vigile,traque,sceau,abime}`, choix `exclusiveGroup`,
> Alpha 4.7). **Vigile** porte désormais son **passif de design** (F-BUILDEFF.4) :
> son aura `heroAura garrisonDefense` accorde **+déf de garnison au siège** (rendu
> par un flat **+3** ≈ un niveau de Fort — équivalent exprimable du « +10 % déf »
> du doc, la défense de garnison étant plate dans le moteur, comme le Fort et la
> Maison Blaireau). Le volet **« +2 vision des héros recrutés ici »** reste
> **différé** (recrutement de héros = M-TAVERN). Les Cercles **Sceau/Traque/Abîme**
> gardent des effets **placeholder** (or/j, croissance) — passifs de design
> (−15 % mana d'école, +1 vitesse des recrues, +10 % dégâts T7/T8) et bâtiments
> exclusifs secondaires (Tour de Guet, Volière, Scriptorium, Fosse aux Reliques)
> **différés** aux sous-lots F-BUILDEFF.x suivants.

### 3.3 Contrat de chasse (économie alternative)

Chaque semaine, le **Tableau des Contrats** (bâtiment) propose 1 cible neutre sur la carte (« Abattez les Griffons du col Nord »). La remplir avant la fin de la semaine rapporte or + **Essence** (monnaie interne de faction servant aux améliorations d'unités et au T8). L'Essence remplace une partie du besoin en ressources rares : la faction est conçue pour **vivre de ses combats**, pas de ses mines.

> ✅ **État (livré)** : le **Tableau des Contrats** (`arcane-hunters-contracts`)
> porte l'effet de bâtiment **générique** `huntContract { gold, resource, amount }`
> (jamais un nom de faction). Au `WeekStarted`, tout propriétaire d'un tel
> bâtiment se voit assigner une cible neutre (un gardien de la carte, tirée au
> **RNG seedé**) ; la vaincre crédite or + Essence puis libère le contrat
> (`PlayerState.huntContract`, `HuntContractAssigned`/`HuntContractCompleted`).
> Valeurs livrées : **300 or + 15 Essence** par contrat (`huntContract`,
> data-driven — placeholder d'équilibrage).

## 4. Lineup d'unités (8 tiers)

Particularité : la faction a **8 tiers**, mais le T8 partage sa croissance avec le T7 (structure « double sommet » : on choisit chaque semaine lequel des deux recruter — le schéma de données le supporte via `sharedGrowthGroup`).

| Tier | Unité | PV | Att | Déf | Dégâts | Vit. | Croiss./sem | Coût | Capacités |
|------|-------|----|-----|-----|--------|------|-------------|------|-----------|
| 1 | **Élève de Sombreveille** | 5 | 3 | 2 | 1–3 | 5 | 12 | 35 or | `mark` ; `swarm` (+1 dégât si ≥ 2 piles alliées adjacentes de la cible) |
| 2 | **Familier lié** (chouette spectrale) | 9 | 4 | 3 | 2–3 | 8 | 9 | 90 or | `flying`, `mark`, `expose` (consomme 1 Marque : la cible perd sa riposte ce round) |
| 3 | **Préfet de Cercle** | 17 | 6 | 6 | 3–6 | 5 | 7 | 170 or + 1 mercure | `shooter(10)` (baguette-arbalète), `mark` |
| 4 | **Bibliothécaire Errant** (golem de grimoires) | 34 | 7 | 10 | 5–8 | 4 | 5 | 340 or | `spellcaster(Entrave/Silence, ×2)`, `magicResistance(30 %)`, `mark` |
| 5 | **Lame du Serment** (duelliste diplômé) | 40 | 12 | 8 | 8–12 | 8 | 3 | 620 or + 1 mercure | `strikeAndReturn`, `mark`, `executioner` (consomme 3 Marques : +40 % dégâts sur cette attaque) |
| 6 | **Chasseresse de l'Abîme** | 62 | 15 | 11 | 11–17 | 9 | 2 | 1200 or + 2 mercure | `shooter(8, noMeleePenalty)`, `mark`, `pinningShot` (consomme 2 Marques : cible immobilisée 1 round, les volants tombent) |
| 7 | **Manticore de Dressage** | 155 | 18 | 18 | 24–36 | 11 | 1* | 2600 or + 2 mercure + 1 gemme | `flying`, `noRetaliation`, `mark`, `poisonSting` |
| 8 | **Pénitent Démonique** (chasseur hybride) | 210 | 24 | 18 | 40–60 | 7 | 1* | 3800 or + 3 gemmes + 40 Essence | `demonform` : commence en forme humaine (`magicResistance(50 %)`), bascule 1×/combat en forme démon (+50 % dégâts, `areaAttack(cône)`, mais perd la résistance) ; `devourMarks` (consomme toutes les Marques du champ de bataille : +2 % dégâts chacune, se soigne d'autant) |

> ⚖️ **Équilibrage (Alpha 4.17)** : la Manticore (T7) était un canon de verre puni
> par les dégâts de Havre (Arcane Hunters perdait ~94 % vs Havre) : PV 130→155,
> Déf 16→18 pour renforcer la survie haut de gamme. Le duel Arcane vs Necropolis
> (≈ 53 %) reste inchangé. Mesuré via `faction:sim`.

\* T7 et T8 partagent 1 croissance/semaine (`sharedGrowthGroup: "apex"`), le joueur choisit.

**Faiblesses assumées** (pour l'équilibre) : croissance totale la plus faible du jeu, T1–T2 très fragiles, aucune capacité de soin/résurrection de masse — si la cible marquée ne meurt pas, la faction perd l'échange.

### 4bis. Unités élites (habitation niveau 2)

Chaque habitation se **gradue au niveau 2** (Alpha 4.11) : le dwelling amélioré débloque la variante élite (**dwelling niveau 2**, pas un champ `upgradeOf`). La base **et** l'élite restent recrutables (façon HoMM, cf. D3). Les élites AH **conservent** `mark` (et enrichissent souvent la panoplie `consumeMarks`), fidèles à la signature de faction.

| Tier | Élite | PV | Att | Déf | Dégâts | Vit. | Cr./sem | Coût | Capacités |
|------|-------|----|-----|-----|--------|------|---------|------|-----------|
| 1 | **Diplômé de Sombreveille** | 6 | 4 | 3 | 2–4 | 6 | 12 | 63 or | `mark` |
| 2 | **Familier Aîné** | 12 | 5 | 4 | 3–4 | 9 | 9 | 162 or | `flying`, `mark`, `consumeMarks` |
| 3 | **Grand Préfet** | 22 | 8 | 8 | 4–8 | 6 | 7 | 306 or, 2 mercure | `shooter`, `mark` |
| 4 | **Archiviste Vivant** | 44 | 9 | 13 | 6–10 | 5 | 5 | 612 or | `mark` |
| 5 | **Lame Consacrée** | 52 | 16 | 10 | 10–16 | 9 | 3 | 1116 or, 2 mercure | `mark`, `consumeMarks` |
| 6 | **Traqueuse de l'Abîme** | 81 | 20 | 14 | 14–22 | 10 | 2 | 2160 or, 4 mercure | `shooter`, `mark`, `consumeMarks` |
| 7 | **Manticore Royale** | 169 | 23 | 21 | 31–47 | 12 | 1 | 4680 or, 4 mercure, 2 gemmes | `flying`, `noRetaliation`, `mark` |
| 8 | **Pénitent Damné** | 273 | 31 | 23 | 52–78 | 8 | 1 | 6840 or, 5 gemmes, 72 Essence | `mark`, `demonform` |

> ⚖️ **Coûts élites (D12, à arbitrer)** : premium en or élite/base = **1,80× uniforme** sur les 8 tiers — nettement au-dessus de Haven (~1,44× moyen) et Necropolis (~1,65×). Asymétrie relevée par l'audit factions : l'élite AH est proportionnellement la plus chère du jeu. Contrairement aux deux autres maisons, les élites AH **ne perdent pas** leur capacité de base. Arbitrage des coûts **renvoyé à une passe `faction:sim`** (non tranché ici).

## 5. Arbre de bâtiments

Bâtiments communs : cf. doc 02 §4.1 (skins « académie »). Spécifiques :

| Bâtiment | Coût | Prérequis | Effet |
|----------|------|-----------|-------|
| **Tableau des Contrats** | 800 or, 5 bois | Taverne | Contrats de chasse hebdomadaires (or + Essence) |
| **Grand Amphithéâtre** | 2000 or, 10 minerai | Guilde des mages 1 | Choix du **Cercle** de la ville (cf. §3.2) |
| **Salle des Reliques** \* | 1600 or, 3 mercure | Grand Amphithéâtre | Héros visiteurs : sorts de Traque +1 cercle d'accès ; +1 slot d'artefact « trophée » |
| **Bâtiment de Cercle** | variable | Grand Amphithéâtre | 1 des 4 exclusifs selon le Cercle choisi |
| **Portail de l'Abîme Scellé** | 4000 or, 3 gemmes, 3 mercure (†) | Habitation T7 + Château | Habitation T8 (Pénitent Démonique) |

> \* **Salle des Reliques** : jamais livrée (absente des reports) — **différée**.
> † Le coût **en Essence** du Portail (60) est **différé** : le bâtiment livré
> ne coûte pas d'Essence (`4000 or + 3 gemmes + 3 mercure`). L'Essence est en
> revanche bien dépensée au **recrutement** du T8 Pénitent (40 Essence, base).

Chaîne d'habitations :

```
Fort ──► T1 Dortoirs ──► T2 Volière ──► T3 Salle des Préfets ──► T4 Grande Bibliothèque
                                │
                    Guilde des mages 1 ──► T5 Salle d'Armes ──► T6 Pavillon de Chasse
                                                                       │
                                                          T7 Fauconnerie Royale
                                                                       │  (+ Château)
                                                          T8 Portail de l'Abîme Scellé
```

> **État livré** : le T8 **requiert le T7** (`arcane-hunters-dwelling-t8` →
> `dwelling-t7` + `fort@3`, D8) — la construction est une **chaîne**. La
> **croissance partagée « apex »** (`sharedGrowthGroups: { apex: [t7, t8] }`) est
> désormais **déclarée ET câblée** (lot 4.20) : quand les deux habitations sont
> bâties, T7 et T8 **partagent une seule croissance hebdomadaire** ; le joueur
> choisit le destinataire (`ChooseSharedGrowth`, préférence permanente ; défaut =
> T7). Point d'extension moteur **générique** (`GameState.growthGroups` +
> `TownState.sharedGrowthChoice`) — aucun nom de faction dans le moteur.

## 6. École de magie : Art de la Traque (extraits)

| Cercle | Sort | Effet |
|--------|------|-------|
| 1 | **Marque du Guetteur** | Applique 2 charges de Marque à une pile |
| 1 | **Pas de Brume** | Téléporte une pile alliée de 3 hexes |
| 2 | **Entraves Runiques** | Cible : −3 vitesse, les volants ne volent plus (Pouvoir rounds) |
| 2 | **Silence Scellé** | Cible `spellcaster` : capacités magiques désactivées |
| 3 | **Volée de Dagues Spectrales** | Dégâts à la cible +50 % par charge de Marque consommée |
| 3 | **Mue Éphémère** | Une pile alliée gagne `stealth` jusqu'à sa prochaine action |
| 4 | **Bannissement** | Retire du combat une pile invoquée/démoniaque (PV ≤ seuil Pouvoir) |
| 5 | **Heure de la Curée** | 1 round : toutes les unités alliées gagnent `noRetaliation` contre les cibles marquées |

## 7. Héros types

| Classe | Orientation | Attributs (A/D/P/S) | Compétences de départ | Spécialité type |
|--------|-------------|----------------------|------------------------|------------------|
| **Maître de Chasse** | Might | 35/20/20/25 | Chasse rituelle N, Tir N | Les Marques donnent +10 % dégâts au lieu de +8 % |
| **Doyen des Sceaux** | Magic | 10/20/35/35 | Art de la Traque N, Sagesse N | Sorts de Traque +1 charge de Marque |

**Compétence de faction — Chasse rituelle** (N/E/M) : les combats contre des neutres rapportent +10/20/30 % d'Essence ; à Maître, le premier `executioner`/`devourMarks` de chaque combat ne consomme pas les Marques.

Héros nommés : *Evadne Corvel* (Maître de Chasse, ex-Cercle de l'Abîme, moitié de visage runique), *Professeur Alwin Marchmont* (Doyen, sa chouette est un familier de combat T2 gratuit au jour 1).

## 8. Résumé des points d'extension utilisés (test de modularité)

| Besoin | Mécanisme du framework (doc 06) |
|--------|--------------------------------|
| 8ᵉ tier à croissance partagée | donnée `sharedGrowthGroups` + point d'extension moteur **générique** `GameState.growthGroups` / `TownState.sharedGrowthChoice` / commande `ChooseSharedGrowth` — **livré** (4.20) : T7/T8 partagent 1 croissance/semaine, destinataire au choix du joueur |
| Marques | capacité générique `mark` + module `consumeMarks` (registre de capacités) — livré (4.2/4.3/4.5/4.8) |
| Essence | ressource **de faction** déclarée dans le manifeste (`factionResources`) — livré (4.4/4.6) |
| Choix de Cercle | mécanisme générique `exclusiveBuildingChoice` — livré (4.7) |
| Contrats de chasse | **effet de bâtiment générique `huntContract`** (assignation au `WeekStarted` + récompense à la victoire) — **livré** (déclaratif, pas un hook impératif) |
| Forme démon du T8 | module de capacité `demonform` (transformation stateful) — livré (4.10) |
