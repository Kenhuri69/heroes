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
> replay inline). **Différé** : génération de Résonance intra-combat (performeurs)
> + École de la Scène (lot 16.5) + héros Hermione & Rumi (lot 16.6).

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
| **Le Blaireau** | Loyauté | +20 % croissance hebdo, +2 Défense en garnison |
| **Venari** *(HUNTR/X)* | Scène / Honmoon | +50 % de gain de Résonance ; buffs de l'École de la Scène +1 Pouvoir |

> Modularité : `houseAllegiance` est **générique** — n'importe quelle faction
> future peut déclarer ses propres « allégeances » (sous-écoles, ordres,
> serments) et leurs profils de bonus. Le moteur ne connaît que la clé de chaîne.

### 3.2 Résonance (Honmoon) — ressource de faction

La **Résonance** représente l'énergie du Honmoon nourrie par la performance.
Au cadrage, elle **réutilise à l'identique** le mécanisme de ressource de faction
livré pour l'Essence (Arcane Hunters, doc 05 §3.3) :

- Déclarée dans le manifeste (`factionResources`), affichée dans la barre de
  ressources, plafonnée.
- **Gagnée** à chaque combat gagné (`gainFactionResourceOnVictory`), event +
  toast i18n.
- **Dépensée** au recrutement du **T8 Avatar du Honmoon** (comme l'Essence gate
  le Pénitent AH), et potentiellement en coût des habitations de la Scène.

> **Différé (extension ultérieure, générique)** : la génération de Résonance
> **en cours de combat** par les unités « performeuses » (T1 Chœur, T4
> Chasseuse-Idole) — nouvelle surface (gain intra-combat) traitée après le
> data-only. En attendant, la Résonance se gagne à la victoire ; aucune unité ne
> crashe faute d'effet.

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
| 5 | **Sombral** | créature Poudlard | 38 | 11 | 9 | 7–11 | 9 | 3 | 720 or | `flying` ; *(peur — différé)* |
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

> **Unités élites** (habitation niveau 2, façon doc 05 §4bis) : différées au
> lot d'équilibrage — chaque habitation se graduera au niveau 2 pour débloquer
> la variante élite, base et élite recrutables.

## 5. Arbre de bâtiments

Bâtiments communs : cf. doc 02 §4.1 (skins « académie gothique »). Spécifiques :

| Bâtiment | Prérequis | Effet |
|----------|-----------|-------|
| **Le Choixpeau** | Hôtel de ville | Débloque le **choix de Maison** de la ville (signature `houseAllegiance`) |
| **La Scène (Amphithéâtre)** | Fort | Production / bonus de **Résonance** |
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
| **Allégeance de Maison** | **NOUVEAU** point générique `houseAllegiance` (profil de bonus déclaratif choisi par héros/ville) | à livrer (le seul diff moteur de la faction) |
| Résonance | ressource **de faction** (`factionResources` + `gainFactionResourceOnVictory`) — **réutilise** l'acquis Essence (doc 05) | réutilisé |
| École de la Scène | `spellSchool` propre + effets de sort génériques (bouclier/buff/debuff/soin) — **réutilise** | réutilisé |
| Lineup / capacités | capacités génériques (`shooter`, `flying`, `spellcaster`, `noRetaliation`, `swarm`) — **réutilise** | réutilisé |
| Génération de Résonance en combat (performeurs) | nouvelle surface (gain intra-combat) — **différée** | différé |
| Barrière du Honmoon (T8) / renaissance (Phénix) / peur (Sombral) | capacités de signature — **différées** | différé |

> Objectif de modularité tenu : **une** faction complète = **un** nouveau point
> d'extension **générique** + des **données**. Le garde-fou CI « zéro nom de
> faction dans le moteur » doit rester vert à chaque sous-lot.
