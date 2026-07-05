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

Chaque classe de héros a des **probabilités de gain** par niveau (data-driven). Ex. Chevalier : 30/30/20/20 ; Nécromancien : 15/15/30/40.

### 1.2 Progression

- **XP** : combats (XP = somme des PV des unités ennemies tuées × coefficient — valeur de départ **1**, dans `data/core/config.json`), coffres, lieux de savoir.
- Courbe : `xp(niveau) = 1000 × niveau^1.9` (héros max niveau 30 au MVP).
- À chaque niveau : +1 attribut primaire (tirage pondéré par classe) + **choix entre 2 propositions de compétence** (nouvelle compétence ou montée d'une existante).

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

> 🚧 **État 3.2** : 10 sorts livrés (`data/core/spells.json`, cercles 1–3) — Feu/Eau/Terre/Air/neutre, types `damage`/`heal`/`buff`/`debuff`. Mana = `Savoir × 10 + artefacts`, remplie à l'ouverture du combat. **1 sort/round** en combat (commande `CastSpell`, prévisualisation obligatoire sans RNG). Dégâts = `round((base + perPower × Pouvoir) × (1 − résistance) × (lucky ? 2 : 1))`. Gating MVP : le héros connaît d'emblée les sorts de **cercle ≤ 3** (Guilde des mages MVP) ; l'apprentissage à la visite de ville, la régénération de mana d'aventure, les cercles 4–5 (Sagesse/Magie) et les sorts d'aventure sont des raffinements 3.3+. L'IA ne lance pas de sort en 3.2.

### 1.5 Mouvement sur carte d'aventure

- Points de mouvement quotidiens : `base 1500 + 50 × vitesse de la créature la plus lente de l'armée` (encourage les armées homogènes), modifiés par Logistique, artefacts, routes (coût tuile ×0,75), terrains (marais ×1,5 ; le terrain « natif » de la faction coûte ×1,0 pour elle).
- Coût d'entrée d'une tuile : **100 points** en terrain de base (herbe), pas en **diagonale ×1,41** (≈ √2), multiplicateurs cumulés puis arrondis à l'entier — ex. route en diagonale : `round(100 × 0,75 × 1,41) = 106`. Valeurs de départ pour l'équilibrage, stockées dans `data/core/config.json`.
- Portée de vision de base du héros : **5 tuiles** (distance de Tchebychev), avant bonus (Recherche +2/4/6).
- Pathfinding A* avec préviualisation du chemin et des jours nécessaires (points verts/jaunes comme HoMM).
- Un joueur possède jusqu'à **8 héros** actifs ; échanges d'armée/artefacts quand deux héros alliés se rencontrent.

---

## 2. Carte d'aventure

### 2.1 Structure

- Grille **carrée** (le hex est réservé au combat — choix Heroes Online) avec déplacement 8 directions, tuiles de 64 px logiques.
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

Chaque faction consomme surtout **une paire de ressources rares** (Haven : cristal+gemmes ; Necropolis : soufre+gemmes ; Arcane Hunters : mercure+gemmes), ce qui crée la compétition territoriale. Marché en ville : troc à taux dégressif selon nombre de marchés possédés.

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
| Taverne | 1 | recrutement de héros, rumeurs, moral +1 en défense |
| Marché | 1 | échange ressources |
| Forge | 1 | machines de guerre (post-MVP) |
| Guilde des mages | 3 (MVP) – 5 | sorts de cercle 1–3 (–5) |
| Habitations T1–T7 | 1 + amélioration | débloque recrutement du tier ; version améliorée débloque l'unité upgradée (post-MVP pour les upgrades) |
| Bâtiments spéciaux ×2–3 | 1 | uniques à la faction (définis dans son manifeste) |

- **Recrutement** : chaque habitation a une croissance hebdo (ex. T1 : 14/sem, T7 : 1/sem) ; le stock s'accumule s'il n'est pas recruté (plafond : 2 semaines). Valeurs de départ (Phase 3.1) : coûts des bâtiments communs dans `data/core/buildings.json` (hôtel de ville gratuit→2500/5000/10000 or ; fort 5000 or + 20 minerai, ×2 par niveau ; guilde des mages 2000 or + 5 bois) ; croissance/coût de recrutement dans les données d'unité ; le stock d'une habitation ne se remplit qu'au **passage de semaine** (état de départ vide).
- **File de garnison** : une ville stocke une armée de défense ; siège si un héros ennemi attaque une ville avec Fort+ (au MVP : combat normal sur décor de ville, sans murs ; murs/catapulte en Alpha).
- **Capture** : ville sans garnison = capture immédiate ; le joueur qui perd sa dernière ville a 7 jours pour en reprendre une, sinon défaite.

### 4.2 Écran de ville

Vue peinte de la ville où les bâtiments construits apparaissent (grande satisfaction visuelle HoMM). Chaque bâtiment est un sprite cliquable ; l'arbre complet est aussi accessible en liste (indispensable mobile), cf. doc 08.

---

## 5. Système de combat

### 5.1 Plateau

- **Grille hexagonale pointy-top de 12 colonnes × 10 rangées** (proche Heroes Online, plus compacte que HoMM III — combats plus courts, meilleur pour mobile).
- Attaquant à gauche, défenseur à droite ; jusqu'à **7 piles** par armée, placement initial automatique + phase de placement tactique si compétence Tactique.
- Placement automatique (valeur de départ, Phase 2) : attaquant colonne 0, défenseur colonne 11 ; pour n piles, rangée du slot i = `floor((i + 0,5) × 10 / n)`.
- Obstacles générés selon le terrain d'aventure (2–5 hexes bloqués, tirés au RNG du combat dans les colonnes 3–8) ; le terrain natif donne +1 vitesse/+1 moral aux unités natives.
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

Le moteur expose un **catalogue de capacités génériques paramétrables** ; les unités les référencent par ID dans leurs données. Extrait :

`flying`, `shooter(ammo, noMeleePenalty?)`, `noRetaliation`, `unlimitedRetaliation`, `strikeAndReturn`, `doubleAttack`, `areaAttack(pattern)`, `breathAttack`, `undead`, `lifeDrain(pct)`, `resurrectOnKill`, `curseOnHit(spell, chance)`, `aura(effect, radius)`, `charge(bonusPerHex)`, `enrage(onAllyDeath)`, `magicResistance(pct)`, `spellcaster(spells, charges)`, `firstStrike`, `taunt`, `stealth(untilFirstAction)`, `mark(target)` …

Une faction qui a besoin d'une capacité **réellement nouvelle** l'ajoute comme module JS enregistré dans le registre de capacités (cf. doc 06 §4) — c'est le seul point d'extension en code autorisé.

Sémantique des 6 capacités de la Phase 2.4 (valeurs de départ) :

| Capacité | Effet implémenté |
|---|---|
| `flying` | le déplacement ignore obstacles et unités (survol), portée = vitesse, atterrissage sur hex libre |
| `shooter(ammo, noMeleePenalty?)` | tir sans riposte, portée illimitée, 1 munition/tir ; à 0 munition ou ennemi adjacent : mêlée à ½ dégâts sauf `noMeleePenalty` |
| `noRetaliation` | la cible ne riposte jamais aux attaques de cette unité |
| `doubleAttack` | deux frappes ; la riposte éventuelle s'intercale après la 1ʳᵉ |
| `undead` | moral figé à 0 (ne subit ni ne donne), ne compte pas dans le malus multi-factions |
| `mark` | chaque frappe applique 1 charge à la cible (max 3, persistantes) ; +8 %/charge de dégâts subis |

### 5.5 Fin de combat & auto-résolution

- Victoire = plus aucune pile adverse. Fuite (perd l'armée, garde héros+artefacts, re-recrutable en taverne) et reddition (idem + coût en or, garde l'armée restante — post-MVP).
- **Combat auto** : la même IA de combat joue les deux camps en accéléré ; résultat déterministe re-simulable (même seed) — indispensable pour le PvP asynchrone futur.

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
> joueur sans ville ni héros est **éliminé** (grâce des 7 jours différée →
> immédiate au MVP) ; hors scénario (partie libre) = **aucune** évaluation.
> **IA d'aventure** déterministe (`engine/ai`, commande `AiTurn`) : chaque
> joueur `controller:'ai'` explore / ramasse / attaque un gardien battable /
> capture / construit / recrute puis passe son tour ; heuristique gloutonne de
> tutoriel (pas de magie ni de planif multi-tours — écart assumé). 3 scénarios
> solo en données (`data/scenarios/`).
