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
| **Terrain natif** | `grass` (forêt) |
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

> Stats **indicatives** (équilibrées finement au lot data via `faction:sim`, doc 09
> ligne 48). Profil : bas de gamme fragile & bon marché, milieu de gamme qui
> *tient*, haut de gamme cher et lent mais colossal une fois enraciné.

| Tier | Unité | PV | Att | Déf | Dégâts | Vit. | Croiss./sem | Coût | Capacités |
|------|-------|----|-----|-----|--------|------|-------------|------|-----------|
| 1 | **Lucine** (fée) | 4 | 2 | 1 | 1–2 | 6 | 16 | 30 or | `flying` |
| 2 | **Archer Sylvestre** | 9 | 4 | 3 | 2–4 | 5 | 9 | 80 or | `shooter(12)` |
| 3 | **Dryade** | 17 | 5 | 6 | 3–5 | 5 | 7 | 160 or | `symbiosis(atk +1, déf +1, max 4)` |
| 4 | **Loup d'Argent** | 28 | 8 | 6 | 5–8 | 8 | 5 | 320 or | `unlimitedRetaliation` |
| 5 | **Licorne** | 38 | 10 | 10 | 7–11 | 7 | 4 | 560 or + 1 cristal | `magicResistance(40 %)` |
| 6 | **Tréant** | 78 | 13 | 15 | 12–18 | 4 | 2 | 1200 or + 1 mercure | `taunt`, `symbiosis(atk +2, déf +2, max 4)` |
| 7 | **Aïeul de la Forêt** | 165 | 20 | 18 | 30–50 | 9 | 1 | 3000 or + 2 cristal + 2 mercure | `symbiosis(atk +2, déf +3, max 4)`, immunité au moral négatif |

## 4. Bâtiments spéciaux (2–3) + chaîne d'habitations

- **Chaîne d'habitations** : 7 dwellings (T1→T7), prérequis en escalier (hôtel de
  ville → dwelling T1 ; chaque tier requiert le précédent + Fort au-delà de T4),
  **identique au patron des 3 maisons** (données pures, `manifest.town.dwellings`).
- **Bâtiments propres (2)** :
  - **Bosquet du Cœur** (`heart-grove`) — bâtiment de croissance : +50 % de
    croissance hebdo des unités à `symbiosis` (effet de bâtiment **générique**
    `growthBonus` déjà existant, filtré par tier/dwelling — aucun code neuf).
  - **Cercle des Anciens** (`elders-circle`) — Guilde des mages thématisée
    (effet `mageGuild` existant) donnant priorité aux sorts `earth`/`water`.
- **Aucune ressource de faction propre** (choix de cadrage : Sylvan valide que la
  modularité tient *sans* rouvrir le point d'extension « ressource de faction »
  déjà prouvé par Essence — variété de preuve).

## 5. Classes de héros (2) + 2 héros nommés

- **Classes** : **Gardien** (Might — Commandement/Armure) et **Druide** (Magic —
  Sagesse/école earth-water). Dotation par défaut du contenu au 1ᵉʳ lot (comme les
  autres maisons ; héros nommés = chantier narratif doc 13).
- **Héros nommés (différés au lot narratif)** : *Faelar l'Écoutant* (Druide,
  spécialité : Symbiose démarre à 1 palier), *Sylwen Gardefronde* (Gardien,
  spécialité : +1 vitesse aux tireurs). Spécialités = **données** si/quand le point
  d'extension « héros nommés » est ouvert (différé, comme pour les 3 maisons).

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

Cadrage livré (ce document). Prochains lots : **5.2** lineup + dwellings + manifeste
+ locales (données pures, garde-fou faction vert, test de recrutement) ; **5.3**
point d'extension `symbiosis` (moteur générique + données qui l'exercent + tests) ;
**5.4** équilibrage `faction:sim` + finitions (assets procéduraux en repli).
