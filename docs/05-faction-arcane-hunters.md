# 05 — Nouvelle Maison : Arcane Hunters (Les Chasseurs Arcanes)

Faction inédite, produite en **Alpha** — elle sert de validation grandeur nature du système de modularité (doc 06). Inspirations assumées : **académie de magie à l'anglaise** (maisons, tours, bibliothèques vivantes, familiers) × **Demon Hunter** (traque, marques, sacrifice, arsenal anti-démon).

## 1. Lore

L'**Académie de Sombreveille** fut fondée sur les ruines d'un portail démoniaque scellé. Ses élèves n'apprennent pas la magie pour la contempler : chaque diplôme est un permis de chasse. Répartis en **quatre Cercles** (Vigile, Traque, Sceau, Abîme), les Chasseurs Arcanes étudient l'ennemi jusqu'à lui ressembler — les plus grands d'entre eux greffent des reliques démoniaques sur leur propre corps. Leur crédo : *« Connaître, marquer, abattre. »*

L'Académie est officiellement neutre… mais considère toute armée trop puissante comme un « spécimen d'étude ».

## 2. Identité de jeu

| | |
|---|---|
| **Fantasme joueur** | L'école de chasseurs de monstres : marquer une cible et voir toute l'armée fondre dessus ; l'élève discret du T1 devient l'hybride démoniaque du T8 |
| **Style de jeu** | Tempo et assassinat de piles clés (« burst la cible marquée »), armée d'élite peu nombreuse, fragile si le combat s'éternise |
| **Terrain natif** | Lande brumeuse |
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

### 3.3 Contrat de chasse (économie alternative)

Chaque semaine, le **Tableau des Contrats** (bâtiment) propose 1 cible neutre sur la carte (« Abattez les Griffons du col Nord »). La remplir avant la fin de la semaine rapporte or + **Essence** (monnaie interne de faction servant aux améliorations d'unités et au T8). L'Essence remplace une partie du besoin en ressources rares : la faction est conçue pour **vivre de ses combats**, pas de ses mines.

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
| 7 | **Manticore de Dressage** | 130 | 18 | 16 | 24–36 | 11 | 1* | 2600 or + 2 mercure + 1 gemme | `flying`, `noRetaliation`, `mark`, `poisonSting` |
| 8 | **Pénitent Démonique** (chasseur hybride) | 210 | 24 | 18 | 40–60 | 7 | 1* | 3800 or + 3 gemmes + 40 Essence | `demonform` : commence en forme humaine (`magicResistance(50 %)`), bascule 1×/combat en forme démon (+50 % dégâts, `areaAttack(cône)`, mais perd la résistance) ; `devourMarks` (consomme toutes les Marques du champ de bataille : +2 % dégâts chacune, se soigne d'autant) |

\* T7 et T8 partagent 1 croissance/semaine (`sharedGrowthGroup: "apex"`), le joueur choisit.

**Faiblesses assumées** (pour l'équilibre) : croissance totale la plus faible du jeu, T1–T2 très fragiles, aucune capacité de soin/résurrection de masse — si la cible marquée ne meurt pas, la faction perd l'échange.

## 5. Arbre de bâtiments

Bâtiments communs : cf. doc 02 §4.1 (skins « académie »). Spécifiques :

| Bâtiment | Coût | Prérequis | Effet |
|----------|------|-----------|-------|
| **Tableau des Contrats** | 800 or, 5 bois | Taverne | Contrats de chasse hebdomadaires (or + Essence) |
| **Grand Amphithéâtre** | 2000 or, 10 minerai | Guilde des mages 1 | Choix du **Cercle** de la ville (cf. §3.2) |
| **Salle des Reliques** | 1600 or, 3 mercure | Grand Amphithéâtre | Héros visiteurs : sorts de Traque +1 cercle d'accès ; +1 slot d'artefact « trophée » |
| **Bâtiment de Cercle** | variable | Grand Amphithéâtre | 1 des 4 exclusifs selon le Cercle choisi |
| **Portail de l'Abîme Scellé** | 4000 or, 3 gemmes, 3 mercure, 60 Essence | Habitation T7 + Château | Habitation T8 (Pénitent Démonique) |

Chaîne d'habitations :

```
Fort ──► T1 Dortoirs ──► T2 Volière ──► T3 Salle des Préfets ──► T4 Grande Bibliothèque
                                │                                      │
                    Guilde des mages 1 ──► T5 Salle d'Armes ──► T6 Pavillon de Chasse
                                                                       │
                                              T7 Fauconnerie Royale ◄──┴──► T8 Portail de l'Abîme Scellé
                                                        (croissance partagée « apex »)
```

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
| 8ᵉ tier à croissance partagée | donnée `sharedGrowthGroup` (générique, déjà dans le schéma) |
| Marques | capacité générique `mark` + module `consumeMarks` (registre de capacités) |
| Essence | ressource **de faction** déclarée dans le manifeste (`factionResources`) |
| Choix de Cercle | mécanisme générique `exclusiveBuildingChoice` (déjà requis par les villes HoMM classiques) |
| Contrats de chasse | module de faction `hooks/onWeekStart.ts` (hook d'aventure) |
| Forme démon du T8 | module de capacité `demonform` (transformation stateful) |
