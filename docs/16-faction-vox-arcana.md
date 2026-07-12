# 16 — Nouvelle Maison : Vox Arcana (« la Voix Arcane »)

Faction #6, produite en **Beta** — elle sert de **test de modularité #4** (doc 06). Inspirations assumées : **académie de sorcellerie à l'anglaise** (Poudlard : maisons, château, baguettes, créatures magiques) × **chasseuses de démons pop** (KPop Demon Hunters / HUNTR/X : la scène, le chant, le Honmoon, l'oni coréen).

> 🚧 **État 16.0 (cadrage — identité verrouillée par les assets)** : la DA, le
> roster T1–T8, les 5 Maisons et les 2 héros nommés (Hermione, Rumi) sont figés
> par une base d'assets validée (planches d'unités, de blasons et d'avatars —
> `assets/prompts/faction-vox-arcana.md`). **Aucun code moteur ni donnée jouable
> à ce stade.** Le pari de modularité : la faction ne requiert qu'**UN** nouveau
> point d'extension moteur **générique** — l'**allégeance de Maison**
> (`houseAllegiance`) ; tout le reste **réutilise** des mécanismes déjà livrés
> pour Arcane Hunters (ressource de faction post-victoire, école de sorts propre,
> capacités génériques). Découpage en sous-lots data-only : cf.
> `.claude/plans/phase-16-faction-vox-arcana.md`.
>
> 🚧 **État 16.1 (livré — `houseAllegiance`, le point d'extension moteur)** : le
> **seul** diff moteur de la faction est ouvert. Les Maisons réutilisent le
> vocabulaire d'effets des compétences : à la création, `hero.houseEffects` est
> résolu depuis un catalogue embarqué (`StartGame.houseCatalog` + `startingHouseId`),
> puis **chaque** accesseur de `hero/skills.ts` additionne ces effets au même titre
> que les compétences (or/jour, mêlée/tir/armure, chance, moral, PM, vision, coût de
> mana **agnostique de l'école**). L'accesseur ne lit que `hero.houseEffects` ⇒
> **zéro** changement chez les consommateurs (combat/économie/mana) et **zéro nom de
> faction** (garde-fou CI vert). Contenu : `houseSchema` + `manifest.houses[]` +
> `buildHouseCatalog`. Sauvegarde v9→**v10** (`houseId`/`houseEffects`), golden
> re-fixé (forme seule). **Différé (16.2)** : câblage client (`houseCatalog`/
> `startingHouseId` vers `StartGame`) + données `data/factions/vox-arcana/` — tant
> qu'ils n'existent pas, aucune Maison n'est active en jeu (jamais de crash).
>
> 🚧 **État 16.2 (livré — faction jouable + choix de Maison via « Le Choixpeau »)** :
> paquet `data/factions/vox-arcana/` complet (5 Maisons, lineup T1–T8, habitations,
> locales FR/EN ; `content:check`/`faction:validate` verts). **Choix de Maison =
> option B** (décision utilisateur) : 5 bâtiments **Choixpeau** exclusifs
> (`exclusiveGroup`, réutilisé des Cercles AH) portant l'effet **générique**
> `houseChoice { houseId }` — à la construction, les héros du propriétaire relèvent
> de la Maison (le moteur résout l'id opaque dans `GameState.houseCatalog` embarqué
> et applique ses effets déclaratifs comme des compétences ; **zéro nom de faction**).
> Client : `houseCatalog` passé à `StartGame` (3 sites) ; la sélection passe par
> l'écran de ville existant ; sprites/blasons/avatars auto-découverts (doc 12 §10).
> Save v10→**v11**, golden re-fixé. **Différé** : atteindre le Choixpeau in-game
> suppose une ville Vox Arcana (sélecteur de faction / scénario dédié = lot suivant) ;
> héritage des héros recrutés après le choix ; Résonance + École de la Scène.

> 🚧 **État 16.4 (livré — Résonance, ressource de faction)** : la **Résonance**
> (Honmoon) est branchée en **pur contenu**, sans aucun diff moteur — elle
> réutilise l'acquis Essence (doc 05) : `factionResources: [resonance]` +
> `factionBonuses: [gainFactionResourceOnVictory]` dans le manifeste, gain à
> chaque combat gagné, et **T8 Avatar du Honmoon gaté** par la ressource
> (coût de recrutement `40 Résonance`, comme le Pénitent gate par l'Essence).
> Locales FR/EN (`factionResource.resonance`). Test de contenu par signature
> (la faction qui déclare Maisons + ressource gagne la ressource et gate son T8),
> garde-fou « zéro faction » vert, golden inchangé (données de faction hors
> replay inline). **~~Différé~~ (levé en 16.10)** : génération de Résonance
> intra-combat (performeurs) ✅ ; École de la Scène (lot 16.5) ✅ + héros
> Hermione & Rumi (lot 16.6) ✅.

> 🚧 **État 16.10 (livré — F-RESON.2 : génération de Résonance intra-combat)** :
> UNE nouvelle surface de combat **générique** — la capacité `performer`
> (`{ resource, amount }`) : une pile performeuse crédite le joueur du héros de son
> camp de `amount` de sa ressource de faction **quand elle prend réellement son
> tour** (1×/round, gaté sur la première action ⇒ jamais sur Attendre ni sur le
> tour bonus de moral positif), **plafonné** au même cap que le gain post-victoire
> (helper `creditFactionResource` partagé avec F-RESON.1). No-op sans héros lié au
> camp (arène/gardien/garnison). Le moteur ne lit qu'un id de ressource opaque
> (garde-fou « zéro faction » vert). Données : **T1 Chœur** `+1/round`, **T4
> Chasseuse-Idole** `+2/round` (+ variantes élites). Cross-validation contenu (le
> `resource` d'un performeur doit être une ressource de faction déclarée). Event
> `StackResonated` → ligne de journal de combat (pas de toast). **Aucun état
> persisté ⇒ pas de bump de sauvegarde, golden inchangé.**

> 🚧 **État 16.11 (livré — F-BUILDEFF.6 : La Scène, production de Résonance)** :
> nouveau point d'extension moteur **générique** — l'effet de bâtiment
> `factionResourceIncome { resource, amount }` crédite chaque `DayStarted` une
> ressource de faction (`player.factionResources`, plafonnée au cap F-RESON.1),
> parallèle du `income` de ressources communes. Bâtiment **La Scène**
> (`vox-arcana-scene`, requiert Fort) : **+5 Résonance/jour** (data-driven,
> placeholder d'équilibrage). Cross-validation contenu (la ressource doit être
> déclarée au manifeste). Le moteur ne lit qu'un id opaque (garde-fou « zéro
> faction » vert). **Aucun état persisté nouveau ⇒ pas de bump de sauvegarde,
> golden inchangé.** (Le **Sanctuaire du Honmoon** du doc = habitation T8, déjà
> livrée `vox-arcana-dwelling-t8`.)

> 🚧 **État 16.5 (livré — École de la Scène)** : l'école de sorts propre de la
> faction est branchée en **pur contenu** (même mécanisme que `traque` d'Arcane
> Hunters), zéro diff moteur — les 4 sorts réutilisent les effets génériques
> existants : `spellSchool: "scene"` au manifeste + 4 sorts dans
> `data/core/spells.json` (Barrière du Honmoon = buff `defenseMod`, Chant de
> courage = buff `attackMod`, Dissonance = debuff `attackMod`, Rappel = `heal`),
> noms + textes d'ambiance FR/EN. Le client câble déjà les écoles de faction de
> façon générique (`SpellBook` ordonne l'école propre après les 5 universelles ;
> `game.ts` ajoute au pool de départ les sorts de `manifest.spellSchool`) ⇒ un
> héros Vox Arcana connaît les sorts de la Scène, un héros d'une autre faction
> non. `SPELL_SCHOOLS` (liste contrôlée de contenu, anti-typo) étendue de `scene`
> — un **nom d'école**, pas un id de faction (garde-fou vert). **Différé** :
> barrière de zone T8 / peur Sombral / renaissance Phénix (capacités de
> signature) + héros Hermione & Rumi (lot 16.6).

> 🚧 **État 16.6 (livré — avatars des héros)** : les avatars peints des deux
> héros nommés sont **stagés et intégrés** (doc 12 §10). Le client découvre les
> avatars par la **convention d'archétype** `heroes/<factionId>-<might|magic>`
> (comme toutes les factions) : Rumi (Might/Hunter) ⇒ `vox-arcana-might`,
> Hermione (Magic) ⇒ `vox-arcana-magic`. Zéro code, zéro donnée de manifeste
> (auto-découverte par le registre d'assets). **Différé** : l'**identité** des
> héros nommés en jeu (nom Hermione/Rumi, spécialité, Maison de départ) reste
> liée au **système de héros nommés du moteur**, non ouvert (différé pour toutes
> les factions) — les avatars ci-dessus le peuplent d'avance.
>
> 🚧 **État 16.7 (livré — F-HOUSES : effets de Maison town-scoped)** : le
> vocabulaire d'effets déclaratifs (`SkillRankEffect` / `heroEffectFields`) gagne
> **2 champs town-scoped** génériques — `garrisonGrowthPct` et `garrisonDefense` —
> pour rendre **Le Blaireau** conforme au doc (§3.1 : +20 % croissance hebdo, +2
> Déf garnison). Propagation **option B** (« le héros apporte sa Maison à la ville
> où il se tient ») : un point d'interprétation town-scoped unique,
> `townHouseField(heroes, ownerPlayerId, townPos, field)`, somme les effets de
> Maison/spécialité des héros du **propriétaire présents sur la tuile** de la
> ville. `garrisonGrowthPct` est replié dans `applyWeeklyGrowth`,
> `garrisonDefense` dans le bonus « murs » du siège (`handleCaptureTown`). Effet
> **intermittent** par conception (le héros doit être présent). Données : la
> Maison **house-badger** passe du placeholder `armorReductionPct:8` à
> `{ garrisonGrowthPct:20, garrisonDefense:2 }`. **Zéro nom de faction** (garde-fou
> vert : `townHouseField` ne lit que `hero.houseEffects`/`specialtyEffects`),
> **aucun bump de sauvegarde** (`houseEffects`, v10, porte déjà les effets), golden
> **inchangé** (le héros du golden n'a pas de Maison). **Toujours différés** : +2
> Attaque plate (Lion), accès aux malédictions (Serpent), +25 % mana max (Aigle),
> +50 % Résonance / Scène +1 Pouvoir (Venari) — non exprimables sans nouvelles
> surfaces moteur.
>
> 🚧 **État 16.8 (avatar stagé — Céleste, 3ᵉ héroïne nommée)** : **Céleste**, jeune
> chasseuse **Hunter/Might**, **protégée de Rumi**, rejoint la base d'assets. Thème
> **céleste / lumière stellaire** (chignon tressé argent-lavande, ornement étoile),
> distincte de sa mentore (violet néon) tout en partageant l'identité Venari
> (armure noir-et-violet, charm d'oni, lame néon). L'avatar est **stagé en avance**
> sous une clé nommée dédiée `heroes/vox-arcana-celeste` (auto-découverte par le
> registre d'assets), **exactement** comme Hermione/Rumi l'ont été avant leur slot.
> **Zéro code, zéro donnée de manifeste, zéro nom de faction dans le moteur.**
> **Différé** : affichage in-game — la convention d'archétype ne connaît que 2
> slots (`might`/`magic`, déjà pris par Rumi/Hermione), et l'**identité** des héros
> nommés reste liée au **système de héros nommés du moteur**, non ouvert (différé
> pour toutes les factions, cf. État 16.6). **Divergence assumée (doc 12 §7)** :
> l'avatar est **photoréaliste** (grimage d'une photo source), là où la DA de tous
> les autres avatars stagés est *painterly* — choix éditorial explicite pour ce
> personnage.
>
> 🚧 **État 16.9 (livré — format d'identité de héros + séparation canon/original)** :
> introduction d'un **format d'identité de héros nommé** *data-driven* dans la
> couche **content** (schéma `heroIdentitySchema`), **zéro diff moteur**. Chaque
> fiche `data/factions/<faction>/heroes/<id>.json` porte `name`/`bio` (@loc:),
> `archetype` (`might`/`magic`), `avatar` (clé du registre) + `avatarStyle`
> (`painterly`/`photoreal`, doc 12 §7), et surtout **`origin`** : le champ qui
> **sépare** les héros **`canon`** (issus d'un univers tiers — exige `source`, le
> nom de l'œuvre) des héros **`original`** (créations propres au jeu, éventuellement
> inspirées d'un vrai joueur — pas de `source`). Le manifeste déclare
> `heroes: [id]` (défaut `[]`) ; le loader charge/valide les fiches (id↔fichier,
> parité locale, `startingHouseId` connu) et les expose sur `FactionPack.heroes`,
> **filtrables par origine**. Vox Arcana peuple les 5 premières fiches : **Rumi**
> (canon, *KPop Demon Hunters*, might), **Hermione** (canon, *Harry Potter*, magic),
> **Céleste** (original, might), **Iris** (original, magic, Maison du Blaireau —
> `startingHouseId`, spécialité **défense / protection de ville**) et **Anastasia**
> (original, magic, Maison du Lion/Gryffondor, disciple d'Hermione, spécialité
> **offensive / attaque**). Avatars photoréalistes pour les originaux. **Non
> consommé par le moteur** (identité stagée en
> avance du système de héros nommés, toujours différé pour toutes les factions) :
> `specialty`/`startingHouseId` restent indicatifs. **Zéro nom de faction** (garde-fou
> vert), **aucun bump de sauvegarde** (rien en sauvegarde), golden **inchangé**.

## 1. Lore

L'**Académie Vox Arcana** occupe un château gothique dont les tours coréennes
veillent sur une faille par où les démons s'infiltrent depuis l'aube des temps.
On n'y apprend pas la magie pour elle-même : chaque élève sert le **Honmoon**, la
barrière tissée par le **chant** qui scelle les démons hors du monde. La voix y
est une arme au même titre que la baguette — les plus grandes élèves montent sur
scène autant qu'elles montent au front.

L'école répartit ses élèves en **cinq Maisons** selon leur vertu : le Lion
(courage), le Serpent (ambition), l'Aigle (savoir), le Blaireau (loyauté) et
**Venari** (la Maison de la Chasse, née de la tradition des chasseuses-idoles).
Leur crédo : *« Que la voix scelle ce que la lame ne peut trancher. »*

## 2. Identité de jeu

| | |
|---|---|
| **Fantasme joueur** | L'académie qui chante autant qu'elle incante : choisir sa Maison, monter la Résonance au combat et déchaîner les sorts de la Scène ; l'apprenti-choriste du T1 devient l'Avatar du Honmoon au T8 |
| **Style de jeu** | Polyvalent et modulaire : la **Maison** oriente la partie (offensive / économie / magie / défense / performance) ; armée équilibrée soutenue par les buffs de zone de l'École de la Scène |
| **Terrain natif** | Prairie / colline gothique — `grass` de la config au niveau des données (un terrain dédié reste optionnel) |
| **Ressources clés** | Cristal + Gemmes |
| **Ressource de faction** | **Résonance (Honmoon)** — gagnée au combat, dépensée pour le sommet (T8) et la Scène |
| **École de magie propre** | **École de la Scène** (barrière du Honmoon, chant de courage, dissonance, rappel) |
| **Couleurs / DA** | Pierre noire gothique + filigrane argent/or ; cyan électrique + magenta/violet néon ; glycine (wisteria) ; masque d'oni, pagodes, chouettes spectrales ; registre « scène/concert » (distinct du registre « traque » d'Arcane Hunters) |

## 3. Mécaniques uniques de faction

### 3.1 Les Cinq Maisons (signature — le point d'extension moteur)

À la création (héros / ville de départ), le joueur relève d'**une des cinq
Maisons**. Chaque Maison applique un **profil de bonus déclaratif** — jamais un
`if maison === …`, mais une table de modificateurs data-driven interprétée par un
mécanisme générique unique **`houseAllegiance`** (le seul nouveau point
d'extension moteur de la faction, cf. §8). Les valeurs réutilisent le
vocabulaire d'effets **déjà** existant (comme les compétences).

| Maison | Vertu | Bonus déclaratif (placeholder d'équilibrage) |
|--------|-------|-----------------------------------------------|
| **Le Lion** | Courage | +2 Attaque en mêlée, +1 Moral |
| **Le Serpent** | Ambition | +250 or/jour ; accès aux sorts de malédiction |
| **L'Aigle** | Savoir | +25 % mana max, −15 % coût de sort |
| **Le Blaireau** | Loyauté | +20 % croissance hebdo, +2 Défense en garnison *(town-scoped, **livré** 16.7)* |
| **Venari** *(HUNTR/X)* | Scène / Honmoon | +50 % de gain de Résonance ; buffs de l'École de la Scène +1 Pouvoir |

> **Effets exprimables vs différés (F-HOUSES, 16.7)** : les effets **town-scoped**
> du Blaireau sont livrés (`garrisonGrowthPct`/`garrisonDefense`, option B —
> §État 16.7). Les effets sans surface moteur restent **différés** et rendus par
> l'équivalent exprimable le plus proche dans les données : Lion `+2 Att mêlée` ≈
> `meleeDamagePct` ; Serpent « accès malédictions » non modélisé (or/jour seul) ;
> Aigle « +25 % mana max » non modélisé (−coût de sort seul) ; Venari Résonance/
> Scène non modélisés (tir/chance en attendant).
>
> Modularité : `houseAllegiance` est **générique** — n'importe quelle faction
> future peut déclarer ses propres « allégeances » (sous-écoles, ordres,
> serments) et leurs profils de bonus. Le moteur ne connaît que la clé de chaîne.

### 3.2 Résonance (Honmoon) — ressource de faction

La **Résonance** représente l'énergie du Honmoon nourrie par la performance.
Au cadrage, elle **réutilise à l'identique** le mécanisme de ressource de faction
livré pour l'Essence (Arcane Hunters, doc 05 §3.3) :

- Déclarée dans le manifeste (`factionResources`), affichée dans la barre de
  ressources, **plafonnée** — le cap (999) est désormais **appliqué au gain**
  (F-RESON.1 : estampillé par le loader sur le bonus de gain, plafonne le crédit
  post-victoire).
- **Gagnée** à chaque combat gagné (`gainFactionResourceOnVictory`), event +
  toast i18n.
- **Dépensée** au recrutement du **T8 Avatar du Honmoon** (comme l'Essence gate
  le Pénitent AH), et potentiellement en coût des habitations de la Scène.

> **F-RESON.2 ✅ (livré)** : la génération de Résonance **en cours de combat**
> par les unités « performeuses » — capacité de combat **générique** `performer`
> (`{ resource, amount }`) : quand une pile performeuse prend réellement son tour
> (1×/round, jamais sur Attendre ni sur le tour bonus de moral), elle crédite le
> joueur du héros de son camp de `amount` de la ressource, **plafonné** au même cap
> que le gain post-victoire (F-RESON.1). Zéro nom de faction dans le moteur (id de
> ressource opaque). Données : **T1 Chœur** (`+1/round`) et **T4 Chasseuse-Idole**
> (`+2/round`) + variantes élites. Event `StackResonated` → ligne de journal de
> combat (pas de toast, la barre de ressources montre la croissance). Aucun état
> persisté ⇒ pas de bump de sauvegarde, golden inchangé.

### 3.3 École de la Scène (école de sorts propre)

École de sorts de faction (`spellSchool: "scene"`, même mécanisme que `traque`
d'Arcane Hunters). Les sorts **réutilisent les effets de sort génériques
existants** (bouclier / buff / debuff / soin) — zéro nouveau moteur :

| Cercle | Sort | Effet (réutilise un effet générique) |
|--------|------|--------------------------------------|
| 1 | **Barrière du Honmoon** | Bouclier : la pile alliée subit −X % de dégâts (buff défensif temporaire) |
| 1 | **Chant de Courage** | Buff de masse : +Moral / +Attaque aux alliés (Pouvoir rounds) |
| 2 | **Dissonance** | Debuff : −Attaque / peur sur une pile ennemie (renforcé vs `demon`) |
| 3 | **Rappel** | Soin / relève une fraction des pertes d'une pile alliée |

## 4. Lineup d'unités (8 tiers, dosage Poudlard + hunter)

> Stats **placeholder d'équilibrage** (magnitudes calquées sur les factions
> existantes), à valider via `faction:sim`. Capacités listées = capacités
> **génériques déjà au moteur** (shooter, flying, spellcaster, noRetaliation…) ;
> les capacités de signature exotiques sont **différées** et notées comme telles
> (les unités combattent normalement en attendant, jamais de crash — discipline
> doc 05).

| Tier | Unité | Ancrage | PV | Att | Déf | Dégâts | Vit. | Cr./sem | Coût | Capacités |
|------|-------|---------|----|-----|-----|--------|------|---------|------|-----------|
| 1 | **Chœur d'apprentis** | élèves / chant | 5 | 3 | 2 | 1–2 | 4 | 14 | 34 or | `swarm` ; *(performeur : gain de Résonance — différé)* |
| 2 | **Duelliste** | défense contre les Forces du Mal | 10 | 5 | 3 | 2–4 | 5 | 9 | 100 or | `shooter(9)` (baguette) |
| 3 | **Hippogriffe** | créature Poudlard | 18 | 7 | 5 | 4–7 | 7 | 6 | 200 or | `flying` |
| 4 | **Chasseuse-Idole** | HUNTR/X | 33 | 10 | 8 | 7–11 | 6 | 4 | 450 or + 1 cristal | `shooter(7, noMeleePenalty)` ; *(performeur — différé)* |
| 5 | **Sombral** | créature Poudlard | 38 | 11 | 9 | 7–11 | 9 | 3 | 720 or | `flying`, `fear(20 %, 1 round)` |
| 6 | **Maître de Sortilèges** | professeur | 55 | 14 | 12 | 10–16 | 5 | 2 | 1150 or + 1 gemme | `spellcaster(Dissonance/Chant, ×2)` |
| 7 | **Phénix** | créature Poudlard | 142 | 19 | 17 | 22–34 | 11 | 1 | 2750 or + 2 gemmes | `flying`, `noRetaliation` ; *(renaissance — différé)* |
| 8 | **Avatar du Honmoon** | fusion scène+magie | 210 | 24 | 20 | 38–56 | 8 | 1 | 3600 or + 3 gemmes + **40 Résonance** | `flying`, `noRetaliation` ; *(spellcaster Barrière du Honmoon / barrière de zone au max de Résonance — différé)* |

> 📊 **DOC-STATS / CAP-DATAFIX (lot A1)** : la table ci-dessus est réalignée sur
> les **données livrées** (`data/factions/vox-arcana/units/`), équilibrées par
> `faction:sim` — celles-ci font foi pour les **stats** (décision design
> 2026-07-10 : PV/Att/Dégâts/coûts/munitions T1–T5,T7 ajustés). Pour les
> **capacités**, les docs font foi : l'Idole reçoit `noMeleePenalty` en données.
> L'Avatar conserve `flying`+`noRetaliation` (présents en données, budget de
> puissance figé par `faction:sim`) — divergence doc↔données tranchée **côté
> données** par prudence (ne pas nerfer un T8 livré) ; le `spellcaster(Barrière
> du Honmoon)` et la barrière de zone restent différés (doc 16 §7).

**Faiblesses assumées** (équilibre) : peu de dégâts bruts « canon » avant le T6 ;
la faction paie sa polyvalence par l'absence d'un tueur de pile précoce — elle
gagne par l'usure, les buffs de la Scène et le bon choix de Maison.

> **Unités élites** (habitation niveau 2, façon doc 05 §4bis) : **livrées**
> (F-ELITEVOX) — les 8 habitations sont désormais `maxLevel:2`, leur niveau 2
> débloque la variante élite (`t*-*-elite`) recrutable et l'**upgrade** base→élite
> (mécanisme générique 4.11, dérivé du dwelling gradué). Stats **placeholder
> d'équilibrage** (~1,25-1,3× la base, capacités conservées/renforcées) — affinage
> via `faction:sim` ultérieur. Pur contenu, zéro diff moteur.

## 5. Arbre de bâtiments

Bâtiments communs : cf. doc 02 §4.1 (skins « académie gothique »). Spécifiques :

| Bâtiment | Prérequis | Effet |
|----------|-----------|-------|
| **Le Choixpeau** | Hôtel de ville | Débloque le **choix de Maison** de la ville (signature `houseAllegiance`) |
| **La Scène (Amphithéâtre)** | Fort | Production de **Résonance** (+5/jour, plafonné) — livré F-BUILDEFF.6 |
| **La Grande Bibliothèque** | — | Guilde des mages (accès aux sorts, dont l'École de la Scène) |
| **Sanctuaire du Honmoon** | Habitation T7 + Château | Habitation **T8** (Avatar du Honmoon ; coût en Résonance) |

Chaîne d'habitations (T1→T8) :

```
Fort ─► T1 Dortoirs ─► T2 Salle de Duel ─► T3 Volière ─► T4 Scène des Idoles
                 │
        Bibliothèque ─► T5 Écurie des Ombres ─► T6 Cabinet des Maîtres
                                                        │
                                          T7 Nid du Phénix
                                                        │  (+ Château)
                                          T8 Sanctuaire du Honmoon
```

## 6. Héros nommés

| Héros | Base | Classe | Maison | Attributs (A/D/P/S) | Compétences de départ | Spécialité (placeholder) |
|-------|------|--------|--------|---------------------|------------------------|--------------------------|
| **Hermione** | Poudlard | **Magic** | L'Aigle | 10/10/25/25 | Sagesse N, École de la Scène N | Sorts de la Scène −1 coût de mana |
| **Rumi** | HUNTR/X | **Might / Hunter** | Venari | 30/15/10/15 | Attaque N, Commandement N | +25 % de gain de Résonance |

> Les spécialités raffinées (barrière renforcée, performance de groupe) suivront
> avec le câblage de la génération de Résonance intra-combat.

> **Avatars (lot 16.6, livré)** : les portraits peints sont stagés sous la
> convention d'archétype du client — Hermione ⇒ `assets/heroes/vox-arcana-magic.png`,
> Rumi ⇒ `assets/heroes/vox-arcana-might.png` (auto-découverte, zéro code). Leur
> **identité nommée** en jeu reste différée avec le système de héros nommés du
> moteur.

## 7. Résumé des points d'extension (test de modularité #4)

| Besoin | Mécanisme du framework (doc 06) | État |
|--------|--------------------------------|------|
| **Allégeance de Maison** | **NOUVEAU** point générique `houseAllegiance` (profil de bonus déclaratif choisi par héros/ville) ; étendu en 16.7 par 2 effets **town-scoped** (`garrisonGrowthPct`/`garrisonDefense`, option B) | **livré** (16.1 héros-scoped + 16.7 town-scoped) |
| Résonance | ressource **de faction** (`factionResources` + `gainFactionResourceOnVictory`) — **réutilise** l'acquis Essence (doc 05) | réutilisé |
| École de la Scène | `spellSchool` propre + effets de sort génériques (bouclier/buff/debuff/soin) — **réutilise** | réutilisé |
| Lineup / capacités | capacités génériques (`shooter`, `flying`, `spellcaster`, `noRetaliation`, `swarm`) — **réutilise** | réutilisé |
| Génération de Résonance en combat (performeurs) | nouvelle surface (gain intra-combat) — **différée** | différé |
| Barrière du Honmoon (T8) / renaissance (Phénix) | capacités de signature — **différées** | différé |
| Peur (Sombral) | capacité générique `fear` (frappe ⇒ chance de faire sauter le tour, réutilise `immobilizedRounds`) — **livrée** (CAP-MORAL) | livré |

> Objectif de modularité tenu : **une** faction complète = **un** nouveau point
> d'extension **générique** + des **données**. Le garde-fou CI « zéro nom de
> faction dans le moteur » doit rester vert à chaque sous-lot.
